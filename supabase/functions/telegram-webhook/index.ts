/**
 * Edge Function: Telegram Webhook
 *
 * Telegram calls this directly (deploy with --no-verify-jwt). Protected by the
 * X-Telegram-Bot-Api-Secret-Token header matching TELEGRAM_WEBHOOK_SECRET.
 *
 * Handles:
 *  - /start <token>  → validate one-time token, link chat to the tutor.
 *  - /stop           → unlink the chat from any tutor.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

serve(async (req: Request) => {
  try {
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const webhookSecret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET');
    if (!botToken || !supabaseUrl || !serviceKey || !webhookSecret) {
      return new Response('not configured', { status: 500 });
    }

    // Reject forged calls. The secret header is the only gatekeeper since this
    // function is deployed with --no-verify-jwt, so enforce it unconditionally.
    if (req.headers.get('X-Telegram-Bot-Api-Secret-Token') !== webhookSecret) {
      return new Response('forbidden', { status: 403 });
    }

    const update = await req.json();
    const message = update.message ?? update.edited_message;
    const chatId: number | undefined = message?.chat?.id;
    const text: string = message?.text ?? '';
    const username: string | null = message?.from?.username ?? null;

    if (!chatId) return new Response('ok'); // ignore non-message updates

    const supabase = createClient(supabaseUrl, serviceKey);
    const reply = (t: string) => sendTelegram(botToken, chatId, t);

    const parts = text.trim().split(/\s+/);
    const command = (parts[0] ?? '').split('@')[0]; // strips @BotName suffix
    const arg = parts[1]?.trim();

    if (command === '/start') {
      const token = arg;
      if (!token) {
        await reply('👋 To connect, open the "Connect Telegram" button in the app.');
        return new Response('ok');
      }

      const nowIso = new Date().toISOString();
      const { data: claimed, error: claimErr } = await supabase
        .from('telegram_link_tokens')
        .update({ used_at: nowIso })
        .eq('token', token)
        .is('used_at', null)
        .gt('expires_at', nowIso)
        .select('tutor_id')
        .maybeSingle();

      if (claimErr) {
        console.error('token claim failed:', claimErr);
        await reply('⚠️ Something went wrong. Please tap "Connect Telegram" in the app again.');
        return new Response('ok');
      }
      if (!claimed) {
        await reply('⚠️ This link is invalid or expired. Please tap "Connect Telegram" in the app again.');
        return new Response('ok');
      }

      // Ensure one Telegram chat never feeds two tutors: clear it from any other
      // parents row that currently holds it before linking to the new tutor.
      await supabase
        .from('parents')
        .update({ telegram_chat_id: null, telegram_linked_at: null })
        .eq('telegram_chat_id', String(chatId))
        .neq('id', claimed.tutor_id);

      const { error: linkErr } = await supabase
        .from('parents')
        .update({
          telegram_chat_id: String(chatId),
          telegram_username: username,
          telegram_linked_at: nowIso,
          telegram_recap_enabled: true,
        })
        .eq('id', claimed.tutor_id);

      if (linkErr) {
        console.error('parents link failed:', linkErr);
        await reply('⚠️ Something went wrong connecting your account. Please try again from the app.');
        return new Response('ok');
      }

      await reply('✅ Connected! You\'ll get your weekly class & payment recap here every Saturday morning.');
      return new Response('ok');
    }

    if (command === '/stop') {
      await supabase
        .from('parents')
        .update({ telegram_chat_id: null, telegram_username: null, telegram_linked_at: null })
        .eq('telegram_chat_id', String(chatId));
      await reply('🔕 Disconnected. You won\'t receive weekly recaps. Reconnect anytime from the app.');
      return new Response('ok');
    }

    await reply('I send weekly recaps 📚. Use the app to connect, or /stop to disconnect.');
    return new Response('ok');
  } catch (error) {
    console.error('telegram-webhook error:', error);
    // Always 200 so Telegram doesn't hammer retries on our bugs.
    return new Response('ok');
  }
});

async function sendTelegram(botToken: string, chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
}
