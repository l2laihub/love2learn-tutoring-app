/**
 * Extend Recurring Lessons Script
 *
 * This script identifies recurring lesson series that are ending soon
 * and extends them by adding new lesson instances for 1 year from today.
 *
 * Usage:
 *   npx tsx scripts/extend-recurring-lessons.ts --dry-run  # Preview changes
 *   npx tsx scripts/extend-recurring-lessons.ts            # Execute changes
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Types
interface ScheduledLesson {
  id: string;
  student_id: string;
  subject: string;
  scheduled_at: string;
  duration_min: number;
  status: string;
  notes: string | null;
  session_id: string | null;
}

interface LessonSession {
  id: string;
  scheduled_at: string;
  duration_min: number;
  notes: string | null;
}

interface RecurringSeries {
  key: string;
  lessons: ScheduledLesson[];
  interval: 'weekly' | 'biweekly' | 'monthly' | 'unknown';
  intervalDays: number;
  lastDate: Date;
  studentId: string;
  subject: string;
  durationMin: number;
  dayOfWeek: number;
  timeOfDay: string;
  sessionId: string | null;
  notes: string | null;
}

interface SessionSeries {
  key: string;
  sessions: Array<{
    session: LessonSession;
    lessons: ScheduledLesson[];
  }>;
  interval: 'weekly' | 'biweekly' | 'monthly' | 'unknown';
  intervalDays: number;
  lastDate: Date;
  dayOfWeek: number;
  timeOfDay: string;
  totalDurationMin: number;
  notes: string | null;
  studentSubjects: Array<{ studentId: string; subject: string; durationMin: number }>;
}

// Configuration
const DRY_RUN = process.argv.includes('--dry-run');
const TARGET_DATE = new Date();
TARGET_DATE.setFullYear(TARGET_DATE.getFullYear() + 1); // 1 year from today

// Initialize Supabase client
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY ||
                    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
                    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Missing Supabase credentials in .env file');
  console.error('Required: EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (or anon key)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Utility functions
function getDayOfWeek(date: Date): number {
  return date.getDay();
}

function getTimeOfDay(date: Date): string {
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

function detectInterval(dates: Date[]): { type: 'weekly' | 'biweekly' | 'monthly' | 'unknown'; days: number } {
  if (dates.length < 2) {
    return { type: 'unknown', days: 0 };
  }

  // Sort dates
  const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime());

  // Calculate intervals between consecutive dates
  const intervals: number[] = [];
  for (let i = 1; i < sortedDates.length; i++) {
    const diffMs = sortedDates[i].getTime() - sortedDates[i - 1].getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    intervals.push(diffDays);
  }

  // Find the most common interval
  const intervalCounts = new Map<number, number>();
  for (const interval of intervals) {
    intervalCounts.set(interval, (intervalCounts.get(interval) || 0) + 1);
  }

  let mostCommonInterval = 0;
  let maxCount = 0;
  for (const [interval, count] of intervalCounts) {
    if (count > maxCount) {
      maxCount = count;
      mostCommonInterval = interval;
    }
  }

  // Classify the interval
  if (mostCommonInterval >= 6 && mostCommonInterval <= 8) {
    return { type: 'weekly', days: 7 };
  } else if (mostCommonInterval >= 13 && mostCommonInterval <= 15) {
    return { type: 'biweekly', days: 14 };
  } else if (mostCommonInterval >= 28 && mostCommonInterval <= 31) {
    return { type: 'monthly', days: 0 }; // Monthly uses setMonth, not fixed days
  }

  return { type: 'unknown', days: mostCommonInterval };
}

function generateNewDates(lastDate: Date, interval: 'weekly' | 'biweekly' | 'monthly' | 'unknown', intervalDays: number, targetDate: Date): Date[] {
  const newDates: Date[] = [];
  let currentDate = new Date(lastDate);

  while (true) {
    if (interval === 'monthly') {
      currentDate = new Date(currentDate);
      currentDate.setMonth(currentDate.getMonth() + 1);
    } else if (intervalDays > 0) {
      currentDate = new Date(currentDate.getTime() + intervalDays * 24 * 60 * 60 * 1000);
    } else {
      break; // Unknown interval, can't generate
    }

    if (currentDate > targetDate) {
      break;
    }

    newDates.push(new Date(currentDate));
  }

  return newDates;
}

async function fetchFutureLessons(): Promise<ScheduledLesson[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('scheduled_lessons')
    .select('*')
    .gte('scheduled_at', today.toISOString())
    .eq('status', 'scheduled')
    .order('scheduled_at', { ascending: true });

  if (error) {
    console.error('Error fetching lessons:', error);
    throw error;
  }

  return data || [];
}

async function fetchStudentNames(studentIds: string[]): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from('students')
    .select('id, name')
    .in('id', studentIds);

  if (error) {
    console.error('Error fetching students:', error);
    return new Map();
  }

  const nameMap = new Map<string, string>();
  for (const student of data || []) {
    nameMap.set(student.id, student.name);
  }
  return nameMap;
}

function groupIntoStandaloneSeries(lessons: ScheduledLesson[]): RecurringSeries[] {
  // Filter standalone lessons (no session_id)
  const standaloneLessons = lessons.filter(l => !l.session_id);

  // Group by key: student_id + subject + dayOfWeek + timeOfDay + duration
  const groups = new Map<string, ScheduledLesson[]>();

  for (const lesson of standaloneLessons) {
    const date = new Date(lesson.scheduled_at);
    const dayOfWeek = getDayOfWeek(date);
    const timeOfDay = getTimeOfDay(date);
    const key = `${lesson.student_id}|${lesson.subject}|${dayOfWeek}|${timeOfDay}|${lesson.duration_min}`;

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(lesson);
  }

  // Convert to series and detect intervals
  const series: RecurringSeries[] = [];

  for (const [key, groupLessons] of groups) {
    if (groupLessons.length < 2) {
      continue; // Need at least 2 lessons to identify a pattern
    }

    const dates = groupLessons.map(l => new Date(l.scheduled_at));
    const { type: intervalType, days: intervalDays } = detectInterval(dates);

    if (intervalType === 'unknown' && intervalDays === 0) {
      continue; // Can't determine interval
    }

    const sortedLessons = [...groupLessons].sort(
      (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
    );
    const lastLesson = sortedLessons[sortedLessons.length - 1];
    const lastDate = new Date(lastLesson.scheduled_at);
    const firstLesson = sortedLessons[0];

    series.push({
      key,
      lessons: sortedLessons,
      interval: intervalType,
      intervalDays: intervalType === 'weekly' ? 7 : intervalType === 'biweekly' ? 14 : intervalDays,
      lastDate,
      studentId: firstLesson.student_id,
      subject: firstLesson.subject,
      durationMin: firstLesson.duration_min,
      dayOfWeek: getDayOfWeek(new Date(firstLesson.scheduled_at)),
      timeOfDay: getTimeOfDay(new Date(firstLesson.scheduled_at)),
      sessionId: null,
      notes: firstLesson.notes,
    });
  }

  return series;
}

async function groupIntoSessionSeries(lessons: ScheduledLesson[]): Promise<SessionSeries[]> {
  // Get lessons with session_id
  const sessionLessons = lessons.filter(l => l.session_id);

  if (sessionLessons.length === 0) {
    return [];
  }

  // Get unique session IDs
  const sessionIds = [...new Set(sessionLessons.map(l => l.session_id!))];

  // Fetch session details
  const { data: sessions, error } = await supabase
    .from('lesson_sessions')
    .select('*')
    .in('id', sessionIds);

  if (error) {
    console.error('Error fetching sessions:', error);
    return [];
  }

  // Create a map of session ID to session
  const sessionMap = new Map<string, LessonSession>();
  for (const session of sessions || []) {
    sessionMap.set(session.id, session);
  }

  // Group lessons by session
  const lessonsBySession = new Map<string, ScheduledLesson[]>();
  for (const lesson of sessionLessons) {
    if (!lessonsBySession.has(lesson.session_id!)) {
      lessonsBySession.set(lesson.session_id!, []);
    }
    lessonsBySession.get(lesson.session_id!)!.push(lesson);
  }

  // Build session entries
  const sessionEntries: Array<{ session: LessonSession; lessons: ScheduledLesson[] }> = [];
  for (const [sessionId, sessionLessons] of lessonsBySession) {
    const session = sessionMap.get(sessionId);
    if (session) {
      sessionEntries.push({ session, lessons: sessionLessons });
    }
  }

  // Group sessions by pattern (day of week, time of day, student-subject combo)
  const groups = new Map<string, typeof sessionEntries>();

  for (const entry of sessionEntries) {
    const date = new Date(entry.session.scheduled_at);
    const dayOfWeek = getDayOfWeek(date);
    const timeOfDay = getTimeOfDay(date);

    // Create a sorted key for student-subject combinations
    const studentSubjects = entry.lessons
      .map(l => `${l.student_id}:${l.subject}`)
      .sort()
      .join(',');

    const key = `${dayOfWeek}|${timeOfDay}|${studentSubjects}`;

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(entry);
  }

  // Convert to series
  const series: SessionSeries[] = [];

  for (const [key, entries] of groups) {
    if (entries.length < 2) {
      continue; // Need at least 2 sessions to identify a pattern
    }

    const dates = entries.map(e => new Date(e.session.scheduled_at));
    const { type: intervalType, days: intervalDays } = detectInterval(dates);

    if (intervalType === 'unknown' && intervalDays === 0) {
      continue;
    }

    const sortedEntries = [...entries].sort(
      (a, b) => new Date(a.session.scheduled_at).getTime() - new Date(b.session.scheduled_at).getTime()
    );
    const lastEntry = sortedEntries[sortedEntries.length - 1];
    const lastDate = new Date(lastEntry.session.scheduled_at);
    const firstEntry = sortedEntries[0];

    // Extract student-subject info from first entry
    const studentSubjects = firstEntry.lessons.map(l => ({
      studentId: l.student_id,
      subject: l.subject,
      durationMin: l.duration_min,
    }));

    series.push({
      key,
      sessions: sortedEntries,
      interval: intervalType,
      intervalDays: intervalType === 'weekly' ? 7 : intervalType === 'biweekly' ? 14 : intervalDays,
      lastDate,
      dayOfWeek: getDayOfWeek(new Date(firstEntry.session.scheduled_at)),
      timeOfDay: getTimeOfDay(new Date(firstEntry.session.scheduled_at)),
      totalDurationMin: firstEntry.session.duration_min,
      notes: firstEntry.session.notes,
      studentSubjects,
    });
  }

  return series;
}

async function createStandaloneLessons(series: RecurringSeries, newDates: Date[]): Promise<number> {
  if (DRY_RUN) {
    return newDates.length;
  }

  const lessonInputs = newDates.map(date => ({
    student_id: series.studentId,
    subject: series.subject,
    scheduled_at: date.toISOString(),
    duration_min: series.durationMin,
    notes: series.notes,
    status: 'scheduled',
  }));

  const { data, error } = await supabase
    .from('scheduled_lessons')
    .insert(lessonInputs)
    .select();

  if (error) {
    console.error('Error creating lessons:', error);
    throw error;
  }

  return data?.length || 0;
}

async function createSessionLessons(series: SessionSeries, newDates: Date[]): Promise<number> {
  if (DRY_RUN) {
    return newDates.length;
  }

  let createdCount = 0;

  for (const date of newDates) {
    // Create the session
    const { data: session, error: sessionError } = await supabase
      .from('lesson_sessions')
      .insert({
        scheduled_at: date.toISOString(),
        duration_min: series.totalDurationMin,
        notes: series.notes,
      })
      .select()
      .single();

    if (sessionError || !session) {
      console.error('Error creating session:', sessionError);
      continue;
    }

    // Create lessons for the session
    const lessonInputs = series.studentSubjects.map(ss => ({
      student_id: ss.studentId,
      subject: ss.subject,
      scheduled_at: date.toISOString(),
      duration_min: ss.durationMin,
      session_id: session.id,
      notes: null,
      status: 'scheduled',
    }));

    const { error: lessonsError } = await supabase
      .from('scheduled_lessons')
      .insert(lessonInputs);

    if (lessonsError) {
      console.error('Error creating session lessons:', lessonsError);
      continue;
    }

    createdCount++;
  }

  return createdCount;
}

async function main() {
  console.log('='.repeat(60));
  console.log('Extend Recurring Lessons Script');
  console.log('='.repeat(60));
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes will be made)' : 'EXECUTE'}`);
  console.log(`Target end date: ${TARGET_DATE.toDateString()}`);
  console.log('');

  // Fetch future lessons
  console.log('Fetching scheduled lessons...');
  const lessons = await fetchFutureLessons();
  console.log(`Found ${lessons.length} scheduled lessons in the future`);
  console.log('');

  // Get student names for display
  const studentIds = [...new Set(lessons.map(l => l.student_id))];
  const studentNames = await fetchStudentNames(studentIds);

  // Group into standalone series
  console.log('Analyzing standalone lesson patterns...');
  const standaloneSeries = groupIntoStandaloneSeries(lessons);
  console.log(`Found ${standaloneSeries.length} recurring standalone series`);
  console.log('');

  // Group into session series
  console.log('Analyzing combined session patterns...');
  const sessionSeries = await groupIntoSessionSeries(lessons);
  console.log(`Found ${sessionSeries.length} recurring session series`);
  console.log('');

  // Process standalone series
  let totalStandaloneLessonsCreated = 0;
  const standaloneNeedingExtension = standaloneSeries.filter(s => s.lastDate < TARGET_DATE);

  if (standaloneNeedingExtension.length > 0) {
    console.log('-'.repeat(60));
    console.log('STANDALONE SERIES NEEDING EXTENSION:');
    console.log('-'.repeat(60));

    for (const series of standaloneNeedingExtension) {
      const studentName = studentNames.get(series.studentId) || series.studentId;
      const newDates = generateNewDates(series.lastDate, series.interval, series.intervalDays, TARGET_DATE);

      if (newDates.length === 0) {
        continue;
      }

      console.log(`\n${studentName} - ${series.subject} (${series.interval})`);
      console.log(`  Current: ${series.lessons.length} lessons, last on ${series.lastDate.toDateString()}`);
      console.log(`  Day: ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][series.dayOfWeek]} at ${series.timeOfDay}`);
      console.log(`  Duration: ${series.durationMin} min`);
      console.log(`  Will add: ${newDates.length} new lessons`);
      console.log(`  New range: ${newDates[0].toDateString()} - ${newDates[newDates.length - 1].toDateString()}`);

      const created = await createStandaloneLessons(series, newDates);
      totalStandaloneLessonsCreated += created;
    }
  } else {
    console.log('No standalone series need extension.');
  }

  // Process session series
  let totalSessionsCreated = 0;
  const sessionsNeedingExtension = sessionSeries.filter(s => s.lastDate < TARGET_DATE);

  if (sessionsNeedingExtension.length > 0) {
    console.log('\n' + '-'.repeat(60));
    console.log('COMBINED SESSION SERIES NEEDING EXTENSION:');
    console.log('-'.repeat(60));

    for (const series of sessionsNeedingExtension) {
      const newDates = generateNewDates(series.lastDate, series.interval, series.intervalDays, TARGET_DATE);

      if (newDates.length === 0) {
        continue;
      }

      const participants = series.studentSubjects
        .map(ss => `${studentNames.get(ss.studentId) || ss.studentId} (${ss.subject})`)
        .join(', ');

      console.log(`\nCombined Session (${series.interval})`);
      console.log(`  Participants: ${participants}`);
      console.log(`  Current: ${series.sessions.length} sessions, last on ${series.lastDate.toDateString()}`);
      console.log(`  Day: ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][series.dayOfWeek]} at ${series.timeOfDay}`);
      console.log(`  Total duration: ${series.totalDurationMin} min`);
      console.log(`  Will add: ${newDates.length} new sessions`);
      console.log(`  New range: ${newDates[0].toDateString()} - ${newDates[newDates.length - 1].toDateString()}`);

      const created = await createSessionLessons(series, newDates);
      totalSessionsCreated += created;
    }
  } else {
    console.log('\nNo combined session series need extension.');
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Standalone lessons ${DRY_RUN ? 'to create' : 'created'}: ${totalStandaloneLessonsCreated}`);
  console.log(`Combined sessions ${DRY_RUN ? 'to create' : 'created'}: ${totalSessionsCreated}`);

  if (DRY_RUN) {
    console.log('\nThis was a DRY RUN. No changes were made.');
    console.log('Run without --dry-run to execute the changes.');
  } else {
    console.log('\nAll recurring series have been extended!');
  }
}

main().catch(console.error);
