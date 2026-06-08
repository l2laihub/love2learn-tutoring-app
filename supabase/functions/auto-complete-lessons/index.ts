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
import { dueLessons, isSubjectPrepaid, type CandidateLesson } from './autocomplete.ts';

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
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !serviceKey) throw new Error('Supabase env not configured');

    const body = await req.json().catch(() => ({}));
    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get('Authorization') ?? '';
    const isInternal = authHeader === `Bearer ${serviceKey}`;

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
        'student:students!inner(id, parent_id, parent:parents!parent_id(id, billing_mode, prepaid_subjects))',
    )
    .eq('tutor_id', tutorId)
    .eq('status', 'scheduled')
    .lt('scheduled_at', nowIso)
    .gte('scheduled_at', oldestIso);
  if (lessonsErr) throw new Error(lessonsErr.message);

  const due = dueLessons((rows ?? []) as unknown as CandidateLesson[], nowMs, MAX_LESSON_AGE_DAYS);
  if (due.length === 0) return { completed: 0, invoiced: 0, paid: 0, parents: 0 };

  // 1. Complete each due lesson; collect (parent, month) pairs needing an invoice.
  const invoiceTargets = new Map<string, { parentId: string; monthStart: string }>();
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
      await incrementPrepaid(supabase, parent.id, monthStart, l.subject, parent.prepaid_subjects ?? []);
    } else {
      invoiceTargets.set(`${parent.id}|${monthStart}`, { parentId: parent.id, monthStart });
    }
  }

  // 2. Generate + settle one invoice per (parent, month).
  let invoiced = 0;
  let paid = 0;
  for (const { parentId, monthStart } of invoiceTargets.values()) {
    const payment = await generateInvoice(supabase, tutor.id, parentId, monthStart, settings);
    if (payment) {
      invoiced++;
      if (await markPaid(supabase, payment.id)) paid++;
    }
  }

  return { completed, invoiced, paid, parents: invoiceTargets.size };
}

// Port of useCompleteLesson's prepaid increment (useLessons.ts:644-696).
async function incrementPrepaid(
  supabase: SupabaseClient,
  parentId: string,
  monthStart: string,
  subject: string,
  prepaidSubjects: string[],
) {
  const lower = (prepaidSubjects ?? []).map((s) => s.toLowerCase());
  let { data: prepaid } = await supabase
    .from('payments')
    .select('id, sessions_used')
    .eq('parent_id', parentId)
    .eq('month', monthStart)
    .eq('payment_type', 'prepaid')
    .eq('subject', subject)
    .maybeSingle();

  if (!prepaid && lower.length === 0) {
    const { data: legacy } = await supabase
      .from('payments')
      .select('id, sessions_used')
      .eq('parent_id', parentId)
      .eq('month', monthStart)
      .eq('payment_type', 'prepaid')
      .is('subject', null)
      .maybeSingle();
    prepaid = legacy;
  }

  if (prepaid) {
    await supabase
      .from('payments')
      .update({ sessions_used: (prepaid.sessions_used || 0) + 1, updated_at: new Date().toISOString() })
      .eq('id', prepaid.id);
  }
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

// Port of useMarkPaymentPaid (usePayments.ts:390-429). The existing
// sync_payment_lessons_paid_status() trigger flips payment_lessons.paid on this.
async function markPaid(supabase: SupabaseClient, paymentId: string): Promise<boolean> {
  const { data: cur, error: e1 } = await supabase
    .from('payments').select('amount_due').eq('id', paymentId).single();
  if (e1 || !cur) { console.error('markPaid fetch failed', e1?.message); return false; }
  const now = new Date().toISOString();
  const { error: e2 } = await supabase
    .from('payments')
    .update({ amount_paid: cur.amount_due, status: 'paid', paid_at: now, updated_at: now })
    .eq('id', paymentId);
  if (e2) { console.error('markPaid update failed', e2.message); return false; }
  return true;
}

// 'YYYY-MM-01' for the month containing the given timestamp (UTC, matching a
// UTC-running getMonthStart). Month-boundary lessons in non-UTC tutor tz are an
// accepted edge nuance, consistent with the existing client behavior.
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
