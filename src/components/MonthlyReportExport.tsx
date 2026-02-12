/**
 * MonthlyReportExport
 * Generates and exports monthly payment summary as CSV
 * Supports month navigation and expandable family rows with lesson details
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Modal,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import {
  MonthlyLessonSummary,
  FamilyLessonSummary,
  LessonDetail,
  useMonthlyLessonSummary,
  usePayments,
} from '../hooks/usePayments';
import { PaymentWithParent } from '../types/database';

interface MonthlyReportExportProps {
  visible: boolean;
  onClose: () => void;
  summary: MonthlyLessonSummary | null;
  payments: PaymentWithParent[];
  month: Date;
}

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function formatMonth(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatMonthShort(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function formatLessonDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function getPaymentStatusLabel(status: 'none' | 'invoiced' | 'paid'): string {
  switch (status) {
    case 'paid': return 'Paid';
    case 'invoiced': return 'Invoiced';
    default: return 'Unpaid';
  }
}

function generateCSV(
  summary: MonthlyLessonSummary,
  payments: PaymentWithParent[],
  month: Date
): string {
  const lines: string[] = [];
  const monthStr = formatMonth(month);

  // Header
  lines.push(`Monthly Payment Report - ${monthStr}`);
  lines.push('');

  // Summary section
  lines.push('SUMMARY');
  lines.push('Metric,Value');
  lines.push(`Total Lessons,${summary.totals.scheduled_count + summary.totals.completed_count + summary.totals.invoiced_count + summary.totals.paid_count}`);
  lines.push(`Completed,${summary.totals.completed_count + summary.totals.invoiced_count + summary.totals.paid_count}`);
  lines.push(`Cancelled,${summary.totals.cancelled_count}`);
  lines.push(`Expected Revenue,${formatCurrency(summary.totals.expected_amount)}`);
  lines.push(`Ready to Bill,${formatCurrency(summary.totals.billable_amount)}`);
  lines.push(`Invoiced (Unpaid),${formatCurrency(summary.totals.invoiced_amount)}`);
  lines.push(`Collected,${formatCurrency(summary.totals.collected_amount)}`);
  lines.push('');

  // Per-family breakdown
  lines.push('FAMILY BREAKDOWN');
  lines.push('Family,Lessons Completed,Lessons Cancelled,Amount Due,Amount Paid,Status');

  // Build a map of payment data by parent_id
  const paymentMap = new Map<string, PaymentWithParent>();
  payments.forEach(p => {
    paymentMap.set(p.parent_id, p);
  });

  summary.families.forEach((family: FamilyLessonSummary) => {
    const payment = paymentMap.get(family.parent_id);
    const totalCompleted = family.completed_count + family.invoiced_count + family.paid_count;
    const amountDue = payment?.amount_due ?? family.expected_amount;
    const amountPaid = payment?.amount_paid ?? 0;
    const status = payment?.status ?? (totalCompleted > 0 ? 'not invoiced' : 'no lessons');

    // Escape commas in names
    const safeName = family.parent_name.includes(',')
      ? `"${family.parent_name}"`
      : family.parent_name;

    lines.push(
      `${safeName},${totalCompleted},${family.cancelled_count},${formatCurrency(amountDue)},${formatCurrency(amountPaid)},${status}`
    );
  });

  lines.push('');

  // Detailed lesson list with Payment Status column
  lines.push('LESSON DETAILS');
  lines.push('Family,Student,Subject,Date,Duration (min),Amount,Status,Payment Status');

  summary.families.forEach((family: FamilyLessonSummary) => {
    if (!family.lessons) return;
    family.lessons.forEach(lesson => {
      const safeFamilyName = family.parent_name.includes(',')
        ? `"${family.parent_name}"`
        : family.parent_name;
      const safeStudentName = lesson.student_name?.includes(',')
        ? `"${lesson.student_name}"`
        : (lesson.student_name || 'Unknown');
      const date = new Date(lesson.scheduled_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      const paymentStatusCsv = lesson.payment_status === 'paid'
        ? 'Paid'
        : lesson.payment_status === 'invoiced'
        ? 'Invoiced'
        : 'UNPAID';

      lines.push(
        `${safeFamilyName},${safeStudentName},${lesson.subject},${date},${lesson.duration_min},${formatCurrency(lesson.calculated_amount || 0)},${lesson.status},${paymentStatusCsv}`
      );
    });
  });

  return lines.join('\n');
}

async function exportCSV(csv: string, month: Date): Promise<void> {
  const monthStr = formatMonthShort(month).replace(' ', '_');
  const filename = `Payment_Report_${monthStr}.csv`;

  if (Platform.OS === 'web') {
    // Web: download via blob
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } else {
    // Mobile: save to file system and share
    const fileUri = FileSystem.documentDirectory + filename;
    await FileSystem.writeAsStringAsync(fileUri, csv, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: `Payment Report - ${formatMonth(month)}`,
      });
    } else {
      Alert.alert('Export Saved', `Report saved to: ${fileUri}`);
    }
  }
}

export function MonthlyReportExport({
  visible,
  onClose,
  summary: propSummary,
  payments: propPayments,
  month,
}: MonthlyReportExportProps) {
  const [exporting, setExporting] = useState(false);
  const [reportMonth, setReportMonth] = useState<Date>(month);
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set());

  // Reset internal state when modal opens or prop month changes
  useEffect(() => {
    if (visible) {
      setReportMonth(month);
      setExpandedFamilies(new Set());
    }
  }, [visible, month]);

  // Determine if we're viewing the prop month or a different one
  const isPropsMonth = reportMonth.getFullYear() === month.getFullYear()
    && reportMonth.getMonth() === month.getMonth();

  // Fetch independent data when browsing to a different month
  const {
    data: fetchedSummary,
    loading: summaryLoading,
  } = useMonthlyLessonSummary(reportMonth);

  const {
    data: fetchedPayments,
    loading: paymentsLoading,
  } = usePayments(reportMonth);

  // Use prop data when on the same month, fetched data otherwise
  const summary = isPropsMonth ? propSummary : fetchedSummary;
  const payments = isPropsMonth ? propPayments : fetchedPayments;
  const isLoading = !isPropsMonth && (summaryLoading || paymentsLoading);

  const navigateMonth = (direction: -1 | 1) => {
    setReportMonth(prev => {
      const next = new Date(prev.getFullYear(), prev.getMonth() + direction, 1);
      return next;
    });
    setExpandedFamilies(new Set());
  };

  const toggleFamily = (parentId: string) => {
    setExpandedFamilies(prev => {
      const next = new Set(prev);
      if (next.has(parentId)) {
        next.delete(parentId);
      } else {
        next.add(parentId);
      }
      return next;
    });
  };

  const totalLessons = summary
    ? summary.totals.scheduled_count +
      summary.totals.completed_count +
      summary.totals.invoiced_count +
      summary.totals.paid_count
    : 0;

  const totalCompleted = summary
    ? summary.totals.completed_count +
      summary.totals.invoiced_count +
      summary.totals.paid_count
    : 0;

  const handleExport = async () => {
    if (!summary) return;
    setExporting(true);
    try {
      const csv = generateCSV(summary, payments, reportMonth);
      await exportCSV(csv, reportMonth);
      onClose();
    } catch (err) {
      console.error('Export failed:', err);
      Alert.alert('Export Failed', 'Unable to export the report. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.neutral.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Monthly Report</Text>
          <Pressable
            style={[styles.exportButton, (exporting || !summary) && styles.exportButtonDisabled]}
            onPress={handleExport}
            disabled={exporting || !summary}
          >
            {exporting ? (
              <ActivityIndicator size="small" color={colors.neutral.white} />
            ) : (
              <>
                <Ionicons name="download-outline" size={18} color={colors.neutral.white} />
                <Text style={styles.exportButtonText}>Export CSV</Text>
              </>
            )}
          </Pressable>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
          {/* Month Navigation */}
          <View style={styles.monthNav}>
            <Pressable onPress={() => navigateMonth(-1)} style={styles.monthNavButton}>
              <Ionicons name="chevron-back" size={24} color={colors.piano.primary} />
            </Pressable>
            <Text style={styles.monthTitle}>{formatMonth(reportMonth)}</Text>
            <Pressable onPress={() => navigateMonth(1)} style={styles.monthNavButton}>
              <Ionicons name="chevron-forward" size={24} color={colors.piano.primary} />
            </Pressable>
          </View>

          {/* Loading State */}
          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.piano.primary} />
              <Text style={styles.loadingText}>Loading report data...</Text>
            </View>
          )}

          {/* Content */}
          {!isLoading && !summary && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No data available for this month</Text>
            </View>
          )}

          {!isLoading && summary && (
            <>
              {/* Summary Cards */}
              <View style={styles.summaryGrid}>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryCardLabel}>Total Lessons</Text>
                  <Text style={styles.summaryCardValue}>{totalLessons}</Text>
                  <Text style={styles.summaryCardSubtext}>
                    {totalCompleted} completed, {summary.totals.cancelled_count} cancelled
                  </Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryCardLabel}>Expected Revenue</Text>
                  <Text style={styles.summaryCardValue}>
                    {formatCurrency(summary.totals.expected_amount)}
                  </Text>
                </View>
                <View style={[styles.summaryCard, styles.summaryCardSuccess]}>
                  <Text style={styles.summaryCardLabel}>Collected</Text>
                  <Text style={[styles.summaryCardValue, { color: colors.status.success }]}>
                    {formatCurrency(summary.totals.collected_amount)}
                  </Text>
                </View>
                <View style={[styles.summaryCard, styles.summaryCardWarning]}>
                  <Text style={styles.summaryCardLabel}>Outstanding</Text>
                  <Text style={[styles.summaryCardValue, { color: colors.status.warning }]}>
                    {formatCurrency(
                      summary.totals.invoiced_amount + summary.totals.billable_amount
                    )}
                  </Text>
                </View>
              </View>

              {/* Family Breakdown */}
              <Text style={styles.sectionTitle}>Family Breakdown</Text>
              {summary.families.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No lesson data for this month</Text>
                </View>
              ) : (
                summary.families.map((family) => {
                  const payment = payments.find(p => p.parent_id === family.parent_id);
                  const completedTotal = family.completed_count + family.invoiced_count + family.paid_count;
                  const isExpanded = expandedFamilies.has(family.parent_id);

                  return (
                    <View key={family.parent_id} style={styles.familyContainer}>
                      <Pressable
                        style={[styles.familyRow, isExpanded && styles.familyRowExpanded]}
                        onPress={() => toggleFamily(family.parent_id)}
                      >
                        <Ionicons
                          name={isExpanded ? 'chevron-down' : 'chevron-forward'}
                          size={18}
                          color={colors.neutral.textMuted}
                          style={styles.familyChevron}
                        />
                        <View style={styles.familyInfo}>
                          <Text style={styles.familyName}>{family.parent_name}</Text>
                          <Text style={styles.familyLessons}>
                            {completedTotal} lesson{completedTotal !== 1 ? 's' : ''}
                            {family.cancelled_count > 0 && ` (${family.cancelled_count} cancelled)`}
                          </Text>
                        </View>
                        <View style={styles.familyAmounts}>
                          <Text style={styles.familyAmountDue}>
                            {formatCurrency(payment?.amount_due ?? family.expected_amount)}
                          </Text>
                          {payment && (
                            <View
                              style={[
                                styles.familyStatusBadge,
                                payment.status === 'paid' && styles.statusPaid,
                                payment.status === 'partial' && styles.statusPartial,
                                payment.status === 'unpaid' && styles.statusUnpaid,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.familyStatusText,
                                  payment.status === 'paid' && styles.statusPaidText,
                                  payment.status === 'partial' && styles.statusPartialText,
                                  payment.status === 'unpaid' && styles.statusUnpaidText,
                                ]}
                              >
                                {payment.status === 'paid'
                                  ? 'Paid'
                                  : payment.status === 'partial'
                                  ? 'Partial'
                                  : 'Unpaid'}
                              </Text>
                            </View>
                          )}
                          {!payment && completedTotal > 0 && (
                            <View style={[styles.familyStatusBadge, styles.statusNotInvoiced]}>
                              <Text style={styles.statusNotInvoicedText}>Not Invoiced</Text>
                            </View>
                          )}
                        </View>
                      </Pressable>

                      {/* Expanded Lesson Details */}
                      {isExpanded && family.lessons && family.lessons.length > 0 && (
                        <View style={styles.lessonList}>
                          {family.lessons.map((lesson: LessonDetail) => {
                            const isUnpaid = lesson.payment_status === 'none' && lesson.status === 'completed';
                            return (
                              <View
                                key={lesson.id}
                                style={[
                                  styles.lessonRow,
                                  isUnpaid && styles.lessonRowUnpaid,
                                ]}
                              >
                                <View style={styles.lessonLeft}>
                                  <Text style={styles.lessonStudent}>
                                    {lesson.student_name}
                                  </Text>
                                  <Text style={styles.lessonMeta}>
                                    {lesson.subject} · {formatLessonDate(lesson.scheduled_at)} · {lesson.duration_min}min
                                  </Text>
                                </View>
                                <View style={styles.lessonRight}>
                                  <Text style={styles.lessonAmount}>
                                    {formatCurrency(lesson.calculated_amount || 0)}
                                  </Text>
                                  <View
                                    style={[
                                      styles.lessonPaymentBadge,
                                      lesson.payment_status === 'paid' && styles.lessonBadgePaid,
                                      lesson.payment_status === 'invoiced' && styles.lessonBadgeInvoiced,
                                      lesson.payment_status === 'none' && styles.lessonBadgeUnpaid,
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.lessonPaymentText,
                                        lesson.payment_status === 'paid' && styles.lessonTextPaid,
                                        lesson.payment_status === 'invoiced' && styles.lessonTextInvoiced,
                                        lesson.payment_status === 'none' && styles.lessonTextUnpaid,
                                      ]}
                                    >
                                      {getPaymentStatusLabel(lesson.payment_status)}
                                    </Text>
                                  </View>
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      )}
                      {isExpanded && (!family.lessons || family.lessons.length === 0) && (
                        <View style={styles.lessonList}>
                          <Text style={styles.noLessonsText}>No lesson details available</Text>
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </>
          )}
        </ScrollView>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    backgroundColor: colors.neutral.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  closeButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.piano.primary,
    borderRadius: borderRadius.md,
  },
  exportButtonDisabled: {
    opacity: 0.6,
  },
  exportButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: spacing.base,
  },
  // Month navigation
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  monthNavButton: {
    padding: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral.white,
    ...shadows.sm,
  },
  monthTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
    minWidth: 200,
    textAlign: 'center',
  },
  // Loading
  loadingContainer: {
    padding: spacing['2xl'],
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textMuted,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  summaryCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    ...shadows.sm,
  },
  summaryCardSuccess: {
    borderLeftWidth: 3,
    borderLeftColor: colors.status.success,
  },
  summaryCardWarning: {
    borderLeftWidth: 3,
    borderLeftColor: colors.status.warning,
  },
  summaryCardLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.neutral.textSecondary,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  summaryCardValue: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
  },
  summaryCardSubtext: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginBottom: spacing.md,
  },
  emptyState: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textMuted,
  },
  // Family rows
  familyContainer: {
    marginBottom: spacing.sm,
  },
  familyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    ...shadows.sm,
  },
  familyRowExpanded: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  familyChevron: {
    marginRight: spacing.sm,
  },
  familyInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  familyName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  familyLessons: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginTop: spacing.xs,
  },
  familyAmounts: {
    alignItems: 'flex-end',
  },
  familyAmountDue: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
    marginBottom: spacing.xs,
  },
  familyStatusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  statusPaid: {
    backgroundColor: colors.status.successBg,
  },
  statusPartial: {
    backgroundColor: colors.status.warningBg,
  },
  statusUnpaid: {
    backgroundColor: colors.status.errorBg,
  },
  statusNotInvoiced: {
    backgroundColor: colors.neutral.background,
  },
  familyStatusText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  statusPaidText: {
    color: colors.status.success,
  },
  statusPartialText: {
    color: colors.status.warning,
  },
  statusUnpaidText: {
    color: colors.status.error,
  },
  statusNotInvoicedText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.neutral.textMuted,
  },
  // Expanded lesson details
  lessonList: {
    backgroundColor: colors.neutral.white,
    borderBottomLeftRadius: borderRadius.lg,
    borderBottomRightRadius: borderRadius.lg,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    ...shadows.sm,
  },
  lessonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: 2,
  },
  lessonRowUnpaid: {
    backgroundColor: '#FFF5F5',
  },
  lessonLeft: {
    flex: 1,
    marginRight: spacing.sm,
  },
  lessonStudent: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  lessonMeta: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
    marginTop: 2,
  },
  lessonRight: {
    alignItems: 'flex-end',
  },
  lessonAmount: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginBottom: 2,
  },
  lessonPaymentBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    borderRadius: borderRadius.full,
  },
  lessonBadgePaid: {
    backgroundColor: colors.status.successBg,
  },
  lessonBadgeInvoiced: {
    backgroundColor: colors.status.warningBg,
  },
  lessonBadgeUnpaid: {
    backgroundColor: colors.status.errorBg,
  },
  lessonPaymentText: {
    fontSize: 10,
    fontWeight: typography.weights.semibold,
  },
  lessonTextPaid: {
    color: colors.status.success,
  },
  lessonTextInvoiced: {
    color: colors.status.warning,
  },
  lessonTextUnpaid: {
    color: colors.status.error,
  },
  noLessonsText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
});

export default MonthlyReportExport;
