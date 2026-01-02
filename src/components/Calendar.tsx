import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows, getSubjectColor } from '../theme';

// Types
interface Lesson {
  id: string;
  studentName: string;
  subject: 'piano' | 'math';
  time: string;
  duration: number;
  status: 'scheduled' | 'completed' | 'cancelled';
}

interface CalendarDay {
  date: Date;
  isToday: boolean;
  isSelected: boolean;
  lessons: Lesson[];
}

// Utility functions
function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

function getWeekDays(date: Date): Date[] {
  const week: Date[] = [];
  const start = new Date(date);
  const day = start.getDay();
  start.setDate(start.getDate() - day); // Start from Sunday

  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    week.push(d);
  }
  return week;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Week view header
interface WeekHeaderProps {
  currentDate: Date;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
}

function WeekHeader({ currentDate, onPrevWeek, onNextWeek, onToday }: WeekHeaderProps) {
  const month = MONTHS[currentDate.getMonth()];
  const year = currentDate.getFullYear();

  return (
    <View style={styles.weekHeader}>
      <View style={styles.weekHeaderTitle}>
        <Text style={styles.monthText}>{month} {year}</Text>
        <Pressable onPress={onToday} style={styles.todayButton}>
          <Text style={styles.todayButtonText}>Today</Text>
        </Pressable>
      </View>
      <View style={styles.weekNavigation}>
        <Pressable onPress={onPrevWeek} style={styles.navButton}>
          <Ionicons name="chevron-back" size={24} color={colors.neutral.text} />
        </Pressable>
        <Pressable onPress={onNextWeek} style={styles.navButton}>
          <Ionicons name="chevron-forward" size={24} color={colors.neutral.text} />
        </Pressable>
      </View>
    </View>
  );
}

// Day selector
interface DaySelectorProps {
  days: Date[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  lessonCounts: Record<string, { piano: number; math: number }>;
}

function DaySelector({ days, selectedDate, onSelectDate, lessonCounts }: DaySelectorProps) {
  const today = new Date();

  return (
    <View style={styles.daySelector}>
      {days.map((day) => {
        const isSelected = isSameDay(day, selectedDate);
        const isToday = isSameDay(day, today);
        const dateKey = day.toISOString().split('T')[0];
        const counts = lessonCounts[dateKey] || { piano: 0, math: 0 };
        const hasLessons = counts.piano > 0 || counts.math > 0;

        return (
          <Pressable
            key={day.toISOString()}
            onPress={() => onSelectDate(day)}
            style={[
              styles.dayItem,
              isSelected && styles.dayItemSelected,
              isToday && !isSelected && styles.dayItemToday,
            ]}
          >
            <Text
              style={[
                styles.dayName,
                isSelected && styles.dayTextSelected,
              ]}
            >
              {DAYS[day.getDay()]}
            </Text>
            <Text
              style={[
                styles.dayNumber,
                isSelected && styles.dayTextSelected,
                isToday && !isSelected && styles.dayNumberToday,
              ]}
            >
              {day.getDate()}
            </Text>
            {hasLessons && (
              <View style={styles.lessonDots}>
                {counts.piano > 0 && <View style={[styles.dot, { backgroundColor: colors.piano.primary }]} />}
                {counts.math > 0 && <View style={[styles.dot, { backgroundColor: colors.math.primary }]} />}
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

// Time slot component
interface TimeSlotProps {
  time: string;
  lessons: Lesson[];
  onLessonPress?: (id: string) => void;
  onEmptyPress?: () => void;
}

function TimeSlot({ time, lessons, onLessonPress, onEmptyPress }: TimeSlotProps) {
  const displayTime = formatTime(time);

  return (
    <View style={styles.timeSlot}>
      <Text style={styles.timeText}>{displayTime}</Text>
      <View style={styles.slotContent}>
        {lessons.length === 0 ? (
          <Pressable onPress={onEmptyPress} style={styles.emptySlot}>
            <Ionicons name="add" size={20} color={colors.neutral.textMuted} />
          </Pressable>
        ) : (
          lessons.map((lesson) => (
            <Pressable
              key={lesson.id}
              onPress={() => onLessonPress?.(lesson.id)}
              style={[
                styles.lessonSlot,
                { backgroundColor: getSubjectColor(lesson.subject).subtle },
                { borderLeftColor: getSubjectColor(lesson.subject).primary },
              ]}
            >
              <View style={styles.lessonSlotHeader}>
                <Text style={styles.lessonStudentName}>{lesson.studentName}</Text>
                <Text style={[styles.lessonSubject, { color: getSubjectColor(lesson.subject).primary }]}>
                  {lesson.subject === 'piano' ? '🎹' : '➗'} {lesson.duration}min
                </Text>
              </View>
              {lesson.status === 'completed' && (
                <View style={styles.completedBadge}>
                  <Ionicons name="checkmark" size={12} color={colors.math.primary} />
                  <Text style={styles.completedText}>Done</Text>
                </View>
              )}
              {lesson.status === 'cancelled' && (
                <View style={[styles.completedBadge, { backgroundColor: '#FFEBEE' }]}>
                  <Ionicons name="close" size={12} color={colors.status.error} />
                  <Text style={[styles.completedText, { color: colors.status.error }]}>Cancelled</Text>
                </View>
              )}
            </Pressable>
          ))
        )}
      </View>
    </View>
  );
}

// Main calendar component
interface CalendarProps {
  lessons?: Array<{
    id: string;
    studentName: string;
    subject: 'piano' | 'math';
    scheduledAt: Date;
    duration: number;
    status: 'scheduled' | 'completed' | 'cancelled';
  }>;
  onLessonPress?: (id: string) => void;
  onAddLesson?: (date: Date, time: string) => void;
}

export function Calendar({ lessons = [], onLessonPress, onAddLesson }: CalendarProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekStart, setWeekStart] = useState(new Date());

  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);

  // Group lessons by date
  const lessonsByDate = useMemo(() => {
    const grouped: Record<string, Array<{ time: string; lessons: Lesson[] }>> = {};

    lessons.forEach((lesson) => {
      const dateKey = lesson.scheduledAt.toISOString().split('T')[0];
      const timeKey = lesson.scheduledAt.toTimeString().slice(0, 5);

      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }

      let timeSlot = grouped[dateKey].find((s) => s.time === timeKey);
      if (!timeSlot) {
        timeSlot = { time: timeKey, lessons: [] };
        grouped[dateKey].push(timeSlot);
      }

      timeSlot.lessons.push({
        id: lesson.id,
        studentName: lesson.studentName,
        subject: lesson.subject,
        time: timeKey,
        duration: lesson.duration,
        status: lesson.status,
      });
    });

    // Sort time slots
    Object.keys(grouped).forEach((key) => {
      grouped[key].sort((a, b) => a.time.localeCompare(b.time));
    });

    return grouped;
  }, [lessons]);

  // Count lessons by date for dots
  const lessonCounts = useMemo(() => {
    const counts: Record<string, { piano: number; math: number }> = {};

    lessons.forEach((lesson) => {
      const dateKey = lesson.scheduledAt.toISOString().split('T')[0];
      if (!counts[dateKey]) {
        counts[dateKey] = { piano: 0, math: 0 };
      }
      counts[dateKey][lesson.subject]++;
    });

    return counts;
  }, [lessons]);

  const selectedDateKey = selectedDate.toISOString().split('T')[0];
  const selectedDaySlots = lessonsByDate[selectedDateKey] || [];

  // Generate time slots for the day (8 AM to 8 PM)
  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    for (let hour = 8; hour <= 20; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
    }
    return slots;
  }, []);

  const handlePrevWeek = () => {
    const newStart = new Date(weekStart);
    newStart.setDate(newStart.getDate() - 7);
    setWeekStart(newStart);
  };

  const handleNextWeek = () => {
    const newStart = new Date(weekStart);
    newStart.setDate(newStart.getDate() + 7);
    setWeekStart(newStart);
  };

  const handleToday = () => {
    const today = new Date();
    setSelectedDate(today);
    setWeekStart(today);
  };

  return (
    <View style={styles.container}>
      <WeekHeader
        currentDate={weekStart}
        onPrevWeek={handlePrevWeek}
        onNextWeek={handleNextWeek}
        onToday={handleToday}
      />

      <DaySelector
        days={weekDays}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        lessonCounts={lessonCounts}
      />

      <ScrollView style={styles.timeGrid} showsVerticalScrollIndicator={false}>
        {timeSlots.map((time) => {
          const slot = selectedDaySlots.find((s) => s.time === time);
          return (
            <TimeSlot
              key={time}
              time={time}
              lessons={slot?.lessons || []}
              onLessonPress={onLessonPress}
              onEmptyPress={() => onAddLesson?.(selectedDate, time)}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.surface,
  },

  // Week header
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  weekHeaderTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  monthText: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  todayButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.piano.subtle,
    borderRadius: borderRadius.full,
  },
  todayButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.piano.primary,
  },
  weekNavigation: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  navButton: {
    padding: spacing.sm,
  },

  // Day selector
  daySelector: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  dayItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    marginHorizontal: 2,
  },
  dayItemSelected: {
    backgroundColor: colors.piano.primary,
  },
  dayItemToday: {
    backgroundColor: colors.neutral.background,
  },
  dayName: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textSecondary,
    marginBottom: 4,
  },
  dayNumber: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  dayNumberToday: {
    color: colors.piano.primary,
  },
  dayTextSelected: {
    color: colors.neutral.textInverse,
  },
  lessonDots: {
    flexDirection: 'row',
    marginTop: 4,
    gap: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  // Time grid
  timeGrid: {
    flex: 1,
    padding: spacing.base,
  },
  timeSlot: {
    flexDirection: 'row',
    minHeight: 60,
    marginBottom: spacing.md,
  },
  timeText: {
    width: 70,
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    paddingTop: spacing.xs,
  },
  slotContent: {
    flex: 1,
    gap: spacing.sm,
  },
  emptySlot: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderStyle: 'dashed',
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lessonSlot: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderLeftWidth: 4,
  },
  lessonSlotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lessonStudentName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
  },
  lessonSubject: {
    fontSize: typography.sizes.sm,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.math.subtle,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  completedText: {
    fontSize: typography.sizes.xs,
    color: colors.math.primary,
    fontWeight: typography.weights.medium,
  },
});

export default Calendar;
