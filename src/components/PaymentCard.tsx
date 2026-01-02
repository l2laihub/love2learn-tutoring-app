import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './ui/Card';
import { PaymentBadge } from './ui/Badge';
import { Avatar } from './ui/Avatar';
import { colors, spacing, typography, borderRadius, getPaymentStatusColor } from '../theme';

interface PaymentCardProps {
  parentName: string;
  studentNames: string[];
  month: string;
  amountDue: number;
  amountPaid: number;
  status: 'paid' | 'partial' | 'unpaid';
  paidAt?: string;
  notes?: string;
  onPress?: () => void;
  onMarkPaid?: () => void;
}

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function PaymentCard({
  parentName,
  studentNames,
  month,
  amountDue,
  amountPaid,
  status,
  paidAt,
  notes,
  onPress,
  onMarkPaid,
}: PaymentCardProps) {
  const statusColor = getPaymentStatusColor(status);
  const remaining = amountDue - amountPaid;
  const progressPercent = amountDue > 0 ? (amountPaid / amountDue) * 100 : 0;

  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.header}>
        <Avatar name={parentName} size="md" />
        <View style={styles.headerText}>
          <Text style={styles.parentName}>{parentName}</Text>
          <Text style={styles.students}>
            {studentNames.join(', ')}
          </Text>
        </View>
        <PaymentBadge status={status} />
      </View>

      <View style={styles.amounts}>
        <View style={styles.amountRow}>
          <Text style={styles.amountLabel}>Due</Text>
          <Text style={styles.amountValue}>{formatCurrency(amountDue)}</Text>
        </View>
        <View style={styles.amountRow}>
          <Text style={styles.amountLabel}>Paid</Text>
          <Text style={[styles.amountValue, { color: colors.math.primary }]}>
            {formatCurrency(amountPaid)}
          </Text>
        </View>
        {status !== 'paid' && remaining > 0 && (
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>Remaining</Text>
            <Text style={[styles.amountValue, { color: colors.status.error }]}>
              {formatCurrency(remaining)}
            </Text>
          </View>
        )}
      </View>

      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.min(progressPercent, 100)}%`,
                backgroundColor: statusColor,
              },
            ]}
          />
        </View>
      </View>

      {paidAt && status === 'paid' && (
        <View style={styles.paidInfo}>
          <Ionicons name="checkmark-circle" size={16} color={colors.math.primary} />
          <Text style={styles.paidText}>Paid on {paidAt}</Text>
        </View>
      )}

      {notes && (
        <Text style={styles.notes} numberOfLines={2}>
          {notes}
        </Text>
      )}

      {status !== 'paid' && onMarkPaid && (
        <Pressable onPress={onMarkPaid} style={styles.markPaidButton}>
          <Ionicons name="checkmark" size={18} color={colors.math.primary} />
          <Text style={styles.markPaidText}>Mark as Paid</Text>
        </Pressable>
      )}
    </Card>
  );
}

// Month header for payment list
interface PaymentMonthHeaderProps {
  month: string;
  totalDue: number;
  totalPaid: number;
  familyCount: number;
}

export function PaymentMonthHeader({
  month,
  totalDue,
  totalPaid,
  familyCount,
}: PaymentMonthHeaderProps) {
  const collectionRate = totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : 0;

  return (
    <View style={styles.monthHeader}>
      <View style={styles.monthTitleRow}>
        <Text style={styles.monthTitle}>{month}</Text>
        <View style={styles.monthBadge}>
          <Text style={styles.monthBadgeText}>{familyCount} families</Text>
        </View>
      </View>
      <View style={styles.monthStats}>
        <View style={styles.monthStat}>
          <Text style={styles.monthStatLabel}>Total Due</Text>
          <Text style={styles.monthStatValue}>{formatCurrency(totalDue)}</Text>
        </View>
        <View style={styles.monthStat}>
          <Text style={styles.monthStatLabel}>Collected</Text>
          <Text style={[styles.monthStatValue, { color: colors.math.primary }]}>
            {formatCurrency(totalPaid)}
          </Text>
        </View>
        <View style={styles.monthStat}>
          <Text style={styles.monthStatLabel}>Rate</Text>
          <Text
            style={[
              styles.monthStatValue,
              { color: collectionRate >= 80 ? colors.math.primary : colors.status.warning },
            ]}
          >
            {collectionRate}%
          </Text>
        </View>
      </View>
    </View>
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
  amounts: {
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  amountLabel: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },
  amountValue: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  progressContainer: {
    marginBottom: spacing.md,
  },
  progressTrack: {
    height: 6,
    backgroundColor: colors.neutral.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  paidInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  paidText: {
    fontSize: typography.sizes.sm,
    color: colors.math.primary,
  },
  notes: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },
  markPaidButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.math.subtle,
    borderRadius: borderRadius.md,
  },
  markPaidText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.math.primary,
  },

  // Month header
  monthHeader: {
    marginBottom: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  monthTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  monthTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
  },
  monthBadge: {
    backgroundColor: colors.neutral.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  monthBadgeText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },
  monthStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  monthStat: {
    alignItems: 'center',
  },
  monthStatLabel: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
    marginBottom: 4,
  },
  monthStatValue: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
});

export default PaymentCard;
