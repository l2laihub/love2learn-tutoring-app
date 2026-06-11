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
  localDateStartToUtcISO,
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
    // Prefer the new-style secret key (sb_secret_…) for the privileged client AND
    // to authenticate internal pg_net dispatches; fall back to the legacy
    // service-role JWT during migration. Deployed with verify_jwt=false, so the
    // in-code bearer check below is the gatekeeper for internal (cron) calls.
    const secretKey = Deno.env.get('EDGE_DISPATCH_SECRET') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const legacyKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (!supabaseUrl || !secretKey) throw new Error('Supabase env not configured');
    if (!botToken) throw new Error('TELEGRAM_BOT_TOKEN not configured');

    const { tutor_id, week_start, preview = false }: RecapRequest = await req.json();

    // Service-role client for all data queries (must bypass RLS to read across
    // the tutor's students/payments).
    const supabase = createClient(supabaseUrl, secretKey);

    // Determine the caller and resolve the effective request parameters.
    //  - Internal (cron via pg_net): Authorization is the service-role key. Trust
    //    the body (tutor_id required, week_start + preview as provided).
    //  - Non-internal (app preview): identify the caller via their JWT and force a
    //    preview of their OWN current recap, ignoring any body tutor_id.
    const authHeader = req.headers.get('Authorization') ?? '';
    const bearer = authHeader.replace(/^Bearer\s+/i, '');
    const isInternal = bearer.length > 0 && (bearer === secretKey || bearer === legacyKey);

    let effectiveTutorId: string;
    let effectiveWeekStart: string | undefined;
    let effectivePreview: boolean;

    if (isInternal) {
      if (!tutor_id) {
        return json({ error: 'tutor_id is required' }, 400);
      }
      effectiveTutorId = tutor_id;
      effectiveWeekStart = week_start;
      effectivePreview = preview;
    } else {
      if (!anonKey) throw new Error('SUPABASE_ANON_KEY not configured');
      const authClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      // getUser() must be given the JWT explicitly: with no argument it reads the
      // token from the client's stored session, but this server-side client has
      // none, so it would fail with AuthSessionMissingError and 401 every time.
      const token = authHeader.replace(/^Bearer\s+/i, '');
      const { data: userData, error: userErr } = await authClient.auth.getUser(token);
      if (userErr || !userData?.user) {
        return json({ error: 'Unauthorized' }, 401);
      }
      // Resolve this user's parents row (tutors live in parents).
      const { data: ownRow, error: ownErr } = await supabase
        .from('parents')
        .select('id')
        .eq('user_id', userData.user.id)
        .maybeSingle();
      if (ownErr || !ownRow) {
        return json({ error: 'No tutor profile for caller' }, 403);
      }
      // A user may only preview their own current recap.
      effectiveTutorId = ownRow.id;
      effectivePreview = true;
      effectiveWeekStart = undefined;
    }

    // 1. Tutor + link status + rates.
    //    NOTE: tutor_id here is a parents.id. tutor_settings, however, is keyed
    //    by the auth user id (= parents.user_id), so we fetch user_id too.
    const { data: tutor, error: tutorErr } = await supabase
      .from('parents')
      .select('id, user_id, telegram_chat_id, telegram_recap_enabled, timezone')
      .eq('id', effectiveTutorId)
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
    const tz = tutor.timezone || 'America/Los_Angeles';
    const { weekStartDate, weekEndExclusive, rangeLabel } = resolveWindow(
      effectiveWeekStart,
      tz,
    );

    // scheduled_at / paid_at are TIMESTAMPTZ. PostgREST compares naive timestamps
    // in the DB's UTC session tz, so convert the tutor-local date boundaries to
    // absolute UTC instants before filtering, or the window shifts by the offset.
    const startUtc = localDateStartToUtcISO(weekStartDate, tz);
    const endUtc = localDateStartToUtcISO(weekEndExclusive, tz);

    // 3. Classes in window (all statuses), joined to students.
    const { data: lessonRows, error: lessonsErr } = await supabase
      .from('scheduled_lessons')
      .select('id, subject, scheduled_at, duration_min, status, override_amount, auto_completed_at, payment_lessons(paid), student:students!inner(name)')
      .eq('tutor_id', effectiveTutorId)
      .gte('scheduled_at', startUtc)
      .lt('scheduled_at', endUtc)
      .order('scheduled_at', { ascending: true });

    const lessons: RecapLesson[] = (lessonRows ?? []).map((l: any) => ({
      // Format in the tutor's timezone: the function runs in UTC, so omitting
      // timeZone would shift evening lessons onto the wrong day.
      date: new Date(l.scheduled_at).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        timeZone: tz,
      }),
      studentName: l.student?.name ?? 'Student',
      subjectLabel: subjectLabel(l.subject),
      status: l.status,
      // No payment_lessons rows → prepaid-covered or not yet invoiced → no
      // paid/unpaid marker. Rows present: any paid → 💵, none paid → ⚠️.
      paid:
        Array.isArray((l as any).payment_lessons) && (l as any).payment_lessons.length > 0
          ? (l as any).payment_lessons.some((pl: any) => pl.paid === true)
          : undefined,
    }));

    const autoMarked = (lessonRows ?? []).filter((l: any) => l.auto_completed_at != null).length;

    const expected = (lessonRows ?? [])
      .filter((l: any) => l.status !== 'cancelled')
      .reduce(
        (sum: number, l: any) =>
          sum +
          calculateLessonAmount(
            settings ?? null,
            l.subject,
            Number(l.duration_min) || 0,
            false,
            l.override_amount == null ? null : Number(l.override_amount),
          ),
        0,
      );

    // 4. Payments received in window (paid_at in range).
    const { data: receivedRows, error: receivedErr } = await supabase
      .from('payments')
      .select('amount_paid, paid_at')
      .eq('tutor_id', effectiveTutorId)
      .gte('paid_at', startUtc)
      .lt('paid_at', endUtc);
    const received = (receivedRows ?? []).reduce(
      (s: number, p: any) => s + (Number(p.amount_paid ?? 0) || 0),
      0,
    );

    // 5. Outstanding / overdue across all the tutor's payments.
    const { data: outstandingRows, error: outstandingErr } = await supabase
      .from('payments')
      .select('amount_due, amount_paid, status')
      .eq('tutor_id', effectiveTutorId)
      .in('status', ['unpaid', 'partial']);
    const outstanding = (outstandingRows ?? []).reduce(
      (s: number, p: any) =>
        s + ((Number(p.amount_due ?? 0) || 0) - (Number(p.amount_paid ?? 0) || 0)),
      0,
    );

    // A transient query error must NOT produce a misleading "$0 / quiet week"
    // recap that then gets logged as 'sent' and suppresses the corrected
    // resend. Fail loudly instead; the next hourly cron run will retry.
    if (lessonsErr || receivedErr || outstandingErr) {
      if (lessonsErr) console.error('recap lessons query failed:', lessonsErr);
      if (receivedErr) console.error('recap received-payments query failed:', receivedErr);
      if (outstandingErr) console.error('recap outstanding-payments query failed:', outstandingErr);
      const failed = [
        lessonsErr && 'lessons',
        receivedErr && 'received_payments',
        outstandingErr && 'outstanding_payments',
      ].filter(Boolean);
      return json({ error: 'Failed to gather recap data', details: failed }, 502);
    }

    // 6. Build + send.
    const text = buildRecapMessage({ rangeLabel, lessons, received, outstanding, expected, autoMarked });

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
    if (!effectivePreview) {
      await supabase
        .from('telegram_recap_log')
        .upsert(
          {
            tutor_id: effectiveTutorId,
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
    return json({ success: true, preview: effectivePreview, week_start: weekStartDate }, 200);
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
