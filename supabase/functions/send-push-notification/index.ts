/**
 * Edge Function: Send Push Notification
 *
 * Fired by a Postgres trigger (pg_net) AFTER INSERT on `notifications`.
 * Resolves the recipient's device tokens and sends an Expo push.
 * Isolated from email: failures are logged, never thrown to the caller.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import {
  buildExpoMessages,
  NotificationRecord,
  shouldSendPush,
} from './push.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Deployed with verify_jwt=false (the trigger's bearer is a non-JWT secret
    // key the gateway can't validate), so authenticate the internal pg_net call
    // here: the trigger sends the secret key as the bearer. This in-code check is
    // the ONLY gatekeeper — reject anything that doesn't match.
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const secretKey = Deno.env.get('EDGE_DISPATCH_SECRET') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const legacyKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !secretKey) return json({ error: 'not configured' }, 500);

    const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!(bearer.length > 0 && (bearer === secretKey || bearer === legacyKey))) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const payload = await req.json();
    // pg_net sends { record }; a dashboard webhook also nests under `record`.
    const record: NotificationRecord = payload.record ?? payload;

    if (!record?.recipient_id) {
      return json({ skipped: 'no recipient (broadcast not pushed)' });
    }

    const supabase = createClient(supabaseUrl, secretKey);

    // recipient_id is parents.id → get the auth user_id and preferences.
    const { data: parent } = await supabase
      .from('parents')
      .select('user_id, preferences')
      .eq('id', record.recipient_id)
      .single();

    if (!parent?.user_id) {
      return json({ skipped: 'recipient has no auth user' });
    }

    const prefs = parent.preferences?.notifications ?? null;
    if (!shouldSendPush(record.type, prefs)) {
      return json({ skipped: 'preference disabled' });
    }

    const { data: tokenRows } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', parent.user_id)
      .neq('platform', 'web');

    const tokens = (tokenRows ?? []).map((r: { token: string }) => r.token);
    if (tokens.length === 0) {
      return json({ skipped: 'no device tokens' });
    }

    const messages = buildExpoMessages(tokens, record);

    const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(expoAccessToken
          ? { Authorization: `Bearer ${expoAccessToken}` }
          : {}),
      },
      body: JSON.stringify(messages),
    });
    const result = await res.json();

    await pruneDeadTokens(supabase, tokens, result);

    return json({ sent: tokens.length, result });
  } catch (e) {
    console.error('[send-push-notification] error', e);
    // Return 200 so a push failure never blocks the originating action.
    return json({ error: String(e) }, 200);
  }
});

// Remove tokens Expo reports as DeviceNotRegistered.
// deno-lint-ignore no-explicit-any
async function pruneDeadTokens(
  supabase: ReturnType<typeof createClient<any, any, any>>,
  tokens: string[],
  expoResult: { data?: Array<{ status?: string; details?: { error?: string } }> },
) {
  const tickets = expoResult?.data;
  if (!Array.isArray(tickets)) return;

  const dead: string[] = [];
  tickets.forEach((ticket, i) => {
    if (
      ticket?.status === 'error' &&
      ticket?.details?.error === 'DeviceNotRegistered'
    ) {
      dead.push(tokens[i]);
    }
  });

  if (dead.length > 0) {
    await supabase.from('push_tokens').delete().in('token', dead);
  }
}
