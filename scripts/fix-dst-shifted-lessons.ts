/**
 * Fix DST-Shifted Lessons Script
 *
 * When recurring lessons were generated using millisecond arithmetic (adding
 * exactly 7*24*60*60*1000ms), lessons after a DST transition have the wrong
 * UTC timestamp. The wall-clock time shifted by 1 hour.
 *
 * This script:
 * 1. Finds recurring lesson series
 * 2. Identifies the "reference" wall-clock time from pre-DST lessons
 * 3. Fixes post-DST lessons that shifted by 1 hour
 *
 * Usage:
 *   npx tsx scripts/fix-dst-shifted-lessons.ts --dry-run  # Preview changes
 *   npx tsx scripts/fix-dst-shifted-lessons.ts            # Execute changes
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const DRY_RUN = process.argv.includes('--dry-run');
const TIMEZONE = 'America/Los_Angeles';

// DST spring forward: March 8, 2026 at 2:00 AM PST -> 3:00 AM PDT
// After this date, PST (UTC-8) becomes PDT (UTC-7)
const DST_DATE = new Date('2026-03-08T10:00:00Z'); // 2 AM PST = 10:00 UTC

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY ||
                    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
                    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function getPartsInTimezone(date: Date, timezone: string = TIMEZONE) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    weekday: 'short',
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => {
    const part = parts.find(p => p.type === type);
    return part ? parseInt(part.value, 10) : 0;
  };
  const getStr = (type: string) => {
    const part = parts.find(p => p.type === type);
    return part?.value || '';
  };
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour') === 24 ? 0 : get('hour'),
    minute: get('minute'),
    weekday: getStr('weekday'),
  };
}

function dateFromTimezone(
  year: number, month: number, day: number,
  hour: number, minute: number, second: number,
  timezone: string = TIMEZONE
): Date {
  const rough = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const parts = getPartsInTimezone(rough, timezone);
  const diffHours = hour - parts.hour;
  const diffMinutes = minute - parts.minute;
  const diffDays = day - parts.day;
  let totalMinutesDiff = diffDays * 24 * 60 + diffHours * 60 + diffMinutes;
  if (diffDays > 15) totalMinutesDiff -= 28 * 24 * 60;
  if (diffDays < -15) totalMinutesDiff += 28 * 24 * 60;
  const adjusted = new Date(rough.getTime() + totalMinutesDiff * 60 * 1000);
  const verify = getPartsInTimezone(adjusted, timezone);
  if (verify.hour !== hour || verify.minute !== minute || verify.day !== day) {
    const finalDiff = (hour - verify.hour) * 60 + (minute - verify.minute);
    return new Date(adjusted.getTime() + finalDiff * 60 * 1000);
  }
  return adjusted;
}

interface Lesson {
  id: string;
  student_id: string;
  subject: string;
  scheduled_at: string;
  duration_min: number;
  status: string;
  session_id: string | null;
}

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  Fix DST-Shifted Lessons${DRY_RUN ? ' (DRY RUN)' : ''}`);
  console.log(`${'='.repeat(60)}\n`);

  // Fetch all future scheduled lessons from March 8 onwards
  const { data: lessons, error } = await supabase
    .from('scheduled_lessons')
    .select('id, student_id, subject, scheduled_at, duration_min, status, session_id')
    .gte('scheduled_at', DST_DATE.toISOString())
    .eq('status', 'scheduled')
    .order('scheduled_at', { ascending: true });

  if (error) {
    console.error('Error fetching lessons:', error);
    process.exit(1);
  }

  if (!lessons || lessons.length === 0) {
    console.log('No lessons found after DST date.');
    return;
  }

  console.log(`Found ${lessons.length} lessons after DST transition date.`);

  // Also fetch pre-DST lessons to find reference times
  const preDstStart = new Date(DST_DATE);
  preDstStart.setDate(preDstStart.getDate() - 60); // Look back 60 days

  const { data: preDstLessons, error: preDstError } = await supabase
    .from('scheduled_lessons')
    .select('id, student_id, subject, scheduled_at, duration_min, status, session_id')
    .gte('scheduled_at', preDstStart.toISOString())
    .lt('scheduled_at', DST_DATE.toISOString())
    .eq('status', 'scheduled')
    .order('scheduled_at', { ascending: true });

  if (preDstError) {
    console.error('Error fetching pre-DST lessons:', preDstError);
    process.exit(1);
  }

  // Build reference time map: for each student+subject, what's their expected wall-clock time?
  const referenceTimeMap = new Map<string, { hour: number; minute: number; weekday: string }>();

  for (const lesson of (preDstLessons || [])) {
    const date = new Date(lesson.scheduled_at);
    const parts = getPartsInTimezone(date);
    const key = `${lesson.student_id}|${lesson.subject}`;
    // Use the most recent pre-DST lesson as reference
    referenceTimeMap.set(key, {
      hour: parts.hour,
      minute: parts.minute,
      weekday: parts.weekday,
    });
  }

  console.log(`Found ${referenceTimeMap.size} unique student+subject combinations with pre-DST reference times.\n`);

  // Check each post-DST lesson against reference
  const fixNeeded: Array<{ lesson: Lesson; expectedHour: number; expectedMinute: number; currentHour: number; currentMinute: number }> = [];

  for (const lesson of lessons) {
    const key = `${lesson.student_id}|${lesson.subject}`;
    const ref = referenceTimeMap.get(key);
    if (!ref) continue; // No reference, skip

    const date = new Date(lesson.scheduled_at);
    const parts = getPartsInTimezone(date);

    // Check if the time shifted by exactly 1 hour (DST shift)
    if (parts.minute === ref.minute && parts.hour === ref.hour + 1) {
      fixNeeded.push({
        lesson,
        expectedHour: ref.hour,
        expectedMinute: ref.minute,
        currentHour: parts.hour,
        currentMinute: parts.minute,
      });
    }
  }

  if (fixNeeded.length === 0) {
    console.log('No DST-shifted lessons found. All times look correct.');
    return;
  }

  console.log(`Found ${fixNeeded.length} lessons that need DST correction:\n`);

  // Group by student for readable output
  const byStudent = new Map<string, typeof fixNeeded>();
  for (const fix of fixNeeded) {
    const key = `${fix.lesson.student_id}|${fix.lesson.subject}`;
    const arr = byStudent.get(key) || [];
    arr.push(fix);
    byStudent.set(key, arr);
  }

  // Fetch student names for display
  const studentIds = [...new Set(fixNeeded.map(f => f.lesson.student_id))];
  const { data: students } = await supabase
    .from('students')
    .select('id, name')
    .in('id', studentIds);

  const studentNameMap = new Map(students?.map(s => [s.id, s.name]) || []);

  for (const [key, fixes] of byStudent) {
    const [studentId, subject] = key.split('|');
    const name = studentNameMap.get(studentId) || studentId;
    console.log(`  ${name} (${subject}):`);
    console.log(`    ${fixes.length} lessons: ${fixes[0].currentHour}:${fixes[0].currentMinute.toString().padStart(2, '0')} -> ${fixes[0].expectedHour}:${fixes[0].expectedMinute.toString().padStart(2, '0')}`);
    for (const fix of fixes) {
      const date = new Date(fix.lesson.scheduled_at);
      const parts = getPartsInTimezone(date);
      console.log(`    - ${parts.year}-${parts.month.toString().padStart(2, '0')}-${parts.day.toString().padStart(2, '0')} ${parts.weekday}`);
    }
    console.log();
  }

  if (DRY_RUN) {
    console.log('DRY RUN - no changes made. Run without --dry-run to apply fixes.');
    return;
  }

  // Apply fixes
  console.log('Applying fixes...\n');
  let fixed = 0;
  let errors = 0;

  for (const fix of fixNeeded) {
    const date = new Date(fix.lesson.scheduled_at);
    const parts = getPartsInTimezone(date);

    // Reconstruct the correct UTC time with the expected wall-clock time
    const corrected = dateFromTimezone(
      parts.year, parts.month, parts.day,
      fix.expectedHour, fix.expectedMinute, 0
    );

    const { error: updateError } = await supabase
      .from('scheduled_lessons')
      .update({ scheduled_at: corrected.toISOString() })
      .eq('id', fix.lesson.id);

    if (updateError) {
      console.error(`  Error fixing lesson ${fix.lesson.id}:`, updateError);
      errors++;
    } else {
      fixed++;
    }
  }

  // Also fix lesson_sessions if they exist
  const sessionIds = [...new Set(fixNeeded
    .filter(f => f.lesson.session_id)
    .map(f => f.lesson.session_id!))];

  if (sessionIds.length > 0) {
    console.log(`\nFixing ${sessionIds.length} associated lesson sessions...`);
    for (const sessionId of sessionIds) {
      // Get the first lesson in this session to determine correct time
      const sessionFix = fixNeeded.find(f => f.lesson.session_id === sessionId);
      if (!sessionFix) continue;

      const date = new Date(sessionFix.lesson.scheduled_at);
      const parts = getPartsInTimezone(date);
      const corrected = dateFromTimezone(
        parts.year, parts.month, parts.day,
        sessionFix.expectedHour, sessionFix.expectedMinute, 0
      );

      const { error: sessError } = await supabase
        .from('lesson_sessions')
        .update({ scheduled_at: corrected.toISOString() })
        .eq('id', sessionId);

      if (sessError) {
        console.error(`  Error fixing session ${sessionId}:`, sessError);
      }
    }
  }

  console.log(`\nDone! Fixed ${fixed} lessons, ${errors} errors.`);
}

main().catch(console.error);
