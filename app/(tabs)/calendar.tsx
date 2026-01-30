/**
 * Calendar Screen
 * Week view calendar for scheduling and managing tutoring lessons
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows, getSubjectColor } from '../../src/theme';
import { useResponsive } from '../../src/hooks/useResponsive';
import { supabase } from '../../src/lib/supabase';
import {
  useWeekGroupedLessons,
  useCreateLesson,
  useUpdateLesson,
  useUpdateLessonSeries,
  useCompleteLesson,
  useCancelLesson,
  useUncompleteLesson,
  useDeleteLesson,
  useCreateGroupedLesson,
  useDeleteLessonSession,
  useFindRecurringSeries,
  useDeleteLessonSeries,
} from '../../src/hooks/useLessons';
import { useStudents, useStudentsByParent } from '../../src/hooks/useStudents';
import { useAuthContext } from '../../src/contexts/AuthContext';
import { useTutorSettings, getSubjectRateConfig } from '../../src/hooks/useTutorSettings';
import {
  ScheduledLessonWithStudent,
  CreateScheduledLessonInput,
  UpdateScheduledLessonInput,
  GroupedLesson,
  TutoringSubject,
} from '../../src/types/database';
import { LessonFormModal, LessonFormData, SessionFormData } from '../../src/components/LessonFormModal';
import { LessonDetailModal } from '../../src/components/LessonDetailModal';
import { RescheduleRequestModal } from '../../src/components/RescheduleRequestModal';
import { DropinRequestModal } from '../../src/components/DropinRequestModal';
import { AvailableSessionsModal } from '../../src/components/AvailableSessionsModal';
import { useWeeklyBreaks } from '../../src/hooks/useTutorBreaks';
import { useAvailableGroupSessions } from '../../src/hooks/useGroupSessions';
import { TutorBreak } from '../../src/types/database';
import { useQuickInvoice, useIncrementSessionUsage } from '../../src/hooks/usePayments';
import { formatTimeDisplay } from '../../src/hooks/useTutorAvailability';
import { StackedAvatars } from '../../src/components/AvatarUpload';

// Subject emoji mapping
const SUBJECT_EMOJI: Record<TutoringSubject, string> = {
  piano: '🎹',
  math: '➗',
  reading: '📖',
  speech: '🗣️',
  english: '📝',
};

// Subject display name mapping
const SUBJECT_NAMES: Record<TutoringSubject, string> = {
  piano: 'Piano',
  math: 'Math',
  reading: 'Reading',
  speech: 'Speech',
  english: 'English',
};

// Helper to get the Monday of the current week
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Helper to format date as key (using local date, not UTC)
function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper to format ISO timestamp to date key in Pacific timezone
// This ensures lessons are displayed on the correct day regardless of user's local timezone
// since the tutoring business operates in Pacific timezone
function formatISOToPacificDateKey(isoString: string): string {
  // Parse the ISO string and format in Pacific timezone
  const date = new Date(isoString);

  // Use Intl.DateTimeFormat to get the date parts in Pacific timezone
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  // Returns YYYY-MM-DD format
  return formatter.format(date);
}

// Days of the week
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Layout constants for responsive design
const layoutConstants = {
  contentMaxWidth: 1400, // Wider for calendar to show week view
};

export default function CalendarScreen() {
  const { isTutor, parent } = useAuthContext();
  const responsive = useResponsive();
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()));
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showDropinModal, setShowDropinModal] = useState(false);
  const [showGroupSessionsModal, setShowGroupSessionsModal] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<ScheduledLessonWithStudent | null>(null);
  const [selectedGroupedLesson, setSelectedGroupedLesson] = useState<GroupedLesson | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Multi-select mode state
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Fetch data - now using grouped lessons
  const { data: groupedLessons, loading, error, refetch } = useWeekGroupedLessons(weekStart);
  const { data: students, loading: studentsLoading } = useStudents();
  const { data: tutorSettings } = useTutorSettings();

  // Fetch parent's students (for drop-in requests)
  const { data: parentStudents } = useStudentsByParent(!isTutor ? parent?.id || null : null);

  // Fetch available group sessions count for badge (only for parents)
  const { data: availableGroupSessions } = useAvailableGroupSessions(!isTutor ? parent?.id || null : null);

  // Fetch tutor breaks (only for tutors)
  const {
    data: weeklyBreaks,
    loading: breaksLoading,
    refetch: refetchBreaks,
  } = useWeeklyBreaks(isTutor ? parent?.id : undefined);
  const createLesson = useCreateLesson();
  const createGroupedLesson = useCreateGroupedLesson();
  const updateLesson = useUpdateLesson();
  const updateLessonSeries = useUpdateLessonSeries();
  const completeLesson = useCompleteLesson();
  const cancelLesson = useCancelLesson();
  const uncompleteLesson = useUncompleteLesson();
  const deleteLesson = useDeleteLesson();
  const deleteLessonSession = useDeleteLessonSession();
  const { findSeries, findSessionSeries } = useFindRecurringSeries();
  const deleteLessonSeries = useDeleteLessonSeries();
  const quickInvoice = useQuickInvoice();
  const incrementSessionUsage = useIncrementSessionUsage();

  // Series state for delete/edit series functionality
  const [seriesLessonIds, setSeriesLessonIds] = useState<string[]>([]);
  const [seriesSessionIds, setSeriesSessionIds] = useState<string[]>([]);
  const [isSessionSeries, setIsSessionSeries] = useState(false);
  const [isEditSeriesMode, setIsEditSeriesMode] = useState(false); // true when editing entire series

  // Multi-select handlers
  const toggleSelectMode = useCallback(() => {
    setIsSelectMode(prev => !prev);
    setSelectedIds(new Set()); // Clear selection when toggling mode
  }, []);

  const toggleSelection = useCallback((groupId: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  }, []);

  const selectAll = useCallback(() => {
    const allIds = groupedLessons.map(g => g.session_id || g.lessons[0].id);
    setSelectedIds(new Set(allIds));
  }, [groupedLessons]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;

    setBulkDeleting(true);
    try {
      for (const id of selectedIds) {
        // Find the grouped lesson
        const group = groupedLessons.find(g => (g.session_id || g.lessons[0].id) === id);
        if (!group) continue;

        if (group.session_id) {
          // Delete session (which deletes all lessons in it)
          await deleteLessonSession.mutate(group.session_id);
        } else {
          // Single lesson - delete it directly
          await deleteLesson.mutate(group.lessons[0].id);
        }
      }
      await refetch();
      setSelectedIds(new Set());
      setIsSelectMode(false);
    } catch (error) {
      console.error('Bulk delete error:', error);
    } finally {
      setBulkDeleting(false);
      setShowBulkDeleteConfirm(false);
    }
  }, [selectedIds, groupedLessons, deleteLessonSession, deleteLesson, refetch]);

  // Group lessons by date for calendar display
  // Use Pacific timezone for consistent display since the tutoring business operates in Pacific
  const lessonsByDate = useMemo(() => {
    const map = new Map<string, GroupedLesson[]>();

    groupedLessons.forEach(group => {
      const dateKey = formatISOToPacificDateKey(group.scheduled_at);
      const existing = map.get(dateKey) || [];
      map.set(dateKey, [...existing, group]);
    });

    // Sort groups within each day by time
    map.forEach((dayGroups, key) => {
      map.set(key, dayGroups.sort((a, b) =>
        new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
      ));
    });
    return map;
  }, [groupedLessons]);

  // Generate week days
  const weekDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      days.push(day);
    }
    return days;
  }, [weekStart]);

  // Helper to get breaks for a specific date
  const getBreaksForDate = useCallback((date: Date): TutorBreak[] => {
    if (!isTutor || !weeklyBreaks) return [];
    const dayOfWeek = date.getDay(); // 0=Sunday, 6=Saturday
    return weeklyBreaks.get(dayOfWeek) || [];
  }, [isTutor, weeklyBreaks]);

  // Navigation
  const goToPreviousWeek = () => {
    const newStart = new Date(weekStart);
    newStart.setDate(newStart.getDate() - 7);
    setWeekStart(newStart);
  };

  const goToNextWeek = () => {
    const newStart = new Date(weekStart);
    newStart.setDate(newStart.getDate() + 7);
    setWeekStart(newStart);
  };

  const goToToday = () => {
    setWeekStart(getWeekStart(new Date()));
  };

  // Handlers
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetch(), refetchBreaks()]);
    setRefreshing(false);
  };

  const handleGroupedLessonPress = async (groupedLesson: GroupedLesson) => {
    setSelectedGroupedLesson(groupedLesson);
    // For now, use the first lesson for the detail modal
    setSelectedLesson(groupedLesson.lessons[0]);
    setShowDetailModal(true);

    // Find recurring series for delete/edit series functionality
    if (groupedLesson.session_id) {
      // Combined Session - find recurring sessions
      const sessionIds = await findSessionSeries(groupedLesson);
      setSeriesSessionIds(sessionIds);
      setSeriesLessonIds([]);
      setIsSessionSeries(true);
    } else if (groupedLesson.lessons.length === 1) {
      // Standalone lesson - find recurring lessons
      const seriesIds = await findSeries(groupedLesson.lessons[0]);
      setSeriesLessonIds(seriesIds);
      setSeriesSessionIds([]);
      setIsSessionSeries(false);
    } else {
      setSeriesLessonIds([]);
      setSeriesSessionIds([]);
      setIsSessionSeries(false);
    }
  };

  const handleCreateLesson = async (data: LessonFormData) => {
    const baseInput: CreateScheduledLessonInput = {
      student_id: data.student_id,
      subject: data.subject,
      scheduled_at: data.scheduled_at,
      duration_min: data.duration_min,
      notes: data.notes,
    };

    // If no recurrence, create single lesson
    if (!data.recurrence || data.recurrence === 'none') {
      await createLesson.mutate(baseInput);
      await refetch();
      return;
    }

    // Generate recurring dates
    const startDate = new Date(data.scheduled_at);
    const endDate = data.recurrence_end_date
      ? new Date(data.recurrence_end_date)
      : new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000); // Default 1 year

    // Calculate interval in days based on recurrence type
    let intervalDays: number;
    switch (data.recurrence) {
      case 'weekly':
        intervalDays = 7;
        break;
      case 'biweekly':
        intervalDays = 14;
        break;
      case 'monthly':
        intervalDays = 0; // Special handling for monthly
        break;
      default:
        intervalDays = 7;
    }

    const datesToCreate: Date[] = [startDate];
    let currentDate = new Date(startDate);

    // Generate dates for the recurrence period
    while (true) {
      if (data.recurrence === 'monthly') {
        // For monthly, add one month to the date
        currentDate = new Date(currentDate);
        currentDate.setMonth(currentDate.getMonth() + 1);
      } else {
        // For weekly/biweekly, add the interval days
        currentDate = new Date(currentDate.getTime() + intervalDays * 24 * 60 * 60 * 1000);
      }

      // Stop if we've passed the end date
      if (currentDate > endDate) break;

      datesToCreate.push(new Date(currentDate));
    }

    // Create lessons for all dates
    for (const date of datesToCreate) {
      const input: CreateScheduledLessonInput = {
        ...baseInput,
        scheduled_at: date.toISOString(),
      };
      await createLesson.mutate(input);
    }

    await refetch();
  };

  const handleCreateSession = async (sessionData: SessionFormData) => {
    // Generate dates for recurring sessions
    const startDate = new Date(sessionData.scheduled_at);
    let datesToCreate: Date[] = [startDate];

    // If recurrence is set, generate additional dates
    if (sessionData.recurrence && sessionData.recurrence !== 'none') {
      const endDate = sessionData.recurrence_end_date
        ? new Date(sessionData.recurrence_end_date)
        : new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000); // Default 1 year

      let intervalDays: number;
      switch (sessionData.recurrence) {
        case 'weekly':
          intervalDays = 7;
          break;
        case 'biweekly':
          intervalDays = 14;
          break;
        case 'monthly':
          intervalDays = 0; // Special handling for monthly
          break;
        default:
          intervalDays = 7;
      }

      let currentDate = new Date(startDate);

      while (true) {
        if (sessionData.recurrence === 'monthly') {
          currentDate = new Date(currentDate);
          currentDate.setMonth(currentDate.getMonth() + 1);
        } else {
          currentDate = new Date(currentDate.getTime() + intervalDays * 24 * 60 * 60 * 1000);
        }

        if (currentDate > endDate) break;
        datesToCreate.push(new Date(currentDate));
      }
    }

    // Determine how to calculate per-lesson duration:
    //
    // Scenario A1: GROUP LESSON - Multiple students, SAME subject
    //   - Ella Luong (Math) + Another student (Math) in 60min group session
    //   - Each student gets FULL session duration (they learn together)
    //   - 60min session → each student gets 60min
    //
    // Scenario A2: SEQUENTIAL LESSONS - Multiple students, DIFFERENT subjects
    //   - Long Bui (Piano) + An Bui (Speech) in 60min session
    //   - Tutor teaches one subject, then the other
    //   - Divide total session time by number of lessons
    //   - 60min session / 2 students = 30min each
    //
    // Scenario B: Same student takes MULTIPLE subjects
    //   - Lauren Vu (Piano + Reading) in one session
    //   - Use each subject's base duration from tutor settings
    //   - Piano=30min, Reading=60min → Lauren gets 30min Piano + 60min Reading
    //
    // Check if any student has multiple subjects (Scenario B)
    const studentSubjectCounts = new Map<string, number>();
    sessionData.lessons.forEach(lesson => {
      const count = studentSubjectCounts.get(lesson.student_id) || 0;
      studentSubjectCounts.set(lesson.student_id, count + 1);
    });
    const hasStudentWithMultipleSubjects = Array.from(studentSubjectCounts.values()).some(count => count > 1);

    // Check if all students have the same subject (Group Lesson - Scenario A1)
    const uniqueSubjects = new Set(sessionData.lessons.map(l => l.subject));
    const isGroupLesson = uniqueSubjects.size === 1 && sessionData.lessons.length > 1;

    // Debug logging
    console.log('=== Combined Session Creation Debug ===');
    console.log('Session duration_min:', sessionData.duration_min);
    console.log('Number of lessons:', sessionData.lessons.length);
    console.log('Lessons:', sessionData.lessons.map(l => ({ student_id: l.student_id, subject: l.subject })));
    console.log('Student subject counts:', Object.fromEntries(studentSubjectCounts));
    console.log('Has student with multiple subjects (Scenario B):', hasStudentWithMultipleSubjects);
    console.log('Is group lesson (same subject, Scenario A1):', isGroupLesson);
    console.log('Per-lesson duration (Scenario A2):', Math.floor(sessionData.duration_min / sessionData.lessons.length));

    // Create a session for each date
    for (const date of datesToCreate) {
      let lessonInputs;
      let calculatedTotalDuration: number;

      if (hasStudentWithMultipleSubjects) {
        // Scenario B: Student(s) taking multiple subjects
        // Use each subject's base duration from tutor settings
        // (e.g., Piano=30min, Reading=60min → each subject gets its standard duration)
        lessonInputs = sessionData.lessons.map(lesson => {
          const rateConfig = getSubjectRateConfig(tutorSettings, lesson.subject);
          return {
            student_id: lesson.student_id,
            subject: lesson.subject,
            scheduled_at: date.toISOString(),
            duration_min: rateConfig.base_duration,
          };
        });

        // Calculate total session duration as sum of all individual lesson durations
        calculatedTotalDuration = lessonInputs.reduce((sum, l) => sum + l.duration_min, 0);
      } else if (isGroupLesson) {
        // Scenario A1: GROUP LESSON - Multiple students learning the SAME subject together
        // Each student gets the FULL session duration (they all attend the same class)
        // E.g., 60min Math group lesson → each student gets 60min
        calculatedTotalDuration = sessionData.duration_min;

        lessonInputs = sessionData.lessons.map(lesson => ({
          student_id: lesson.student_id,
          subject: lesson.subject,
          scheduled_at: date.toISOString(),
          duration_min: sessionData.duration_min, // Full session duration for each student
        }));
      } else {
        // Scenario A2: SEQUENTIAL LESSONS - Students have DIFFERENT subjects
        // Divide total session time equally among all lessons
        // (e.g., 60min session / 2 students = 30min each, tutor teaches one then the other)
        const perLessonDuration = Math.floor(sessionData.duration_min / sessionData.lessons.length);
        calculatedTotalDuration = sessionData.duration_min;

        lessonInputs = sessionData.lessons.map(lesson => ({
          student_id: lesson.student_id,
          subject: lesson.subject,
          scheduled_at: date.toISOString(),
          duration_min: perLessonDuration,
        }));
      }

      const sessionInput = {
        scheduled_at: date.toISOString(),
        duration_min: calculatedTotalDuration,
        notes: sessionData.notes,
      };

      // Debug: Log what we're about to create
      console.log('=== Creating Session ===');
      console.log('Session input:', sessionInput);
      console.log('Lesson inputs:', lessonInputs.map(l => ({
        student_id: l.student_id,
        subject: l.subject,
        duration_min: l.duration_min
      })));

      await createGroupedLesson.mutate(sessionInput, lessonInputs);
    }

    await refetch();
  };

  const handleUpdateLesson = async (data: LessonFormData) => {
    if (!selectedLesson) return;

    // Extract the new time from the scheduled_at
    const newDate = new Date(data.scheduled_at);
    const newTime = `${newDate.getHours().toString().padStart(2, '0')}:${newDate.getMinutes().toString().padStart(2, '0')}`;

    // If editing entire series, update all lessons in the series
    if (isEditSeriesMode && seriesLessonIds.length > 1) {
      // Standalone lesson series - update all lessons with same IDs
      await updateLessonSeries.mutate(seriesLessonIds, {
        newTime,
        duration_min: data.duration_min,
        notes: data.notes,
      });
    } else if (isEditSeriesMode && seriesSessionIds.length > 1 && selectedGroupedLesson) {
      // Combined session series - find all lessons across the session series
      const { data: allSessionLessons, error: fetchError } = await supabase
        .from('scheduled_lessons')
        .select('id')
        .in('session_id', seriesSessionIds);

      if (fetchError) {
        console.error('Error fetching session lessons:', fetchError);
      } else if (allSessionLessons && allSessionLessons.length > 0) {
        const allLessonIds = allSessionLessons.map(l => l.id);
        await updateLessonSeries.mutate(allLessonIds, {
          newTime,
          duration_min: data.duration_min,
          notes: data.notes,
        });
      }
    } else {
      // Single lesson update
      const input: UpdateScheduledLessonInput = {
        student_id: data.student_id,
        subject: data.subject,
        scheduled_at: data.scheduled_at,
        duration_min: data.duration_min,
        notes: data.notes,
      };
      await updateLesson.mutate(selectedLesson.id, input);
    }

    await refetch();
    setShowEditModal(false);
    setSelectedLesson(null);
    setSelectedGroupedLesson(null);
    setSeriesLessonIds([]);
    setSeriesSessionIds([]);
    setIsEditSeriesMode(false);
  };

  const handleCompleteLesson = async (notes?: string) => {
    if (!selectedGroupedLesson) return;

    // Complete all lessons in the group
    for (const lesson of selectedGroupedLesson.lessons) {
      await completeLesson.mutate(lesson.id, notes);
    }
    await refetch();

    // Auto-generate invoice or update prepaid sessions
    // Get unique parents from the completed lessons
    const parentMap = new Map<string, { id: string; billing_mode: 'invoice' | 'prepaid' }>();
    for (const lesson of selectedGroupedLesson.lessons) {
      const parent = lesson.student.parent;
      if (!parentMap.has(parent.id)) {
        parentMap.set(parent.id, { id: parent.id, billing_mode: parent.billing_mode });
      }
    }

    // Process each parent
    const lessonDate = new Date(selectedGroupedLesson.scheduled_at);
    for (const [parentId, parentInfo] of parentMap) {
      if (parentInfo.billing_mode === 'prepaid') {
        // For prepaid families: session usage is already incremented in useCompleteLesson hook
        // No additional action needed here
      } else {
        // For invoice families: auto-generate/update invoice
        const payment = await quickInvoice.generateQuickInvoice(parentId, lessonDate);
        if (!payment && quickInvoice.error) {
          // Show error to user - invoice generation failed
          const parentName = selectedGroupedLesson.lessons.find(
            l => l.student.parent.id === parentId
          )?.student.parent.name || 'Unknown';
          Alert.alert(
            'Invoice Error',
            `Failed to generate invoice for ${parentName}: ${quickInvoice.error.message}`
          );
        }
      }
    }
  };

  const handleCancelLesson = async (reason?: string) => {
    if (!selectedGroupedLesson) return;
    // Cancel all lessons in the group
    for (const lesson of selectedGroupedLesson.lessons) {
      await cancelLesson.mutate(lesson.id, reason);
    }
    await refetch();
  };

  const handleUncompleteLesson = async () => {
    if (!selectedGroupedLesson) return;
    // Uncomplete all lessons in the group (revert to scheduled)
    for (const lesson of selectedGroupedLesson.lessons) {
      await uncompleteLesson.mutate(lesson.id);
    }
    await refetch();
  };

  const handleDeleteLesson = async () => {
    if (!selectedGroupedLesson) return;

    // If it's a session, delete the session (which deletes all lessons)
    if (selectedGroupedLesson.session_id) {
      await deleteLessonSession.mutate(selectedGroupedLesson.session_id);
    } else {
      // Single lesson - just delete it
      await deleteLesson.mutate(selectedGroupedLesson.lessons[0].id);
    }
    setSelectedLesson(null);
    setSelectedGroupedLesson(null);
    setSeriesLessonIds([]);
    setSeriesSessionIds([]);
    setIsSessionSeries(false);
    await refetch();
  };

  const handleDeleteLessonSeries = async () => {
    if (isSessionSeries) {
      // Delete Combined Session series
      if (seriesSessionIds.length === 0) return;
      await deleteLessonSeries.mutateSessions(seriesSessionIds);
    } else {
      // Delete standalone lesson series
      if (seriesLessonIds.length === 0) return;
      await deleteLessonSeries.mutate(seriesLessonIds);
    }

    setSelectedLesson(null);
    setSelectedGroupedLesson(null);
    setSeriesLessonIds([]);
    setSeriesSessionIds([]);
    setIsSessionSeries(false);
    await refetch();
  };

  const handleEditFromDetail = () => {
    setIsEditSeriesMode(false);
    setShowDetailModal(false);
    setShowEditModal(true);
  };

  const handleEditSeriesFromDetail = () => {
    setIsEditSeriesMode(true);
    setShowDetailModal(false);
    setShowEditModal(true);
  };

  // Handle reschedule request from parent
  const handleRequestReschedule = () => {
    setShowDetailModal(false);
    setShowRescheduleModal(true);
  };

  // Handle successful reschedule request
  const handleRescheduleSuccess = () => {
    setShowRescheduleModal(false);
    setSelectedLesson(null);
    // Could show a success toast here
  };

  // Check if a date is today
  const isToday = (date: Date): boolean => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  // Format week range for header
  const weekRangeText = useMemo(() => {
    const endDate = new Date(weekStart);
    endDate.setDate(endDate.getDate() + 6);
    const startMonth = weekStart.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = endDate.toLocaleDateString('en-US', { month: 'short' });
    const year = weekStart.getFullYear();

    if (startMonth === endMonth) {
      return `${startMonth} ${weekStart.getDate()} - ${endDate.getDate()}, ${year}`;
    }
    return `${startMonth} ${weekStart.getDate()} - ${endMonth} ${endDate.getDate()}, ${year}`;
  }, [weekStart]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>
            {isTutor ? 'Lesson Calendar' : 'My Schedule'}
          </Text>
          {isTutor && (
            <View style={styles.headerButtons}>
              <Pressable
                style={[styles.selectButton, isSelectMode && styles.selectButtonActive]}
                onPress={toggleSelectMode}
              >
                <Ionicons
                  name={isSelectMode ? 'close' : 'checkbox-outline'}
                  size={20}
                  color={isSelectMode ? colors.neutral.white : colors.neutral.text}
                />
                <Text style={[
                  styles.selectButtonText,
                  isSelectMode && styles.selectButtonTextActive
                ]}>
                  {isSelectMode ? 'Cancel' : 'Select'}
                </Text>
              </Pressable>
              {!isSelectMode && (
                <Pressable
                  style={styles.addButton}
                  onPress={() => setShowCreateModal(true)}
                >
                  <Ionicons name="add" size={24} color={colors.neutral.white} />
                </Pressable>
              )}
            </View>
          )}
          {!isTutor && parent && (
            <View style={styles.parentButtons}>
              <Pressable
                style={styles.groupSessionsButton}
                onPress={() => setShowGroupSessionsModal(true)}
              >
                <View style={styles.buttonWithBadge}>
                  <Ionicons name="people-outline" size={20} color={colors.secondary.main} />
                  {availableGroupSessions.length > 0 && (
                    <View style={styles.sessionBadge}>
                      <Text style={styles.sessionBadgeText}>
                        {availableGroupSessions.length}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.groupSessionsButtonText}>Group Sessions</Text>
              </Pressable>
              <Pressable
                style={styles.dropinButton}
                onPress={() => setShowDropinModal(true)}
              >
                <Ionicons name="add-circle-outline" size={20} color={colors.primary.main} />
                <Text style={styles.dropinButtonText}>Request Drop-in</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Week Navigation */}
        <View style={styles.weekNav}>
          <Pressable style={styles.navButton} onPress={goToPreviousWeek}>
            <Ionicons name="chevron-back" size={24} color={colors.neutral.text} />
          </Pressable>
          <Pressable style={styles.weekRange} onPress={goToToday}>
            <Text style={styles.weekRangeText}>{weekRangeText}</Text>
          </Pressable>
          <Pressable style={styles.navButton} onPress={goToNextWeek}>
            <Ionicons name="chevron-forward" size={24} color={colors.neutral.text} />
          </Pressable>
        </View>
      </View>

      {/* Loading State */}
      {loading && !refreshing && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.piano.primary} />
        </View>
      )}

      {/* Error State */}
      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={colors.status.error} />
          <Text style={styles.errorText}>Failed to load lessons</Text>
          <Pressable style={styles.retryButton} onPress={refetch}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {/* Week View */}
      {!loading && !error && (
        <ScrollView
          style={styles.content}
          contentContainerStyle={{
            padding: responsive.contentPadding,
            maxWidth: layoutConstants.contentMaxWidth,
            alignSelf: 'center',
            width: '100%',
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          {weekDays.map((day, index) => {
            // Use Pacific timezone for consistency with lesson grouping
            const dateKey = formatISOToPacificDateKey(day.toISOString());
            const dayLessons = lessonsByDate.get(dateKey) || [];
            const dayBreaks = getBreaksForDate(day);
            const today = isToday(day);
            const hasContent = dayLessons.length > 0 || dayBreaks.length > 0;

            // Combine and sort lessons and breaks by start time
            type CalendarItem =
              | { type: 'lesson'; data: GroupedLesson; sortTime: string }
              | { type: 'break'; data: TutorBreak; sortTime: string };

            const combinedItems: CalendarItem[] = [
              ...dayLessons.map(lesson => ({
                type: 'lesson' as const,
                data: lesson,
                sortTime: new Date(lesson.scheduled_at).toTimeString().slice(0, 5), // HH:MM
              })),
              ...dayBreaks.map(breakSlot => ({
                type: 'break' as const,
                data: breakSlot,
                sortTime: breakSlot.start_time.slice(0, 5), // HH:MM
              })),
            ].sort((a, b) => a.sortTime.localeCompare(b.sortTime));

            return (
              <View key={dateKey} style={styles.dayContainer}>
                {/* Day Header */}
                <View style={[styles.dayHeader, today && styles.dayHeaderToday]}>
                  <Text style={[styles.dayName, today && styles.dayNameToday]}>
                    {WEEKDAYS[index]}
                  </Text>
                  <View style={[styles.dayNumber, today && styles.dayNumberToday]}>
                    <Text style={[styles.dayNumberText, today && styles.dayNumberTextToday]}>
                      {day.getDate()}
                    </Text>
                  </View>
                </View>

                {/* Day Content */}
                <View style={styles.dayContent}>
                  {!hasContent ? (
                    <View style={styles.emptyDay}>
                      <Text style={styles.emptyDayText}>No lessons</Text>
                    </View>
                  ) : (
                    <>
                    {combinedItems.map((item) => {
                      if (item.type === 'break') {
                        const breakSlot = item.data;
                        return (
                          <View key={`break-${breakSlot.id}`} style={styles.breakCard}>
                            <View style={styles.breakTime}>
                              <Text style={styles.breakTimeText}>
                                {formatTimeDisplay(breakSlot.start_time)}
                              </Text>
                              <Text style={styles.breakTimeEndText}>
                                –{formatTimeDisplay(breakSlot.end_time)}
                              </Text>
                            </View>
                            <View style={styles.breakInfo}>
                              <View style={styles.breakLabel}>
                                <Ionicons name="cafe" size={14} color={colors.status.warning} />
                                <Text style={styles.breakLabelText}>Break</Text>
                              </View>
                              {breakSlot.notes && (
                                <Text style={styles.breakNotes} numberOfLines={1}>
                                  {breakSlot.notes}
                                </Text>
                              )}
                            </View>
                          </View>
                        );
                      }

                      // Lesson item
                      const group = item.data;
                      // Use the primary subject color (first subject)
                      const primarySubject = group.subjects[0];
                      const subjectColor = getSubjectColor(primarySubject);

                      // Format time range
                      const startTime = new Date(group.scheduled_at);
                      const endTime = new Date(group.end_time);
                      const startTimeString = startTime.toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true,
                      });
                      const endTimeString = endTime.toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true,
                      });

                      // Format student names (join with &)
                      const studentNamesDisplay = group.student_names.join(' & ');

                      // Format subjects display
                      const subjectsDisplay = group.subjects
                        .map(s => SUBJECT_NAMES[s])
                        .join(', ');

                      // Get emojis for all subjects
                      const subjectEmojis = group.subjects
                        .map(s => SUBJECT_EMOJI[s])
                        .join(' ');

                      // Is this a grouped session?
                      const isGroupedSession = group.session_id !== null;

                      // Unique ID for selection tracking
                      const groupId = group.session_id || group.lessons[0].id;
                      const isSelected = selectedIds.has(groupId);

                      return (
                        <Pressable
                          key={groupId}
                          style={[
                            styles.lessonCard,
                            { borderLeftColor: subjectColor.primary },
                            isGroupedSession && styles.lessonCardGrouped,
                            group.status === 'cancelled' && styles.lessonCardCancelled,
                            group.status === 'completed' && styles.lessonCardCompleted,
                            isSelectMode && isSelected && styles.lessonCardSelected,
                          ]}
                          onPress={() => {
                            if (isSelectMode) {
                              toggleSelection(groupId);
                            } else {
                              handleGroupedLessonPress(group);
                            }
                          }}
                        >
                          {/* Checkbox in select mode */}
                          {isSelectMode && (
                            <View style={styles.checkboxContainer}>
                              <View style={[
                                styles.checkbox,
                                isSelected && styles.checkboxSelected
                              ]}>
                                {isSelected && (
                                  <Ionicons
                                    name="checkmark"
                                    size={16}
                                    color={colors.neutral.white}
                                  />
                                )}
                              </View>
                            </View>
                          )}
                          <View style={styles.lessonTime}>
                            <Text style={styles.lessonTimeText}>{startTimeString}</Text>
                            <Text style={styles.lessonTimeEndText}>–{endTimeString}</Text>
                          </View>
                          {/* Student Avatars - deduplicate by student ID */}
                          <StackedAvatars
                            students={Array.from(
                              new Map(
                                group.lessons.map(l => [l.student.id, {
                                  id: l.student.id,
                                  name: l.student.name,
                                  avatar_url: l.student.avatar_url,
                                }])
                              ).values()
                            )}
                            size={28}
                            maxVisible={2}
                          />
                          <View style={styles.lessonInfo}>
                            <Text style={styles.lessonStudent} numberOfLines={1}>
                              {studentNamesDisplay}
                            </Text>
                            <View style={styles.lessonSubject}>
                              <Text style={styles.lessonSubjectIcon}>
                                {subjectEmojis}
                              </Text>
                              <Text
                                style={[
                                  styles.lessonSubjectText,
                                  { color: subjectColor.primary },
                                ]}
                                numberOfLines={1}
                              >
                                {subjectsDisplay}
                              </Text>
                            </View>
                          </View>
                          {!isSelectMode && isGroupedSession && (
                            <View style={styles.groupIndicator}>
                              <Ionicons
                                name="people"
                                size={14}
                                color={colors.neutral.textMuted}
                              />
                            </View>
                          )}
                          {!isSelectMode && group.status === 'completed' && (
                            <Ionicons
                              name="checkmark-circle"
                              size={20}
                              color={colors.status.success}
                            />
                          )}
                          {!isSelectMode && group.status === 'cancelled' && (
                            <Ionicons
                              name="close-circle"
                              size={20}
                              color={colors.status.error}
                            />
                          )}
                        </Pressable>
                      );
                    })}
                    </>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Bulk Action Bar (shown in select mode) */}
      {isSelectMode && (
        <View style={styles.bulkActionBar}>
          <View style={styles.bulkActionLeft}>
            <Pressable
              style={styles.selectAllButton}
              onPress={selectedIds.size === groupedLessons.length ? deselectAll : selectAll}
            >
              <Ionicons
                name={selectedIds.size === groupedLessons.length ? 'checkbox' : 'square-outline'}
                size={20}
                color={colors.primary.main}
              />
              <Text style={styles.selectAllText}>
                {selectedIds.size === groupedLessons.length ? 'Deselect All' : 'Select All'}
              </Text>
            </Pressable>
            <Text style={styles.selectedCount}>
              {selectedIds.size} selected
            </Text>
          </View>
          <Pressable
            style={[
              styles.bulkDeleteButton,
              selectedIds.size === 0 && styles.bulkDeleteButtonDisabled,
            ]}
            onPress={() => setShowBulkDeleteConfirm(true)}
            disabled={selectedIds.size === 0}
          >
            <Ionicons name="trash-outline" size={20} color={colors.neutral.white} />
            <Text style={styles.bulkDeleteText}>Delete</Text>
          </Pressable>
        </View>
      )}

      {/* Bulk Delete Confirmation Modal */}
      <Modal
        visible={showBulkDeleteConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBulkDeleteConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModal}>
            <View style={styles.confirmIconContainer}>
              <Ionicons name="warning" size={48} color={colors.status.error} />
            </View>
            <Text style={styles.confirmTitle}>Delete {selectedIds.size} Lessons?</Text>
            <Text style={styles.confirmMessage}>
              This action cannot be undone. All selected lessons will be permanently deleted.
            </Text>
            <View style={styles.confirmButtons}>
              <Pressable
                style={styles.confirmCancelButton}
                onPress={() => setShowBulkDeleteConfirm(false)}
                disabled={bulkDeleting}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmDeleteButton, bulkDeleting && styles.buttonDisabled]}
                onPress={handleBulkDelete}
                disabled={bulkDeleting}
              >
                {bulkDeleting ? (
                  <ActivityIndicator size="small" color={colors.neutral.white} />
                ) : (
                  <>
                    <Ionicons name="trash" size={18} color={colors.neutral.white} />
                    <Text style={styles.confirmDeleteText}>Delete</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Legend */}
      {!isSelectMode && (
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.piano.primary }]} />
            <Text style={styles.legendText}>Piano</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.math.primary }]} />
            <Text style={styles.legendText}>Math</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.subjects.reading.primary }]} />
            <Text style={styles.legendText}>Reading</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.subjects.speech.primary }]} />
            <Text style={styles.legendText}>Speech</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.subjects.english.primary }]} />
            <Text style={styles.legendText}>English</Text>
          </View>
          {isTutor && (
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.status.warning }]} />
              <Text style={styles.legendText}>Break</Text>
            </View>
          )}
        </View>
      )}

      {/* Create Lesson Modal */}
      <LessonFormModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateLesson}
        onSubmitSession={handleCreateSession}
        students={students}
        studentsLoading={studentsLoading}
        mode="create"
      />

      {/* Edit Lesson Modal */}
      <LessonFormModal
        visible={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedLesson(null);
          setSelectedGroupedLesson(null);
          setIsEditSeriesMode(false);
        }}
        onSubmit={handleUpdateLesson}
        students={students}
        studentsLoading={studentsLoading}
        initialData={selectedLesson}
        mode="edit"
      />

      {/* Lesson Detail Modal */}
      <LessonDetailModal
        visible={showDetailModal}
        lesson={selectedLesson}
        groupedLesson={selectedGroupedLesson}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedLesson(null);
          setSelectedGroupedLesson(null);
          setSeriesLessonIds([]);
          setSeriesSessionIds([]);
          setIsSessionSeries(false);
          setIsEditSeriesMode(false);
        }}
        onEdit={handleEditFromDetail}
        onEditSeries={
          isTutor && (seriesLessonIds.length > 1 || seriesSessionIds.length > 1)
            ? handleEditSeriesFromDetail
            : undefined
        }
        onComplete={handleCompleteLesson}
        onCancel={handleCancelLesson}
        onUncomplete={isTutor ? handleUncompleteLesson : undefined}
        onDelete={isTutor ? handleDeleteLesson : undefined}
        onDeleteSeries={
          isTutor && (seriesLessonIds.length > 1 || seriesSessionIds.length > 1)
            ? handleDeleteLessonSeries
            : undefined
        }
        onRequestReschedule={!isTutor ? handleRequestReschedule : undefined}
        seriesCount={isSessionSeries ? seriesSessionIds.length : seriesLessonIds.length}
        isTutor={isTutor}
      />

      {/* Reschedule Request Modal (for parents) */}
      {selectedLesson && parent && (
        <RescheduleRequestModal
          visible={showRescheduleModal}
          lesson={selectedLesson}
          groupedLesson={selectedGroupedLesson}
          parentId={parent.id}
          onClose={() => {
            setShowRescheduleModal(false);
            setSelectedLesson(null);
            setSelectedGroupedLesson(null);
          }}
          onSuccess={handleRescheduleSuccess}
        />
      )}

      {/* Drop-in Request Modal (for parents) */}
      {parent && parentStudents && (
        <DropinRequestModal
          visible={showDropinModal}
          parentId={parent.id}
          students={parentStudents}
          onClose={() => setShowDropinModal(false)}
          onSuccess={() => {
            setShowDropinModal(false);
            // Optionally show success message or refresh
          }}
        />
      )}

      {/* Available Group Sessions Modal (for parents) */}
      {parent && parentStudents && (
        <AvailableSessionsModal
          visible={showGroupSessionsModal}
          onClose={() => setShowGroupSessionsModal(false)}
          parentId={parent.id}
          students={parentStudents}
          onEnrollmentCreated={() => {
            setShowGroupSessionsModal(false);
            // Optionally refetch data
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.background,
  },
  header: {
    backgroundColor: colors.neutral.white,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
  },
  addButton: {
    backgroundColor: colors.piano.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  parentButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  groupSessionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.secondary.subtle,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.secondary.main,
  },
  groupSessionsButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.secondary.main,
  },
  buttonWithBadge: {
    position: 'relative',
  },
  sessionBadge: {
    position: 'absolute',
    top: -6,
    right: -8,
    backgroundColor: colors.status.error,
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  sessionBadgeText: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    color: colors.neutral.white,
  },
  dropinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary.subtle,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary.main,
  },
  dropinButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.primary.main,
  },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navButton: {
    padding: spacing.sm,
  },
  weekRange: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  weekRangeText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  errorText: {
    fontSize: typography.sizes.md,
    color: colors.neutral.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  retryButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.piano.primary,
    borderRadius: borderRadius.md,
  },
  retryButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.neutral.white,
  },
  dayContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.borderLight,
    minHeight: 80,
  },
  dayHeader: {
    width: 60,
    alignItems: 'center',
    paddingVertical: spacing.md,
    backgroundColor: colors.neutral.white,
    borderRightWidth: 1,
    borderRightColor: colors.neutral.borderLight,
  },
  dayHeaderToday: {
    backgroundColor: colors.piano.subtle,
  },
  dayName: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.neutral.textMuted,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  dayNameToday: {
    color: colors.piano.primary,
  },
  dayNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumberToday: {
    backgroundColor: colors.piano.primary,
  },
  dayNumberText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  dayNumberTextToday: {
    color: colors.neutral.white,
  },
  dayContent: {
    flex: 1,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  emptyDay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyDayText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
  },
  lessonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    borderLeftWidth: 4,
    ...shadows.sm,
  },
  lessonCardGrouped: {
    borderLeftWidth: 6,
  },
  lessonCardCancelled: {
    opacity: 0.6,
    backgroundColor: colors.status.errorBg,
  },
  lessonCardCompleted: {
    backgroundColor: colors.status.successBg,
  },
  // Break card styles
  breakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7', // warning subtle
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.status.warning,
  },
  breakTime: {
    width: 70,
    marginRight: spacing.sm,
  },
  breakTimeText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: '#92400E', // darker warning
  },
  breakTimeEndText: {
    fontSize: typography.sizes.xs,
    color: '#B45309', // medium warning
    marginTop: 1,
  },
  breakInfo: {
    flex: 1,
  },
  breakLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  breakLabelText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: '#92400E',
  },
  breakNotes: {
    fontSize: typography.sizes.xs,
    color: '#B45309',
    marginTop: 2,
  },
  lessonTime: {
    width: 70,
  },
  lessonTimeText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  lessonTimeEndText: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
    marginTop: 1,
  },
  lessonDuration: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
  },
  groupIndicator: {
    marginRight: spacing.xs,
    padding: spacing.xs,
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.sm,
  },
  lessonInfo: {
    flex: 1,
  },
  lessonStudent: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
    marginBottom: 2,
  },
  lessonSubject: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  lessonSubjectIcon: {
    fontSize: 12,
  },
  lessonSubjectText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.neutral.white,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textSecondary,
  },
  // Multi-select mode styles
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    backgroundColor: colors.neutral.white,
  },
  selectButtonActive: {
    backgroundColor: colors.status.error,
    borderColor: colors.status.error,
  },
  selectButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
  },
  selectButtonTextActive: {
    color: colors.neutral.white,
  },
  lessonCardSelected: {
    backgroundColor: colors.primary.subtle,
    borderWidth: 2,
    borderColor: colors.primary.main,
  },
  checkboxContainer: {
    marginRight: spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.neutral.border,
    backgroundColor: colors.neutral.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.primary.main,
    borderColor: colors.primary.main,
  },
  bulkActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    backgroundColor: colors.neutral.white,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
    ...shadows.md,
  },
  bulkActionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  selectAllText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.primary.main,
  },
  selectedCount: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },
  bulkDeleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    backgroundColor: colors.status.error,
    borderRadius: borderRadius.md,
  },
  bulkDeleteButtonDisabled: {
    backgroundColor: colors.neutral.textMuted,
  },
  bulkDeleteText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
  },
  // Confirmation modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.neutral.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  confirmModal: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    ...shadows.xl,
  },
  confirmIconContainer: {
    marginBottom: spacing.md,
  },
  confirmTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  confirmMessage: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
  },
  confirmCancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    alignItems: 'center',
  },
  confirmCancelText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
  },
  confirmDeleteButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.status.error,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  confirmDeleteText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
