import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './ui/Card';
import { Avatar } from './ui/Avatar';
import { colors, spacing, typography, borderRadius } from '../theme';

interface PrepaidStatusCardProps {
  // Family info
  parentName: string;
  studentNames: string[];
  // Month info
  month: string;
  monthDisplay: string;
  // Prepaid status
  sessionsTotal: number;
  sessionsUsed: number;
  sessionsRemaining: number;
  sessionsRolledOver?: number;
  // Payment info
  amountDue: number;
  isPaid: boolean;
  paidAt?: string;
  notes?: string;
  // Actions
  onPress?: () => void;
  onMarkPaid?: () => void;
  onCreatePrepaid?: () => void;
  onUpdateSessionsUsed?: (newCount: number) => void;
  onPreviewParentView?: () => void;
}

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function PrepaidStatusCard({
  parentName,
  studentNames,
  month,
  monthDisplay,
  sessionsTotal,
  sessionsUsed,
  sessionsRemaining,
  sessionsRolledOver = 0,
  amountDue,
  isPaid,
  paidAt,
  notes,
  onPress,
  onMarkPaid,
  onUpdateSessionsUsed,
  onPreviewParentView,
}: PrepaidStatusCardProps) {
  const usagePercent = sessionsTotal > 0 ? (sessionsUsed / sessionsTotal) * 100 : 0;
  const isOverLimit = sessionsUsed > sessionsTotal;

  // Determine progress bar color
  let progressColor: string = colors.piano.primary;
  if (usagePercent >= 100) {
    progressColor = colors.status.error;
  } else if (usagePercent >= 75) {
    progressColor = colors.status.warning;
  }

  return (
    <Card onPress={onPress} style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <Avatar name={parentName} size="md" />
        <View style={styles.headerText}>
          <Text style={styles.parentName}>{parentName}</Text>
          <Text style={styles.students}>
            {studentNames.join(', ')}
          </Text>
        </View>
        <View style={[styles.badge, isPaid ? styles.badgePaid : styles.badgeUnpaid]}>
          <Text style={[styles.badgeText, isPaid ? styles.badgeTextPaid : styles.badgeTextUnpaid]}>
            {isPaid ? 'Prepaid' : 'Unpaid'}
          </Text>
        </View>
      </View>

      {/* Session counter */}
      <View style={styles.sessionCounter}>
        <View style={styles.sessionHeader}>
          <Text style={styles.sessionTitle}>Sessions</Text>
          <View style={styles.sessionCountRow}>
            {onUpdateSessionsUsed && (
              <Pressable
                style={styles.sessionAdjustButton}
                onPress={() => onUpdateSessionsUsed(Math.max(0, sessionsUsed - 1))}
              >
                <Ionicons name="remove" size={16} color={colors.neutral.text} />
              </Pressable>
            )}
            <Text style={styles.sessionCount}>
              <Text style={styles.sessionUsed}>{sessionsUsed}</Text>
              <Text style={styles.sessionSeparator}> / </Text>
              <Text style={styles.sessionTotal}>{sessionsTotal}</Text>
            </Text>
            {onUpdateSessionsUsed && (
              <Pressable
                style={styles.sessionAdjustButton}
                onPress={() => onUpdateSessionsUsed(sessionsUsed + 1)}
              >
                <Ionicons name="add" size={16} color={colors.neutral.text} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(usagePercent, 100)}%`,
                  backgroundColor: progressColor,
                },
              ]}
            />
          </View>
        </View>

        {/* Session details */}
        <View style={styles.sessionDetails}>
          <View style={styles.sessionDetailItem}>
            <Ionicons name="checkmark-circle" size={14} color={colors.math.primary} />
            <Text style={styles.sessionDetailText}>{sessionsUsed} used</Text>
          </View>
          <View style={styles.sessionDetailItem}>
            <Ionicons name="time-outline" size={14} color={colors.piano.primary} />
            <Text style={styles.sessionDetailText}>{sessionsRemaining} remaining</Text>
          </View>
          {sessionsRolledOver > 0 && (
            <View style={styles.sessionDetailItem}>
              <Ionicons name="refresh" size={14} color={colors.neutral.textSecondary} />
              <Text style={styles.sessionDetailText}>{sessionsRolledOver} rolled over</Text>
            </View>
          )}
        </View>

        {isOverLimit && (
          <View style={styles.overLimitWarning}>
            <Ionicons name="warning" size={16} color={colors.status.error} />
            <Text style={styles.overLimitText}>
              {sessionsUsed - sessionsTotal} extra session(s) beyond prepaid
            </Text>
          </View>
        )}
      </View>

      {/* Amount info */}
      <View style={styles.amountSection}>
        <View style={styles.amountRow}>
          <Text style={styles.amountLabel}>Prepaid Amount</Text>
          <Text style={styles.amountValue}>{formatCurrency(amountDue)}</Text>
        </View>
        {paidAt && isPaid && (
          <View style={styles.paidInfo}>
            <Ionicons name="checkmark-circle" size={14} color={colors.math.primary} />
            <Text style={styles.paidText}>Paid on {paidAt}</Text>
          </View>
        )}
      </View>

      {notes && (
        <Text style={styles.notes} numberOfLines={2}>
          {notes}
        </Text>
      )}

      {/* Action buttons */}
      <View style={styles.actionButtonsRow}>
        {/* Mark as paid button */}
        {!isPaid && onMarkPaid && (
          <Pressable onPress={onMarkPaid} style={styles.markPaidButton}>
            <Ionicons name="checkmark" size={18} color={colors.math.primary} />
            <Text style={styles.markPaidText}>Mark as Paid</Text>
          </Pressable>
        )}

        {/* Preview parent view button */}
        {onPreviewParentView && (
          <Pressable onPress={onPreviewParentView} style={styles.previewButton}>
            <Ionicons name="eye-outline" size={18} color={colors.piano.primary} />
            <Text style={styles.previewButtonText}>Preview Parent View</Text>
          </Pressable>
        )}
      </View>
    </Card>
  );
}

/**
 * Compact prepaid status for parent dashboard
 */
interface PrepaidStatusCompactProps {
  sessionsTotal: number;
  sessionsUsed: number;
  sessionsRemaining: number;
  isPaid: boolean;
  monthDisplay: string;
  onViewDetails?: () => void;
}

export function PrepaidStatusCompact({
  sessionsTotal,
  sessionsUsed,
  sessionsRemaining,
  isPaid,
  monthDisplay,
  onViewDetails,
}: PrepaidStatusCompactProps) {
  const usagePercent = sessionsTotal > 0 ? (sessionsUsed / sessionsTotal) * 100 : 0;

  let progressColor: string = colors.piano.primary;
  if (usagePercent >= 100) {
    progressColor = colors.status.error;
  } else if (usagePercent >= 75) {
    progressColor = colors.status.warning;
  }

  return (
    <Card onPress={onViewDetails} style={styles.compactCard}>
      <View style={styles.compactHeader}>
        <View>
          <Text style={styles.compactTitle}>{monthDisplay} Sessions</Text>
          <View style={[styles.badge, isPaid ? styles.badgePaid : styles.badgeUnpaid, styles.compactBadge]}>
            <Text style={[styles.badgeText, isPaid ? styles.badgeTextPaid : styles.badgeTextUnpaid, styles.compactBadgeText]}>
              {isPaid ? 'Prepaid' : 'Payment Due'}
            </Text>
          </View>
        </View>
        <View style={styles.compactCounter}>
          <Text style={styles.compactSessionCount}>
            {sessionsUsed}/{sessionsTotal}
          </Text>
          <Text style={styles.compactSessionLabel}>used</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.compactProgress}>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.min(usagePercent, 100)}%`,
                backgroundColor: progressColor,
              },
            ]}
          />
        </View>
      </View>

      <Text style={styles.compactRemaining}>
        {sessionsRemaining} session{sessionsRemaining !== 1 ? 's' : ''} remaining
      </Text>
    </Card>
  );
}

/**
 * Empty state when no prepaid payment exists
 */
interface PrepaidEmptyStateProps {
  parentName: string;
  monthDisplay: string;
  onCreatePrepaid: () => void;
}

export function PrepaidEmptyState({
  parentName,
  monthDisplay,
  onCreatePrepaid,
}: PrepaidEmptyStateProps) {
  return (
    <Card style={styles.emptyCard}>
      <Ionicons name="calendar-outline" size={40} color={colors.neutral.textMuted} />
      <Text style={styles.emptyTitle}>No Prepaid Plan</Text>
      <Text style={styles.emptyText}>
        {parentName} doesn't have a prepaid plan for {monthDisplay}
      </Text>
      <Pressable onPress={onCreatePrepaid} style={styles.createButton}>
        <Ionicons name="add" size={18} color={colors.neutral.white} />
        <Text style={styles.createButtonText}>Create Prepaid Plan</Text>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerText: {
    flex: 1,
    marginLeft: spacing.md,
  },
  parentName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  students: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  badgePaid: {
    backgroundColor: colors.math.subtle,
  },
  badgeUnpaid: {
    backgroundColor: colors.status.warningBg,
  },
  badgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  badgeTextPaid: {
    color: colors.math.primary,
  },
  badgeTextUnpaid: {
    color: colors.status.warning,
  },

  // Session counter
  sessionCounter: {
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sessionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.textSecondary,
  },
  sessionCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sessionAdjustButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.neutral.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionCount: {
    fontSize: typography.sizes.lg,
  },
  sessionUsed: {
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
  },
  sessionSeparator: {
    color: colors.neutral.textMuted,
  },
  sessionTotal: {
    fontWeight: typography.weights.medium,
    color: colors.neutral.textSecondary,
  },
  progressContainer: {
    marginBottom: spacing.sm,
  },
  progressTrack: {
    height: 8,
    backgroundColor: colors.neutral.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  sessionDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  sessionDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sessionDetailText: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textSecondary,
  },
  overLimitWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    backgroundColor: colors.status.errorBg,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  overLimitText: {
    fontSize: typography.sizes.xs,
    color: colors.status.error,
    fontWeight: typography.weights.medium,
  },

  // Amount section
  amountSection: {
    marginBottom: spacing.sm,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },
  amountValue: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  paidInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  paidText: {
    fontSize: typography.sizes.xs,
    color: colors.math.primary,
  },
  notes: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    fontStyle: 'italic',
  },
  actionButtonsRow: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  markPaidButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    backgroundColor: colors.math.subtle,
    borderRadius: borderRadius.md,
  },
  markPaidText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.math.primary,
  },
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.piano.primary,
    borderRadius: borderRadius.md,
  },
  previewButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.piano.primary,
  },

  // Compact card
  compactCard: {
    marginBottom: spacing.md,
  },
  compactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  compactTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginBottom: spacing.xs,
  },
  compactBadge: {
    marginTop: 0,
  },
  compactBadgeText: {
    fontSize: 10,
  },
  compactCounter: {
    alignItems: 'flex-end',
  },
  compactSessionCount: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
  },
  compactSessionLabel: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textSecondary,
  },
  compactProgress: {
    marginBottom: spacing.sm,
  },
  compactRemaining: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
  },

  // Empty state
  emptyCard: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  emptyText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.piano.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  createButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.white,
  },
});

export default PrepaidStatusCard;
