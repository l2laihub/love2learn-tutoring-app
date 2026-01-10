/**
 * LessonDetailModal
 * Modal for viewing lesson details with edit, complete, and cancel actions
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows, getSubjectColor } from '../theme';
import { ScheduledLessonWithStudent, GroupedLesson, TutoringSubject } from '../types/database';
import { Avatar } from './ui/Avatar';

// Subject display name mapping
const SUBJECT_NAMES: Record<TutoringSubject, string> = {
  piano: 'Piano',
  math: 'Math',
  reading: 'Reading',
  speech: 'Speech',
  english: 'English',
};

// Subject emoji mapping
const SUBJECT_EMOJI: Record<TutoringSubject, string> = {
  piano: '🎹',
  math: '➗',
  reading: '📖',
  speech: '🗣️',
  english: '📝',
};

interface LessonDetailModalProps {
  visible: boolean;
  lesson: ScheduledLessonWithStudent | null;
  groupedLesson?: GroupedLesson | null;
  onClose: () => void;
  onEdit: () => void;
  onEditSeries?: () => void; // Edit all lessons in the recurring series
  onComplete: (notes?: string) => Promise<void>;
  onCancel: (reason?: string) => Promise<void>;
  onUncomplete?: () => Promise<void>; // Undo a completed lesson (admin only)
  onDelete?: () => Promise<void>;
  onDeleteSeries?: () => Promise<void>;
  onRequestReschedule?: () => void; // For parents to request reschedule
  seriesCount?: number; // Number of lessons in the recurring series
  isTutor?: boolean; // Whether the current user is a tutor/admin
}

export function LessonDetailModal({
  visible,
  lesson,
  groupedLesson,
  onClose,
  onEdit,
  onEditSeries,
  onComplete,
  onCancel,
  onUncomplete,
  onDelete,
  onDeleteSeries,
  onRequestReschedule,
  seriesCount = 0,
  isTutor = false,
}: LessonDetailModalProps) {
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [showUncompleteConfirm, setShowUncompleteConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeleteSeriesConfirm, setShowDeleteSeriesConfirm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [completeNotes, setCompleteNotes] = useState('');
  const [loading, setLoading] = useState(false);

  if (!lesson) return null;

  // Determine if this is a grouped session
  const isGroupedSession = groupedLesson?.session_id !== null && groupedLesson?.lessons && groupedLesson.lessons.length > 1;

  // Use grouped lesson data if available, otherwise fall back to single lesson
  const displayData = groupedLesson || {
    session_id: null,
    lessons: [lesson],
    scheduled_at: lesson.scheduled_at,
    end_time: new Date(new Date(lesson.scheduled_at).getTime() + lesson.duration_min * 60000).toISOString(),
    duration_min: lesson.duration_min,
    student_names: [lesson.student.name],
    subjects: [lesson.subject] as TutoringSubject[],
    status: lesson.status,
  };

  const subjectColor = getSubjectColor(displayData.subjects[0]);
  const lessonDate = new Date(displayData.scheduled_at);
  const endDate = new Date(displayData.end_time);
  const formattedDate = lessonDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const formattedStartTime = lessonDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const formattedEndTime = endDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  // For grouped sessions, show time range; for single lessons, show start time
  const timeDisplay = isGroupedSession
    ? `${formattedStartTime} – ${formattedEndTime}`
    : formattedStartTime;

  // Format subject display
  const subjectDisplay = displayData.subjects.map(s => SUBJECT_NAMES[s]).join(', ');
  const subjectEmojis = displayData.subjects.map(s => SUBJECT_EMOJI[s]).join(' ');

  // Format student names
  const studentNamesDisplay = displayData.student_names.join(' & ');

  const handleComplete = async () => {
    setLoading(true);
    try {
      await onComplete(completeNotes.trim() || undefined);
      setShowCompleteConfirm(false);
      setCompleteNotes('');
      onClose();
    } catch (err) {
      console.error('Failed to complete lesson:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    setLoading(true);
    try {
      await onCancel(cancelReason.trim() || undefined);
      setShowCancelConfirm(false);
      setCancelReason('');
      onClose();
    } catch (err) {
      console.error('Failed to cancel lesson:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setLoading(true);
    try {
      await onDelete();
      setShowDeleteConfirm(false);
      onClose();
    } catch (err) {
      console.error('Failed to delete lesson:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSeries = async () => {
    if (!onDeleteSeries) return;
    setLoading(true);
    try {
      await onDeleteSeries();
      setShowDeleteSeriesConfirm(false);
      onClose();
    } catch (err) {
      console.error('Failed to delete lesson series:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUncomplete = async () => {
    if (!onUncomplete) return;
    setLoading(true);
    try {
      await onUncomplete();
      setShowUncompleteConfirm(false);
      onClose();
    } catch (err) {
      console.error('Failed to uncomplete lesson:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setShowCancelConfirm(false);
    setShowCompleteConfirm(false);
    setShowUncompleteConfirm(false);
    setShowDeleteConfirm(false);
    setShowDeleteSeriesConfirm(false);
    setCancelReason('');
    setCompleteNotes('');
    onClose();
  };

  // Confirmation dialogs
  if (showCancelConfirm) {
    return (
      <Modal visible={visible} animationType="fade" transparent onRequestClose={handleClose}>
        <View style={styles.overlay}>
          <View style={styles.confirmDialog}>
            <Ionicons name="close-circle" size={48} color={colors.status.error} />
            <Text style={styles.confirmTitle}>Cancel Lesson?</Text>
            <Text style={styles.confirmSubtitle}>
              This will notify {lesson.student.parent.name} about the cancellation.
            </Text>
            <TextInput
              style={styles.confirmInput}
              value={cancelReason}
              onChangeText={setCancelReason}
              placeholder="Reason for cancellation (optional)"
              placeholderTextColor={colors.neutral.textMuted}
              multiline
            />
            <View style={styles.confirmActions}>
              <Pressable
                style={[styles.confirmButton, styles.confirmButtonSecondary]}
                onPress={() => setShowCancelConfirm(false)}
                disabled={loading}
              >
                <Text style={styles.confirmButtonSecondaryText}>Go Back</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmButton, styles.confirmButtonDanger]}
                onPress={handleCancel}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={colors.neutral.white} />
                ) : (
                  <Text style={styles.confirmButtonText}>Cancel Lesson</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  if (showCompleteConfirm) {
    return (
      <Modal visible={visible} animationType="fade" transparent onRequestClose={handleClose}>
        <View style={styles.overlay}>
          <View style={styles.confirmDialog}>
            <Ionicons name="checkmark-circle" size={48} color={colors.status.success} />
            <Text style={styles.confirmTitle}>Complete Lesson?</Text>
            <Text style={styles.confirmSubtitle}>
              Mark this lesson with {lesson.student.name} as completed.
            </Text>
            <TextInput
              style={styles.confirmInput}
              value={completeNotes}
              onChangeText={setCompleteNotes}
              placeholder="Lesson notes (optional)"
              placeholderTextColor={colors.neutral.textMuted}
              multiline
            />
            <View style={styles.confirmActions}>
              <Pressable
                style={[styles.confirmButton, styles.confirmButtonSecondary]}
                onPress={() => setShowCompleteConfirm(false)}
                disabled={loading}
              >
                <Text style={styles.confirmButtonSecondaryText}>Go Back</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmButton, styles.confirmButtonSuccess]}
                onPress={handleComplete}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={colors.neutral.white} />
                ) : (
                  <Text style={styles.confirmButtonText}>Complete</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  if (showDeleteConfirm) {
    return (
      <Modal visible={visible} animationType="fade" transparent onRequestClose={handleClose}>
        <View style={styles.overlay}>
          <View style={styles.confirmDialog}>
            <Ionicons name="trash" size={48} color={colors.status.error} />
            <Text style={styles.confirmTitle}>Delete Lesson?</Text>
            <Text style={styles.confirmSubtitle}>
              This will permanently delete this lesson. This action cannot be undone.
            </Text>
            <View style={styles.confirmActions}>
              <Pressable
                style={[styles.confirmButton, styles.confirmButtonSecondary]}
                onPress={() => setShowDeleteConfirm(false)}
                disabled={loading}
              >
                <Text style={styles.confirmButtonSecondaryText}>Go Back</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmButton, styles.confirmButtonDanger]}
                onPress={handleDelete}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={colors.neutral.white} />
                ) : (
                  <Text style={styles.confirmButtonText}>Delete</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  if (showDeleteSeriesConfirm) {
    return (
      <Modal visible={visible} animationType="fade" transparent onRequestClose={handleClose}>
        <View style={styles.overlay}>
          <View style={styles.confirmDialog}>
            <Ionicons name="trash" size={48} color={colors.status.error} />
            <Text style={styles.confirmTitle}>Delete Entire Series?</Text>
            <Text style={styles.confirmSubtitle}>
              This will permanently delete {seriesCount} lessons in this recurring series. This action cannot be undone.
            </Text>
            <View style={styles.confirmActions}>
              <Pressable
                style={[styles.confirmButton, styles.confirmButtonSecondary]}
                onPress={() => setShowDeleteSeriesConfirm(false)}
                disabled={loading}
              >
                <Text style={styles.confirmButtonSecondaryText}>Go Back</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmButton, styles.confirmButtonDanger]}
                onPress={handleDeleteSeries}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={colors.neutral.white} />
                ) : (
                  <Text style={styles.confirmButtonText}>Delete All</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  if (showUncompleteConfirm) {
    return (
      <Modal visible={visible} animationType="fade" transparent onRequestClose={handleClose}>
        <View style={styles.overlay}>
          <View style={styles.confirmDialog}>
            <Ionicons name="arrow-undo-circle" size={48} color={colors.status.warning} />
            <Text style={styles.confirmTitle}>Undo Complete?</Text>
            <Text style={styles.confirmSubtitle}>
              This will change the lesson status back to "Scheduled". Use this if you accidentally marked the lesson as complete.
            </Text>
            <View style={styles.confirmActions}>
              <Pressable
                style={[styles.confirmButton, styles.confirmButtonSecondary]}
                onPress={() => setShowUncompleteConfirm(false)}
                disabled={loading}
              >
                <Text style={styles.confirmButtonSecondaryText}>Go Back</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmButton, styles.confirmButtonWarning]}
                onPress={handleUncomplete}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={colors.neutral.white} />
                ) : (
                  <Text style={styles.confirmButtonText}>Undo Complete</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: subjectColor.subtle }]}>
          <Pressable onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.neutral.text} />
          </Pressable>
          <View style={styles.headerContent}>
            <Text style={styles.subjectIcon}>
              {subjectEmojis}
            </Text>
            <Text style={[styles.subjectLabel, { color: subjectColor.primary }]}>
              {isGroupedSession ? 'Combined Session' : `${subjectDisplay} Lesson`}
            </Text>
            {isGroupedSession && (
              <View style={styles.sessionBadge}>
                <Ionicons name="people" size={14} color={colors.neutral.white} />
                <Text style={styles.sessionBadgeText}>
                  {displayData.lessons.length} lessons grouped
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Student Info - Shows multiple students for grouped sessions */}
          {isGroupedSession ? (
            <View style={styles.studentSection}>
              <View style={styles.multiStudentAvatars}>
                {displayData.lessons.slice(0, 3).map((l, idx) => (
                  <View key={l.id} style={[styles.multiStudentAvatar, { marginLeft: idx > 0 ? -12 : 0 }]}>
                    <Avatar
                      name={l.student.name}
                      size="md"
                      backgroundColor={getSubjectColor(l.subject).primary}
                    />
                  </View>
                ))}
              </View>
              <View style={styles.studentInfo}>
                <Text style={styles.studentName}>{studentNamesDisplay}</Text>
                <Text style={styles.subjectsText}>{subjectDisplay}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.studentSection}>
              <Avatar
                name={lesson.student.name}
                size="lg"
                backgroundColor={subjectColor.primary}
              />
              <View style={styles.studentInfo}>
                <Text style={styles.studentName}>{lesson.student.name}</Text>
                <Text style={styles.parentName}>
                  Parent: {lesson.student.parent.name}
                </Text>
              </View>
            </View>
          )}

          {/* Date/Time Info */}
          <View style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <Ionicons name="calendar-outline" size={20} color={colors.neutral.textSecondary} />
              <Text style={styles.detailText}>{formattedDate}</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="time-outline" size={20} color={colors.neutral.textSecondary} />
              <Text style={styles.detailText}>{timeDisplay}</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="hourglass-outline" size={20} color={colors.neutral.textSecondary} />
              <Text style={styles.detailText}>{displayData.duration_min} minutes</Text>
            </View>
          </View>

          {/* Grouped Lessons Details - show individual lessons in the session */}
          {isGroupedSession && (
            <View style={styles.groupedLessonsSection}>
              <Text style={styles.sectionLabel}>Lessons in this session</Text>
              {displayData.lessons.map((l) => (
                <View key={l.id} style={styles.groupedLessonItem}>
                  <Text style={styles.groupedLessonIcon}>{SUBJECT_EMOJI[l.subject]}</Text>
                  <View style={styles.groupedLessonInfo}>
                    <Text style={styles.groupedLessonName}>{l.student.name}</Text>
                    <Text style={styles.groupedLessonSubject}>{SUBJECT_NAMES[l.subject]}</Text>
                  </View>
                  <View
                    style={[
                      styles.miniStatusBadge,
                      l.status === 'completed' && styles.miniStatusCompleted,
                      l.status === 'cancelled' && styles.miniStatusCancelled,
                    ]}
                  >
                    <Ionicons
                      name={
                        l.status === 'completed'
                          ? 'checkmark'
                          : l.status === 'cancelled'
                          ? 'close'
                          : 'time-outline'
                      }
                      size={12}
                      color={
                        l.status === 'completed'
                          ? colors.status.success
                          : l.status === 'cancelled'
                          ? colors.status.error
                          : colors.status.info
                      }
                    />
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Status */}
          <View style={styles.statusSection}>
            <Text style={styles.statusLabel}>Status</Text>
            <View
              style={[
                styles.statusBadge,
                displayData.status === 'completed' && styles.statusCompleted,
                displayData.status === 'cancelled' && styles.statusCancelled,
              ]}
            >
              <Ionicons
                name={
                  displayData.status === 'completed'
                    ? 'checkmark-circle'
                    : displayData.status === 'cancelled'
                    ? 'close-circle'
                    : 'time'
                }
                size={16}
                color={
                  displayData.status === 'completed'
                    ? colors.status.success
                    : displayData.status === 'cancelled'
                    ? colors.status.error
                    : colors.status.info
                }
              />
              <Text
                style={[
                  styles.statusText,
                  displayData.status === 'completed' && { color: colors.status.success },
                  displayData.status === 'cancelled' && { color: colors.status.error },
                ]}
              >
                {displayData.status.charAt(0).toUpperCase() + displayData.status.slice(1)}
              </Text>
            </View>
          </View>

          {/* Notes */}
          {lesson.notes && (
            <View style={styles.notesSection}>
              <Text style={styles.notesLabel}>Notes</Text>
              <Text style={styles.notesText}>{lesson.notes}</Text>
            </View>
          )}
        </View>

        {/* Actions - only show for scheduled lessons (tutor only) */}
        {displayData.status === 'scheduled' && isTutor && (
          <View style={styles.actions}>
            <Pressable style={styles.editButton} onPress={onEdit}>
              <Ionicons name="create-outline" size={20} color={colors.neutral.textSecondary} />
              <Text style={styles.editButtonText}>Edit</Text>
            </Pressable>
            {onEditSeries && seriesCount > 1 && (
              <Pressable style={styles.editButton} onPress={onEditSeries}>
                <Ionicons name="albums-outline" size={20} color={colors.neutral.textSecondary} />
                <Text style={styles.editButtonText}>Edit Series ({seriesCount})</Text>
              </Pressable>
            )}
            <Pressable
              style={styles.cancelButton}
              onPress={() => setShowCancelConfirm(true)}
            >
              <Ionicons name="close-circle-outline" size={20} color={colors.status.error} />
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={styles.completeButton}
              onPress={() => setShowCompleteConfirm(true)}
            >
              <Ionicons name="checkmark-circle" size={20} color={colors.neutral.white} />
              <Text style={styles.completeButtonText}>Complete</Text>
            </Pressable>
          </View>
        )}

        {/* Parent view - reschedule request button for scheduled lessons */}
        {displayData.status === 'scheduled' && !isTutor && (
          <View style={styles.parentActions}>
            {onRequestReschedule ? (
              <Pressable style={styles.rescheduleButton} onPress={onRequestReschedule}>
                <Ionicons name="calendar-outline" size={20} color={colors.primary.main} />
                <Text style={styles.rescheduleButtonText}>Request Reschedule</Text>
              </Pressable>
            ) : (
              <View style={styles.parentInfoBar}>
                <Ionicons name="information-circle-outline" size={20} color={colors.status.info} />
                <Text style={styles.parentInfoText}>
                  Contact your tutor to reschedule or cancel this lesson
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Undo Complete action - only show for completed lessons (tutor/admin only) */}
        {displayData.status === 'completed' && isTutor && onUncomplete && (
          <View style={styles.actions}>
            <Pressable
              style={styles.uncompleteButton}
              onPress={() => setShowUncompleteConfirm(true)}
            >
              <Ionicons name="arrow-undo-circle-outline" size={20} color={colors.status.warning} />
              <Text style={styles.uncompleteButtonText}>Undo Complete</Text>
            </Pressable>
          </View>
        )}

        {/* Delete action - available for all lesson states (admin only) */}
        {onDelete && (
          <View style={styles.deleteSection}>
            <Pressable
              style={styles.deleteButton}
              onPress={() => setShowDeleteConfirm(true)}
            >
              <Ionicons name="trash-outline" size={18} color={colors.status.error} />
              <Text style={styles.deleteButtonText}>Delete This Lesson</Text>
            </Pressable>
            {onDeleteSeries && seriesCount > 1 && (
              <Pressable
                style={[styles.deleteButton, styles.deleteSeriesButton]}
                onPress={() => setShowDeleteSeriesConfirm(true)}
              >
                <Ionicons name="albums-outline" size={18} color={colors.status.error} />
                <Text style={styles.deleteButtonText}>Delete Entire Series ({seriesCount} lessons)</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.background,
  },
  header: {
    paddingTop: spacing['2xl'],
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.base,
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    padding: spacing.xs,
    zIndex: 1,
  },
  headerContent: {
    alignItems: 'center',
  },
  subjectIcon: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  subjectLabel: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
  },
  content: {
    flex: 1,
    padding: spacing.base,
  },
  studentSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  studentInfo: {
    marginLeft: spacing.md,
  },
  studentName: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  parentName: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginTop: spacing.xs,
  },
  subjectsText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginTop: spacing.xs,
  },
  multiStudentAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  multiStudentAvatar: {
    borderWidth: 2,
    borderColor: colors.neutral.white,
    borderRadius: 999,
  },
  sessionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.neutral.textMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginTop: spacing.sm,
  },
  sessionBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.neutral.white,
  },
  sectionLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.textSecondary,
    marginBottom: spacing.sm,
  },
  groupedLessonsSection: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  groupedLessonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  groupedLessonIcon: {
    fontSize: 20,
    marginRight: spacing.md,
  },
  groupedLessonInfo: {
    flex: 1,
  },
  groupedLessonName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
  },
  groupedLessonSubject: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
  },
  miniStatusBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.status.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniStatusCompleted: {
    backgroundColor: colors.status.successBg,
  },
  miniStatusCancelled: {
    backgroundColor: colors.status.errorBg,
  },
  detailsCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  detailText: {
    fontSize: typography.sizes.base,
    color: colors.neutral.text,
  },
  statusSection: {
    marginBottom: spacing.lg,
  },
  statusLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.textSecondary,
    marginBottom: spacing.sm,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.status.infoBg,
    borderRadius: borderRadius.full,
  },
  statusCompleted: {
    backgroundColor: colors.status.successBg,
  },
  statusCancelled: {
    backgroundColor: colors.status.errorBg,
  },
  statusText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.status.info,
  },
  notesSection: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    ...shadows.sm,
  },
  notesLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.textSecondary,
    marginBottom: spacing.sm,
  },
  notesText: {
    fontSize: typography.sizes.base,
    color: colors.neutral.text,
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    padding: spacing.base,
    gap: spacing.sm,
    backgroundColor: colors.neutral.white,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  editButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.neutral.textSecondary,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.status.error,
  },
  cancelButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.status.error,
  },
  completeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    backgroundColor: colors.status.success,
    borderRadius: borderRadius.md,
  },
  completeButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
  },
  uncompleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.status.warning,
    backgroundColor: colors.status.warningBg,
  },
  uncompleteButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.status.warning,
  },
  // Confirmation dialog
  overlay: {
    flex: 1,
    backgroundColor: colors.neutral.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  confirmDialog: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    ...shadows.lg,
  },
  confirmTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  confirmSubtitle: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  confirmInput: {
    width: '100%',
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.sizes.base,
    color: colors.neutral.text,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: spacing.lg,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonSecondary: {
    backgroundColor: colors.neutral.background,
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  confirmButtonSecondaryText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.neutral.textSecondary,
  },
  confirmButtonDanger: {
    backgroundColor: colors.status.error,
  },
  confirmButtonSuccess: {
    backgroundColor: colors.status.success,
  },
  confirmButtonWarning: {
    backgroundColor: colors.status.warning,
  },
  confirmButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
  },
  // Delete section
  deleteSection: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.base,
    backgroundColor: colors.neutral.white,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.status.errorBg,
    backgroundColor: colors.status.errorBg,
  },
  deleteSeriesButton: {
    marginTop: spacing.sm,
  },
  deleteButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.status.error,
  },
  // Parent view info bar and actions
  parentActions: {
    backgroundColor: colors.neutral.white,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
  },
  parentInfoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.base,
    backgroundColor: colors.status.infoBg,
  },
  parentInfoText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.status.info,
  },
  rescheduleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    margin: spacing.base,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary.subtle,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.primary.main,
  },
  rescheduleButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.primary.main,
  },
});

export default LessonDetailModal;
