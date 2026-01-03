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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows, getSubjectColor } from '../../src/theme';
import {
  useWeekGroupedLessons,
  useCreateLesson,
  useUpdateLesson,
  useCompleteLesson,
  useCancelLesson,
  useUncompleteLesson,
  useDeleteLesson,
  useCreateGroupedLesson,
  useDeleteLessonSession,
  useFindRecurringSeries,
  useDeleteLessonSeries,
} from '../../src/hooks/useLessons';
import { useStudents } from '../../src/hooks/useStudents';
import { useAuthContext } from '../../src/contexts/AuthContext';
import {
  ScheduledLessonWithStudent,
  CreateScheduledLessonInput,
  UpdateScheduledLessonInput,
  GroupedLesson,
  TutoringSubject,
} from '../../src/types/database';
import { LessonFormModal, LessonFormData, SessionFormData } from '../../src/components/LessonFormModal';
import { LessonDetailModal } from '../../src/components/LessonDetailModal';

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

// Days of the week
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function CalendarScreen() {
  const { isTutor } = useAuthContext();
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()));
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
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
  const createLesson = useCreateLesson();
  const createGroupedLesson = useCreateGroupedLesson();
  const updateLesson = useUpdateLesson();
  const completeLesson = useCompleteLesson();
  const cancelLesson = useCancelLesson();
  const uncompleteLesson = useUncompleteLesson();
  const deleteLesson = useDeleteLesson();
  const deleteLessonSession = useDeleteLessonSession();
  const { findSeries, findSessionSeries } = useFindRecurringSeries();
  const deleteLessonSeries = useDeleteLessonSeries();

  // Series state for delete series functionality
  const [seriesLessonIds, setSeriesLessonIds] = useState<string[]>([]);
  const [seriesSessionIds, setSeriesSessionIds] = useState<string[]>([]);
  const [isSessionSeries, setIsSessionSeries] = useState(false);

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
  const lessonsByDate = useMemo(() => {
    const map = new Map<string, GroupedLesson[]>();

    groupedLessons.forEach(group => {
      const dateKey = formatDateKey(new Date(group.scheduled_at));
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
    await refetch();
    setRefreshing(false);
  };

  const handleGroupedLessonPress = async (groupedLesson: GroupedLesson) => {
    setSelectedGroupedLesson(groupedLesson);
    // For now, use the first lesson for the detail modal
    setSelectedLesson(groupedLesson.lessons[0]);
    setShowDetailModal(true);

    // Find recurring series for delete series functionality
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

    // Create a session for each date
    for (const date of datesToCreate) {
      const sessionInput = {
        scheduled_at: date.toISOString(),
        duration_min: sessionData.duration_min,
        notes: sessionData.notes,
      };

      const lessonInputs = sessionData.lessons.map(lesson => ({
        student_id: lesson.student_id,
        subject: lesson.subject,
        scheduled_at: date.toISOString(),
        duration_min: sessionData.duration_min,
      }));

      await createGroupedLesson.mutate(sessionInput, lessonInputs);
    }

    await refetch();
  };

  const handleUpdateLesson = async (data: LessonFormData) => {
    if (!selectedLesson) return;
    const input: UpdateScheduledLessonInput = {
      student_id: data.student_id,
      subject: data.subject,
      scheduled_at: data.scheduled_at,
      duration_min: data.duration_min,
      notes: data.notes,
    };
    await updateLesson.mutate(selectedLesson.id, input);
    await refetch();
    setSelectedLesson(null);
    setSelectedGroupedLesson(null);
  };

  const handleCompleteLesson = async (notes?: string) => {
    if (!selectedGroupedLesson) return;
    // Complete all lessons in the group
    for (const lesson of selectedGroupedLesson.lessons) {
      await completeLesson.mutate(lesson.id, notes);
    }
    await refetch();
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
    setShowDetailModal(false);
    setShowEditModal(true);
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
          <Text style={styles.title}>Lesson Calendar</Text>
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
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          {weekDays.map((day, index) => {
            const dateKey = formatDateKey(day);
            const dayLessons = lessonsByDate.get(dateKey) || [];
            const today = isToday(day);

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
                  {dayLessons.length === 0 ? (
                    <View style={styles.emptyDay}>
                      <Text style={styles.emptyDayText}>No lessons</Text>
                    </View>
                  ) : (
                    dayLessons.map((group, groupIndex) => {
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
                    })
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
        }}
        onEdit={handleEditFromDetail}
        onComplete={handleCompleteLesson}
        onCancel={handleCancelLesson}
        onUncomplete={isTutor ? handleUncompleteLesson : undefined}
        onDelete={isTutor ? handleDeleteLesson : undefined}
        onDeleteSeries={
          isTutor && (seriesLessonIds.length > 1 || seriesSessionIds.length > 1)
            ? handleDeleteLessonSeries
            : undefined
        }
        seriesCount={isSessionSeries ? seriesSessionIds.length : seriesLessonIds.length}
        isTutor={isTutor}
      />
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
  lessonTime: {
    width: 70,
    marginRight: spacing.sm,
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
