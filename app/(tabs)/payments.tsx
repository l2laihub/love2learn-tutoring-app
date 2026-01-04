/**
 * Payments Screen
 * Payment tracking for tutor (all families) and parents (their own)
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../../src/theme';
import { useAuthContext } from '../../src/contexts/AuthContext';
import {
  usePayments,
  usePaymentSummary,
  useCreatePayment,
  useUpdatePayment,
  useMarkPaymentPaid,
  useOverduePayments,
  useDeletePayment,
  useMonthlyLessonSummary,
  useQuickInvoice,
} from '../../src/hooks/usePayments';
import { useParents } from '../../src/hooks/useParents';
import { PaymentWithParent, CreatePaymentInput, UpdatePaymentInput } from '../../src/types/database';
import { PaymentFormModal, PaymentFormData } from '../../src/components/PaymentFormModal';
import { GenerateInvoiceModal } from '../../src/components/GenerateInvoiceModal';
import { RateSettingsModal } from '../../src/components/RateSettingsModal';
import { MonthlyPaymentSummary } from '../../src/components/MonthlyPaymentSummary';

export default function PaymentsScreen() {
  const { isTutor, parent } = useAuthContext();
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentWithParent | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch data
  const { data: payments, loading, error, refetch } = usePayments(selectedMonth);
  const { summary, refetch: refetchSummary } = usePaymentSummary(selectedMonth);
  const { data: overduePayments, refetch: refetchOverdue } = useOverduePayments();
  const { data: parents, loading: parentsLoading } = useParents();
  const {
    data: monthlyLessonSummary,
    loading: lessonSummaryLoading,
    refetch: refetchLessonSummary,
  } = useMonthlyLessonSummary(selectedMonth);

  // Mutations
  const createPayment = useCreatePayment();
  const updatePayment = useUpdatePayment();
  const markPaid = useMarkPaymentPaid();
  const deletePayment = useDeletePayment();
  const quickInvoice = useQuickInvoice();

  // Filter payments for parents (only show their own)
  const displayPayments = useMemo(() => {
    if (isTutor) return payments;
    return payments.filter(p => p.parent_id === parent?.id);
  }, [payments, isTutor, parent?.id]);

  // Month navigation
  const goToPreviousMonth = () => {
    const newMonth = new Date(selectedMonth);
    newMonth.setMonth(newMonth.getMonth() - 1);
    setSelectedMonth(newMonth);
  };

  const goToNextMonth = () => {
    const newMonth = new Date(selectedMonth);
    newMonth.setMonth(newMonth.getMonth() + 1);
    setSelectedMonth(newMonth);
  };

  const goToCurrentMonth = () => {
    setSelectedMonth(new Date());
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetch(), refetchSummary(), refetchOverdue(), refetchLessonSummary()]);
    setRefreshing(false);
  };

  // Quick invoice generation for a family
  const handleQuickInvoice = async (parentId: string) => {
    const payment = await quickInvoice.generateQuickInvoice(parentId, selectedMonth);
    if (payment) {
      Alert.alert('Success', 'Invoice generated successfully!');
      await handleRefresh();
    } else if (quickInvoice.error) {
      Alert.alert('Error', quickInvoice.error.message);
    }
  };

  const handleCreatePayment = async (data: PaymentFormData) => {
    const input: CreatePaymentInput = {
      parent_id: data.parent_id,
      month: data.month,
      amount_due: data.amount_due,
      amount_paid: data.amount_paid,
      notes: data.notes,
    };
    await createPayment.mutate(input);
    await handleRefresh();
  };

  const handleUpdatePayment = async (data: PaymentFormData) => {
    if (!selectedPayment) return;
    const input: UpdatePaymentInput = {
      amount_due: data.amount_due,
      amount_paid: data.amount_paid,
      notes: data.notes,
    };
    await updatePayment.mutate(selectedPayment.id, input);
    await handleRefresh();
    setSelectedPayment(null);
  };

  const handleMarkPaid = async (payment: PaymentWithParent) => {
    await markPaid.mutate(payment.id);
    await handleRefresh();
  };

  const handleDeletePayment = (payment: PaymentWithParent) => {
    Alert.alert(
      'Delete Payment',
      `Are you sure you want to delete the payment record for ${payment.parent?.name || 'this family'}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await deletePayment.mutate(payment.id);
            if (success) {
              await handleRefresh();
            } else {
              Alert.alert('Error', 'Failed to delete payment. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleInvoiceSuccess = async () => {
    await handleRefresh();
  };

  const monthDisplay = selectedMonth.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return colors.status.success;
      case 'partial':
        return colors.status.warning;
      case 'unpaid':
        return colors.status.error;
      default:
        return colors.neutral.textSecondary;
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'paid':
        return colors.status.successBg;
      case 'partial':
        return colors.status.warningBg;
      case 'unpaid':
        return colors.status.errorBg;
      default:
        return colors.neutral.background;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Payments</Text>
          {isTutor && (
            <View style={styles.headerButtons}>
              <Pressable
                style={styles.settingsButton}
                onPress={() => setShowSettingsModal(true)}
              >
                <Ionicons name="settings-outline" size={20} color={colors.neutral.textSecondary} />
              </Pressable>
              <Pressable
                style={styles.invoiceButton}
                onPress={() => setShowInvoiceModal(true)}
              >
                <Ionicons name="receipt-outline" size={20} color={colors.piano.primary} />
                <Text style={styles.invoiceButtonText}>Generate</Text>
              </Pressable>
              <Pressable
                style={styles.addButton}
                onPress={() => setShowCreateModal(true)}
              >
                <Ionicons name="add" size={24} color={colors.neutral.white} />
              </Pressable>
            </View>
          )}
        </View>

        {/* Month Navigation */}
        <View style={styles.monthNav}>
          <Pressable style={styles.navButton} onPress={goToPreviousMonth}>
            <Ionicons name="chevron-back" size={24} color={colors.neutral.text} />
          </Pressable>
          <Pressable style={styles.monthDisplay} onPress={goToCurrentMonth}>
            <Text style={styles.monthText}>{monthDisplay}</Text>
          </Pressable>
          <Pressable style={styles.navButton} onPress={goToNextMonth}>
            <Ionicons name="chevron-forward" size={24} color={colors.neutral.text} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Monthly Lesson Summary (Hybrid Approach) - Tutor only */}
        {isTutor && (
          <MonthlyPaymentSummary
            summary={monthlyLessonSummary}
            loading={lessonSummaryLoading}
            onGenerateInvoice={handleQuickInvoice}
            compact={false}
          />
        )}

        {/* Legacy Summary Cards - now as secondary info */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryCard}>
            <Ionicons name="wallet-outline" size={24} color={colors.status.success} />
            <Text style={styles.summaryAmount}>
              ${summary.totalPaid.toFixed(2)}
            </Text>
            <Text style={styles.summaryLabel}>Invoiced Collected</Text>
          </View>
          <View style={styles.summaryCard}>
            <Ionicons name="time-outline" size={24} color={colors.status.error} />
            <Text style={[styles.summaryAmount, { color: colors.status.error }]}>
              ${summary.totalOutstanding.toFixed(2)}
            </Text>
            <Text style={styles.summaryLabel}>Invoiced Outstanding</Text>
          </View>
        </View>

        {/* Status Breakdown */}
        {isTutor && summary.totalFamilies > 0 && (
          <View style={styles.statusBreakdown}>
            <View style={styles.statusItem}>
              <View style={[styles.statusDot, { backgroundColor: colors.status.success }]} />
              <Text style={styles.statusText}>{summary.paidCount} Paid</Text>
            </View>
            <View style={styles.statusItem}>
              <View style={[styles.statusDot, { backgroundColor: colors.status.warning }]} />
              <Text style={styles.statusText}>{summary.partialCount} Partial</Text>
            </View>
            <View style={styles.statusItem}>
              <View style={[styles.statusDot, { backgroundColor: colors.status.error }]} />
              <Text style={styles.statusText}>{summary.unpaidCount} Unpaid</Text>
            </View>
          </View>
        )}

        {/* Overdue Alert */}
        {isTutor && overduePayments.length > 0 && (
          <Pressable style={styles.overdueAlert}>
            <Ionicons name="warning" size={20} color={colors.status.error} />
            <Text style={styles.overdueText}>
              {overduePayments.length} overdue payment{overduePayments.length > 1 ? 's' : ''}
            </Text>
            <Ionicons name="chevron-forward" size={20} color={colors.status.error} />
          </Pressable>
        )}

        {/* Payment List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {isTutor ? 'All Families' : 'Payment History'}
          </Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.piano.primary} />
            </View>
          ) : displayPayments.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="receipt-outline" size={48} color={colors.neutral.textMuted} />
              <Text style={styles.emptyTitle}>No payments this month</Text>
              <Text style={styles.emptySubtitle}>
                {isTutor
                  ? 'Create payment records for your families'
                  : 'No payments recorded for this month'}
              </Text>
            </View>
          ) : (
            <View style={styles.paymentsList}>
              {displayPayments.map((payment) => (
                <Pressable
                  key={payment.id}
                  style={styles.paymentCard}
                  onPress={() => {
                    if (isTutor) {
                      setSelectedPayment(payment);
                      setShowEditModal(true);
                    }
                  }}
                >
                  <View style={styles.paymentMain}>
                    <View style={styles.paymentInfo}>
                      <Text style={styles.paymentFamily}>
                        {payment.parent?.name || 'Unknown'}
                      </Text>
                      <Text style={styles.paymentStudents}>
                        {payment.parent?.students?.length || 0} student{(payment.parent?.students?.length || 0) !== 1 ? 's' : ''}
                      </Text>
                    </View>
                    <View style={styles.paymentAmounts}>
                      <Text style={styles.paymentDue}>
                        ${payment.amount_due.toFixed(2)}
                      </Text>
                      <Text style={[styles.paymentPaid, { color: getStatusColor(payment.status) }]}>
                        ${payment.amount_paid.toFixed(2)} paid
                      </Text>
                    </View>
                  </View>

                  <View style={styles.paymentFooter}>
                    <View style={styles.paymentFooterLeft}>
                      <View style={[styles.statusBadge, { backgroundColor: getStatusBg(payment.status) }]}>
                        <Text style={[styles.statusBadgeText, { color: getStatusColor(payment.status) }]}>
                          {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.paymentActions}>
                      {isTutor && payment.status !== 'paid' && (
                        <Pressable
                          style={styles.markPaidButton}
                          onPress={() => handleMarkPaid(payment)}
                        >
                          <Ionicons name="checkmark" size={16} color={colors.status.success} />
                          <Text style={styles.markPaidText}>Mark Paid</Text>
                        </Pressable>
                      )}
                      {isTutor && (
                        <Pressable
                          style={styles.deleteButton}
                          onPress={() => handleDeletePayment(payment)}
                        >
                          <Ionicons name="trash-outline" size={16} color={colors.status.error} />
                        </Pressable>
                      )}
                    </View>
                  </View>

                  {payment.notes && (
                    <Text style={styles.paymentNotes} numberOfLines={1}>
                      {payment.notes}
                    </Text>
                  )}
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Create Modal */}
      <PaymentFormModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreatePayment}
        parents={parents}
        parentsLoading={parentsLoading}
        mode="create"
      />

      {/* Edit Modal */}
      <PaymentFormModal
        visible={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedPayment(null);
        }}
        onSubmit={handleUpdatePayment}
        parents={parents}
        parentsLoading={parentsLoading}
        initialData={selectedPayment}
        mode="edit"
      />

      {/* Generate Invoice Modal */}
      <GenerateInvoiceModal
        visible={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        onSuccess={handleInvoiceSuccess}
        parents={parents}
        parentsLoading={parentsLoading}
        initialMonth={selectedMonth}
      />

      {/* Rate Settings Modal */}
      <RateSettingsModal
        visible={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
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
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  settingsButton: {
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  invoiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.piano.primary,
    backgroundColor: colors.piano.subtle,
  },
  invoiceButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.piano.primary,
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
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navButton: {
    padding: spacing.sm,
  },
  monthDisplay: {
    flex: 1,
    alignItems: 'center',
  },
  monthText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
  },
  content: {
    flex: 1,
    padding: spacing.base,
  },
  summaryContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    ...shadows.sm,
  },
  summaryAmount: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.status.success,
    marginTop: spacing.sm,
  },
  summaryLabel: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginTop: spacing.xs,
  },
  statusBreakdown: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },
  overdueAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.status.errorBg,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  overdueText: {
    flex: 1,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.status.error,
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
  loadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.sm,
  },
  emptyTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  paymentsList: {
    gap: spacing.md,
  },
  paymentCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  paymentMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentFamily: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  paymentStudents: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginTop: 2,
  },
  paymentAmounts: {
    alignItems: 'flex-end',
  },
  paymentDue: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
  },
  paymentPaid: {
    fontSize: typography.sizes.sm,
    marginTop: 2,
  },
  paymentFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.borderLight,
  },
  paymentFooterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  statusBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    textTransform: 'uppercase',
  },
  markPaidButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.status.success,
  },
  markPaidText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.status.success,
  },
  deleteButton: {
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.status.error,
  },
  paymentNotes: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
});
