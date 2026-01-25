/**
 * SessionEnrollmentsPanel
 * Panel component for LessonDetailModal showing enrollment requests
 * Used by tutors to approve/reject enrollment requests
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows, getSubjectColor } from '../theme';
import {
  SessionEnrollmentWithDetails,
  TutoringSubject,
  getEnrollmentStatusInfo,
} from '../types/database';
import {
  useSessionEnrollments,
  useApproveEnrollment,
  useRejectEnrollment,
} from '../hooks/useGroupSessions';

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

interface SessionEnrollmentsPanelProps {
  sessionId: string;
  onEnrollmentChanged?: () => void;
}

export function SessionEnrollmentsPanel({
  sessionId,
  onEnrollmentChanged,
}: SessionEnrollmentsPanelProps) {
  const { data: enrollments, loading, refetch } = useSessionEnrollments(sessionId);
  const { approveEnrollment, loading: approving } = useApproveEnrollment();
  const { rejectEnrollment, loading: rejecting } = useRejectEnrollment();

  // Filter to show pending enrollments first, then others
  const pendingEnrollments = enrollments.filter((e) => e.status === 'pending');
  const otherEnrollments = enrollments.filter((e) => e.status !== 'pending');

  const handleApprove = (enrollment: SessionEnrollmentWithDetails) => {
    Alert.alert(
      'Approve Enrollment',
      `Approve ${enrollment.student.name}'s request to join this session for ${SUBJECT_NAMES[enrollment.subject as TutoringSubject]}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            const result = await approveEnrollment(enrollment.id);
            if (result) {
              refetch();
              onEnrollmentChanged?.();
            }
          },
        },
      ]
    );
  };

  const handleReject = (enrollment: SessionEnrollmentWithDetails) => {
    Alert.prompt(
      'Decline Enrollment',
      `Provide a reason for declining ${enrollment.student.name}'s request (optional)`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async (reason?: string) => {
            const result = await rejectEnrollment(enrollment.id, reason);
            if (result) {
              refetch();
              onEnrollmentChanged?.();
            }
          },
        },
      ],
      'plain-text'
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary.main} />
        </View>
      </View>
    );
  }

  if (enrollments.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Ionicons
            name="mail-open-outline"
            size={32}
            color={colors.neutral.textMuted}
          />
          <Text style={styles.emptyStateText}>No enrollment requests</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Pending Enrollments Header */}
      {pendingEnrollments.length > 0 && (
        <View style={styles.sectionHeader}>
          <Ionicons name="time" size={18} color={colors.status.warning} />
          <Text style={styles.sectionTitle}>
            Pending Requests ({pendingEnrollments.length})
          </Text>
        </View>
      )}

      {/* Pending Enrollments */}
      {pendingEnrollments.map((enrollment) => (
        <EnrollmentRequestCard
          key={enrollment.id}
          enrollment={enrollment}
          onApprove={() => handleApprove(enrollment)}
          onReject={() => handleReject(enrollment)}
          actionLoading={approving || rejecting}
        />
      ))}

      {/* Other Enrollments */}
      {otherEnrollments.length > 0 && pendingEnrollments.length > 0 && (
        <View style={styles.sectionHeader}>
          <Ionicons
            name="checkmark-done"
            size={18}
            color={colors.neutral.textSecondary}
          />
          <Text style={styles.sectionTitle}>Processed</Text>
        </View>
      )}

      {otherEnrollments.map((enrollment) => (
        <EnrollmentStatusCard key={enrollment.id} enrollment={enrollment} />
      ))}
    </View>
  );
}

// Card for pending enrollment with approve/reject actions
interface EnrollmentRequestCardProps {
  enrollment: SessionEnrollmentWithDetails;
  onApprove: () => void;
  onReject: () => void;
  actionLoading?: boolean;
}

function EnrollmentRequestCard({
  enrollment,
  onApprove,
  onReject,
  actionLoading,
}: EnrollmentRequestCardProps) {
  const subject = enrollment.subject as TutoringSubject;
  const subjectColor = getSubjectColor(subject);

  return (
    <View style={styles.requestCard}>
      <View style={[styles.requestHeader, { backgroundColor: subjectColor.subtle }]}>
        <Text style={styles.emoji}>{SUBJECT_EMOJI[subject]}</Text>
        <View style={styles.requestInfo}>
          <Text style={styles.studentName}>{enrollment.student.name}</Text>
          <Text style={styles.parentName}>
            Parent: {enrollment.parent.name}
          </Text>
        </View>
        <View style={styles.subjectBadge}>
          <Text style={[styles.subjectBadgeText, { color: subjectColor.primary }]}>
            {SUBJECT_NAMES[subject]}
          </Text>
        </View>
      </View>

      <View style={styles.requestContent}>
        <View style={styles.detailRow}>
          <Ionicons
            name="hourglass-outline"
            size={16}
            color={colors.neutral.textSecondary}
          />
          <Text style={styles.detailText}>{enrollment.duration_min} minutes</Text>
        </View>

        {enrollment.notes && (
          <View style={styles.notesBox}>
            <Text style={styles.notesLabel}>Parent's note:</Text>
            <Text style={styles.notesText}>{enrollment.notes}</Text>
          </View>
        )}

        <Text style={styles.timestamp}>
          Requested{' '}
          {new Date(enrollment.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })}
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={[styles.rejectButton, actionLoading && styles.actionDisabled]}
          onPress={onReject}
          disabled={actionLoading}
        >
          <Ionicons
            name="close-circle-outline"
            size={18}
            color={colors.status.error}
          />
          <Text style={styles.rejectButtonText}>Decline</Text>
        </Pressable>
        <Pressable
          style={[styles.approveButton, actionLoading && styles.actionDisabled]}
          onPress={onApprove}
          disabled={actionLoading}
        >
          <Ionicons name="checkmark-circle" size={18} color={colors.neutral.white} />
          <Text style={styles.approveButtonText}>Approve</Text>
        </Pressable>
      </View>
    </View>
  );
}

// Card for processed enrollments (approved/rejected/cancelled)
interface EnrollmentStatusCardProps {
  enrollment: SessionEnrollmentWithDetails;
}

function EnrollmentStatusCard({ enrollment }: EnrollmentStatusCardProps) {
  const subject = enrollment.subject as TutoringSubject;
  const statusInfo = getEnrollmentStatusInfo(enrollment.status);

  return (
    <View style={styles.statusCard}>
      <View style={styles.statusHeader}>
        <Text style={styles.emoji}>{SUBJECT_EMOJI[subject]}</Text>
        <View style={styles.statusInfo}>
          <Text style={styles.studentNameSmall}>{enrollment.student.name}</Text>
          <Text style={styles.subjectSmall}>{SUBJECT_NAMES[subject]}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusInfo.bgColor }]}>
          <Ionicons
            name={statusInfo.icon as any}
            size={12}
            color={statusInfo.color}
          />
          <Text style={[styles.statusBadgeText, { color: statusInfo.color }]}>
            {statusInfo.label}
          </Text>
        </View>
      </View>

      {enrollment.tutor_response && (
        <View style={styles.responseBox}>
          <Text style={styles.responseText}>{enrollment.tutor_response}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  loadingContainer: {
    padding: spacing.md,
    alignItems: 'center',
  },
  emptyState: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.md,
  },
  emptyStateText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.textSecondary,
  },
  requestCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.sm,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    gap: spacing.sm,
  },
  emoji: {
    fontSize: 24,
  },
  requestInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  parentName: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textSecondary,
  },
  subjectBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral.white,
  },
  subjectBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  requestContent: {
    padding: spacing.sm,
    gap: spacing.xs,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  detailText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.text,
  },
  notesBox: {
    marginTop: spacing.xs,
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
  timestamp: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.status.error,
  },
  rejectButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.status.error,
  },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.status.success,
  },
  approveButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
  },
  actionDisabled: {
    opacity: 0.6,
  },
  statusCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    ...shadows.sm,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusInfo: {
    flex: 1,
  },
  studentNameSmall: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
  },
  subjectSmall: {
    fontSize: typography.sizes.xs,
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
  statusBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  responseBox: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.sm,
    borderLeftWidth: 2,
    borderLeftColor: colors.primary.main,
  },
  responseText: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textSecondary,
    fontStyle: 'italic',
  },
});

export default SessionEnrollmentsPanel;
