/**
 * Fix DST-Shifted Lesson Timestamps
 *
 * Due to a bug where recurring lessons were generated using naive millisecond
 * arithmetic (24h * 60m * 60s * 1000ms per day), lessons created before DST
 * spring-forward (March 8, 2026) for dates after DST have their timestamps
 * shifted by 1 hour. This script identifies and corrects those timestamps.
 *
 * The bug: `new Date(d.getTime() + 7 * 86400000)` doesn't account for the
 * 23-hour day during spring-forward, causing all subsequent times to shift.
 *
 * Usage:
 *   npx tsx scripts/fix-dst-shifted-lessons.ts --dry-run  # Preview changes
 *   npx tsx scripts/fix-dst-shifted-lessons.ts             # Execute fixes
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const DRY_RUN = process.argv.includes('--dry-run');
const TUTOR_TIMEZONE = 'America/Los_Angeles';

// DST spring-forward: March 8, 2026, 2:00 AM PST → 3:00 AM PDT
// In UTC: March 8, 2026, 10:00 UTC
const DST_TRANSITION_UTC = new Date('2026-03-08T10:00:00Z');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY ||
                    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
                    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Timezone-aware utilities (same as dateUtils.ts)
function getPartsInTimezone(date: Date, timezone: string = TUTOR_TIMEZONE) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => {
    const part = parts.find(p => p.type === type);
    return part ? parseInt(part.value, 10) : 0;
  };
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour') === 24 ? 0 : get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

function dateFromTimezone(
  year: number, month: number, day: number,
  hour: number, minute: number, second: number,
  timezone: string = TUTOR_TIMEZONE
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

function getDayOfWeek(date: Date): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TUTOR_TIMEZONE,
    weekday: 'short',
  });
  const dayMap: Record<string, number> = {
    'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6,
  };
  return dayMap[formatter.format(date)] ?? date.getDay();
}

function getTimeString(date: Date): string {
  const parts = getPartsInTimezone(date);
  return `${parts.hour.toString().padStart(2, '0')}:${parts.minute.toString().padStart(2, '0')}`;
}

async function main() {
  console.log('='.repeat(60));
  console.log('Fix DST-Shifted Lesson Timestamps');
  console.log('='.repeat(60));
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes will be made)' : 'EXECUTE'}`);
  console.log(`Timezone: ${TUTOR_TIMEZONE}`);
  console.log(`DST transition: March 8, 2026 at 2:00 AM PST`);
  console.log('');

  // Fetch all lessons after DST transition
  const { data: lessons, error } = await supabase
    .from('scheduled_lessons')
    .select('id, student_id, subject, scheduled_at, duration_min, session_id, status, created_at')
    .gte('scheduled_at', DST_TRANSITION_UTC.toISOString())
    .order('scheduled_at', { ascending: true });

  if (error) {
    console.error('Error fetching lessons:', error);
    process.exit(1);
  }

  if (!lessons || lessons.length === 0) {
    console.log('No lessons found after DST transition.');
    return;
  }

  console.log(`Found ${lessons.length} lessons after DST transition`);

  // Fetch lessons before DST to establish canonical wall-clock times
  const { data: preDstLessons, error: preDstError } = await supabase
    .from('scheduled_lessons')
    .select('id, student_id, subject, scheduled_at, duration_min, session_id, status, created_at')
    .lt('scheduled_at', DST_TRANSITION_UTC.toISOString())
    .gte('scheduled_at', '2026-01-01T00:00:00Z')
    .order('scheduled_at', { ascending: true });

  if (preDstError) {
    console.error('Error fetching pre-DST lessons:', preDstError);
    process.exit(1);
  }

  console.log(`Found ${preDstLessons?.length || 0} lessons before DST for reference`);
  console.log('');

  // Build canonical time map from pre-DST lessons
  // Key: student_id|subject|dayOfWeek|duration
  // Value: time string (HH:MM) in tutor timezone
  const canonicalTimes = new Map<string, string>();

  for (const lesson of (preDstLessons || [])) {
    const date = new Date(lesson.scheduled_at);
    const dow = getDayOfWeek(date);
    const time = getTimeString(date);
    const key = `${lesson.student_id}|${lesson.subject}|${dow}|${lesson.duration_min}`;
    canonicalTimes.set(key, time);
  }

  console.log(`Identified ${canonicalTimes.size} canonical time slots from pre-DST lessons`);
  console.log('');

  // Check each post-DST lesson against canonical times
  let fixCount = 0;
  let skipCount = 0;
  const fixes: Array<{ id: string; oldTime: string; newTime: string; student: string; subject: string; date: string }> = [];

  for (const lesson of lessons) {
    const date = new Date(lesson.scheduled_at);
    const dow = getDayOfWeek(date);
    const currentTime = getTimeString(date);
    const parts = getPartsInTimezone(date);

    const key = `${lesson.student_id}|${lesson.subject}|${dow}|${lesson.duration_min}`;
    const canonicalTime = canonicalTimes.get(key);

    if (!canonicalTime) {
      skipCount++;
      continue;
    }

    // Check if the current time is exactly 1 hour later than canonical
    const [canonHour, canonMin] = canonicalTime.split(':').map(Number);
    const [currHour, currMin] = currentTime.split(':').map(Number);

    const canonMinutes = canonHour * 60 + canonMin;
    const currMinutes = currHour * 60 + currMin;
    const diff = currMinutes - canonMinutes;

    if (diff === 60) {
      // Off by exactly 1 hour — this is a DST-shifted lesson
      const dateStr = `${parts.year}-${parts.month.toString().padStart(2, '0')}-${parts.day.toString().padStart(2, '0')}`;
      const correctedDate = dateFromTimezone(
        parts.year, parts.month, parts.day,
        canonHour, canonMin, 0
      );

      fixes.push({
        id: lesson.id,
        oldTime: `${dateStr} ${currentTime}`,
        newTime: `${dateStr} ${canonicalTime}`,
        student: lesson.student_id,
        subject: lesson.subject,
        date: dateStr,
      });

      if (!DRY_RUN) {
        const { error: updateError } = await supabase
          .from('scheduled_lessons')
          .update({
            scheduled_at: correctedDate.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', lesson.id);

        if (updateError) {
          console.error(`Error updating lesson ${lesson.id}:`, updateError);
          continue;
        }
      }

      fixCount++;
    } else if (diff === 0) {
      skipCount++;
    } else {
      skipCount++;
    }
  }

  // Also fix lesson_sessions that are DST-shifted
  const { data: sessions, error: sessionError } = await supabase
    .from('lesson_sessions')
    .select('id, scheduled_at')
    .gte('scheduled_at', DST_TRANSITION_UTC.toISOString());

  if (!sessionError && sessions) {
    console.log(`Checking ${sessions.length} lesson sessions...`);
    let sessionFixCount = 0;

    for (const session of sessions) {
      const sessionDate = new Date(session.scheduled_at);
      const sessionParts = getPartsInTimezone(sessionDate);
      const sessionTime = getTimeString(sessionDate);
      const sessionDateStr = `${sessionParts.year}-${sessionParts.month.toString().padStart(2, '0')}-${sessionParts.day.toString().padStart(2, '0')}`;

      // Check if there's a corresponding fix for lessons at this time
      const matchingFix = fixes.find(f => {
        const fixOldTime = f.oldTime.split(' ')[1];
        return f.date === sessionDateStr && fixOldTime === sessionTime;
      });

      if (matchingFix) {
        const newTime = matchingFix.newTime.split(' ')[1];
        const [h, m] = newTime.split(':').map(Number);
        const correctedDate = dateFromTimezone(
          sessionParts.year, sessionParts.month, sessionParts.day,
          h, m, 0
        );

        if (!DRY_RUN) {
          const { error: updateError } = await supabase
            .from('lesson_sessions')
            .update({ scheduled_at: correctedDate.toISOString() })
            .eq('id', session.id);

          if (updateError) {
            console.error(`Error updating session ${session.id}:`, updateError);
            continue;
          }
        }
        sessionFixCount++;
      }
    }
    console.log(`Sessions ${DRY_RUN ? 'to fix' : 'fixed'}: ${sessionFixCount}`);
  }

  // Get student names for display
  if (fixes.length > 0) {
    const studentIds = [...new Set(fixes.map(f => f.student))];
    const { data: students } = await supabase
      .from('students')
      .select('id, name')
      .in('id', studentIds);

    const nameMap = new Map<string, string>();
    for (const s of students || []) {
      nameMap.set(s.id, s.name);
    }

    console.log('\n' + '-'.repeat(60));
    console.log('DST-SHIFTED LESSONS:');
    console.log('-'.repeat(60));

    for (const fix of fixes.slice(0, 50)) {
      const name = nameMap.get(fix.student) || fix.student.slice(0, 8);
      console.log(`  ${name} (${fix.subject}) ${fix.oldTime} → ${fix.newTime}`);
    }
    if (fixes.length > 50) {
      console.log(`  ... and ${fixes.length - 50} more`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Lessons ${DRY_RUN ? 'to fix' : 'fixed'}: ${fixCount}`);
  console.log(`Lessons skipped (already correct or no reference): ${skipCount}`);

  if (DRY_RUN) {
    console.log('\nThis was a DRY RUN. No changes were made.');
    console.log('Run without --dry-run to execute the fixes.');
  } else {
    console.log('\nAll DST-shifted lessons have been corrected!');
  }
}

main().catch(console.error);
