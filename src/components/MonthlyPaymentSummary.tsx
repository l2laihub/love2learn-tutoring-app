import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ViewStyle, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './ui/Card';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import { MonthlyLessonSummary, FamilyLessonSummary, LessonDetail } from '../hooks/usePayments';
import { TutoringSubject } from '../types/database';

// Tooltip descriptions for each stat card
const STAT_TOOLTIPS = {
  expected: {
    title: 'Expected Revenue',
    description: 'Total amount you expect to earn this month from all scheduled and completed lessons.',
  },
  ready_to_bill: {
    title: 'Ready to Bill',
    description: 'Completed lessons that haven\'t been invoiced yet. Generate an invoice to bill parents for these lessons.',
  },
  invoiced: {
    title: 'Invoiced',
    description: 'Lessons that have been added to an invoice but payment hasn\'t been received yet. Awaiting parent payment.',
  },
  collected: {
    title: 'Collected',
    description: 'Payment has been received for these lessons. This is money in your pocket!',
  },
};

// Subject display names
const SUBJECT_NAMES: Record<TutoringSubject, string> = {
  math: 'Math',
  piano: 'Piano',
  reading: 'Reading',
  speech: 'Speech',
  english: 'English',
};

export type StatusFilterType = 'ready_to_bill' | 'invoiced' | 'collected' | 'all';

interface MonthlyPaymentSummaryProps {
  summary: MonthlyLessonSummary | null;
  loading?: boolean;
  onGenerateInvoice?: (parentId: string) => void;
  onViewFamily?: (parentId: string) => void;
  onSwitchToPrepaid?: (parentId: string) => void;
  onStatusClick?: (status: StatusFilterType) => void;
  compact?: boolean;
}

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function formatMonth(monthString: string): string {
  const date = new Date(monthString + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// Helper to show tooltip info
function showTooltip(key: keyof typeof STAT_TOOLTIPS) {
  const tooltip = STAT_TOOLTIPS[key];
  if (Platform.OS === 'web') {
    window.alert(`${tooltip.title}\n\n${tooltip.description}`);
  } else {
    Alert.alert(tooltip.title, tooltip.description);
  }
}

/**
 * Summary card showing the overall monthly payment status
 */
export function MonthlyPaymentSummary({
  summary,
  loading,
  onGenerateInvoice,
  onViewFamily,
  onSwitchToPrepaid,
  onStatusClick,
  compact = false,
}: MonthlyPaymentSummaryProps) {
  if (loading) {
    return (
      <Card style={styles.card}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.piano.primary} />
          <Text style={styles.loadingText}>Loading summary...</Text>
        </View>
      </Card>
    );
  }

  if (!summary) {
    return null;
  }

  const { totals } = summary;
  const totalLessons = totals.scheduled_count + totals.completed_count + totals.invoiced_count + totals.paid_count;

  return (
    <View style={styles.container}>
      {/* Main Summary Card */}
      <Card style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>{formatMonth(summary.month)} Summary</Text>
          {totals.combined_session_count > 0 && (
            <View style={styles.combinedBadge}>
              <Ionicons name="people" size={12} color={colors.piano.primary} />
              <Text style={styles.combinedText}>
                {totals.combined_session_count} combined
              </Text>
            </View>
          )}
        </View>

        {/* Summary Stats Grid */}
        <View style={styles.statsGrid}>
          {/* Expected */}
          <Pressable
            style={[styles.statBox, styles.statBoxExpected, onStatusClick && styles.statBoxClickable]}
            onPress={onStatusClick ? () => onStatusClick('all') : undefined}
          >
            <View style={styles.statHeaderRow}>
              <View style={styles.statIcon}>
                <Ionicons name="calendar-outline" size={20} color={colors.neutral.textSecondary} />
              </View>
              <Pressable
                style={styles.infoButton}
                onPress={(e) => {
                  e.stopPropagation();
                  showTooltip('expected');
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="information-circle-outline" size={16} color={colors.neutral.textMuted} />
              </Pressable>
            </View>
            <Text style={styles.statLabel}>Expected</Text>
            <Text style={styles.statAmount}>{formatCurrency(totals.expected_amount)}</Text>
            <Text style={styles.statCount}>{totals.scheduled_count + totals.completed_count + totals.invoiced_count + totals.paid_count} lessons</Text>
            {onStatusClick && (
              <View style={styles.viewDetailsHint}>
                <Ionicons name="eye-outline" size={12} color={colors.neutral.textMuted} />
                <Text style={styles.viewDetailsText}>View all</Text>
              </View>
            )}
          </Pressable>

          {/* Billable (Ready to Invoice) */}
          <Pressable
            style={[styles.statBox, styles.statBoxBillable, onStatusClick && styles.statBoxClickable]}
            onPress={onStatusClick ? () => onStatusClick('ready_to_bill') : undefined}
          >
            <View style={styles.statHeaderRow}>
              <View style={styles.statIcon}>
                <Ionicons name="checkmark-circle-outline" size={20} color={colors.status.warning} />
              </View>
              <Pressable
                style={styles.infoButton}
                onPress={(e) => {
                  e.stopPropagation();
                  showTooltip('ready_to_bill');
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="information-circle-outline" size={16} color={colors.status.warning} />
              </Pressable>
            </View>
            <Text style={styles.statLabel}>Ready to Bill</Text>
            <Text style={[styles.statAmount, { color: colors.status.warning }]}>
              {formatCurrency(totals.billable_amount)}
            </Text>
            <Text style={styles.statCount}>{totals.completed_count} lessons</Text>
            {onStatusClick && totals.completed_count > 0 && (
              <View style={styles.viewDetailsHint}>
                <Ionicons name="eye-outline" size={12} color={colors.status.warning} />
                <Text style={[styles.viewDetailsText, { color: colors.status.warning }]}>View details</Text>
              </View>
            )}
          </Pressable>

          {/* Invoiced */}
          <Pressable
            style={[styles.statBox, styles.statBoxInvoiced, onStatusClick && styles.statBoxClickable]}
            onPress={onStatusClick ? () => onStatusClick('invoiced') : undefined}
          >
            <View style={styles.statHeaderRow}>
              <View style={styles.statIcon}>
                <Ionicons name="document-text-outline" size={20} color={colors.piano.primary} />
              </View>
              <Pressable
                style={styles.infoButton}
                onPress={(e) => {
                  e.stopPropagation();
                  showTooltip('invoiced');
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="information-circle-outline" size={16} color={colors.piano.primary} />
              </Pressable>
            </View>
            <Text style={styles.statLabel}>Invoiced</Text>
            <Text style={[styles.statAmount, { color: colors.piano.primary }]}>
              {formatCurrency(totals.invoiced_amount)}
            </Text>
            <Text style={styles.statCount}>{totals.invoiced_count} lessons</Text>
            {onStatusClick && totals.invoiced_count > 0 && (
              <View style={styles.viewDetailsHint}>
                <Ionicons name="eye-outline" size={12} color={colors.piano.primary} />
                <Text style={[styles.viewDetailsText, { color: colors.piano.primary }]}>View details</Text>
              </View>
            )}
          </Pressable>

          {/* Collected */}
          <Pressable
            style={[styles.statBox, styles.statBoxCollected, onStatusClick && styles.statBoxClickable]}
            onPress={onStatusClick ? () => onStatusClick('collected') : undefined}
          >
            <View style={styles.statHeaderRow}>
              <View style={styles.statIcon}>
                <Ionicons name="cash-outline" size={20} color={colors.math.primary} />
              </View>
              <Pressable
                style={styles.infoButton}
                onPress={(e) => {
                  e.stopPropagation();
                  showTooltip('collected');
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="information-circle-outline" size={16} color={colors.math.primary} />
              </Pressable>
            </View>
            <Text style={styles.statLabel}>Collected</Text>
            <Text style={[styles.statAmount, { color: colors.math.primary }]}>
              {formatCurrency(totals.collected_amount)}
            </Text>
            <Text style={styles.statCount}>{totals.paid_count} lessons</Text>
            {onStatusClick && totals.paid_count > 0 && (
              <View style={styles.viewDetailsHint}>
                <Ionicons name="eye-outline" size={12} color={colors.math.primary} />
                <Text style={[styles.viewDetailsText, { color: colors.math.primary }]}>View details</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressSection}>
          <View style={styles.progressLabels}>
            <Text style={styles.progressLabel}>Collection Progress</Text>
            <Text style={styles.progressPercent}>
              {totals.expected_amount > 0
                ? Math.round((totals.collected_amount / totals.expected_amount) * 100)
                : 0}%
            </Text>
          </View>
          <View style={styles.progressTrack}>
            {/* Collected portion */}
            <View
              style={[
                styles.progressFill,
                styles.progressCollected,
                {
                  width: totals.expected_amount > 0
                    ? `${(totals.collected_amount / totals.expected_amount) * 100}%`
                    : '0%',
                },
              ]}
            />
            {/* Invoiced portion */}
            <View
              style={[
                styles.progressFill,
                styles.progressInvoiced,
                {
                  width: totals.expected_amount > 0
                    ? `${(totals.invoiced_amount / totals.expected_amount) * 100}%`
                    : '0%',
                },
              ]}
            />
            {/* Billable portion */}
            <View
              style={[
                styles.progressFill,
                styles.progressBillable,
                {
                  width: totals.expected_amount > 0
                    ? `${(totals.billable_amount / totals.expected_amount) * 100}%`
                    : '0%',
                },
              ]}
            />
          </View>
          <View style={styles.progressLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.math.primary }]} />
              <Text style={styles.legendText}>Collected</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.piano.primary }]} />
              <Text style={styles.legendText}>Invoiced</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.status.warning }]} />
              <Text style={styles.legendText}>Ready</Text>
            </View>
          </View>
        </View>

        {/* Cancelled lessons note */}
        {totals.cancelled_count > 0 && (
          <View style={styles.cancelledNote}>
            <Ionicons name="close-circle-outline" size={14} color={colors.neutral.textMuted} />
            <Text style={styles.cancelledText}>
              {totals.cancelled_count} cancelled lesson{totals.cancelled_count !== 1 ? 's' : ''} not included
            </Text>
          </View>
        )}
      </Card>

      {/* Family Breakdown (if not compact) */}
      {!compact && summary.families.length > 0 && (
        <View style={styles.familiesSection}>
          <Text style={styles.sectionTitle}>By Family</Text>
          {summary.families.map((family) => (
            <FamilySummaryCard
              key={family.parent_id}
              family={family}
              onGenerateInvoice={
                family.billable_amount > 0 && onGenerateInvoice
                  ? () => onGenerateInvoice(family.parent_id)
                  : undefined
              }
              onPress={onViewFamily ? () => onViewFamily(family.parent_id) : undefined}
              onSwitchToPrepaid={onSwitchToPrepaid ? () => onSwitchToPrepaid(family.parent_id) : undefined}
              onStatusClick={onStatusClick}
            />
          ))}
        </View>
      )}
    </View>
  );
}

/**
 * Individual family summary card with expandable lesson details
 */
interface FamilySummaryCardProps {
  family: FamilyLessonSummary;
  onGenerateInvoice?: () => void;
  onPress?: () => void;
  onSwitchToPrepaid?: () => void;
  onStatusClick?: (status: StatusFilterType, parentId: string) => void;
}

function formatLessonDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function getStatusIcon(status: 'scheduled' | 'completed' | 'cancelled'): string {
  switch (status) {
    case 'scheduled': return 'calendar-outline';
    case 'completed': return 'checkmark-circle';
    case 'cancelled': return 'close-circle';
  }
}

function getPaymentStatusColor(paymentStatus: 'none' | 'invoiced' | 'paid' | 'prepaid'): string {
  switch (paymentStatus) {
    case 'paid': return colors.math.primary;
    case 'invoiced': return colors.piano.primary;
    case 'prepaid': return colors.status.info;
    case 'none': return colors.neutral.textMuted;
  }
}

function FamilySummaryCard({ family, onGenerateInvoice, onSwitchToPrepaid, onStatusClick }: FamilySummaryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const totalLessons = family.scheduled_count + family.completed_count + family.invoiced_count + family.paid_count;

  return (
    <Card style={styles.familyCard}>
      {/* Header - always visible */}
      <Pressable onPress={() => setExpanded(!expanded)} style={styles.familyHeader}>
        <View style={styles.familyInfo}>
          <Text style={styles.familyName}>{family.parent_name}</Text>
          <Text style={styles.familyLessons}>
            {totalLessons} lesson{totalLessons !== 1 ? 's' : ''}
            {family.combined_session_count > 0 && (
              <Text style={styles.combinedInfo}> ({family.combined_session_count} combined)</Text>
            )}
          </Text>
        </View>
        <View style={styles.familyAmountSection}>
          <Text style={styles.familyExpected}>{formatCurrency(family.expected_amount)}</Text>
          {family.collected_amount > 0 && (
            <Text style={styles.familyCollected}>
              {formatCurrency(family.collected_amount)} collected
            </Text>
          )}
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.neutral.textSecondary}
        />
      </Pressable>

      {/* Status breakdown - clickable chips */}
      <View style={styles.familyStatus}>
        {family.scheduled_count > 0 && (
          <View style={styles.statusItem}>
            <View style={[styles.statusDot, { backgroundColor: colors.neutral.textMuted }]} />
            <Text style={styles.statusText}>{family.scheduled_count} scheduled</Text>
          </View>
        )}
        {family.completed_count > 0 && (
          <Pressable
            style={[styles.statusItem, onStatusClick && styles.statusItemClickable]}
            onPress={onStatusClick ? () => onStatusClick('ready_to_bill', family.parent_id) : undefined}
          >
            <View style={[styles.statusDot, { backgroundColor: colors.status.warning }]} />
            <Text style={[styles.statusText, onStatusClick && styles.statusTextClickable]}>
              {family.completed_count} ready to bill
            </Text>
            {onStatusClick && (
              <Ionicons name="chevron-forward" size={12} color={colors.status.warning} />
            )}
          </Pressable>
        )}
        {family.invoiced_count > 0 && (
          <Pressable
            style={[styles.statusItem, onStatusClick && styles.statusItemClickable]}
            onPress={onStatusClick ? () => onStatusClick('invoiced', family.parent_id) : undefined}
          >
            <View style={[styles.statusDot, { backgroundColor: colors.piano.primary }]} />
            <Text style={[styles.statusText, onStatusClick && styles.statusTextClickable]}>
              {family.invoiced_count} invoiced
            </Text>
            {onStatusClick && (
              <Ionicons name="chevron-forward" size={12} color={colors.piano.primary} />
            )}
          </Pressable>
        )}
        {family.paid_count > 0 && (
          <Pressable
            style={[styles.statusItem, onStatusClick && styles.statusItemClickable]}
            onPress={onStatusClick ? () => onStatusClick('collected', family.parent_id) : undefined}
          >
            <View style={[styles.statusDot, { backgroundColor: colors.math.primary }]} />
            <Text style={[styles.statusText, onStatusClick && styles.statusTextClickable]}>
              {family.paid_count} paid
            </Text>
            {onStatusClick && (
              <Ionicons name="chevron-forward" size={12} color={colors.math.primary} />
            )}
          </Pressable>
        )}
      </View>

      {/* Expanded lesson details */}
      {expanded && family.lessons.length > 0 && (
        <View style={styles.lessonDetails}>
          <View style={styles.lessonDetailsHeader}>
            <Text style={styles.lessonDetailsTitle}>Lesson Breakdown</Text>
          </View>
          {family.lessons.map((lesson) => (
            <LessonDetailRow key={lesson.id} lesson={lesson} />
          ))}
          <View style={styles.lessonTotalRow}>
            <Text style={styles.lessonTotalLabel}>Total Expected</Text>
            <Text style={styles.lessonTotalAmount}>{formatCurrency(family.expected_amount)}</Text>
          </View>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        {/* Quick Invoice Button */}
        {onGenerateInvoice && family.billable_amount > 0 && (
          <Pressable onPress={onGenerateInvoice} style={styles.invoiceButton}>
            <Ionicons name="receipt-outline" size={16} color={colors.piano.primary} />
            <Text style={styles.invoiceButtonText}>
              Generate Invoice ({formatCurrency(family.billable_amount)})
            </Text>
          </Pressable>
        )}
        {/* Switch to Prepaid Button */}
        {onSwitchToPrepaid && (
          <Pressable onPress={onSwitchToPrepaid} style={styles.switchToPrepaidButton}>
            <Ionicons name="swap-horizontal" size={16} color={colors.neutral.textSecondary} />
            <Text style={styles.switchToPrepaidText}>Switch to Prepaid</Text>
          </Pressable>
        )}
      </View>
    </Card>
  );
}

/**
 * Individual lesson row showing calculation details
 */
function LessonDetailRow({ lesson }: { lesson: LessonDetail }) {
  const statusColor = lesson.status === 'cancelled'
    ? colors.status.error
    : lesson.status === 'completed'
      ? colors.status.success
      : colors.neutral.textSecondary;

  return (
    <View style={[
      styles.lessonRow,
      lesson.status === 'cancelled' && styles.lessonRowCancelled,
    ]}>
      <View style={styles.lessonRowMain}>
        <View style={styles.lessonRowLeft}>
          <View style={styles.lessonDateRow}>
            <Ionicons
              name={getStatusIcon(lesson.status) as any}
              size={14}
              color={statusColor}
            />
            <Text style={styles.lessonDate}>{formatLessonDate(lesson.scheduled_at)}</Text>
            {lesson.is_combined_session && (
              <View style={styles.combinedBadgeSmall}>
                <Ionicons name="people" size={10} color={colors.piano.primary} />
              </View>
            )}
          </View>
          <Text style={styles.lessonStudent}>{lesson.student_name}</Text>
          <Text style={styles.lessonSubject}>
            {SUBJECT_NAMES[lesson.subject]} • {lesson.duration_min}min
          </Text>
        </View>
        <View style={styles.lessonRowRight}>
          <Text style={[
            styles.lessonAmount,
            lesson.status === 'cancelled' && styles.lessonAmountCancelled,
          ]}>
            {lesson.status === 'cancelled' ? '$0.00' : formatCurrency(lesson.calculated_amount)}
          </Text>
          <Text style={styles.lessonRate}>{lesson.rate_display}</Text>
          {lesson.payment_status !== 'none' && lesson.status !== 'cancelled' && (
            <View style={[styles.paymentBadge, { backgroundColor: getPaymentStatusColor(lesson.payment_status) + '20' }]}>
              <Text style={[styles.paymentBadgeText, { color: getPaymentStatusColor(lesson.payment_status) }]}>
                {lesson.payment_status}
              </Text>
            </View>
          )}
        </View>
      </View>
      <Text style={styles.lessonFormula}>{lesson.calculation_formula}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  card: {
    marginBottom: spacing.md,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  loadingText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
  },
  combinedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.piano.subtle,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  combinedText: {
    fontSize: typography.sizes.xs,
    color: colors.piano.primary,
    fontWeight: typography.weights.medium,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  statBoxExpected: {},
  statBoxBillable: {
    borderLeftWidth: 3,
    borderLeftColor: colors.status.warning,
  },
  statBoxInvoiced: {
    borderLeftWidth: 3,
    borderLeftColor: colors.piano.primary,
  },
  statBoxCollected: {
    borderLeftWidth: 3,
    borderLeftColor: colors.math.primary,
  },
  statHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  statIcon: {
    // Icon styling
  },
  infoButton: {
    padding: 2,
    borderRadius: borderRadius.full,
  },
  statLabel: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statAmount: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
  },
  statCount: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textSecondary,
    marginTop: 2,
  },
  statBoxClickable: {
    cursor: 'pointer',
  } as ViewStyle,
  viewDetailsHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
  },
  viewDetailsText: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
  },
  progressSection: {
    marginBottom: spacing.md,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  progressLabel: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },
  progressPercent: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  progressTrack: {
    height: 8,
    backgroundColor: colors.neutral.border,
    borderRadius: 4,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  progressFill: {
    height: '100%',
  },
  progressCollected: {
    backgroundColor: colors.math.primary,
  },
  progressInvoiced: {
    backgroundColor: colors.piano.primary,
  },
  progressBillable: {
    backgroundColor: colors.status.warning,
  },
  progressLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textSecondary,
  },
  cancelledNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
  },
  cancelledText: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
    fontStyle: 'italic',
  },

  // Families Section
  familiesSection: {
    marginTop: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginBottom: spacing.md,
  },
  familyCard: {
    marginBottom: spacing.sm,
  },
  familyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  familyInfo: {
    flex: 1,
  },
  familyName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  familyLessons: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginTop: 2,
  },
  combinedInfo: {
    color: colors.piano.primary,
  },
  familyAmountSection: {
    alignItems: 'flex-end',
    marginRight: spacing.sm,
  },
  familyExpected: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
  },
  familyCollected: {
    fontSize: typography.sizes.xs,
    color: colors.math.primary,
    marginTop: 2,
  },
  familyStatus: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textSecondary,
  },
  statusItemClickable: {
    backgroundColor: colors.neutral.background,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  statusTextClickable: {
    fontWeight: typography.weights.medium,
  },

  // Lesson Details (expanded)
  lessonDetails: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
  },
  lessonDetailsHeader: {
    marginBottom: spacing.sm,
  },
  lessonDetailsTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  lessonRow: {
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  lessonRowCancelled: {
    opacity: 0.6,
  },
  lessonRowMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  lessonRowLeft: {
    flex: 1,
  },
  lessonRowRight: {
    alignItems: 'flex-end',
  },
  lessonDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  lessonDate: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
  },
  lessonStudent: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginTop: 2,
  },
  lessonSubject: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textSecondary,
  },
  lessonAmount: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
  },
  lessonAmountCancelled: {
    textDecorationLine: 'line-through',
    color: colors.neutral.textMuted,
  },
  lessonRate: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textSecondary,
  },
  lessonFormula: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  combinedBadgeSmall: {
    backgroundColor: colors.piano.subtle,
    padding: 2,
    borderRadius: borderRadius.full,
  },
  paymentBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginTop: 2,
  },
  paymentBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    textTransform: 'capitalize',
  },
  lessonTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
  },
  lessonTotalLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  lessonTotalAmount: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
  },

  actionButtons: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  invoiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    backgroundColor: colors.piano.subtle,
    borderRadius: borderRadius.md,
  },
  invoiceButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.piano.primary,
  },
  switchToPrepaidButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: borderRadius.md,
  },
  switchToPrepaidText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.textSecondary,
  },
});

export default MonthlyPaymentSummary;
