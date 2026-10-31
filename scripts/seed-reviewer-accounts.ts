/**
 * Seed the App Review demo accounts
 *
 * Creates two sign-in accounts for Apple / Google reviewers, with realistic
 * fictional data so the app isn't empty:
 *
 *   Tutor  reviewer.tutor@dalesson.app   "Harmony Studio" with 7 families,
 *          9 students, ~14 weeks of recurring lessons, session notes,
 *          invoice + prepaid payments, and message threads.
 *   Parent reviewer.parent@dalesson.app  The "Park" family of that tutor
 *          (2 children), onboarding and agreement already done.
 *
 * Passwords are generated fresh and printed once at the end. They are never
 * written to disk. Paste them into App Store Connect → App Review Information.
 * To choose them yourself, set REVIEWER_TUTOR_PASSWORD / REVIEWER_PARENT_PASSWORD.
 *
 * Requires (run these first):
 *   npx supabase db push                          # delete_user_account() for --reset
 *   SUPABASE_SECRET_KEY in .env                   # service role / secret key
 *
 * Usage:
 *   npx tsx scripts/seed-reviewer-accounts.ts --dry-run   # print the plan, no network
 *   npx tsx scripts/seed-reviewer-accounts.ts             # create (fails if they exist)
 *   npx tsx scripts/seed-reviewer-accounts.ts --reset     # delete + recreate (new passwords)
 *
 * All names are fictional. Non-login families use `.review@example.com` emails.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { randomInt } from 'crypto';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const DRY_RUN = process.argv.includes('--dry-run');
const RESET = process.argv.includes('--reset');

const TUTOR_EMAIL = 'reviewer.tutor@dalesson.app';
const PARENT_EMAIL = 'reviewer.parent@dalesson.app';
const FAMILY_EMAIL_SUFFIX = '.review@example.com';
const TIMEZONE = 'America/Los_Angeles';
const NOW = new Date();

// --- fictional data ----------------------------------------------------------

const TUTOR = {
  name: 'Sarah Nguyen',
  business_name: 'Harmony Studio',
  phone: '(206) 555-0142',
};

type Subject = 'piano' | 'math' | 'reading' | 'speech' | 'english';
const RATES: Record<Subject, { rate: number; base_duration: number }> = {
  piano: { rate: 45, base_duration: 45 },
  math: { rate: 50, base_duration: 60 },
  reading: { rate: 40, base_duration: 45 },
  speech: { rate: 55, base_duration: 30 },
  english: { rate: 50, base_duration: 60 },
};

interface FamilySpec {
  key: string;
  name: string;
  email: string;
  billing_mode: 'invoice' | 'prepaid';
  login?: boolean; // the reviewer parent account
}
const FAMILIES: FamilySpec[] = [
  { key: 'park', name: 'Jennifer Park', email: PARENT_EMAIL, billing_mode: 'invoice', login: true },
  { key: 'tran', name: 'David Tran', email: `david.tran${FAMILY_EMAIL_SUFFIX}`, billing_mode: 'prepaid' },
  { key: 'lopez', name: 'Maria Lopez', email: `maria.lopez${FAMILY_EMAIL_SUFFIX}`, billing_mode: 'invoice' },
  { key: 'chen', name: 'Kevin Chen', email: `kevin.chen${FAMILY_EMAIL_SUFFIX}`, billing_mode: 'invoice' },
  { key: 'wright', name: 'Amanda Wright', email: `amanda.wright${FAMILY_EMAIL_SUFFIX}`, billing_mode: 'prepaid' },
  { key: 'pham', name: 'Linh Pham', email: `linh.pham${FAMILY_EMAIL_SUFFIX}`, billing_mode: 'invoice' },
  { key: 'kim', name: 'Robert Kim', email: `robert.kim${FAMILY_EMAIL_SUFFIX}`, billing_mode: 'invoice' },
];

interface StudentSpec {
  key: string;
  family: string;
  name: string;
  age: number;
  grade_level: string;
  subjects: Subject[];
}
const STUDENTS: StudentSpec[] = [
  { key: 'emma', family: 'park', name: 'Emma Park', age: 9, grade_level: '4th', subjects: ['piano', 'reading'] },
  { key: 'lucas', family: 'park', name: 'Lucas Park', age: 7, grade_level: '2nd', subjects: ['math'] },
  { key: 'mia', family: 'tran', name: 'Mia Tran', age: 11, grade_level: '6th', subjects: ['math', 'english'] },
  { key: 'sofia', family: 'lopez', name: 'Sofia Lopez', age: 8, grade_level: '3rd', subjects: ['reading', 'speech'] },
  { key: 'ethan', family: 'chen', name: 'Ethan Chen', age: 12, grade_level: '7th', subjects: ['piano'] },
  { key: 'chloe', family: 'chen', name: 'Chloe Chen', age: 10, grade_level: '5th', subjects: ['piano', 'math'] },
  { key: 'noah', family: 'wright', name: 'Noah Wright', age: 6, grade_level: '1st', subjects: ['reading'] },
  { key: 'ava', family: 'pham', name: 'Ava Pham', age: 13, grade_level: '8th', subjects: ['math', 'english'] },
  { key: 'leo', family: 'kim', name: 'Leo Kim', age: 9, grade_level: '4th', subjects: ['speech'] },
];

// Weekly slots in Pacific time: [student, subject, weekday 0=Sun, hour, minute]
const SLOTS: [string, Subject, number, number, number][] = [
  ['emma', 'piano', 1, 15, 30], ['mia', 'math', 1, 16, 30], ['noah', 'reading', 1, 17, 30],
  ['ethan', 'piano', 2, 15, 0], ['sofia', 'reading', 2, 16, 0], ['ava', 'english', 2, 17, 0],
  ['lucas', 'math', 3, 15, 30], ['leo', 'speech', 3, 16, 30], ['chloe', 'piano', 3, 17, 15],
  ['emma', 'reading', 4, 15, 0], ['mia', 'english', 4, 16, 0], ['chloe', 'math', 4, 17, 15], ['sofia', 'speech', 4, 18, 15],
  ['ava', 'math', 5, 15, 30], ['noah', 'reading', 5, 16, 45],
  ['ethan', 'piano', 6, 10, 0], ['emma', 'piano', 6, 11, 0],
];

const NOTES: Record<Subject, string[]> = {
  piano: [
    'Great focus today. Practice C major scale hands together, 10 minutes daily.',
    'Recital piece is coming along. Work on the left hand in measures 9 to 16.',
    'Nice improvement on rhythm. Keep using the metronome at 80 bpm.',
  ],
  math: [
    'Finished the fractions unit. Practice set 3 for homework.',
    'Good progress on word problems. Review multiplying by 10s.',
    'Worked on long division. Needs a little more practice with remainders.',
  ],
  reading: [
    'Read two chapters aloud with great expression. New sight words sent home.',
    'Worked on summarizing. Ask about the main character at dinner!',
    'Fluency is improving. Keep up 20 minutes of reading each night.',
  ],
  speech: [
    'Practiced the "r" sound in short phrases. Great effort today.',
    'Good carryover in conversation. Keep practicing the word list.',
  ],
  english: [
    'Outlined the persuasive essay. First draft due next week.',
    'Reviewed commas and run-on sentences. Strong improvement.',
  ],
};

// --- helpers -----------------------------------------------------------------

/** UTC Date for a wall-clock time in the given IANA time zone. */
function zonedToUtc(y: number, m: number, d: number, h: number, mi: number, tz: string): Date {
  const guess = new Date(Date.UTC(y, m, d, h, mi));
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
  const parts = Object.fromEntries(fmt.formatToParts(guess).map((p) => [p.type, p.value]));
  const asIfUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return new Date(guess.getTime() - (asIfUtc - guess.getTime()));
}

function readablePassword(): string {
  // No look-alike characters (0/O, 1/l/I) so a reviewer can type it.
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const group = () => Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join('');
  return `${group()}-${group()}-${group()}-${group()}`;
}

function firstOfMonth(monthsAgo: number): string {
  const d = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth() - monthsAgo, 1));
  return d.toISOString().slice(0, 10);
}

function plannedLessons() {
  const out: { student: string; subject: Subject; at: Date; status: string; notes: string | null }[] = [];
  const today = new Date(NOW);
  const start = new Date(today);
  start.setDate(start.getDate() - 6 * 7 - start.getDay()); // Sunday, 6 weeks back
  let n = 0;
  for (let i = 0; i < 14 * 7; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    for (const [student, subject, wd, h, mi] of SLOTS) {
      if (day.getDay() !== wd) continue;
      const at = zonedToUtc(day.getFullYear(), day.getMonth(), day.getDate(), h, mi, TIMEZONE);
      const past = at.getTime() < NOW.getTime();
      n++;
      const cancelled = past && n % 13 === 0;
      out.push({
        student, subject, at,
        status: past ? (cancelled ? 'cancelled' : 'completed') : 'scheduled',
        notes: past && !cancelled && n % 3 === 0 ? NOTES[subject][n % NOTES[subject].length] : null,
      });
    }
  }
  return out;
}

// --- cleanup -----------------------------------------------------------------

async function findUser(db: SupabaseClient, email: string) {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const u = data.users.find((x) => x.email?.toLowerCase() === email);
    if (u) return u;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function removeExisting(db: SupabaseClient) {
  const tutorUser = await findUser(db, TUTOR_EMAIL);
  const parentUser = await findUser(db, PARENT_EMAIL);
  if (!tutorUser && !parentUser) return;
  if (!RESET) {
    throw new Error(
      'Reviewer accounts already exist. Re-run with --reset to delete and recreate them (passwords change).'
    );
  }
  console.log('🧹 Removing existing reviewer accounts...');

  if (tutorUser) {
    const { data: tutorRow } = await db.from('parents').select('id').eq('user_id', tutorUser.id).maybeSingle();
    if (tutorRow) {
      // Delete this tutor's demo families (cascades students, lessons, payments).
      const { error } = await db.from('parents').delete().eq('tutor_id', tutorRow.id).eq('role', 'parent');
      if (error) throw error;
    }
    const { error: rpcErr } = await db.rpc('delete_user_account', { p_user_id: tutorUser.id });
    if (rpcErr) throw new Error(`delete_user_account failed (did you run "npx supabase db push"?): ${rpcErr.message}`);
    const { error: delErr } = await db.auth.admin.deleteUser(tutorUser.id);
    if (delErr) throw delErr;
  }
  if (parentUser) {
    const { error: rpcErr } = await db.rpc('delete_user_account', { p_user_id: parentUser.id });
    if (rpcErr) throw rpcErr;
    const { error: delErr } = await db.auth.admin.deleteUser(parentUser.id);
    if (delErr) throw delErr;
  }
  // Any leftover unlinked rows with our emails.
  await db.from('parents').delete().in('email', [PARENT_EMAIL, ...FAMILIES.map((f) => f.email)]).is('user_id', null);
}

// --- seed --------------------------------------------------------------------

async function seed(db: SupabaseClient, tutorPassword: string, parentPassword: string) {
  const trialEnds = new Date(NOW);
  trialEnds.setFullYear(trialEnds.getFullYear() + 1);

  // 1. Tutor login. The handle_new_user trigger creates the parents row.
  const { data: tu, error: tuErr } = await db.auth.admin.createUser({
    email: TUTOR_EMAIL,
    password: tutorPassword,
    email_confirm: true,
    user_metadata: {
      name: TUTOR.name, role: 'tutor', business_name: TUTOR.business_name, timezone: TIMEZONE,
      subscription_plan: 'pro', subscription_status: 'trialing', trial_ends_at: trialEnds.toISOString(),
    },
  });
  if (tuErr) throw tuErr;
  const tutorUserId = tu.user!.id;

  const { data: tutorRow, error: trErr } = await db
    .from('parents')
    .update({
      name: TUTOR.name, role: 'tutor', business_name: TUTOR.business_name, phone: TUTOR.phone, timezone: TIMEZONE,
      onboarding_completed_at: NOW.toISOString(), requires_agreement: false, trial_ends_at: trialEnds.toISOString(),
    })
    .eq('user_id', tutorUserId)
    .select('id')
    .single();
  if (trErr) throw new Error(`Tutor profile row not found after sign up: ${trErr.message}`);
  const tutorId: string = tutorRow.id;
  console.log(`  ✓ tutor ${TUTOR_EMAIL}`);

  const { error: tsErr } = await db.from('tutor_settings').insert({
    tutor_id: tutorUserId,
    subject_rates: RATES,
    default_rate: 45,
    default_base_duration: 45,
    reminder_settings: {
      enabled: true, due_day_of_month: 7, friendly_reminder_days_before: 3,
      past_due_intervals: [3, 7, 14], send_email: false, send_notification: true,
    },
  });
  if (tsErr) throw tsErr;

  // 2. Families (the Park family row is created first so the parent login links to it).
  const { data: famRows, error: fErr } = await db
    .from('parents')
    .insert(FAMILIES.map((f) => ({
      name: f.name, email: f.email, role: 'parent', tutor_id: tutorId, billing_mode: f.billing_mode,
      prepaid_subjects: f.billing_mode === 'prepaid' ? ['math', 'reading'] : [], timezone: TIMEZONE,
      requires_agreement: false, agreement_signed_at: NOW.toISOString(),
      onboarding_completed_at: f.login ? NOW.toISOString() : null,
    })))
    .select('id,email');
  if (fErr) throw fErr;
  const familyId: Record<string, string> = {};
  for (const f of FAMILIES) familyId[f.key] = famRows!.find((r) => r.email === f.email)!.id;
  console.log(`  ✓ ${FAMILIES.length} families`);

  // 3. Parent login. The trigger links it to the Park row by email.
  const park = FAMILIES.find((f) => f.login)!;
  const { data: pu, error: puErr } = await db.auth.admin.createUser({
    email: PARENT_EMAIL, password: parentPassword, email_confirm: true,
    user_metadata: { name: park.name, role: 'parent' },
  });
  if (puErr) throw puErr;
  const { data: linked } = await db.from('parents').select('user_id').eq('id', familyId.park).single();
  if (linked?.user_id !== pu.user!.id) {
    const { error } = await db.from('parents').update({ user_id: pu.user!.id }).eq('id', familyId.park);
    if (error) throw error;
  }
  console.log(`  ✓ parent ${PARENT_EMAIL} (Park family)`);

  // 4. Students
  const { data: stuRows, error: sErr } = await db
    .from('students')
    .insert(STUDENTS.map((s) => ({
      parent_id: familyId[s.family], tutor_id: tutorId, name: s.name, age: s.age, grade_level: s.grade_level,
      subjects: s.subjects, // rates come from tutor_settings.subject_rates
    })))
    .select('id,name');
  if (sErr) throw sErr;
  const studentId: Record<string, string> = {};
  for (const s of STUDENTS) studentId[s.key] = stuRows!.find((r) => r.name === s.name)!.id;
  console.log(`  ✓ ${STUDENTS.length} students`);

  // 5. Lessons
  const lessons = plannedLessons();
  const rows = lessons.map((l) => ({
    student_id: studentId[l.student], tutor_id: tutorId, subject: l.subject, scheduled_at: l.at.toISOString(),
    duration_min: RATES[l.subject].base_duration, status: l.status, notes: l.notes,
  }));
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await db.from('scheduled_lessons').insert(rows.slice(i, i + 200));
    if (error) throw error;
  }
  const past = lessons.filter((l) => l.status !== 'scheduled').length;
  console.log(`  ✓ ${rows.length} lessons (${past} past with notes on some, ${rows.length - past} upcoming)`);

  // 6. Payments: last month all paid; this month mixed.
  const m0 = firstOfMonth(0), m1 = firstOfMonth(1);
  const paidAt = (m: string) => `${m.slice(0, 8)}05T18:00:00Z`;
  const pay = (fam: string, month: string, due: number, paid: number, extra: object = {}) => ({
    parent_id: familyId[fam], tutor_id: tutorId, month, amount_due: due, amount_paid: paid,
    status: paid >= due ? 'paid' : paid > 0 ? 'partial' : 'unpaid',
    paid_at: paid > 0 ? paidAt(month) : null, payment_type: 'invoice', ...extra,
  });
  const prepaid = (fam: string, month: string, subject: Subject, sessions: number, used: number) =>
    pay(fam, month, sessions * RATES[subject].rate, sessions * RATES[subject].rate, {
      payment_type: 'prepaid', subject, sessions_prepaid: sessions, sessions_used: used, sessions_rolled_over: 0,
    });
  const payments = [
    pay('park', m1, 540, 540), pay('park', m0, 540, 540),
    pay('lopez', m1, 380, 380), pay('lopez', m0, 380, 190),
    pay('chen', m1, 720, 720), pay('chen', m0, 720, 720),
    pay('pham', m1, 400, 400), pay('pham', m0, 400, 0),
    pay('kim', m1, 220, 220), pay('kim', m0, 220, 220),
    prepaid('tran', m1, 'math', 8, 8), prepaid('tran', m0, 'math', 8, 5),
    prepaid('wright', m1, 'reading', 8, 8), prepaid('wright', m0, 'reading', 8, 4),
  ];
  const { error: pErr } = await db.from('payments').insert(payments);
  if (pErr) throw pErr;
  console.log(`  ✓ ${payments.length} payments (paid, partial, unpaid, prepaid)`);

  // 7. Message threads (tutor ↔ family), with the Park thread unread for the parent.
  const threads: { fam: string; subject: string; msgs: [string, string, number][] }[] = [
    { fam: 'park', subject: "Emma's recital piece", msgs: [
      ['tutor', "Hi Jennifer! Emma is ready to start her recital piece. I've added the sheet music to her worksheets.", 26],
      ['family', 'She has been practicing every night. Thank you so much!', 2],
    ] },
    { fam: 'lopez', subject: 'Reschedule next Tuesday?', msgs: [
      ['family', 'Could we move Sofia to 5:00 PM next Tuesday?', 30],
      ['tutor', 'Tuesday at 5:00 PM works. See you then!', 5],
    ] },
    { fam: 'tran', subject: 'Math packet for Mia', msgs: [
      ['tutor', 'Uploaded the fractions practice set to Shared Resources.', 8],
    ] },
  ];
  for (const t of threads) {
    const { data: th, error: thErr } = await db.from('message_threads')
      .insert({ subject: t.subject, created_by: tutorId, recipient_type: 'parent', tutor_id: tutorId })
      .select('id').single();
    if (thErr) throw thErr;
    const msgRows = t.msgs.map(([who, content, hoursAgo]) => ({
      thread_id: th!.id, sender_id: who === 'tutor' ? tutorId : familyId[t.fam], content,
      created_at: new Date(NOW.getTime() - hoursAgo * 3600e3).toISOString(),
    }));
    const { error: mErr } = await db.from('messages').insert(msgRows);
    if (mErr) throw mErr;
    const { error: ptErr } = await db.from('message_thread_participants').insert([
      { thread_id: th!.id, parent_id: tutorId, last_read_at: NOW.toISOString() },
      { thread_id: th!.id, parent_id: familyId[t.fam], last_read_at: t.fam === 'park' ? null : NOW.toISOString() },
    ]);
    if (ptErr) throw ptErr;
  }
  console.log(`  ✓ ${threads.length} message threads`);
}

// --- main --------------------------------------------------------------------

(async () => {
  const tutorPassword = process.env.REVIEWER_TUTOR_PASSWORD || readablePassword();
  const parentPassword = process.env.REVIEWER_PARENT_PASSWORD || readablePassword();

  if (DRY_RUN) {
    const lessons = plannedLessons();
    console.log('DRY RUN: nothing is written and no network calls are made.\n');
    console.log(`Tutor:   ${TUTOR_EMAIL}  (${TUTOR.name}, ${TUTOR.business_name})`);
    console.log(`Parent:  ${PARENT_EMAIL}  (${FAMILIES[0].name}, children: Emma, Lucas)`);
    console.log(`Families ${FAMILIES.length}, students ${STUDENTS.length}, lessons ${lessons.length} ` +
      `(${lessons.filter((l) => l.status === 'scheduled').length} upcoming), payments 14, threads 3`);
    const next = lessons.find((l) => l.status === 'scheduled')!;
    console.log(`Next lesson: ${next.student} ${next.subject} at ${next.at.toLocaleString('en-US', { timeZone: TIMEZONE })} PT`);
    return;
  }

  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env');
    process.exit(1);
  }
  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  try {
    await removeExisting(db);
    console.log(`🌱 Creating reviewer accounts on ${new URL(url).host}`);
    await seed(db, tutorPassword, parentPassword);
    console.log(`
✅ Done. Paste these into App Store Connect → App Review Information
   (they are not saved anywhere; keep them in your password manager).

   Tutor (Sign-In Information)
     Username: ${TUTOR_EMAIL}
     Password: ${tutorPassword}

   Parent (put in the Notes field)
     Username: ${PARENT_EMAIL}
     Password: ${parentPassword}
`);
  } catch (e) {
    console.error('\n❌ Seed failed:', e instanceof Error ? e.message : e);
    console.error('   Fix the error, then run again with --reset to start clean.');
    process.exit(1);
  }
})();
