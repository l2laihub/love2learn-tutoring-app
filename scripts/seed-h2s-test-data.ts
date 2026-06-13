/**
 * Seed Test Data for the H2S test-tutor account
 *
 * Populates the H2S tutor (huy.q.duong@hotmail.com) with a representative
 * sample of synthetic data modelled on the main tutor (Trang Ly):
 *   - 6 parents (mixed invoice / prepaid billing)
 *   - 10 students across a mix of subjects
 *   - ~3 months of weekly recurring lessons (past = completed/cancelled, future = scheduled)
 *   - 2 group sessions (shared time slot, multiple students)
 *   - 9 payments in mixed statuses (paid / unpaid / partial, invoice + prepaid)
 *
 * All synthetic identities use `.seed@example.com` emails and `[seed]` session
 * notes so the data is easy to spot and the script is safely re-runnable: a
 * cleanup pass deletes prior seed rows (cascading to students/lessons/payments)
 * without ever touching the account's real students.
 *
 * Usage:
 *   npx tsx scripts/seed-h2s-test-data.ts --dry-run  # Preview plan, no writes
 *   npx tsx scripts/seed-h2s-test-data.ts            # Execute
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DRY_RUN = process.argv.includes('--dry-run');

// H2S test tutor
const TUTOR_ID = '27d9eab8-3a9d-4711-ae2b-18b66b6ad2a5';
const TIMEZONE = 'America/Los_Angeles';
const SEED_EMAIL_SUFFIX = '.seed@example.com';
const SEED_NOTE = '[seed]';

// Anchor "now" so generated dates are stable & sensible regardless of clock.
const NOW = new Date();

// Duration (minutes) and a representative rate by subject.
const SUBJECT_DURATION: Record<string, number> = {
  piano: 30,
  math: 60,
  reading: 45,
  english: 60,
  speech: 30,
};

interface ParentSpec {
  key: string;
  name: string;
  email: string;
  billing_mode: 'invoice' | 'prepaid';
}

interface StudentSpec {
  parentKey: string;
  name: string;
  age: number;
  grade_level: string;
  subject: string;
  hourly_rate: number;
  // weekly recurring slot
  dayOfWeek: number; // 0=Sun..6=Sat
  hour: number; // local-ish hour, stored as UTC for simplicity in test data
  minute: number;
}

const PARENTS: ParentSpec[] = [
  { key: 'thompson', name: 'Sarah Thompson', email: `sarah.thompson${SEED_EMAIL_SUFFIX}`, billing_mode: 'invoice' },
  { key: 'chen', name: 'Michael Chen', email: `michael.chen${SEED_EMAIL_SUFFIX}`, billing_mode: 'invoice' },
  { key: 'rodriguez', name: 'Jessica Rodriguez', email: `jessica.rodriguez${SEED_EMAIL_SUFFIX}`, billing_mode: 'prepaid' },
  { key: 'patel', name: 'David Patel', email: `david.patel${SEED_EMAIL_SUFFIX}`, billing_mode: 'invoice' },
  { key: 'nguyen', name: 'Emily Nguyen', email: `emily.nguyen${SEED_EMAIL_SUFFIX}`, billing_mode: 'prepaid' },
  { key: 'wilson', name: 'James Wilson', email: `james.wilson${SEED_EMAIL_SUFFIX}`, billing_mode: 'invoice' },
];

const STUDENTS: StudentSpec[] = [
  { parentKey: 'thompson', name: 'Olivia Thompson', age: 8, grade_level: '3rd', subject: 'piano', hourly_rate: 50, dayOfWeek: 1, hour: 16, minute: 0 },
  { parentKey: 'thompson', name: 'Liam Thompson', age: 10, grade_level: '5th', subject: 'math', hourly_rate: 45, dayOfWeek: 3, hour: 17, minute: 0 },
  { parentKey: 'chen', name: 'Sophia Chen', age: 7, grade_level: '2nd', subject: 'reading', hourly_rate: 40, dayOfWeek: 2, hour: 15, minute: 30 },
  { parentKey: 'rodriguez', name: 'Noah Rodriguez', age: 9, grade_level: '4th', subject: 'piano', hourly_rate: 50, dayOfWeek: 4, hour: 16, minute: 30 },
  { parentKey: 'rodriguez', name: 'Emma Rodriguez', age: 12, grade_level: '7th', subject: 'english', hourly_rate: 55, dayOfWeek: 1, hour: 18, minute: 0 },
  { parentKey: 'patel', name: 'Ava Patel', age: 6, grade_level: '1st', subject: 'speech', hourly_rate: 60, dayOfWeek: 5, hour: 15, minute: 0 },
  { parentKey: 'nguyen', name: 'Lucas Nguyen', age: 11, grade_level: '6th', subject: 'math', hourly_rate: 45, dayOfWeek: 3, hour: 16, minute: 0 },
  { parentKey: 'nguyen', name: 'Mia Nguyen', age: 8, grade_level: '3rd', subject: 'piano', hourly_rate: 50, dayOfWeek: 2, hour: 17, minute: 0 },
  { parentKey: 'wilson', name: 'Ethan Wilson', age: 13, grade_level: '8th', subject: 'english', hourly_rate: 55, dayOfWeek: 4, hour: 18, minute: 0 },
  { parentKey: 'wilson', name: 'Isabella Wilson', age: 9, grade_level: '4th', subject: 'reading', hourly_rate: 40, dayOfWeek: 5, hour: 16, minute: 0 },
];

// --- helpers ---------------------------------------------------------------

/** Date of the most recent (or same) given weekday at-or-before the anchor week start. */
function weekStart(anchor: Date): Date {
  const d = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - d.getUTCDay()); // back to Sunday
  return d;
}

/** Generate weekly occurrences for a student's slot, weeks -6..+6 around now. */
function occurrencesFor(spec: StudentSpec): Date[] {
  const start = weekStart(NOW);
  start.setUTCDate(start.getUTCDate() - 6 * 7); // 6 weeks back
  const out: Date[] = [];
  for (let w = 0; w < 13; w++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + w * 7 + spec.dayOfWeek);
    d.setUTCHours(spec.hour, spec.minute, 0, 0);
    out.push(d);
  }
  return out;
}

function firstOfMonthISO(monthsAgo: number): string {
  const d = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth() - monthsAgo, 1));
  return d.toISOString().slice(0, 10);
}

// --- cleanup ---------------------------------------------------------------

async function cleanup() {
  console.log('\n🧹 Cleaning up any prior seed data...');

  // Delete prior seed parents -> cascades to students, scheduled_lessons, payments.
  const { data: oldParents, error: selErr } = await supabase
    .from('parents')
    .select('id')
    .eq('tutor_id', TUTOR_ID)
    .like('email', `%${SEED_EMAIL_SUFFIX}`);
  if (selErr) throw selErr;

  if (oldParents && oldParents.length) {
    if (!DRY_RUN) {
      const { error } = await supabase
        .from('parents')
        .delete()
        .in('id', oldParents.map((p) => p.id));
      if (error) throw error;
    }
    console.log(`  - removed ${oldParents.length} prior seed parent(s) (cascade: students/lessons/payments)`);
  } else {
    console.log('  - no prior seed parents found');
  }

  // Group sessions don't cascade from students (session_id is SET NULL), delete by marker.
  const { data: oldSessions, error: sErr } = await supabase
    .from('lesson_sessions')
    .select('id')
    .eq('tutor_id', TUTOR_ID)
    .like('notes', `${SEED_NOTE}%`);
  if (sErr) throw sErr;
  if (oldSessions && oldSessions.length) {
    if (!DRY_RUN) {
      const { error } = await supabase
        .from('lesson_sessions')
        .delete()
        .in('id', oldSessions.map((s) => s.id));
      if (error) throw error;
    }
    console.log(`  - removed ${oldSessions.length} prior seed group session(s)`);
  }
}

// --- seed ------------------------------------------------------------------

async function seed() {
  console.log(`\n🌱 Seeding H2S test data${DRY_RUN ? ' (DRY RUN — no writes)' : ''}`);

  // 1. Parents
  const parentRows = PARENTS.map((p) => ({
    name: p.name,
    email: p.email,
    role: 'parent',
    tutor_id: TUTOR_ID,
    billing_mode: p.billing_mode,
    timezone: TIMEZONE,
  }));
  const parentIds: Record<string, string> = {};
  if (DRY_RUN) {
    PARENTS.forEach((p, i) => (parentIds[p.key] = `dry-parent-${i}`));
  } else {
    const { data, error } = await supabase.from('parents').insert(parentRows).select('id,email');
    if (error) throw error;
    for (const p of PARENTS) {
      parentIds[p.key] = data!.find((r) => r.email === p.email)!.id;
    }
  }
  console.log(`  ✓ ${PARENTS.length} parents`);

  // 2. Students
  const studentRows = STUDENTS.map((s) => ({
    parent_id: parentIds[s.parentKey],
    tutor_id: TUTOR_ID,
    name: s.name,
    age: s.age,
    grade_level: s.grade_level,
    subjects: [s.subject],
    hourly_rate: s.hourly_rate,
    subject_rates: {},
  }));
  const studentIds: string[] = [];
  if (DRY_RUN) {
    STUDENTS.forEach((_, i) => studentIds.push(`dry-student-${i}`));
  } else {
    const { data, error } = await supabase.from('students').insert(studentRows).select('id,name');
    if (error) throw error;
    // Preserve input order by matching on name (names are unique here).
    for (const s of STUDENTS) studentIds.push(data!.find((r) => r.name === s.name)!.id);
  }
  console.log(`  ✓ ${STUDENTS.length} students`);

  // 3. Recurring lessons (individual, no session)
  let lessonRows: any[] = [];
  STUDENTS.forEach((spec, i) => {
    const sid = studentIds[i];
    const dur = SUBJECT_DURATION[spec.subject] ?? 30;
    for (const dt of occurrencesFor(spec)) {
      const isPast = dt.getTime() < NOW.getTime();
      // ~1 in 8 past lessons cancelled, rest completed.
      let status: string;
      if (isPast) {
        status = dt.getUTCDate() % 8 === 0 ? 'cancelled' : 'completed';
      } else {
        status = 'scheduled';
      }
      lessonRows.push({
        student_id: sid,
        tutor_id: TUTOR_ID,
        subject: spec.subject,
        scheduled_at: dt.toISOString(),
        duration_min: dur,
        status,
      });
    }
  });
  if (!DRY_RUN && lessonRows.length) {
    const { error } = await supabase.from('scheduled_lessons').insert(lessonRows);
    if (error) throw error;
  }
  const pastCount = lessonRows.filter((l) => l.status !== 'scheduled').length;
  console.log(`  ✓ ${lessonRows.length} recurring lessons (${pastCount} past, ${lessonRows.length - pastCount} upcoming)`);

  // 4. Group sessions — two piano students share a slot (one past, one upcoming).
  const pianoIdx = STUDENTS.map((s, i) => (s.subject === 'piano' ? i : -1)).filter((i) => i >= 0).slice(0, 2);
  const groupSlots = [
    { whenOffsetDays: -14, status: 'completed', label: 'past' },
    { whenOffsetDays: 7, status: 'scheduled', label: 'upcoming' },
  ];
  let groupLessonCount = 0;
  for (const slot of groupSlots) {
    const when = new Date(NOW);
    when.setUTCDate(when.getUTCDate() + slot.whenOffsetDays);
    when.setUTCHours(14, 0, 0, 0);
    if (DRY_RUN) {
      groupLessonCount += pianoIdx.length;
      continue;
    }
    const { data: sess, error: sErr } = await supabase
      .from('lesson_sessions')
      .insert({ scheduled_at: when.toISOString(), duration_min: 30, notes: `${SEED_NOTE} group piano`, tutor_id: TUTOR_ID })
      .select('id')
      .single();
    if (sErr) throw sErr;
    const groupRows = pianoIdx.map((idx) => ({
      student_id: studentIds[idx],
      tutor_id: TUTOR_ID,
      subject: 'piano',
      scheduled_at: when.toISOString(),
      duration_min: 30,
      status: slot.status,
      session_id: sess!.id,
    }));
    const { error: glErr } = await supabase.from('scheduled_lessons').insert(groupRows);
    if (glErr) throw glErr;
    groupLessonCount += groupRows.length;
  }
  console.log(`  ✓ 2 group sessions (${groupLessonCount} grouped lessons)`);

  // 5. Payments — mixed statuses across invoice & prepaid parents.
  const m0 = firstOfMonthISO(0); // current month
  const m1 = firstOfMonthISO(1);
  const m2 = firstOfMonthISO(2);
  const paymentRows: any[] = [
    // Thompson (invoice): two paid, current unpaid
    { parent_id: parentIds.thompson, month: m2, amount_due: 200, amount_paid: 200, status: 'paid', paid_at: NOW.toISOString(), payment_type: 'invoice', notes: `${SEED_NOTE} Auto invoice` },
    { parent_id: parentIds.thompson, month: m1, amount_due: 200, amount_paid: 200, status: 'paid', paid_at: NOW.toISOString(), payment_type: 'invoice', notes: `${SEED_NOTE} Auto invoice` },
    { parent_id: parentIds.thompson, month: m0, amount_due: 200, amount_paid: 0, status: 'unpaid', payment_type: 'invoice', notes: `${SEED_NOTE} Auto invoice` },
    // Chen (invoice): paid then partial
    { parent_id: parentIds.chen, month: m1, amount_due: 160, amount_paid: 160, status: 'paid', paid_at: NOW.toISOString(), payment_type: 'invoice', notes: `${SEED_NOTE} Auto invoice` },
    { parent_id: parentIds.chen, month: m0, amount_due: 160, amount_paid: 80, status: 'partial', payment_type: 'invoice', notes: `${SEED_NOTE} Partial payment` },
    // Patel (invoice): current unpaid
    { parent_id: parentIds.patel, month: m0, amount_due: 240, amount_paid: 0, status: 'unpaid', payment_type: 'invoice', notes: `${SEED_NOTE} Auto invoice` },
    // Wilson (invoice): paid + unpaid
    { parent_id: parentIds.wilson, month: m1, amount_due: 220, amount_paid: 220, status: 'paid', paid_at: NOW.toISOString(), payment_type: 'invoice', notes: `${SEED_NOTE} Auto invoice` },
    // Rodriguez (prepaid): package paid, partially used
    { parent_id: parentIds.rodriguez, month: m0, amount_due: 400, amount_paid: 400, status: 'paid', paid_at: NOW.toISOString(), payment_type: 'prepaid', sessions_prepaid: 8, sessions_used: 3, sessions_rolled_over: 0, subject: 'piano', notes: `${SEED_NOTE} 8-session package` },
    // Nguyen (prepaid): package fully used
    { parent_id: parentIds.nguyen, month: m1, amount_due: 180, amount_paid: 180, status: 'paid', paid_at: NOW.toISOString(), payment_type: 'prepaid', sessions_prepaid: 4, sessions_used: 4, sessions_rolled_over: 0, subject: 'math', notes: `${SEED_NOTE} 4-session package` },
  ];
  if (!DRY_RUN) {
    const { error } = await supabase.from('payments').insert(paymentRows);
    if (error) throw error;
  }
  console.log(`  ✓ ${paymentRows.length} payments (paid/unpaid/partial, invoice + prepaid)`);

  console.log('\n✅ Done.');
}

(async () => {
  try {
    await cleanup();
    await seed();
    if (DRY_RUN) console.log('\n(DRY RUN — nothing was written. Re-run without --dry-run to apply.)');
  } catch (e) {
    console.error('\n❌ Seed failed:', e);
    process.exit(1);
  }
})();
