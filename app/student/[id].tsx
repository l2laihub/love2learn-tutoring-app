/**
 * Student Detail Screen
 * Displays detailed information about a specific student
 */

import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useStudent, useUpdateStudent, useDeleteStudent } from '../../src/hooks/useStudents';
import { useParents } from '../../src/hooks/useParents';
import { useLessons } from '../../src/hooks/useLessons';
import { StudentFormModal } from '../../src/components/StudentFormModal';
import { colors, spacing, typography, borderRadius } from '../../src/theme';
import { UpdateStudentInput, ScheduledLessonWithStudent, SubjectRates } from '../../src/types/database';
import { StudentRateSettingsModal } from '../../src/components/StudentRateSettingsModal';

// Lesson status filter for the schedule section
type LessonStatusFilter = 'all' | 'scheduled' | 'completed' | 'cancelled';

const STATUS_FILTERS: { key: LessonStatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

// Helper to format date for display
const formatLessonDate = (dateString: string): string => {
  const date = new Date(dateString);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const isToday = date.toDateString() === today.toDateString();
  const isTomorrow = date.toDateString() === tomorrow.toDateString();

  if (isToday) return 'Today';
  if (isTomorrow) return 'Tomorrow';

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
};

// Helper to format time for display
const formatLessonTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

// Get status color and icon
const getStatusConfig = (status: string): { color: string; icon: string; label: string } => {
  switch (status) {
    case 'completed':
      return { color: colors.status.success, icon: 'checkmark-circle', label: 'Completed' };
    case 'cancelled':
      return { color: colors.status.error, icon: 'close-circle', label: 'Cancelled' };
    default:
      return { color: colors.piano.primary, icon: 'time', label: 'Scheduled' };
  }
};

export default function StudentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: student, loading, error, refetch } = useStudent(id || null);
  const { data: parents } = useParents();
  const { data: lessons, loading: lessonsLoading } = useLessons({ studentId: id || undefined });
  const { mutate: updateStudent, loading: updating } = useUpdateStudent();
  const { mutate: deleteStudent, loading: deleting } = useDeleteStudent();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [rateModalVisible, setRateModalVisible] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<LessonStatusFilter>('all');

  // Counts per status across ALL of this student's lessons, for the filter chips.
  const statusCounts = useMemo(() => {
    const counts = { all: lessons.length, scheduled: 0, completed: 0, cancelled: 0 };
    lessons.forEach(lesson => {
      if (lesson.status === 'scheduled') counts.scheduled += 1;
      else if (lesson.status === 'completed') counts.completed += 1;
      else if (lesson.status === 'cancelled') counts.cancelled += 1;
    });
    return counts;
  }, [lessons]);

  // Organize the lessons matching the active status filter into upcoming
  // (future scheduled) and recent (everything else). No date or count caps —
  // every lesson is reachable so the totals always match what's shown.
  const { upcomingLessons, pastLessons } = useMemo(() => {
    const now = new Date();
    const upcoming: ScheduledLessonWithStudent[] = [];
    const past: ScheduledLessonWithStudent[] = [];

    lessons
      .filter(lesson => statusFilter === 'all' || lesson.status === statusFilter)
      .forEach(lesson => {
        const lessonDate = new Date(lesson.scheduled_at);
        if (lessonDate >= now && lesson.status === 'scheduled') {
          upcoming.push(lesson);
        } else {
          past.push(lesson);
        }
      });

    // Sort upcoming by date ascending (soonest first)
    upcoming.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
    // Sort past by date descending (most recent first)
    past.sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());

    return { upcomingLessons: upcoming, pastLessons: past };
  }, [lessons, statusFilter]);

  const visibleLessonCount = upcomingLessons.length + pastLessons.length;

  // The "past" group holds different things depending on the active filter:
  // overdue lessons when viewing scheduled, completed/cancelled when filtered,
  // and a mix when viewing all.
  const pastGroupLabel =
    statusFilter === 'scheduled' ? 'Overdue'
    : statusFilter === 'completed' ? 'Completed'
    : statusFilter === 'cancelled' ? 'Cancelled'
    : 'Recent';

  const handleEditStudent = () => {
    setEditModalVisible(true);
  };

  const handleSaveStudent = async (data: UpdateStudentInput): Promise<boolean> => {
    if (!id) return false;
    const result = await updateStudent(id, data);
    if (result) {
      await refetch();
      return true;
    }
    return false;
  };

  const handleSaveRates = async (subjectRates: SubjectRates): Promise<boolean> => {
    if (!id) return false;
    const result = await updateStudent(id, { subject_rates: subjectRates });
    if (result) {
      await refetch();
      return true;
    }
    return false;
  };

  const handleViewParent = () => {
    if (student?.parent?.id) {
      router.push(`/parent/${student.parent.id}`);
    }
  };

  const handleCallParent = () => {
    if (student?.parent?.phone) {
      const phoneUrl = Platform.OS === 'ios'
        ? `telprompt:${student.parent.phone}`
        : `tel:${student.parent.phone}`;
      Linking.openURL(phoneUrl).catch(() => {
        Alert.alert('Error', 'Unable to make phone call');
      });
    }
  };

  const handleEmailParent = () => {
    if (student?.parent?.email) {
      Linking.openURL(`mailto:${student.parent.email}`).catch(() => {
        Alert.alert('Error', 'Unable to open email app');
      });
    }
  };

  const handleDeleteStudent = () => {
    if (Platform.OS === 'web') {
      setShowDeleteConfirm(true);
    } else {
      Alert.alert(
        'Delete Student',
        `Are you sure you want to delete ${student?.name}? This action cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: confirmDelete,
          },
        ]
      );
    }
  };

  const confirmDelete = async () => {
    if (!id) return;
    setShowDeleteConfirm(false);
    const success = await deleteStudent(id);
    if (success) {
      router.back();
    } else {
      if (Platform.OS === 'web') {
        alert('Failed to delete student. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to delete student. Please try again.');
      }
    }
  };

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.piano.primary} />
          <Text style={styles.loadingText}>Loading student...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error || !student) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={colors.status.error} />
          <Text style={styles.errorText}>Failed to load student</Text>
          <Text style={styles.errorSubtext}>{error?.message || 'Student not found'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={refetch}>
            <Text style={styles.retryText}>Tap to retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Get initials for avatar
  const initials = student.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  // Get subjects with their display info
  const subjectsList = student.subjects || [];
  const SUBJECT_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
    piano: { icon: 'musical-notes', color: colors.piano.primary, label: 'Piano' },
    math: { icon: 'calculator', color: colors.math.primary, label: 'Math' },
    reading: { icon: 'book', color: '#9C27B0', label: 'Reading' },
    speech: { icon: 'mic', color: '#FF9800', label: 'Speech' },
    english: { icon: 'language', color: '#2196F3', label: 'English' },
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header with Back Button */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.neutral.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Student Details</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.studentName}>{student.name}</Text>
          <Text style={styles.gradeText}>Grade {student.grade_level} • Age {student.age}</Text>

          <View style={styles.tagContainer}>
            {subjectsList.map((subject) => {
              const config = SUBJECT_CONFIG[subject] || {
                icon: 'school',
                color: colors.neutral.textSecondary,
                label: subject.charAt(0).toUpperCase() + subject.slice(1),
              };
              return (
                <View
                  key={subject}
                  style={[styles.tag, { backgroundColor: config.color }]}
                >
                  <Ionicons name={config.icon as any} size={14} color="#FFFFFF" />
                  <Text style={styles.tagText}>{config.label}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Parent/Guardian Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Parent/Guardian</Text>
          {student.parent ? (
            <TouchableOpacity style={styles.parentCard} onPress={handleViewParent}>
              <View style={styles.parentInfo}>
                <View style={styles.parentAvatar}>
                  <Text style={styles.parentAvatarText}>
                    {(student.parent?.name ?? '')
                      .split(' ')
                      .filter(n => n.length > 0)
                      .map((n) => n[0])
                      .join('')
                      .substring(0, 2)
                      .toUpperCase() || '??'}
                  </Text>
                </View>
                <View style={styles.parentDetails}>
                  <Text style={styles.parentName}>{student.parent?.name ?? 'Loading...'}</Text>
                  <Text style={styles.parentEmail}>{student.parent.email}</Text>
                  {student.parent.phone && (
                    <Text style={styles.parentPhone}>{student.parent.phone}</Text>
                  )}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.neutral.textMuted} />
            </TouchableOpacity>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="person-outline" size={32} color="#CCC" />
              <Text style={styles.emptyText}>No parent linked</Text>
            </View>
          )}

          {/* Quick Contact Actions */}
          {student.parent && (
            <View style={styles.contactActions}>
              {student.parent.phone && (
                <TouchableOpacity style={styles.contactButton} onPress={handleCallParent}>
                  <View style={[styles.contactIcon, { backgroundColor: colors.status.success }]}>
                    <Ionicons name="call" size={18} color="#FFFFFF" />
                  </View>
                  <Text style={styles.contactText}>Call</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.contactButton} onPress={handleEmailParent}>
                <View style={[styles.contactIcon, { backgroundColor: '#2196F3' }]}>
                  <Ionicons name="mail" size={18} color="#FFFFFF" />
                </View>
                <Text style={styles.contactText}>Email</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Lesson Schedule Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Lesson Schedule</Text>
            {lessons.length > 0 && (
              <Text style={styles.lessonCount}>
                {statusFilter === 'all'
                  ? `${lessons.length} total`
                  : `${visibleLessonCount} of ${lessons.length}`}
              </Text>
            )}
          </View>

          {lessons.length > 0 && !lessonsLoading && (
            <View style={styles.statusFilterRow}>
              {STATUS_FILTERS.map((filter) => {
                const isActive = statusFilter === filter.key;
                return (
                  <TouchableOpacity
                    key={filter.key}
                    style={[styles.statusFilterChip, isActive && styles.statusFilterChipActive]}
                    onPress={() => setStatusFilter(filter.key)}
                  >
                    <Text style={[styles.statusFilterText, isActive && styles.statusFilterTextActive]}>
                      {filter.label} ({statusCounts[filter.key]})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {lessonsLoading ? (
            <View style={styles.lessonsLoading}>
              <ActivityIndicator size="small" color={colors.piano.primary} />
              <Text style={styles.lessonsLoadingText}>Loading lessons...</Text>
            </View>
          ) : lessons.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={32} color="#CCC" />
              <Text style={styles.emptyText}>No lessons scheduled</Text>
              <Text style={styles.emptySubtext}>Lessons will appear here once scheduled</Text>
            </View>
          ) : visibleLessonCount === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={32} color="#CCC" />
              <Text style={styles.emptyText}>No {statusFilter} lessons</Text>
              <Text style={styles.emptySubtext}>Try a different filter above</Text>
            </View>
          ) : (
            <View style={styles.lessonsContainer}>
              {/* Upcoming Lessons */}
              {upcomingLessons.length > 0 && (
                <View style={styles.lessonGroup}>
                  <View style={styles.lessonGroupHeader}>
                    <Ionicons name="arrow-forward-circle" size={18} color={colors.piano.primary} />
                    <Text style={styles.lessonGroupTitle}>
                      Upcoming ({upcomingLessons.length})
                    </Text>
                  </View>
                  {upcomingLessons.map((lesson) => {
                    const subjectConfig = SUBJECT_CONFIG[lesson.subject] || {
                      icon: 'school',
                      color: colors.neutral.textSecondary,
                      label: lesson.subject.charAt(0).toUpperCase() + lesson.subject.slice(1),
                    };
                    const statusConfig = getStatusConfig(lesson.status);
                    return (
                      <View key={lesson.id} style={styles.lessonCard}>
                        <View style={[styles.lessonSubjectIndicator, { backgroundColor: subjectConfig.color }]} />
                        <View style={styles.lessonContent}>
                          <View style={styles.lessonHeader}>
                            <View style={styles.lessonSubjectBadge}>
                              <Ionicons name={subjectConfig.icon as any} size={14} color={subjectConfig.color} />
                              <Text style={[styles.lessonSubjectText, { color: subjectConfig.color }]}>
                                {subjectConfig.label}
                              </Text>
                            </View>
                            <View style={[styles.lessonStatusBadge, { backgroundColor: statusConfig.color + '20' }]}>
                              <Ionicons name={statusConfig.icon as any} size={12} color={statusConfig.color} />
                              <Text style={[styles.lessonStatusText, { color: statusConfig.color }]}>
                                {statusConfig.label}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.lessonDetails}>
                            <View style={styles.lessonDateRow}>
                              <Ionicons name="calendar-outline" size={14} color={colors.neutral.textSecondary} />
                              <Text style={styles.lessonDateText}>{formatLessonDate(lesson.scheduled_at)}</Text>
                            </View>
                            <View style={styles.lessonTimeRow}>
                              <Ionicons name="time-outline" size={14} color={colors.neutral.textSecondary} />
                              <Text style={styles.lessonTimeText}>
                                {formatLessonTime(lesson.scheduled_at)} ({lesson.duration_min} min)
                              </Text>
                            </View>
                          </View>
                          {lesson.notes && (
                            <Text style={styles.lessonNotes} numberOfLines={2}>{lesson.notes}</Text>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Past/Completed Lessons */}
              {pastLessons.length > 0 && (
                <View style={styles.lessonGroup}>
                  <View style={styles.lessonGroupHeader}>
                    <Ionicons name="checkmark-done-circle" size={18} color={colors.neutral.textMuted} />
                    <Text style={[styles.lessonGroupTitle, { color: colors.neutral.textMuted }]}>
                      {pastGroupLabel} ({pastLessons.length})
                    </Text>
                  </View>
                  {pastLessons.map((lesson) => {
                    const subjectConfig = SUBJECT_CONFIG[lesson.subject] || {
                      icon: 'school',
                      color: colors.neutral.textSecondary,
                      label: lesson.subject.charAt(0).toUpperCase() + lesson.subject.slice(1),
                    };
                    const statusConfig = getStatusConfig(lesson.status);
                    return (
                      <View key={lesson.id} style={[styles.lessonCard, styles.pastLessonCard]}>
                        <View style={[styles.lessonSubjectIndicator, { backgroundColor: subjectConfig.color, opacity: 0.5 }]} />
                        <View style={styles.lessonContent}>
                          <View style={styles.lessonHeader}>
                            <View style={styles.lessonSubjectBadge}>
                              <Ionicons name={subjectConfig.icon as any} size={14} color={subjectConfig.color} style={{ opacity: 0.7 }} />
                              <Text style={[styles.lessonSubjectText, { color: subjectConfig.color, opacity: 0.7 }]}>
                                {subjectConfig.label}
                              </Text>
                            </View>
                            <View style={[styles.lessonStatusBadge, { backgroundColor: statusConfig.color + '20' }]}>
                              <Ionicons name={statusConfig.icon as any} size={12} color={statusConfig.color} />
                              <Text style={[styles.lessonStatusText, { color: statusConfig.color }]}>
                                {statusConfig.label}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.lessonDetails}>
                            <View style={styles.lessonDateRow}>
                              <Ionicons name="calendar-outline" size={14} color={colors.neutral.textMuted} />
                              <Text style={[styles.lessonDateText, { color: colors.neutral.textMuted }]}>
                                {formatLessonDate(lesson.scheduled_at)}
                              </Text>
                            </View>
                            <View style={styles.lessonTimeRow}>
                              <Ionicons name="time-outline" size={14} color={colors.neutral.textMuted} />
                              <Text style={[styles.lessonTimeText, { color: colors.neutral.textMuted }]}>
                                {formatLessonTime(lesson.scheduled_at)} ({lesson.duration_min} min)
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}
        </View>

        {/* Custom Rates Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Custom Rates</Text>
            <TouchableOpacity onPress={() => setRateModalVisible(true)}>
              <Text style={styles.manageRatesLink}>Manage</Text>
            </TouchableOpacity>
          </View>
          {(() => {
            const customRates = (student.subject_rates as SubjectRates | undefined) || {};
            const entries = Object.entries(customRates).filter(
              ([, cfg]) => cfg && cfg.rate > 0 && cfg.base_duration > 0
            );
            if (entries.length === 0) {
              return (
                <TouchableOpacity style={styles.emptyState} onPress={() => setRateModalVisible(true)}>
                  <Ionicons name="pricetags-outline" size={32} color="#CCC" />
                  <Text style={styles.emptyText}>No custom rates set</Text>
                  <Text style={styles.emptySubtext}>Tap to set a special rate for this student</Text>
                </TouchableOpacity>
              );
            }
            return (
              <View style={styles.customRatesList}>
                {entries.map(([subject, cfg]) => {
                  const subjectConfig = SUBJECT_CONFIG[subject] || {
                    icon: 'school',
                    color: colors.neutral.textSecondary,
                    label: subject.charAt(0).toUpperCase() + subject.slice(1),
                  };
                  const label =
                    cfg!.base_duration === 60
                      ? `$${cfg!.rate}/hr`
                      : `$${cfg!.rate}/${cfg!.base_duration}min`;
                  return (
                    <View key={subject} style={styles.customRateRow}>
                      <View style={styles.lessonSubjectBadge}>
                        <Ionicons name={subjectConfig.icon as any} size={14} color={subjectConfig.color} />
                        <Text style={[styles.lessonSubjectText, { color: subjectConfig.color }]}>
                          {subjectConfig.label}
                        </Text>
                      </View>
                      <Text style={styles.customRateValue}>
                        {label}{cfg!.duration_prices ? ' + tiers' : ''}
                      </Text>
                    </View>
                  );
                })}
              </View>
            );
          })()}
        </View>

        {/* Recent Progress Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Progress</Text>
          <View style={styles.emptyState}>
            <Ionicons name="trending-up-outline" size={32} color="#CCC" />
            <Text style={styles.emptyText}>No progress data yet</Text>
            <Text style={styles.emptySubtext}>Progress tracking coming soon</Text>
          </View>
        </View>

        {/* Worksheets Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Worksheets</Text>
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={32} color="#CCC" />
            <Text style={styles.emptyText}>No worksheets assigned</Text>
            <Text style={styles.emptySubtext}>Assigned worksheets will appear here</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.editButton} onPress={handleEditStudent}>
            <Ionicons name="create-outline" size={20} color="#FFFFFF" />
            <Text style={styles.editButtonText}>Edit Student</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDeleteStudent}
            disabled={deleting}
          >
            <Ionicons name="trash-outline" size={20} color={colors.status.error} />
            <Text style={styles.deleteButtonText}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Delete Confirmation Dialog for Web */}
      {showDeleteConfirm && (
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmDialog}>
            <Ionicons name="warning" size={48} color={colors.status.error} style={styles.confirmIcon} />
            <Text style={styles.confirmTitle}>Delete Student?</Text>
            <Text style={styles.confirmMessage}>
              Are you sure you want to delete {student.name}? This action cannot be undone.
            </Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={styles.confirmButtonCancel}
                onPress={() => setShowDeleteConfirm(false)}
              >
                <Text style={styles.confirmButtonCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButtonDelete}
                onPress={confirmDelete}
              >
                <Text style={styles.confirmButtonDeleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Edit Student Modal */}
      <StudentFormModal
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        onSave={handleSaveStudent}
        student={student}
        parents={parents}
        loading={updating}
      />

      <StudentRateSettingsModal
        visible={rateModalVisible}
        onClose={() => setRateModalVisible(false)}
        student={student}
        onSave={handleSaveRates}
        saving={updating}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.neutral.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  backButton: {
    padding: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    padding: spacing.base,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.neutral.textMuted,
    fontSize: typography.sizes.sm,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['2xl'],
  },
  errorText: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginTop: spacing.md,
  },
  errorSubtext: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  retryButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  retryText: {
    color: colors.piano.primary,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.piano.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: typography.weights.bold,
    color: '#FFFFFF',
  },
  studentName: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
  },
  gradeText: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    marginTop: spacing.xs,
  },
  tagContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  tagText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginBottom: spacing.md,
  },
  parentCard: {
    backgroundColor: colors.neutral.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: colors.shadow.color,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  parentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  parentAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.math.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  parentAvatarText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.math.primary,
  },
  parentDetails: {
    marginLeft: spacing.md,
    flex: 1,
  },
  parentName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  parentEmail: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginTop: 2,
  },
  parentPhone: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
    marginTop: 2,
  },
  contactActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
    marginTop: spacing.md,
  },
  contactButton: {
    alignItems: 'center',
  },
  contactIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  contactText: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textSecondary,
    fontWeight: typography.weights.medium,
  },
  emptyState: {
    backgroundColor: colors.neutral.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    shadowColor: colors.shadow.color,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
    marginTop: spacing.sm,
  },
  emptySubtext: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.border,
    marginTop: spacing.xs,
  },
  // Section header with count
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  manageRatesLink: {
    fontSize: typography.sizes.sm,
    color: colors.piano.primary,
    fontWeight: typography.weights.semibold,
  },
  customRatesList: {
    backgroundColor: colors.neutral.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  customRateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  customRateValue: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  lessonCount: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
    fontWeight: typography.weights.medium,
  },
  // Status filter chips
  statusFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  statusFilterChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral.surface,
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  statusFilterChipActive: {
    backgroundColor: colors.piano.primary,
    borderColor: colors.piano.primary,
  },
  statusFilterText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    fontWeight: typography.weights.medium,
  },
  statusFilterTextActive: {
    color: colors.neutral.white,
  },
  // Lessons loading state
  lessonsLoading: {
    backgroundColor: colors.neutral.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  lessonsLoadingText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
  },
  // Lessons container
  lessonsContainer: {
    gap: spacing.lg,
  },
  lessonGroup: {
    gap: spacing.sm,
  },
  lessonGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  lessonGroupTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.piano.primary,
  },
  // Lesson card
  lessonCard: {
    backgroundColor: colors.neutral.surface,
    borderRadius: borderRadius.lg,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: colors.shadow.color,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  pastLessonCard: {
    opacity: 0.8,
  },
  lessonSubjectIndicator: {
    width: 4,
  },
  lessonContent: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  lessonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lessonSubjectBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  lessonSubjectText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  lessonStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  lessonStatusText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  lessonDetails: {
    gap: spacing.xs,
  },
  lessonDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  lessonDateText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },
  lessonTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  lessonTimeText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },
  lessonNotes: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
    fontStyle: 'italic',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  editButton: {
    flex: 1,
    backgroundColor: colors.piano.primary,
    borderRadius: borderRadius.lg,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    shadowColor: colors.piano.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  editButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: '#FFFFFF',
  },
  deleteButton: {
    backgroundColor: colors.neutral.surface,
    borderRadius: borderRadius.lg,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.status.error,
  },
  deleteButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.status.error,
  },

  // Confirmation Dialog Styles
  confirmOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  confirmDialog: {
    backgroundColor: colors.neutral.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    width: '85%',
    maxWidth: 320,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  confirmIcon: {
    marginBottom: spacing.md,
  },
  confirmTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  confirmMessage: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
  },
  confirmButtonCancel: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    alignItems: 'center',
  },
  confirmButtonCancelText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
  },
  confirmButtonDelete: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    backgroundColor: colors.status.error,
    alignItems: 'center',
  },
  confirmButtonDeleteText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: '#FFFFFF',
  },
});
