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
    if (!botToken || !supabaseUrl || !serviceKey) {
      return new Response('not configured', { status: 500 });
    }

    // Reject forged calls.
    if (
      webhookSecret &&
      req.headers.get('X-Telegram-Bot-Api-Secret-Token') !== webhookSecret
    ) {
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

    if (text.startsWith('/start')) {
      const token = text.split(' ')[1]?.trim();
      if (!token) {
        await reply('👋 To connect, open the "Connect Telegram" button in the app.');
        return new Response('ok');
      }

      const { data: row } = await supabase
        .from('telegram_link_tokens')
        .select('tutor_id, used_at, expires_at')
        .eq('token', token)
        .maybeSingle();

      if (!row || row.used_at || new Date(row.expires_at) < new Date()) {
        await reply('⚠️ This link is invalid or expired. Please tap "Connect Telegram" in the app again.');
        return new Response('ok');
      }

      await supabase
        .from('parents')
        .update({
          telegram_chat_id: String(chatId),
          telegram_username: username,
          telegram_linked_at: new Date().toISOString(),
          telegram_recap_enabled: true,
        })
        .eq('id', row.tutor_id);

      await supabase
        .from('telegram_link_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('token', token);

      await reply('✅ Connected! You\'ll get your weekly class & payment recap here every Saturday morning.');
      return new Response('ok');
    }

    if (text.startsWith('/stop')) {
      await supabase
        .from('parents')
        .update({ telegram_chat_id: null, telegram_linked_at: null })
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
