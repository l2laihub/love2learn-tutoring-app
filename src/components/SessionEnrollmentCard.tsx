/**
 * SessionEnrollmentCard
 * Display component for enrollment status with cancel functionality
 * Used in parent views to show their enrollment requests
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows, getSubjectColor } from '../theme';
import {
  SessionEnrollmentWithDetails,
  TutoringSubject,
  getEnrollmentStatusInfo,
} from '../types/database';

// Subject display names
const SUBJECT_NAMES: Record<TutoringSubject, string> = {
  piano: 'Piano',
  math: 'Math',
  reading: 'Reading',
  speech: 'Speech',
  english: 'English',
};

const SUBJECT_EMOJI: Record<TutoringSubject, string> = {
  piano: '🎹',
  math: '➗',
  reading: '📖',
  speech: '🗣️',
  english: '📝',
};

interface SessionEnrollmentCardProps {
  enrollment: SessionEnrollmentWithDetails;
  onCancel?: (enrollmentId: string) => void;
  cancelling?: boolean;
  showSession?: boolean;
}

export function SessionEnrollmentCard({
  enrollment,
  onCancel,
  cancelling,
  showSession = true,
}: SessionEnrollmentCardProps) {
  const statusInfo = getEnrollmentStatusInfo(enrollment.status);
  const subject = enrollment.subject as TutoringSubject;
  const subjectColor = getSubjectColor(subject);
  const session = enrollment.session;

  // Format session time
  const formatSessionTime = () => {
    if (!session) return null;
    const date = new Date(session.scheduled_at);
    return {
      date: date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
      time: date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      }),
    };
  };

  const sessionTime = formatSessionTime();

  // Handle cancel
  const handleCancel = () => {
    if (!onCancel) return;

    Alert.alert(
      'Cancel Enrollment',
      `Are you sure you want to cancel ${enrollment.student.name}'s enrollment request?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: () => onCancel(enrollment.id),
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { borderLeftColor: subjectColor.primary }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: subjectColor.subtle }]}>
        <Text style={styles.subjectEmoji}>{SUBJECT_EMOJI[subject]}</Text>
        <View style={styles.headerInfo}>
          <Text style={styles.studentName}>{enrollment.student.name}</Text>
          <Text style={styles.subject}>{SUBJECT_NAMES[subject]}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusInfo.bgColor }]}>
          <Ionicons
            name={statusInfo.icon as any}
            size={14}
            color={statusInfo.color}
          />
          <Text style={[styles.statusText, { color: statusInfo.color }]}>
            {statusInfo.label}
          </Text>
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Session info */}
        {showSession && sessionTime && (
          <View style={styles.sessionInfo}>
            <Ionicons
              name="calendar-outline"
              size={16}
              color={colors.neutral.textSecondary}
            />
            <Text style={styles.sessionText}>
              {sessionTime.date} at {sessionTime.time}
            </Text>
          </View>
        )}

        {/* Duration */}
        <View style={styles.detailRow}>
          <Ionicons
            name="hourglass-outline"
            size={16}
            color={colors.neutral.textSecondary}
          />
          <Text style={styles.detailText}>{enrollment.duration_min} minutes</Text>
        </View>

        {/* Notes */}
        {enrollment.notes && (
          <View style={styles.notesSection}>
            <Text style={styles.notesLabel}>Your note:</Text>
            <Text style={styles.notesText}>{enrollment.notes}</Text>
          </View>
        )}

        {/* Tutor response */}
        {enrollment.tutor_response && (
          <View style={styles.responseSection}>
            <Text style={styles.responseLabel}>Tutor response:</Text>
            <Text style={styles.responseText}>{enrollment.tutor_response}</Text>
          </View>
        )}

        {/* Timestamp */}
        <Text style={styles.timestamp}>
          Requested{' '}
          {new Date(enrollment.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })}{' '}
          at{' '}
          {new Date(enrollment.created_at).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          })}
        </Text>
      </View>

      {/* Cancel button (only for pending) */}
      {enrollment.status === 'pending' && onCancel && (
        <View style={styles.actions}>
          <Pressable
            style={[styles.cancelButton, cancelling && styles.cancelButtonDisabled]}
            onPress={handleCancel}
            disabled={cancelling}
          >
            <Ionicons
              name="close-circle-outline"
              size={18}
              color={colors.status.error}
            />
            <Text style={styles.cancelButtonText}>
              {cancelling ? 'Cancelling...' : 'Cancel Request'}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    borderLeftWidth: 4,
    overflow: 'hidden',
    ...shadows.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  subjectEmoji: {
    fontSize: 28,
  },
  headerInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  subject: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  statusText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  content: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  sessionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.borderLight,
    marginBottom: spacing.xs,
  },
  sessionText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detailText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.text,
  },
  notesSection: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.md,
  },
  notesLabel: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
    marginBottom: spacing.xs,
  },
  notesText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.text,
    fontStyle: 'italic',
  },
  responseSection: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.primary.subtle,
    borderRadius: borderRadius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary.main,
  },
  responseLabel: {
    fontSize: typography.sizes.xs,
    color: colors.primary.dark,
    marginBottom: spacing.xs,
  },
  responseText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.text,
  },
  timestamp: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
    marginTop: spacing.sm,
  },
  actions: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.status.error,
  },
  cancelButtonDisabled: {
    opacity: 0.6,
  },
  cancelButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.status.error,
  },
});

export default SessionEnrollmentCard;
