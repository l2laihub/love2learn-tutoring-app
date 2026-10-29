/**
 * Edge Function: Delete Account
 *
 * Permanently deletes the signed-in user's account
 * (App Store Guideline 5.1.1(v), Google Play account deletion policy).
 *
 * Flow:
 *   1. Verify the caller's JWT.
 *   2. If the user has a Stripe subscription that can still bill, cancel it
 *      immediately. If that fails we stop, so nobody is charged for an
 *      account that no longer exists.
 *   3. Call public.delete_user_account() (service role only) to delete or
 *      unlink app data. See migration 20261029000001_delete_user_account.sql.
 *   4. Delete the auth user.
 *
 * Request body: { "confirm": "DELETE" }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-name',
};

const BILLABLE_STATUSES = new Set(['trialing', 'active', 'past_due', 'unpaid', 'incomplete']);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase environment variables are not configured');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Authorization header required' }, 401);
    }

    const body = await req.json().catch(() => ({}));
    if (body?.confirm !== 'DELETE') {
      return json({ error: 'Confirmation required' }, 400);
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const {
      data: { user },
      error: userError,
    } = await admin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) {
      return json({ error: 'Invalid authentication' }, 401);
    }

    // 1. Cancel any Stripe subscription that could still bill this user.
    const { data: records, error: recordsError } = await admin
      .from('parents')
      .select('id, stripe_subscription_id')
      .eq('user_id', user.id);
    if (recordsError) {
      throw new Error(`Could not load account: ${recordsError.message}`);
    }

    const subscriptionIds = (records ?? [])
      .map((r: { stripe_subscription_id: string | null }) => r.stripe_subscription_id)
      .filter((id: string | null): id is string => !!id);

    if (subscriptionIds.length > 0) {
      const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
      if (!stripeSecretKey) {
        throw new Error('STRIPE_SECRET_KEY is not configured, cannot cancel subscription');
      }
      const stripe = new Stripe(stripeSecretKey, {
        apiVersion: '2023-10-16',
        httpClient: Stripe.createFetchHttpClient(),
      });
      for (const subscriptionId of subscriptionIds) {
        try {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          if (BILLABLE_STATUSES.has(sub.status)) {
            await stripe.subscriptions.cancel(subscriptionId);
          }
        } catch (err) {
          // A subscription that no longer exists in Stripe cannot bill anyone.
          const code = (err as { code?: string })?.code;
          if (code !== 'resource_missing') {
            console.error('[delete-account] Stripe cancel failed:', err);
            return json(
              {
                error:
                  'We could not cancel your subscription, so your account was not deleted. Please try again or contact support@dalesson.app.',
              },
              502
            );
          }
        }
      }
    }

    // 2. Delete or unlink app data.
    const { data: result, error: rpcError } = await admin.rpc('delete_user_account', {
      p_user_id: user.id,
    });
    if (rpcError) {
      throw new Error(`Could not delete account data: ${rpcError.message}`);
    }

    // 3. Delete the login.
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      throw new Error(`Could not delete login: ${deleteError.message}`);
    }

    console.log('[delete-account] Deleted user', user.id, result);
    return json({ success: true });
  } catch (err) {
    console.error('[delete-account] Error:', err);
    return json(
      { error: 'Something went wrong while deleting your account. Please try again or contact support@dalesson.app.' },
      500
    );
  }
});
