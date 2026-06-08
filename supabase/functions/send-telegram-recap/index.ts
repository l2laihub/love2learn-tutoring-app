/**
 * Edge Function: Send Weekly Telegram Recap
 *
 * Invoked two ways:
 *  - Scheduled: pg_net from send_weekly_tutor_recaps() with { tutor_id, week_start }.
 *  - Preview: app via functions.invoke with { tutor_id, preview: true }.
 *
 * Gathers the tutor's classes (Sun–Fri) and payments, formats a Telegram message,
 * and sends it. Scheduled sends are logged for idempotency; previews are not.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import {
  calculateLessonAmount,
  buildRecapMessage,
  type RecapLesson,
} from './recap.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-app-name',
};

const SUBJECT_LABELS: Record<string, string> = {
  piano: '🎹 Piano',
  math: '📐 Math',
  reading: '📖 Reading',
  speech: '🗣️ Speech',
  english: '📝 English',
};
const subjectLabel = (s: string) =>
  SUBJECT_LABELS[s] ?? `📚 ${s.charAt(0).toUpperCase()}${s.slice(1)}`;

interface RecapRequest {
  tutor_id: string;
  week_start?: string;        // 'YYYY-MM-DD' Sunday; required for scheduled sends
  preview?: boolean;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (!supabaseUrl || !serviceKey) throw new Error('Supabase env not configured');
    if (!botToken) throw new Error('TELEGRAM_BOT_TOKEN not configured');

    const { tutor_id, week_start, preview = false }: RecapRequest = await req.json();
    if (!tutor_id) {
      return json({ error: 'tutor_id is required' }, 400);
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Tutor + link status + rates.
    //    NOTE: tutor_id here is a parents.id. tutor_settings, however, is keyed
    //    by the auth user id (= parents.user_id), so we fetch user_id too.
    const { data: tutor, error: tutorErr } = await supabase
      .from('parents')
      .select('id, user_id, telegram_chat_id, telegram_recap_enabled, timezone')
      .eq('id', tutor_id)
      .single();
    if (tutorErr || !tutor) return json({ error: 'Tutor not found' }, 404);

    if (!tutor.telegram_chat_id || tutor.telegram_recap_enabled === false) {
      return json({ success: true, skipped: true, reason: 'not linked or disabled' }, 200);
    }

    // tutor_settings.tutor_id references auth.users(id), not parents(id) — key by user_id.
    const { data: settings } = await supabase
      .from('tutor_settings')
      .select('default_rate, default_base_duration, subject_rates, combined_session_rate')
      .eq('tutor_id', tutor.user_id)
      .maybeSingle();

    // 2. Resolve the Sun..Fri window.
    const { weekStartDate, weekEndExclusive, rangeLabel } = resolveWindow(
      week_start,
      tutor.timezone || 'America/Los_Angeles',
    );

    // 3. Classes in window (all statuses), joined to students.
    const { data: lessonRows } = await supabase
      .from('scheduled_lessons')
      .select('id, subject, scheduled_at, duration_min, status, override_amount, student:students!inner(name)')
      .eq('tutor_id', tutor_id)
      .gte('scheduled_at', `${weekStartDate}T00:00:00`)
      .lt('scheduled_at', `${weekEndExclusive}T00:00:00`)
      .order('scheduled_at', { ascending: true });

    const lessons: RecapLesson[] = (lessonRows ?? []).map((l: any) => ({
      date: new Date(l.scheduled_at).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
      studentName: l.student?.name ?? 'Student',
      subjectLabel: subjectLabel(l.subject),
      status: l.status,
    }));

    const expected = (lessonRows ?? []).reduce(
      (sum: number, l: any) =>
        sum +
        calculateLessonAmount(
          settings ?? null,
          l.subject,
          l.duration_min,
          false,
          l.override_amount,
        ),
      0,
    );

    // 4. Payments received in window (paid_at in range).
    const { data: receivedRows } = await supabase
      .from('payments')
      .select('amount_paid, paid_at')
      .eq('tutor_id', tutor_id)
      .gte('paid_at', `${weekStartDate}T00:00:00`)
      .lt('paid_at', `${weekEndExclusive}T00:00:00`);
    const received = (receivedRows ?? []).reduce(
      (s: number, p: any) => s + Number(p.amount_paid ?? 0),
      0,
    );

    // 5. Outstanding / overdue across all the tutor's payments.
    const { data: outstandingRows } = await supabase
      .from('payments')
      .select('amount_due, amount_paid, status')
      .eq('tutor_id', tutor_id)
      .in('status', ['unpaid', 'partial']);
    const outstanding = (outstandingRows ?? []).reduce(
      (s: number, p: any) => s + (Number(p.amount_due ?? 0) - Number(p.amount_paid ?? 0)),
      0,
    );

    // 6. Build + send.
    const text = buildRecapMessage({ rangeLabel, lessons, received, outstanding, expected });

    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: tutor.telegram_chat_id,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    const tgOk = tgRes.ok;
    const tgBody = await tgRes.json().catch(() => ({}));

    // 7. Log scheduled sends for idempotency (skip for previews).
    if (!preview) {
      await supabase
        .from('telegram_recap_log')
        .upsert(
          {
            tutor_id,
            week_start: weekStartDate,
            status: tgOk ? 'sent' : 'error',
            error: tgOk ? null : JSON.stringify(tgBody).slice(0, 500),
            sent_at: new Date().toISOString(),
          },
          { onConflict: 'tutor_id,week_start' },
        );
    }

    if (!tgOk) {
      return json({ error: 'Telegram send failed', details: tgBody }, 502);
    }
    return json({ success: true, preview, week_start: weekStartDate }, 200);
  } catch (error) {
    console.error('send-telegram-recap error:', error);
    return json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : String(error) },
      500,
    );
  }
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Resolve the Sun..Fri window. If weekStart (Sunday) is provided, use it.
// Otherwise compute from current date in the tutor's timezone (preview path).
function resolveWindow(
  weekStart: string | undefined,
  timeZone: string,
): { weekStartDate: string; weekEndExclusive: string; rangeLabel: string } {
  let sunday: Date;
  if (weekStart) {
    sunday = new Date(`${weekStart}T00:00:00`);
  } else {
    // "Today" in the tutor's tz → back up to the most recent Sunday.
    const nowLocal = new Date(
      new Date().toLocaleString('en-US', { timeZone }),
    );
    nowLocal.setHours(0, 0, 0, 0);
    sunday = new Date(nowLocal);
    sunday.setDate(nowLocal.getDate() - nowLocal.getDay()); // getDay(): 0 = Sunday
  }
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6); // exclusive end (covers Sun..Fri)
  const friday = new Date(sunday);
  friday.setDate(sunday.getDate() + 5);

  const fmtDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const fmtLabel = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return {
    weekStartDate: fmtDate(sunday),
    weekEndExclusive: fmtDate(saturday),
    rangeLabel: `${fmtLabel(sunday)}–${fmtLabel(friday)}`,
  };
}
