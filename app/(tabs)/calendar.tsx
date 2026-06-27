/**
 * Calendar Screen
 * Week view calendar for scheduling and managing tutoring lessons
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
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
import { useTutorBranding, getDateKeyInTimezone, DEFAULT_TIMEZONE } from '../../src/hooks/useTutorBranding';
import { getWeekStartInTimezone, addDaysInTimezone, getWeekDaysInTimezone, getDayInTimezone, getDayOfWeekInTimezone, getPartsInTimezone, isSameDayInTimezone, formatTimeInTimezone } from '../../src/utils/dateUtils';
import { supabase } from '../../src/lib/supabase';
import { prepaidCoverage } from '../../src/lib/prepaidCoverage';
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
  useConvertLessonToSession,
  useDeleteLessonSession,
  useFindRecurringSeries,
  useDeleteLessonSeries,
} from '../../src/hooks/useLessons';
import { buildSessionLessonPlan } from '../../src/lib/sessionPlan';
import { generateRecurringDates } from '../../src/lib/recurrence';
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
import { useQuickInvoice, useIncrementSessionUsage, useMarkPaymentPaid, useMarkLessonsPaid } from '../../src/hooks/usePayments';
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

// Helper to get the Monday of the current week (fallback for initial render before timezone loads)
function getWeekStart(date: Date): Date {
  // Use DEFAULT_TIMEZONE for DST-safe initial calculation
  return getWeekStartInTimezone(date, DEFAULT_TIMEZONE);
}

// Helper to format date as key (using local date, not UTC)
function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper to format ISO timestamp to date key in the tutor's configured timezone
// This ensures lessons are displayed on the correct day regardless of user's local timezone
// since times should be shown in the tutor's business timezone
function formatISOToDateKey(isoString: string, timezone: string): string {
  // Parse the ISO string and format in the specified timezone
  const date = new Date(isoString);

  // Use Intl.DateTimeFormat to get the date parts in the configured timezone
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
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
  const [selectedLessonPaid, setSelectedLessonPaid] = useState<boolean | null>(null);
  const [selectedPaymentLessonIds, setSelectedPaymentLessonIds] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Multi-select mode state
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Fetch tutor branding (includes timezone) - must be before lesson fetch for timezone
  const { data: tutorBranding } = useTutorBranding();
  const tutorTimezone = tutorBranding?.timezone || DEFAULT_TIMEZONE;

  // Fetch data - now using grouped lessons with timezone-aware query range
  const { data: groupedLessons, loading, error, refetch } = useWeekGroupedLessons(weekStart, tutorTimezone);

  // Refetch when tab gains focus (e.g., after tutor approves a reschedule on another screen)
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );
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
  const convertLessonToSession = useConvertLessonToSession();
  const updateLesson = useUpdateLesson();
  const updateLessonSeries = useUpdateLessonSeries(tutorTimezone);
  const completeLesson = useCompleteLesson();
  const cancelLesson = useCancelLesson();
  const uncompleteLesson = useUncompleteLesson();
  const deleteLesson = useDeleteLesson();
  const deleteLessonSession = useDeleteLessonSession();
  const { findSeries, findSessionSeries } = useFindRecurringSeries(tutorTimezone);
  const deleteLessonSeries = useDeleteLessonSeries();
  const quickInvoice = useQuickInvoice();
  const incrementSessionUsage = useIncrementSessionUsage();
  const markPaymentPaid = useMarkPaymentPaid();
  const { markLessonsPaid } = useMarkLessonsPaid();

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
  // Use tutor's configured timezone for consistent display
  const lessonsByDate = useMemo(() => {
    const map = new Map<string, GroupedLesson[]>();

    groupedLessons.forEach(group => {
      const dateKey = formatISOToDateKey(group.scheduled_at, tutorTimezone);
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
  }, [groupedLessons, tutorTimezone]);

  // Generate week days (timezone-aware for DST safety)
  const weekDays = useMemo(() => {
    return getWeekDaysInTimezone(weekStart, tutorTimezone);
  }, [weekStart, tutorTimezone]);

  // Helper to get breaks for a specific date (timezone-aware)
  const getBreaksForDate = useCallback((date: Date): TutorBreak[] => {
    if (!isTutor || !weeklyBreaks) return [];
    const dayOfWeek = getDayOfWeekInTimezone(date, tutorTimezone); // 0=Sunday, 6=Saturday
    return weeklyBreaks.get(dayOfWeek) || [];
  }, [isTutor, weeklyBreaks, tutorTimezone]);

  // Navigation (timezone-aware to handle DST transitions correctly)
  const goToPreviousWeek = () => {
    setWeekStart(addDaysInTimezone(weekStart, -7, tutorTimezone));
  };

  const goToNextWeek = () => {
    setWeekStart(addDaysInTimezone(weekStart, 7, tutorTimezone));
  };

  const goToToday = () => {
    setWeekStart(getWeekStartInTimezone(new Date(), tutorTimezone));
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

    // Expand the recurrence into individual dates (timezone-aware / DST-safe).
    const startDate = new Date(data.scheduled_at);
    const endDate = data.recurrence_end_date
      ? new Date(data.recurrence_end_date)
      : addDaysInTimezone(startDate, 365, tutorTimezone); // Default 1 year

    const datesToCreate = generateRecurringDates(
      startDate, data.recurrence, endDate, tutorTimezone, data.recurrence_weeks
    );

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
    // Generate dates for recurring sessions (timezone-aware / DST-safe).
    const startDate = new Date(sessionData.scheduled_at);
    let datesToCreate: Date[] = [startDate];

    if (sessionData.recurrence && sessionData.recurrence !== 'none') {
      const endDate = sessionData.recurrence_end_date
        ? new Date(sessionData.recurrence_end_date)
        : addDaysInTimezone(startDate, 365, tutorTimezone); // Default 1 year

      datesToCreate = generateRecurringDates(
        startDate, sessionData.recurrence, endDate, tutorTimezone, sessionData.recurrence_weeks
      );
    }

    // Per-lesson durations (group lesson / sequential / multi-subject scenarios)
    // are computed by buildSessionLessonPlan — see src/lib/sessionPlan.ts
    const plan = buildSessionLessonPlan(
      sessionData.lessons,
      sessionData.duration_min,
      (subject) => getSubjectRateConfig(tutorSettings, subject).base_duration
    );

    // Create a session for each date
    for (const date of datesToCreate) {
      const sessionInput = {
        scheduled_at: date.toISOString(),
        duration_min: plan.totalDuration,
        notes: sessionData.notes,
      };
      const lessonInputs = plan.lessons.map(lesson => ({
        ...lesson,
        scheduled_at: date.toISOString(),
      }));

      await createGroupedLesson.mutate(sessionInput, lessonInputs);
    }

    await refetch();
  };

  // Convert a standalone lesson into a Combined Session (edit mode with
  // multiple students/subjects selected)
  const handleConvertToSession = async (sessionData: SessionFormData) => {
    if (!selectedLesson) return;
    if (selectedLesson.session_id) {
      throw new Error('This lesson is already part of a combined session');
    }

    const plan = buildSessionLessonPlan(
      sessionData.lessons,
      sessionData.duration_min,
      (subject) => getSubjectRateConfig(tutorSettings, subject).base_duration
    );

    const success = await convertLessonToSession.mutate(
      {
        id: selectedLesson.id,
        student_id: selectedLesson.student_id,
        subject: selectedLesson.subject,
        scheduled_at: selectedLesson.scheduled_at,
        duration_min: selectedLesson.duration_min,
        session_id: selectedLesson.session_id,
      },
      {
        scheduled_at: sessionData.scheduled_at,
        duration_min: plan.totalDuration,
        notes: sessionData.notes,
      },
      plan.lessons.map(lesson => ({
        ...lesson,
        scheduled_at: sessionData.scheduled_at,
      }))
    );

    if (!success) {
      // Hook state updates aren't visible synchronously; surface a generic
      // message and let the form modal display it
      throw new Error('Failed to convert lesson to a combined session');
    }

    await refetch();
    setShowEditModal(false);
    setSelectedLesson(null);
    setSelectedGroupedLesson(null);
    setSeriesLessonIds([]);
    setSeriesSessionIds([]);
    setIsEditSeriesMode(false);
  };

  const handleUpdateLesson = async (data: LessonFormData) => {
    if (!selectedLesson) return;

    // Extract the new time from the scheduled_at (in tutor's timezone)
    const newDate = new Date(data.scheduled_at);
    const newTime = formatTimeInTimezone(newDate, tutorTimezone);

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

  // Save an inline note from the detail modal without opening the full edit form.
  // For a combined session, apply the same note to every lesson in the group.
  const handleSaveLessonNotes = async (notes: string) => {
    const ids = selectedGroupedLesson?.lessons?.map(l => l.id)
      ?? (selectedLesson ? [selectedLesson.id] : []);
    for (const id of ids) {
      await updateLesson.mutate(id, { notes: notes || null });
    }
    await refetch();
  };

  // After completing prepaid-subject lessons, flag any that had no prepaid
  // balance to draw from. `useCompleteLesson` only increments an EXISTING prepaid
  // package; with no package for the month (or one that's exhausted) the session
  // is completed but silently uncharged. Mirrors that hook's lookup so a lesson is
  // flagged exactly when the increment had nothing to record against.
  const warnUncoveredPrepaid = async (lessons: ScheduledLessonWithStudent[]) => {
    const uncovered: string[] = [];
    for (const lesson of lessons) {
      const parent = lesson.student.parent;
      const prepaidSubjects = ((parent as { prepaid_subjects?: string[] }).prepaid_subjects || [])
        .map((s: string) => s.toLowerCase());
      const isFullyPrepaid = parent.billing_mode === 'prepaid' && prepaidSubjects.length === 0;
      const isSubjectPrepaid = isFullyPrepaid || prepaidSubjects.includes(lesson.subject.toLowerCase());
      if (!isSubjectPrepaid) continue;

      const lessonDate = new Date(lesson.scheduled_at);
      const monthStart = new Date(lessonDate.getFullYear(), lessonDate.getMonth(), 1)
        .toISOString().split('T')[0];

      // Subject-specific package first, then legacy null-subject only when the
      // family has no per-subject prepaid config (matches useCompleteLesson).
      const { data: subjectPrepaid } = await supabase
        .from('payments')
        .select('sessions_used, sessions_prepaid')
        .eq('parent_id', parent.id)
        .eq('month', monthStart)
        .eq('payment_type', 'prepaid')
        .eq('subject', lesson.subject)
        .maybeSingle();

      let row = subjectPrepaid;
      if (!row && prepaidSubjects.length === 0) {
        const { data: legacyPrepaid } = await supabase
          .from('payments')
          .select('sessions_used, sessions_prepaid')
          .eq('parent_id', parent.id)
          .eq('month', monthStart)
          .eq('payment_type', 'prepaid')
          .is('subject', null)
          .maybeSingle();
        row = legacyPrepaid;
      }

      if (prepaidCoverage(row) === 'uncovered') {
        uncovered.push(`• ${lesson.student.name} (${lesson.subject})`);
      }
    }

    if (uncovered.length > 0) {
      Alert.alert(
        'No prepaid balance',
        `These completed prepaid lesson(s) had no active prepaid package for the month, ` +
          `so they were not charged:\n\n${uncovered.join('\n')}\n\n` +
          `Add a prepaid package for the family, or switch them to invoicing, to bill these sessions.`,
      );
    }
  };

  const handleCompleteLesson = async (notes?: string, cancelledLessonIds: string[] = []) => {
    if (!selectedGroupedLesson) return;

    // Complete attending students; cancel (no charge) any the tutor marked canceled.
    // Cancelled lessons keep status 'cancelled', so they're excluded from invoicing and prepaid.
    for (const lesson of selectedGroupedLesson.lessons) {
      if (cancelledLessonIds.includes(lesson.id)) {
        await cancelLesson.mutate(lesson.id);
      } else {
        await completeLesson.mutate(lesson.id, notes);
      }
    }
    await refetch();

    // Only attending (non-cancelled) students drive invoice/prepaid logic.
    const billableLessons = selectedGroupedLesson.lessons.filter(
      (lesson) => !cancelledLessonIds.includes(lesson.id)
    );

    // Auto-generate invoice for non-prepaid subjects
    // Prepaid session usage is already handled in useCompleteLesson hook
    // Get unique parents and check which have invoice-subject lessons
    const parentMap = new Map<string, {
      id: string;
      billing_mode: 'invoice' | 'prepaid';
      prepaid_subjects: string[];
      hasInvoiceSubjects: boolean;
    }>();
    for (const lesson of billableLessons) {
      const parent = lesson.student.parent;
      if (!parentMap.has(parent.id)) {
        const prepaidSubjects: string[] = ((parent as { prepaid_subjects?: string[] }).prepaid_subjects || [])
          .map((s: string) => s.toLowerCase());
        parentMap.set(parent.id, {
          id: parent.id,
          billing_mode: parent.billing_mode,
          prepaid_subjects: prepaidSubjects,
          hasInvoiceSubjects: false,
        });
      }
      // Check if this lesson's subject is NOT prepaid (needs invoicing)
      const parentInfo = parentMap.get(parent.id)!;
      const isFullyPrepaid = parentInfo.billing_mode === 'prepaid' && parentInfo.prepaid_subjects.length === 0;
      const isSubjectPrepaid = isFullyPrepaid || parentInfo.prepaid_subjects.includes(lesson.subject.toLowerCase());
      if (!isSubjectPrepaid) {
        parentInfo.hasInvoiceSubjects = true;
      }
    }

    // Process each parent - only generate invoices for parents with non-prepaid subjects
    const lessonDate = new Date(selectedGroupedLesson.scheduled_at);
    for (const [parentId, parentInfo] of parentMap) {
      if (parentInfo.hasInvoiceSubjects) {
        // Generate/update invoice for non-prepaid-subject lessons
        const payment = await quickInvoice.generateQuickInvoice(parentId, lessonDate);
        if (!payment) {
          const parentName = selectedGroupedLesson.lessons.find(
            l => l.student.parent.id === parentId
          )?.student?.parent?.name ?? 'Unknown';
          Alert.alert(
            'Invoice Error',
            `Failed to generate invoice for ${parentName}. You can generate it manually from the Payments page.`
          );
        }
      }
      // Prepaid subjects: session usage already incremented in useCompleteLesson
    }

    // Flag prepaid lessons that had no balance to draw from (silent no-charge).
    await warnUncoveredPrepaid(billableLessons);
  };

  const handleCompleteLessonAndPay = async (notes?: string, cancelledLessonIds: string[] = []) => {
    if (!selectedGroupedLesson) return;

    // Complete attending students; cancel (no charge) any the tutor marked canceled.
    for (const lesson of selectedGroupedLesson.lessons) {
      if (cancelledLessonIds.includes(lesson.id)) {
        await cancelLesson.mutate(lesson.id);
      } else {
        await completeLesson.mutate(lesson.id, notes);
      }
    }
    await refetch();

    // Only attending (non-cancelled) students drive invoice/prepaid logic.
    const billableLessons = selectedGroupedLesson.lessons.filter(
      (lesson) => !cancelledLessonIds.includes(lesson.id)
    );

    // Auto-generate invoice and mark as paid for non-prepaid subjects
    const parentMap = new Map<string, {
      id: string;
      billing_mode: 'invoice' | 'prepaid';
      prepaid_subjects: string[];
      hasInvoiceSubjects: boolean;
    }>();
    for (const lesson of billableLessons) {
      const parent = lesson.student.parent;
      if (!parentMap.has(parent.id)) {
        const prepaidSubjects: string[] = ((parent as { prepaid_subjects?: string[] }).prepaid_subjects || [])
          .map((s: string) => s.toLowerCase());
        parentMap.set(parent.id, {
          id: parent.id,
          billing_mode: parent.billing_mode,
          prepaid_subjects: prepaidSubjects,
          hasInvoiceSubjects: false,
        });
      }
      const parentInfo = parentMap.get(parent.id)!;
      const isFullyPrepaid = parentInfo.billing_mode === 'prepaid' && parentInfo.prepaid_subjects.length === 0;
      const isSubjectPrepaid = isFullyPrepaid || parentInfo.prepaid_subjects.includes(lesson.subject.toLowerCase());
      if (!isSubjectPrepaid) {
        parentInfo.hasInvoiceSubjects = true;
      }
    }

    const lessonDate = new Date(selectedGroupedLesson.scheduled_at);
    for (const [parentId, parentInfo] of parentMap) {
      if (parentInfo.hasInvoiceSubjects) {
        // Generate invoice then mark as paid for non-prepaid-subject lessons
        const payment = await quickInvoice.generateQuickInvoice(parentId, lessonDate);
        if (payment) {
          await markPaymentPaid.mutate(payment.id);
        } else {
          const parentName = selectedGroupedLesson.lessons.find(
            l => l.student.parent.id === parentId
          )?.student?.parent?.name ?? 'Unknown';
          Alert.alert(
            'Invoice Error',
            `Failed to generate invoice for ${parentName}. You can generate it manually from the Payments page.`
          );
        }
      }
      // Prepaid subjects: session usage already incremented in useCompleteLesson
    }

    // Flag prepaid lessons that had no balance to draw from (silent no-charge).
    await warnUncoveredPrepaid(billableLessons);
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

  // Check if a date is today (timezone-aware)
  const isToday = (date: Date): boolean => {
    return isSameDayInTimezone(date, new Date(), tutorTimezone);
  };

  // Format week range for header (timezone-aware)
  const weekRangeText = useMemo(() => {
    const endDate = addDaysInTimezone(weekStart, 6, tutorTimezone);
    const startParts = getPartsInTimezone(weekStart, tutorTimezone);
    const endParts = getPartsInTimezone(endDate, tutorTimezone);
    const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const startMonth = monthNames[startParts.month];
    const endMonth = monthNames[endParts.month];

    if (startMonth === endMonth) {
      return `${startMonth} ${startParts.day} - ${endParts.day}, ${startParts.year}`;
    }
    return `${startMonth} ${startParts.day} - ${endMonth} ${endParts.day}, ${startParts.year}`;
  }, [weekStart, tutorTimezone]);

  // Derive paid/unpaid for the selected completed lesson from payment_lessons.
  useEffect(() => {
    let active = true;
    (async () => {
      const lessons = selectedGroupedLesson?.lessons ?? [];
      const completed = lessons.filter(l => l.status === 'completed');
      if (completed.length === 0) {
        setSelectedLessonPaid(null);
        setSelectedPaymentLessonIds([]);
        return;
      }
      const { data } = await supabase
        .from('payment_lessons')
        .select('id, paid')
        .in('lesson_id', completed.map(l => l.id));
      if (!active) return;
      const rows = data ?? [];
      setSelectedPaymentLessonIds(rows.map(r => r.id));
      // No invoice rows -> prepaid-covered completion -> treat as paid.
      setSelectedLessonPaid(rows.length === 0 ? true : rows.every(r => r.paid === true));
    })();
    return () => { active = false; };
  }, [selectedGroupedLesson]);

  // Toggle invoiced lessons between paid/unpaid from the detail modal.
  const handleSetLessonPaid = async (paid: boolean) => {
    if (selectedPaymentLessonIds.length === 0) return;
    const result = await markLessonsPaid(selectedPaymentLessonIds, paid);
    if (result.success) {
      setSelectedLessonPaid(paid);
    } else {
      Alert.alert('Error', result.error || 'Failed to update payment status.');
    }
  };

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
            // Use tutor's configured timezone for consistency with lesson grouping
            const dateKey = formatISOToDateKey(day.toISOString(), tutorTimezone);
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
                sortTime: formatTimeInTimezone(new Date(lesson.scheduled_at), tutorTimezone), // HH:MM in tutor timezone
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
                      {getDayInTimezone(day, tutorTimezone)}
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

                      // Format time range (in tutor's timezone for consistency)
                      const startTime = new Date(group.scheduled_at);
                      const endTime = new Date(group.end_time);
                      const startTimeString = startTime.toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true,
                        timeZone: tutorTimezone,
                      });
                      const endTimeString = endTime.toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true,
                        timeZone: tutorTimezone,
                      });

                      // Format student names (join with &)
                      const studentNamesDisplay = group.student_names.join(' & ');

                      // First non-empty note among the grouped lessons, shown as a preview
                      const lessonNote = group.lessons.find(l => l.notes?.trim())?.notes?.trim();

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
                                group.lessons.map(l => [l.student?.id ?? '', {
                                  id: l.student?.id ?? '',
                                  name: l.student?.name ?? 'Student',
                                  avatar_url: l.student?.avatar_url,
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
                            {lessonNote && (
                              <View style={styles.lessonNoteRow}>
                                <Ionicons
                                  name="document-text-outline"
                                  size={12}
                                  color={colors.neutral.textMuted}
                                />
                                <Text style={styles.lessonNoteText} numberOfLines={1}>
                                  {lessonNote}
                                </Text>
                              </View>
                            )}
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
        onSubmitSession={
          // Conversion to a combined session is only offered when editing a
          // single standalone lesson (not a series, not an existing session)
          !isEditSeriesMode && !selectedLesson?.session_id ? handleConvertToSession : undefined
        }
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
        onCompleteAndPay={isTutor ? handleCompleteLessonAndPay : undefined}
        onCancel={handleCancelLesson}
        onUncomplete={isTutor ? handleUncompleteLesson : undefined}
        onDelete={isTutor ? handleDeleteLesson : undefined}
        onDeleteSeries={
          isTutor && (seriesLessonIds.length > 1 || seriesSessionIds.length > 1)
            ? handleDeleteLessonSeries
            : undefined
        }
        onRequestReschedule={!isTutor ? handleRequestReschedule : undefined}
        onSaveNotes={isTutor ? handleSaveLessonNotes : undefined}
        seriesCount={isSessionSeries ? seriesSessionIds.length : seriesLessonIds.length}
        isTutor={isTutor}
        paid={selectedLessonPaid}
        onMarkPaid={isTutor && selectedPaymentLessonIds.length > 0 ? () => handleSetLessonPaid(true) : undefined}
        onMarkUnpaid={isTutor && selectedPaymentLessonIds.length > 0 ? () => handleSetLessonPaid(false) : undefined}
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
  lessonNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  lessonNoteText: {
    flex: 1,
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
    fontStyle: 'italic',
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
