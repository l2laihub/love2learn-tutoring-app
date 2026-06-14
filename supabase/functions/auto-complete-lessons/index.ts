/**
 * Edge Function: Auto-complete & auto-pay finished lessons for one tutor.
 *
 * Invoked two ways (same shape as send-telegram-recap):
 *  - Scheduled: pg_net from auto_complete_due_lessons() with { tutor_id }, using
 *    the service-role key as the bearer (isInternal -> trust the body).
 *  - "Run now": app via functions.invoke (user JWT) -> forced to the caller's own
 *    tutor_id.
 *
 * For each due `scheduled` lesson (end time passed) it replays the app's
 * "Complete & Mark as Paid" behavior: completes the lesson (+ prepaid session
 * increment), and for invoice subjects generates/extends the month's invoice and
 * marks it paid (the sync trigger then flips payment_lessons.paid).
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { calculateLessonAmount } from '../_shared/lessonAmount.ts';
import { prepaidCoverage } from '../_shared/prepaidCoverage.ts';
import {
  buildUncoveredPrepaidMessage,
  dueLessons,
  isSubjectPrepaid,
  type CandidateLesson,
} from './autocomplete.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-name',
};

// Only sweep lessons that started within this many days. Bounds the backlog the
// job will auto-complete when the toggle is first enabled; self-heal for missed
// cron runs still works for up to this many days.
const MAX_LESSON_AGE_DAYS = 7;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    // Privileged key for DB access AND the shared secret that authenticates internal
    // pg_net dispatches. Prefer the new-style secret key (sb_secret_…); fall back to
    // the legacy service-role JWT so either key keeps working during migration.
    // This function is deployed with verify_jwt=false (the gateway can't validate the
    // non-JWT secret key), so the in-code bearer check below is the ONLY gatekeeper
    // for internal cron calls — keep it strict.
    const secretKey = Deno.env.get('EDGE_DISPATCH_SECRET') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const legacyKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !secretKey) throw new Error('Supabase env not configured');

    const body = await req.json().catch(() => ({}));
    const supabase = createClient(supabaseUrl, secretKey);

    const authHeader = req.headers.get('Authorization') ?? '';
    const bearer = authHeader.replace(/^Bearer\s+/i, '');
    const isInternal = bearer.length > 0 && (bearer === secretKey || bearer === legacyKey);

    let effectiveTutorId: string;
    if (isInternal) {
      if (!body.tutor_id) return json({ error: 'tutor_id is required' }, 400);
      effectiveTutorId = body.tutor_id;
    } else {
      if (!anonKey) throw new Error('SUPABASE_ANON_KEY not configured');
      const token = authHeader.replace(/^Bearer\s+/i, '');
      const authClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userErr } = await authClient.auth.getUser(token);
      if (userErr || !userData?.user) return json({ error: 'Unauthorized' }, 401);
      const { data: ownRow, error: ownErr } = await supabase
        .from('parents').select('id').eq('user_id', userData.user.id).maybeSingle();
      if (ownErr || !ownRow) return json({ error: 'No tutor profile for caller' }, 403);
      effectiveTutorId = ownRow.id;
    }

    const summary = await processTutor(supabase, effectiveTutorId);
    return json({ success: true, tutor_id: effectiveTutorId, ...summary }, 200);
  } catch (error) {
    console.error('auto-complete-lessons error:', error);
    return json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : String(error) },
      500,
    );
  }
});

async function processTutor(supabase: SupabaseClient, tutorId: string) {
  const { data: tutor, error: tutorErr } = await supabase
    .from('parents')
    .select('id, user_id, timezone, auto_complete_lessons')
    .eq('id', tutorId)
    .single();
  if (tutorErr || !tutor) throw new Error('Tutor not found');
  if (tutor.auto_complete_lessons === false) {
    return { skipped: true, reason: 'disabled', completed: 0, invoiced: 0, paid: 0 };
  }

  // tutor_settings is keyed by auth user id (= parents.user_id), not parents.id.
  const { data: settings } = await supabase
    .from('tutor_settings')
    .select('default_rate, default_base_duration, subject_rates, combined_session_rate')
    .eq('tutor_id', tutor.user_id)
    .maybeSingle();

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const oldestIso = new Date(nowMs - MAX_LESSON_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Candidate lessons: this tutor's still-scheduled lessons that have already
  // started and are within the look-back window.
  const { data: rows, error: lessonsErr } = await supabase
    .from('scheduled_lessons')
    .select(
      'id, subject, scheduled_at, duration_min, session_id, override_amount, ' +
        'student:students!inner(id, name, parent_id, parent:parents!parent_id(id, billing_mode, prepaid_subjects))',
    )
    .eq('tutor_id', tutorId)
    .eq('status', 'scheduled')
    .lt('scheduled_at', nowIso)
    .gte('scheduled_at', oldestIso);
  if (lessonsErr) throw new Error(lessonsErr.message);

  const due = dueLessons((rows ?? []) as unknown as CandidateLesson[], nowMs, MAX_LESSON_AGE_DAYS);
  if (due.length === 0) return { completed: 0, invoiced: 0, paid: 0, parents: 0 };

  // 1. Complete each due lesson; collect (parent, month) pairs needing an invoice.
  const invoiceTargets = new Map<string, { parentId: string; monthStart: string; lessonIds: string[] }>();
  // Prepaid lessons we auto-completed but couldn't draw against (no package / exhausted).
  // A cron can't pop an Alert like the calendar UI, so we summarize these into one
  // in-app notification for the tutor below (mirrors calendar.tsx warnUncoveredPrepaid).
  const uncoveredPrepaid: { studentName: string; subject: string }[] = [];
  let completed = 0;
  for (const l of due) {
    const parent = l.student?.parent;
    if (!parent) continue;
    const subjectPrepaid = isSubjectPrepaid(parent.billing_mode, parent.prepaid_subjects, l.subject);

    // Status guard (eq status scheduled) makes this a no-op if something else
    // already completed/cancelled the lesson between the read and the write.
    const { data: updated, error: upErr } = await supabase
      .from('scheduled_lessons')
      .update({ status: 'completed', auto_completed_at: nowIso, updated_at: nowIso })
      .eq('id', l.id)
      .eq('status', 'scheduled')
      .select('id')
      .maybeSingle();
    if (upErr) { console.error('complete failed', l.id, upErr.message); continue; }
    if (!updated) continue; // already handled by someone else
    completed++;

    const monthStart = monthStartOf(l.scheduled_at);
    if (subjectPrepaid) {
      const coverage = await incrementPrepaid(supabase, parent.id, monthStart, l.subject, parent.prepaid_subjects ?? []);
      if (coverage === 'uncovered') {
        uncoveredPrepaid.push({ studentName: l.student?.name ?? 'A student', subject: l.subject });
      }
    } else {
      const key = `${parent.id}|${monthStart}`;
      const target = invoiceTargets.get(key) ?? { parentId: parent.id, monthStart, lessonIds: [] };
      target.lessonIds.push(l.id);
      invoiceTargets.set(key, target);
    }
  }

  // 2. Generate + settle one invoice per (parent, month).
  let invoiced = 0;
  let paid = 0;
  for (const { parentId, monthStart, lessonIds } of invoiceTargets.values()) {
    const payment = await generateInvoice(supabase, tutor.id, parentId, monthStart, settings);
    if (payment) {
      invoiced++;
      if (await settleRunLessons(supabase, payment.id, lessonIds)) paid++;
    }
  }

  // 3. Flag prepaid sessions that were auto-completed with nothing to draw from.
  // Reuses the existing 'general' notification_type (no enum change). Both recipient
  // AND tutor_id are the tutor's own parents.id: tutor_id scopes the row to this
  // business so the multi-tutor SELECT policy (tutor_id = get_current_tutor_id())
  // shows it only to this tutor — a NULL tutor_id would leak it to every tutor.
  // Best-effort: a failed notification must not fail the run.
  if (uncoveredPrepaid.length > 0) {
    const { title, message } = buildUncoveredPrepaidMessage(uncoveredPrepaid);
    const { error: notifErr } = await supabase.from('notifications').insert({
      recipient_id: tutor.id,
      tutor_id: tutor.id,
      type: 'general',
      priority: 'high',
      title,
      message,
      data: { kind: 'prepaid_uncovered', lessons: uncoveredPrepaid },
      action_url: '/payments',
    });
    if (notifErr) console.error('uncovered-prepaid notification failed', notifErr.message);
  }

  return { completed, invoiced, paid, parents: invoiceTargets.size, uncoveredPrepaid: uncoveredPrepaid.length };
}

// Port of useCompleteLesson's prepaid increment (useLessons.ts:644-696). Returns
// whether the lesson actually drew from a balance — 'uncovered' when there's no
// package or it's exhausted/over-drawn — so the caller can flag silently
// uncharged sessions (mirrors calendar.tsx warnUncoveredPrepaid).
async function incrementPrepaid(
  supabase: SupabaseClient,
  parentId: string,
  monthStart: string,
  subject: string,
  prepaidSubjects: string[],
): Promise<'covered' | 'uncovered'> {
  const lower = (prepaidSubjects ?? []).map((s) => s.toLowerCase());
  let { data: prepaid } = await supabase
    .from('payments')
    .select('id, sessions_used, sessions_prepaid')
    .eq('parent_id', parentId)
    .eq('month', monthStart)
    .eq('payment_type', 'prepaid')
    .eq('subject', subject)
    .maybeSingle();

  if (!prepaid && lower.length === 0) {
    const { data: legacy } = await supabase
      .from('payments')
      .select('id, sessions_used, sessions_prepaid')
      .eq('parent_id', parentId)
      .eq('month', monthStart)
      .eq('payment_type', 'prepaid')
      .is('subject', null)
      .maybeSingle();
    prepaid = legacy;
  }

  // No package for the month: nothing to increment, session goes uncharged.
  if (!prepaid) return 'uncovered';

  const newUsed = (prepaid.sessions_used || 0) + 1;
  await supabase
    .from('payments')
    .update({ sessions_used: newUsed, updated_at: new Date().toISOString() })
    .eq('id', prepaid.id);

  // Judge coverage on the POST-increment count, matching src/lib/prepaidCoverage.
  return prepaidCoverage({ sessions_used: newUsed, sessions_prepaid: prepaid.sessions_prepaid });
}

// Port of useQuickInvoice.generateQuickInvoice (usePayments.ts:1799-1992),
// keyed on a 'YYYY-MM-01' month string. Also stamps payments.tutor_id (the app's
// quickInvoice omits it; setting it keeps recap revenue queries accurate).
async function generateInvoice(
  supabase: SupabaseClient,
  tutorId: string,
  parentId: string,
  monthStart: string,
  settings: unknown,
) {
  const monthEnd = monthEndOf(monthStart);

  const { data: existingPayment } = await supabase
    .from('payments')
    .select('id, amount_due, status, payment_type')
    .eq('parent_id', parentId)
    .eq('month', monthStart)
    .eq('payment_type', 'invoice')
    .is('subject', null)
    .maybeSingle();

  const { data: parentRecord } = await supabase
    .from('parents').select('prepaid_subjects').eq('id', parentId).single();
  const prepaidSubjects: string[] = (parentRecord?.prepaid_subjects as string[]) || [];

  const { data: subjectPrepaidPayments } = await supabase
    .from('payments')
    .select('subject')
    .eq('parent_id', parentId)
    .eq('month', monthStart)
    .eq('payment_type', 'prepaid')
    .not('subject', 'is', null);

  const prepaidPaymentSubjects = new Set<string>([
    ...prepaidSubjects.map((s) => s.toLowerCase()),
    ...(subjectPrepaidPayments ?? [])
      .filter((p: { subject: string | null }) => p.subject !== null)
      .map((p: { subject: string | null }) => p.subject!.toLowerCase()),
  ]);

  const { data: students } = await supabase.from('students').select('id').eq('parent_id', parentId);
  if (!students || students.length === 0) return null;
  const studentIds = students.map((s: { id: string }) => s.id);

  const { data: lessons } = await supabase
    .from('scheduled_lessons')
    .select('id, student_id, subject, duration_min, session_id, override_amount')
    .in('student_id', studentIds)
    .eq('status', 'completed')
    .gte('scheduled_at', monthStart)
    .lte('scheduled_at', monthEnd + 'T23:59:59.999Z');
  if (!lessons || lessons.length === 0) return null;

  const { data: invoicedLessons } = await supabase
    .from('payment_lessons')
    .select('lesson_id')
    .in('lesson_id', lessons.map((l: { id: string }) => l.id));
  const invoicedIds = new Set((invoicedLessons ?? []).map((il: { lesson_id: string }) => il.lesson_id));

  const uninvoiced = lessons.filter(
    (l: { id: string; subject: string }) =>
      !invoicedIds.has(l.id) && !prepaidPaymentSubjects.has(l.subject.toLowerCase()),
  );
  if (uninvoiced.length === 0) return null;

  const lessonAmounts = uninvoiced.map((l: any) => ({
    lesson_id: l.id,
    // Raw, unrounded amount — matches useQuickInvoice (usePayments.ts:1902-1917).
    // The total is rounded once below; per-link amounts are rounded at insert time.
    amount: calculateLessonAmount(
      (settings as any) ?? null,
      l.subject,
      Number(l.duration_min) || 0,
      l.session_id !== null,
      l.override_amount == null ? null : Number(l.override_amount),
    ),
  }));
  const roundedTotal = Math.round(lessonAmounts.reduce((s: number, l: { amount: number }) => s + l.amount, 0) * 100) / 100;

  let payment;
  if (existingPayment) {
    const newAmountDue = Math.round((existingPayment.amount_due + roundedTotal) * 100) / 100;
    const newStatus = existingPayment.status === 'paid' ? 'unpaid' : existingPayment.status;
    const { data: updatedPayment, error: updateError } = await supabase
      .from('payments')
      .update({ amount_due: newAmountDue, status: newStatus, notes: `Updated: added ${uninvoiced.length} new lesson(s)` })
      .eq('id', existingPayment.id)
      .select()
      .single();
    if (updateError) throw new Error(updateError.message);
    payment = updatedPayment;
  } else {
    const { data: newPayment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        parent_id: parentId,
        month: monthStart,
        amount_due: roundedTotal,
        amount_paid: 0,
        status: 'unpaid',
        payment_type: 'invoice',
        tutor_id: tutorId,
        notes: `Auto invoice for ${uninvoiced.length} lesson(s)`,
      })
      .select()
      .single();
    if (paymentError) throw new Error(paymentError.message);
    payment = newPayment;
  }

  const links = lessonAmounts.map((la: { lesson_id: string; amount: number }) => ({
    payment_id: payment.id,
    lesson_id: la.lesson_id,
    amount: Math.round(la.amount * 100) / 100,
  }));
  const { error: linkError } = await supabase.from('payment_lessons').insert(links);
  if (linkError) {
    if (!existingPayment) await supabase.from('payments').delete().eq('id', payment.id);
    throw new Error(`Failed to link lessons: ${linkError.message}`);
  }
  return payment;
}

// Per-lesson settle: mark ONLY the lessons this run completed as paid, then
// recompute the invoice aggregate from the per-lesson paid flags. Unlike the
// manual useMarkPaymentPaid (which settles the whole invoice), this never
// resurrects a lesson the tutor previously marked unpaid — those lessons are
// already 'completed' (not 'scheduled') so they're never in a run's lessonIds.
async function settleRunLessons(
  supabase: SupabaseClient,
  paymentId: string,
  lessonIds: string[],
): Promise<boolean> {
  if (lessonIds.length === 0) return false;
  // Mark this run's lessons paid at the per-lesson level.
  const { error: markErr } = await supabase
    .from('payment_lessons')
    .update({ paid: true })
    .eq('payment_id', paymentId)
    .in('lesson_id', lessonIds);
  if (markErr) { console.error('settle mark failed', markErr.message); return false; }

  // Recompute the invoice aggregate from per-lesson paid flags.
  const { data: links, error: linksErr } = await supabase
    .from('payment_lessons')
    .select('amount, paid')
    .eq('payment_id', paymentId);
  if (linksErr || !links) { console.error('settle links fetch failed', linksErr?.message); return false; }

  const amountPaid =
    Math.round(
      links.filter((l: { paid: boolean | null }) => l.paid).reduce(
        (s: number, l: { amount: number | null }) => s + (Number(l.amount) || 0),
        0,
      ) * 100,
    ) / 100;

  const { data: pay, error: payErr } = await supabase
    .from('payments').select('amount_due').eq('id', paymentId).single();
  if (payErr || !pay) { console.error('settle payment fetch failed', payErr?.message); return false; }

  const status = amountPaid <= 0 ? 'unpaid' : amountPaid >= pay.amount_due ? 'paid' : 'partial';
  const now = new Date().toISOString();
  const { error: updErr } = await supabase
    .from('payments')
    .update({ amount_paid: amountPaid, status, paid_at: status === 'paid' ? now : null, updated_at: now })
    .eq('id', paymentId);
  if (updErr) { console.error('settle payment update failed', updErr.message); return false; }
  return true;
}

// 'YYYY-MM-01' for the month containing the given timestamp, computed in UTC.
// NOTE: the source getMonthStart (usePayments.ts) uses LOCAL time, so on the
// server this matches it only when the tutor's tz is UTC. For a lesson within a
// few hours of a month boundary in a non-UTC tutor tz, the auto-complete job may
// bucket it into a different invoice month than the manual flow would. Accepted
// edge nuance (see spec: 2026-06-07-auto-complete-lessons-design.md).
function monthStartOf(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}
// Last calendar day 'YYYY-MM-DD' of the same month.
function monthEndOf(monthStart: string): string {
  const [y, m] = monthStart.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)); // day 0 of next month = last day of this month
  return `${last.getUTCFullYear()}-${String(last.getUTCMonth() + 1).padStart(2, '0')}-${String(last.getUTCDate()).padStart(2, '0')}`;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
