/**
 * Payments Screen
 * Payment tracking for tutor (all families) and parents (their own)
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
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../../src/theme';
import { useAuthContext } from '../../src/contexts/AuthContext';
import {
  usePayments,
  usePaymentSummary,
  useCreatePayment,
  useUpdatePayment,
  useMarkPaymentPaid,
  useMarkPaymentUnpaid,
  useOverduePayments,
  useDeletePayment,
  useMonthlyLessonSummary,
  useQuickInvoice,
  useCreatePrepaidPayment,
  usePrepaidPayments,
  useMarkPrepaidPaymentPaid,
  useUpdatePrepaidSessionsUsed,
} from '../../src/hooks/usePayments';
import { useParents, useUpdateBillingMode } from '../../src/hooks/useParents';
import { PaymentWithParent, CreatePaymentInput, UpdatePaymentInput, ParentWithStudents } from '../../src/types/database';
import { PaymentFormModal, PaymentFormData } from '../../src/components/PaymentFormModal';
import { GenerateInvoiceModal } from '../../src/components/GenerateInvoiceModal';
import { RateSettingsModal } from '../../src/components/RateSettingsModal';
import { MonthlyPaymentSummary } from '../../src/components/MonthlyPaymentSummary';
import { PrepaidStatusCard } from '../../src/components/PrepaidStatusCard';
import { CreatePrepaidModal } from '../../src/components/CreatePrepaidModal';
import { ParentViewPreviewModal } from '../../src/components/ParentViewPreviewModal';
import { LessonDetailsModal, LessonFilterType, PrepaidPaymentDisplay } from '../../src/components/LessonDetailsModal';
import { StatusFilterType } from '../../src/components/MonthlyPaymentSummary';
import { PaymentFilterBar, PaymentFilterStatus, PaymentSortOption } from '../../src/components/PaymentFilterBar';
import { SendReminderModal } from '../../src/components/SendReminderModal';
import { MonthlyReportExport } from '../../src/components/MonthlyReportExport';
import { usePaymentRemindersBatch, formatRelativeTime } from '../../src/hooks/usePaymentReminders';

type PaymentViewMode = 'invoice' | 'prepaid';

// Type for storing preview data
interface PreviewData {
  parentName: string;
  studentNames: string[];
  monthDisplay: string;
  sessionsTotal: number;
  sessionsUsed: number;
  sessionsRemaining: number;
  sessionsRolledOver: number;
  amountDue: number;
  isPaid: boolean;
  paidAt?: string;
  notes?: string;
}

export default function PaymentsScreen() {
  const { isTutor, parent } = useAuthContext();
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentWithParent | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // Prepaid-specific state
  const [viewMode, setViewMode] = useState<PaymentViewMode>('invoice');
  const [showPrepaidModal, setShowPrepaidModal] = useState(false);
  const [selectedPrepaidParent, setSelectedPrepaidParent] = useState<ParentWithStudents | null>(null);
  // Preview modal state
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  // Lesson details modal state
  const [showLessonDetailsModal, setShowLessonDetailsModal] = useState(false);
  const [lessonFilterType, setLessonFilterType] = useState<LessonFilterType>('all');
  // Filter bar state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<PaymentFilterStatus>('all');
  const [sortOption, setSortOption] = useState<PaymentSortOption>('name-asc');
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  // Send reminder modal state
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderPayment, setReminderPayment] = useState<PaymentWithParent | null>(null);
  // Monthly report export modal state
  const [showReportModal, setShowReportModal] = useState(false);

  // Fetch data
  const { data: payments, loading, error, refetch } = usePayments(selectedMonth);
  const { summary, refetch: refetchSummary } = usePaymentSummary(selectedMonth);
  const { data: overduePayments, refetch: refetchOverdue } = useOverduePayments();
  const { data: parents, loading: parentsLoading, refetch: refetchParents } = useParents();
  const {
    data: monthlyLessonSummary,
    loading: lessonSummaryLoading,
    refetch: refetchLessonSummary,
  } = useMonthlyLessonSummary(selectedMonth);
  // Prepaid data
  const {
    data: prepaidPayments,
    loading: prepaidLoading,
    refetch: refetchPrepaid,
  } = usePrepaidPayments(selectedMonth);

  // Get payment IDs for batch reminder fetching
  const paymentIds = useMemo(() => payments.map(p => p.id), [payments]);
  const {
    data: remindersByPayment,
    refetch: refetchReminders,
  } = usePaymentRemindersBatch(paymentIds);

  // Refetch all data when tab gains focus (e.g., after completing a lesson on Calendar)
  useFocusEffect(
    useCallback(() => {
      refetch();
      refetchSummary();
      refetchOverdue();
      refetchLessonSummary();
      refetchPrepaid();
      refetchParents();
    }, [refetch, refetchSummary, refetchOverdue, refetchLessonSummary, refetchPrepaid, refetchParents])
  );

  // Mutations
  const createPayment = useCreatePayment();
  const updatePayment = useUpdatePayment();
  const markPaid = useMarkPaymentPaid();
  const markUnpaid = useMarkPaymentUnpaid();
  const deletePayment = useDeletePayment();
  const quickInvoice = useQuickInvoice();
  // Prepaid mutations
  const createPrepaid = useCreatePrepaidPayment();
  const markPrepaidPaid = useMarkPrepaidPaymentPaid();
  const updateBillingMode = useUpdateBillingMode();
  const updateSessionsUsed = useUpdatePrepaidSessionsUsed();

  // Filter prepaid families (families set to prepaid billing mode)
  const prepaidFamilies = useMemo(() => {
    return parents.filter(p => p.billing_mode === 'prepaid');
  }, [parents]);

  // Filter invoice families (families set to invoice billing mode or default)
  const invoiceFamilies = useMemo(() => {
    return parents.filter(p => !p.billing_mode || p.billing_mode === 'invoice');
  }, [parents]);

  // Filter payments for parents (only show their own)
  // For tutors on Invoice tab, only show invoice-based families (not prepaid)
  const displayPayments = useMemo(() => {
    if (!isTutor) {
      return payments.filter(p => p.parent_id === parent?.id);
    }
    // For tutor: filter out prepaid families from invoice payments list
    const prepaidParentIds = new Set(prepaidFamilies.map(p => p.id));
    return payments.filter(p => !prepaidParentIds.has(p.parent_id));
  }, [payments, isTutor, parent?.id, prepaidFamilies]);

  // Filtered and sorted payments for Invoice tab
  const filteredPayments = useMemo(() => {
    let result = displayPayments;

    // Search by family name
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(p =>
        p.parent?.name?.toLowerCase().includes(query)
      );
    }

    // Filter by status
    if (filterStatus !== 'all') {
      result = result.filter(p => p.status === filterStatus);
    }

    // Sort
    switch (sortOption) {
      case 'name-asc':
        result = [...result].sort((a, b) =>
          (a.parent?.name || '').localeCompare(b.parent?.name || '')
        );
        break;
      case 'name-desc':
        result = [...result].sort((a, b) =>
          (b.parent?.name || '').localeCompare(a.parent?.name || '')
        );
        break;
      case 'amount-high':
        result = [...result].sort((a, b) => b.amount_due - a.amount_due);
        break;
      case 'amount-low':
        result = [...result].sort((a, b) => a.amount_due - b.amount_due);
        break;
      case 'status':
        const statusOrder: Record<string, number> = { unpaid: 0, partial: 1, paid: 2 };
        result = [...result].sort((a, b) =>
          statusOrder[a.status] - statusOrder[b.status]
        );
        break;
    }

    return result;
  }, [displayPayments, searchQuery, filterStatus, sortOption]);

  // Helper to get lesson dates for a payment from the monthly lesson summary
  const getLessonDatesForPayment = (parentId: string): { dates: string[], count: number } => {
    if (!monthlyLessonSummary) return { dates: [], count: 0 };

    const family = monthlyLessonSummary.families.find(f => f.parent_id === parentId);
    if (!family) return { dates: [], count: 0 };

    // Get lessons that are invoiced or paid (part of this payment)
    const invoicedLessons = family.lessons.filter(
      l => l.payment_status === 'invoiced' || l.payment_status === 'paid'
    );

    // Format dates
    const dates = invoicedLessons.map(l => {
      const date = new Date(l.scheduled_at);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    return { dates, count: invoicedLessons.length };
  };

  // Convert paid prepaid payments to display format for the Collected modal
  const paidPrepaidForDisplay: PrepaidPaymentDisplay[] = useMemo(() => {
    return prepaidPayments
      .filter(p => p.status === 'paid')
      .map(p => ({
        id: p.id,
        parentId: p.parent_id,
        parentName: p.parent?.name || 'Unknown',
        studentNames: p.parent?.students?.map(s => s.name) || [],
        sessionsTotal: p.sessions_prepaid || 0,
        sessionsUsed: p.sessions_used || 0,
        amountPaid: p.amount_paid || 0,
        paidAt: p.paid_at ? new Date(p.paid_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }) : undefined,
      }));
  }, [prepaidPayments]);

  // Reset filters helper
  const resetFilters = () => {
    setSearchQuery('');
    setFilterStatus('all');
    setSortOption('name-asc');
  };

  // Month navigation
  const goToPreviousMonth = () => {
    const newMonth = new Date(selectedMonth);
    newMonth.setMonth(newMonth.getMonth() - 1);
    setSelectedMonth(newMonth);
    resetFilters();
  };

  const goToNextMonth = () => {
    const newMonth = new Date(selectedMonth);
    newMonth.setMonth(newMonth.getMonth() + 1);
    setSelectedMonth(newMonth);
    resetFilters();
  };

  const goToCurrentMonth = () => {
    setSelectedMonth(new Date());
    resetFilters();
  };

  // View mode handler with filter reset
  const handleViewModeChange = (mode: PaymentViewMode) => {
    setViewMode(mode);
    resetFilters();
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refetch(),
      refetchSummary(),
      refetchOverdue(),
      refetchLessonSummary(),
      refetchPrepaid(),
      refetchParents(), // Refetch parents to update billing mode and tab counts
      refetchReminders(), // Refetch payment reminders
    ]);
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

  const handleMarkUnpaid = async (payment: PaymentWithParent) => {
    await markUnpaid.mutate(payment.id);
    await handleRefresh();
  };

  const handleDeletePayment = async (payment: PaymentWithParent) => {
    const parentName = payment.parent?.name || 'this family';

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        `Are you sure you want to delete the payment record for ${parentName}? This cannot be undone.`
      );
      if (confirmed) {
        const success = await deletePayment.mutate(payment.id);
        if (success) {
          await handleRefresh();
        } else {
          window.alert('Failed to delete payment. Please try again.');
        }
      }
    } else {
      Alert.alert(
        'Delete Payment',
        `Are you sure you want to delete the payment record for ${parentName}? This cannot be undone.`,
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
    }
  };

  const handleInvoiceSuccess = async () => {
    await handleRefresh();
  };

  // Open reminder modal for a payment
  const handleOpenReminderModal = (payment: PaymentWithParent) => {
    setReminderPayment(payment);
    setShowReminderModal(true);
  };

  // Prepaid handlers
  const handleCreatePrepaid = async (data: {
    parent_id: string;
    sessions_count: number;
    amount: number;
    notes?: string;
  }) => {
    const payment = await createPrepaid.mutate({
      parent_id: data.parent_id,
      month: selectedMonth.toISOString(),
      sessions_count: data.sessions_count,
      amount: data.amount,
      notes: data.notes,
    });

    if (payment) {
      Alert.alert('Success', 'Prepaid plan created successfully!');
      await handleRefresh();
    } else if (createPrepaid.error) {
      throw createPrepaid.error;
    }
  };

  const handleMarkPrepaidPaid = async (paymentId: string, parentName: string) => {
    // Use window.confirm for web, Alert for native
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(`Confirm that ${parentName} has paid for their prepaid sessions?`);
      if (confirmed) {
        const payment = await markPrepaidPaid.mutate(paymentId);
        if (payment) {
          window.alert('Payment marked as paid!');
          await handleRefresh();
        } else {
          window.alert('Failed to mark payment as paid.');
        }
      }
    } else {
      Alert.alert(
        'Mark as Paid',
        `Confirm that ${parentName} has paid for their prepaid sessions?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Confirm',
            onPress: async () => {
              const payment = await markPrepaidPaid.mutate(paymentId);
              if (payment) {
                await handleRefresh();
              } else {
                Alert.alert('Error', 'Failed to mark payment as paid.');
              }
            },
          },
        ]
      );
    }
  };

  const handleOpenPrepaidModal = (parentData: ParentWithStudents) => {
    setSelectedPrepaidParent(parentData);
    setShowPrepaidModal(true);
  };

  const handleUpdateSessionsUsed = async (paymentId: string, newCount: number) => {
    const result = await updateSessionsUsed.mutate(paymentId, newCount);
    if (result) {
      await handleRefresh();
    } else if (Platform.OS === 'web') {
      window.alert('Failed to update sessions count.');
    } else {
      Alert.alert('Error', 'Failed to update sessions count.');
    }
  };

  const handlePreviewParentView = (
    parentData: ParentWithStudents,
    prepaidPayment: PaymentWithParent
  ) => {
    setPreviewData({
      parentName: parentData.name,
      studentNames: parentData.students?.map(s => s.name) || [],
      monthDisplay,
      sessionsTotal: prepaidPayment.sessions_prepaid || 0,
      sessionsUsed: prepaidPayment.sessions_used || 0,
      sessionsRemaining: Math.max(0, (prepaidPayment.sessions_prepaid || 0) - (prepaidPayment.sessions_used || 0)),
      sessionsRolledOver: prepaidPayment.sessions_rolled_over || 0,
      amountDue: prepaidPayment.amount_due,
      isPaid: prepaidPayment.status === 'paid',
      paidAt: prepaidPayment.paid_at ? new Date(prepaidPayment.paid_at).toLocaleDateString() : undefined,
      notes: prepaidPayment.notes || undefined,
    });
    setShowPreviewModal(true);
  };

  const handleToggleBillingMode = async (parentData: ParentWithStudents) => {
    const newMode = parentData.billing_mode === 'prepaid' ? 'invoice' : 'prepaid';
    const modeName = newMode === 'prepaid' ? 'Prepaid' : 'Invoice';

    // Use window.confirm for web, Alert for native
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(`Switch ${parentData.name} to ${modeName} billing mode?`);
      if (confirmed) {
        const result = await updateBillingMode.mutate(parentData.id, newMode);
        if (result) {
          window.alert(`${parentData.name} is now on ${modeName} billing.`);
          await handleRefresh();
        } else {
          window.alert('Failed to update billing mode.');
        }
      }
    } else {
      Alert.alert(
        'Change Billing Mode',
        `Switch ${parentData.name} to ${modeName} billing mode?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Confirm',
            onPress: async () => {
              const result = await updateBillingMode.mutate(parentData.id, newMode);
              if (result) {
                Alert.alert('Success', `${parentData.name} is now on ${modeName} billing.`);
                await handleRefresh();
              } else {
                Alert.alert('Error', 'Failed to update billing mode.');
              }
            },
          },
        ]
      );
    }
  };

  const monthDisplay = selectedMonth.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  // Handler for showing lesson details modal
  const handleStatusClick = (status: StatusFilterType) => {
    setLessonFilterType(status as LessonFilterType);
    setShowLessonDetailsModal(true);
  };

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
                onPress={() => setShowReportModal(true)}
              >
                <Ionicons name="document-text-outline" size={20} color={colors.neutral.textSecondary} />
              </Pressable>
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

        {/* View Mode Toggle (Tutor only) */}
        {isTutor && (
          <View style={styles.viewModeToggle}>
            <Pressable
              style={[
                styles.viewModeButton,
                viewMode === 'invoice' && styles.viewModeButtonActive,
              ]}
              onPress={() => handleViewModeChange('invoice')}
            >
              <Ionicons
                name="receipt-outline"
                size={16}
                color={viewMode === 'invoice' ? colors.piano.primary : colors.neutral.textSecondary}
              />
              <Text style={[
                styles.viewModeText,
                viewMode === 'invoice' && styles.viewModeTextActive,
              ]}>
                Invoice ({invoiceFamilies.length})
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.viewModeButton,
                viewMode === 'prepaid' && styles.viewModeButtonActive,
              ]}
              onPress={() => handleViewModeChange('prepaid')}
            >
              <Ionicons
                name="calendar-outline"
                size={16}
                color={viewMode === 'prepaid' ? colors.piano.primary : colors.neutral.textSecondary}
              />
              <Text style={[
                styles.viewModeText,
                viewMode === 'prepaid' && styles.viewModeTextActive,
              ]}>
                Prepaid ({prepaidFamilies.length})
              </Text>
            </Pressable>
          </View>
        )}

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
        {/* Overdue Alert - Show at very top for tutors */}
        {isTutor && viewMode === 'invoice' && overduePayments.length > 0 && (
          <Pressable style={styles.overdueAlert}>
            <Ionicons name="warning" size={20} color={colors.status.error} />
            <Text style={styles.overdueText}>
              {overduePayments.length} overdue payment{overduePayments.length > 1 ? 's' : ''}
            </Text>
            <Ionicons name="chevron-forward" size={20} color={colors.status.error} />
          </Pressable>
        )}

        {/* Filter Bar - Tutor invoice view only */}
        {isTutor && viewMode === 'invoice' && (
          <View style={styles.filterBarContainer}>
            <PaymentFilterBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              filterStatus={filterStatus}
              onFilterStatusChange={setFilterStatus}
              sortOption={sortOption}
              onSortChange={setSortOption}
              totalCount={displayPayments.length}
              filteredCount={filteredPayments.length}
            />
          </View>
        )}

        {/* Invoice Families Section - MOVED UP for quick access */}
        {isTutor && viewMode === 'invoice' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Invoice Families</Text>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.piano.primary} />
              </View>
            ) : filteredPayments.length === 0 ? (
              <View style={styles.emptyCard}>
                {displayPayments.length > 0 ? (
                  <>
                    <Ionicons name="search-outline" size={48} color={colors.neutral.textMuted} />
                    <Text style={styles.emptyTitle}>No matching families</Text>
                    <Text style={styles.emptySubtitle}>
                      Try adjusting your search or filters
                    </Text>
                    <Pressable
                      style={styles.clearFiltersButton}
                      onPress={resetFilters}
                    >
                      <Text style={styles.clearFiltersText}>Clear filters</Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Ionicons name="receipt-outline" size={48} color={colors.neutral.textMuted} />
                    <Text style={styles.emptyTitle}>No invoices this month</Text>
                    <Text style={styles.emptySubtitle}>
                      Generate invoices from completed lessons below
                    </Text>
                  </>
                )}
              </View>
            ) : (
              <View style={styles.paymentsList}>
                {filteredPayments.map((payment) => (
                  <Pressable
                    key={payment.id}
                    style={styles.paymentCard}
                    onPress={() => {
                      setSelectedPayment(payment);
                      setShowEditModal(true);
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
                        {payment.status !== 'paid' && (
                          <Pressable
                            style={styles.markPaidButton}
                            onPress={(e) => {
                              e.stopPropagation();
                              handleMarkPaid(payment);
                            }}
                          >
                            <Ionicons name="checkmark" size={16} color={colors.status.success} />
                            <Text style={styles.markPaidText}>Mark Paid</Text>
                          </Pressable>
                        )}
                        {payment.status === 'paid' && (
                          <Pressable
                            style={styles.markUnpaidButton}
                            onPress={(e) => {
                              e.stopPropagation();
                              handleMarkUnpaid(payment);
                            }}
                          >
                            <Ionicons name="close" size={16} color={colors.status.warning} />
                            <Text style={styles.markUnpaidText}>Mark Unpaid</Text>
                          </Pressable>
                        )}
                        {payment.status !== 'paid' && (
                          <Pressable
                            style={styles.sendReminderButton}
                            onPress={(e) => {
                              e.stopPropagation();
                              handleOpenReminderModal(payment);
                            }}
                          >
                            <Ionicons name="mail-outline" size={16} color={colors.piano.primary} />
                          </Pressable>
                        )}
                        <Pressable
                          style={styles.switchModeButton}
                          onPress={(e) => {
                            e.stopPropagation();
                            const parentData = parents.find(p => p.id === payment.parent_id);
                            if (parentData) {
                              handleToggleBillingMode(parentData);
                            }
                          }}
                        >
                          <Ionicons name="swap-horizontal" size={16} color={colors.piano.primary} />
                        </Pressable>
                        <Pressable
                          style={styles.deleteButton}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleDeletePayment(payment);
                          }}
                        >
                          <Ionicons name="trash-outline" size={16} color={colors.status.error} />
                        </Pressable>
                      </View>
                    </View>

                    {/* Lesson dates for this invoice */}
                    {(() => {
                      const { dates, count } = getLessonDatesForPayment(payment.parent_id);
                      if (count > 0) {
                        return (
                          <View style={styles.lessonDatesContainer}>
                            <Ionicons name="calendar-outline" size={14} color={colors.neutral.textSecondary} />
                            <Text style={styles.lessonDatesText}>
                              {count === 1
                                ? `Lesson on ${dates[0]}`
                                : dates.length <= 3
                                  ? `Lessons: ${dates.join(', ')}`
                                  : `${count} lessons: ${dates.slice(0, 2).join(', ')} +${count - 2} more`}
                            </Text>
                          </View>
                        );
                      }
                      return null;
                    })()}

                    {/* Reminder indicator */}
                    {(() => {
                      const reminders = remindersByPayment.get(payment.id) || [];
                      if (reminders.length > 0) {
                        const lastReminder = reminders[0];
                        return (
                          <View style={styles.reminderIndicator}>
                            <Ionicons name="mail-outline" size={14} color={colors.neutral.textMuted} />
                            <Text style={styles.reminderIndicatorText}>
                              Updated: {formatRelativeTime(lastReminder.sent_at)}
                              {reminders.length > 1 && ` (${reminders.length} reminders)`}
                            </Text>
                          </View>
                        );
                      }
                      return null;
                    })()}

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
        )}

        {/* Monthly Lesson Summary (Collapsible) - Tutor invoice view only */}
        {isTutor && viewMode === 'invoice' && (
          <View style={styles.collapsibleSection}>
            <Pressable
              style={styles.collapsibleHeader}
              onPress={() => setSummaryExpanded(!summaryExpanded)}
            >
              <View style={styles.collapsibleHeaderLeft}>
                <Ionicons
                  name={summaryExpanded ? 'chevron-down' : 'chevron-forward'}
                  size={20}
                  color={colors.neutral.textSecondary}
                />
                <Text style={styles.collapsibleTitle}>Monthly Summary</Text>
              </View>
              {monthlyLessonSummary && (
                <Text style={styles.collapsibleSubtitle}>
                  ${monthlyLessonSummary.totals.expected_amount.toFixed(2)} expected
                </Text>
              )}
            </Pressable>
            {summaryExpanded && (
              <MonthlyPaymentSummary
                summary={monthlyLessonSummary}
                loading={lessonSummaryLoading}
                onGenerateInvoice={handleQuickInvoice}
                onStatusClick={handleStatusClick}
                onSwitchToPrepaid={(parentId) => {
                  const parentData = parents.find(p => p.id === parentId);
                  if (parentData) {
                    handleToggleBillingMode(parentData);
                  } else {
                    console.error('Parent not found:', parentId, 'Available parents:', parents.map(p => ({ id: p.id, name: p.name })));
                    if (Platform.OS === 'web') {
                      window.alert('Parent not found. Please refresh the page and try again.');
                    } else {
                      Alert.alert('Error', 'Parent not found. Please refresh and try again.');
                    }
                  }
                }}
                compact={false}
              />
            )}
          </View>
        )}

        {/* Parent Prepaid Status - Show if parent is on prepaid billing */}
        {!isTutor && parent?.billing_mode === 'prepaid' && (
          <View style={styles.parentPrepaidSection}>
            {prepaidPayments.find(p => p.parent_id === parent?.id) ? (
              (() => {
                const prepaidPayment = prepaidPayments.find(p => p.parent_id === parent?.id)!;
                return (
                  <PrepaidStatusCard
                    parentName={parent.name}
                    studentNames={[]}
                    month={selectedMonth.toISOString().split('T')[0]}
                    monthDisplay={monthDisplay}
                    sessionsTotal={prepaidPayment.sessions_prepaid || 0}
                    sessionsUsed={prepaidPayment.sessions_used || 0}
                    sessionsRemaining={Math.max(0, (prepaidPayment.sessions_prepaid || 0) - (prepaidPayment.sessions_used || 0))}
                    sessionsRolledOver={prepaidPayment.sessions_rolled_over || 0}
                    amountDue={prepaidPayment.amount_due}
                    isPaid={prepaidPayment.status === 'paid'}
                    paidAt={prepaidPayment.paid_at ? new Date(prepaidPayment.paid_at).toLocaleDateString() : undefined}
                    notes={prepaidPayment.notes || undefined}
                  />
                );
              })()
            ) : (
              <View style={styles.parentNoPrepaidCard}>
                <Ionicons name="calendar-outline" size={32} color={colors.neutral.textMuted} />
                <Text style={styles.parentNoPrepaidTitle}>No Prepaid Plan</Text>
                <Text style={styles.parentNoPrepaidText}>
                  Your tutor hasn't set up a prepaid plan for {monthDisplay} yet.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Prepaid Summary (when in prepaid mode) */}
        {isTutor && viewMode === 'prepaid' && (
          <View style={styles.prepaidSummaryContainer}>
            <View style={styles.summaryCard}>
              <View style={styles.summaryCardHeader}>
                <Ionicons name="wallet-outline" size={24} color={colors.status.success} />
                <Pressable
                  style={styles.infoButton}
                  onPress={() => {
                    const message = 'Total payments received from families who have paid for their prepaid session packages this month.';
                    if (Platform.OS === 'web') {
                      window.alert(`Prepaid Collected\n\n${message}`);
                    } else {
                      Alert.alert('Prepaid Collected', message);
                    }
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="information-circle-outline" size={16} color={colors.status.success} />
                </Pressable>
              </View>
              <Text style={styles.summaryAmount}>
                ${prepaidPayments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount_paid, 0).toFixed(2)}
              </Text>
              <Text style={styles.summaryLabel}>Prepaid Collected</Text>
              <Text style={styles.summaryCount}>
                {prepaidPayments.filter(p => p.status === 'paid').length} families
              </Text>
            </View>
            <View style={styles.summaryCard}>
              <View style={styles.summaryCardHeader}>
                <Ionicons name="time-outline" size={24} color={colors.status.warning} />
                <Pressable
                  style={styles.infoButton}
                  onPress={() => {
                    const message = 'Prepaid session packages that have been created but payment hasn\'t been received yet. Follow up with these families to collect payment.';
                    if (Platform.OS === 'web') {
                      window.alert(`Prepaid Pending\n\n${message}`);
                    } else {
                      Alert.alert('Prepaid Pending', message);
                    }
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="information-circle-outline" size={16} color={colors.status.warning} />
                </Pressable>
              </View>
              <Text style={[styles.summaryAmount, { color: colors.status.warning }]}>
                ${prepaidPayments.filter(p => p.status === 'unpaid').reduce((sum, p) => sum + p.amount_due, 0).toFixed(2)}
              </Text>
              <Text style={styles.summaryLabel}>Prepaid Pending</Text>
              <Text style={styles.summaryCount}>
                {prepaidPayments.filter(p => p.status === 'unpaid').length} families
              </Text>
            </View>
          </View>
        )}

        {/* Overdue Alert - Prepaid mode only (invoice mode has it at top) */}
        {isTutor && viewMode === 'prepaid' && overduePayments.length > 0 && (
          <Pressable style={styles.overdueAlert}>
            <Ionicons name="warning" size={20} color={colors.status.error} />
            <Text style={styles.overdueText}>
              {overduePayments.length} overdue payment{overduePayments.length > 1 ? 's' : ''}
            </Text>
            <Ionicons name="chevron-forward" size={20} color={colors.status.error} />
          </Pressable>
        )}

        {/* Prepaid Families Section (when in prepaid mode) */}
        {isTutor && viewMode === 'prepaid' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Prepaid Families</Text>
              <Pressable
                style={styles.addPrepaidButton}
                onPress={() => {
                  // Show picker to select a family to add prepaid
                  if (parents.length > 0) {
                    // For now, show alert with instruction
                    Alert.alert(
                      'Add Prepaid Plan',
                      'Tap on a family below and select "Create Prepaid Plan" to set up prepaid billing.',
                    );
                  }
                }}
              >
                <Ionicons name="add-circle-outline" size={20} color={colors.piano.primary} />
              </Pressable>
            </View>

            {prepaidLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.piano.primary} />
              </View>
            ) : prepaidFamilies.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="calendar-outline" size={48} color={colors.neutral.textMuted} />
                <Text style={styles.emptyTitle}>No prepaid families</Text>
                <Text style={styles.emptySubtitle}>
                  Switch a family to prepaid mode from Invoice view to get started
                </Text>
              </View>
            ) : (
              <View style={styles.prepaidList}>
                {prepaidFamilies.map((parentData) => {
                  const prepaidPayment = prepaidPayments.find(p => p.parent_id === parentData.id);

                  if (prepaidPayment) {
                    return (
                      <PrepaidStatusCard
                        key={parentData.id}
                        parentName={parentData.name}
                        studentNames={parentData.students?.map(s => s.name) || []}
                        month={selectedMonth.toISOString().split('T')[0]}
                        monthDisplay={monthDisplay}
                        sessionsTotal={prepaidPayment.sessions_prepaid || 0}
                        sessionsUsed={prepaidPayment.sessions_used || 0}
                        sessionsRemaining={Math.max(0, (prepaidPayment.sessions_prepaid || 0) - (prepaidPayment.sessions_used || 0))}
                        sessionsRolledOver={prepaidPayment.sessions_rolled_over || 0}
                        amountDue={prepaidPayment.amount_due}
                        isPaid={prepaidPayment.status === 'paid'}
                        paidAt={prepaidPayment.paid_at ? new Date(prepaidPayment.paid_at).toLocaleDateString() : undefined}
                        notes={prepaidPayment.notes || undefined}
                        onMarkPaid={() => handleMarkPrepaidPaid(prepaidPayment.id, parentData.name)}
                        onPress={() => handleToggleBillingMode(parentData)}
                        onUpdateSessionsUsed={(newCount) => handleUpdateSessionsUsed(prepaidPayment.id, newCount)}
                        onPreviewParentView={() => handlePreviewParentView(parentData, prepaidPayment)}
                      />
                    );
                  }

                  // No prepaid payment for this month yet
                  return (
                    <View key={parentData.id} style={styles.noPrepaidCard}>
                      <View style={styles.noPrepaidHeader}>
                        <Text style={styles.noPrepaidName}>{parentData.name}</Text>
                        <Text style={styles.noPrepaidStudents}>
                          {parentData.students?.map(s => s.name).join(', ')}
                        </Text>
                      </View>
                      <Text style={styles.noPrepaidText}>No prepaid plan for {monthDisplay}</Text>
                      <Pressable
                        style={styles.createPrepaidButton}
                        onPress={() => handleOpenPrepaidModal(parentData)}
                      >
                        <Ionicons name="add" size={18} color={colors.neutral.white} />
                        <Text style={styles.createPrepaidText}>Create Plan</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Payment History - Parent view only (tutors have invoice list above) */}
        {!isTutor && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment History</Text>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.piano.primary} />
              </View>
            ) : displayPayments.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="receipt-outline" size={48} color={colors.neutral.textMuted} />
                <Text style={styles.emptyTitle}>No payments this month</Text>
                <Text style={styles.emptySubtitle}>
                  No payments recorded for this month
                </Text>
              </View>
            ) : (
              <View style={styles.paymentsList}>
                {displayPayments.map((payment) => (
                  <View key={payment.id} style={styles.paymentCard}>
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
                    </View>

                    {/* Lesson dates for this invoice */}
                    {(() => {
                      const { dates, count } = getLessonDatesForPayment(payment.parent_id);
                      if (count > 0) {
                        return (
                          <View style={styles.lessonDatesContainer}>
                            <Ionicons name="calendar-outline" size={14} color={colors.neutral.textSecondary} />
                            <Text style={styles.lessonDatesText}>
                              {count === 1
                                ? `Lesson on ${dates[0]}`
                                : dates.length <= 3
                                  ? `Lessons: ${dates.join(', ')}`
                                  : `${count} lessons: ${dates.slice(0, 2).join(', ')} +${count - 2} more`}
                            </Text>
                          </View>
                        );
                      }
                      return null;
                    })()}

                    {payment.notes && (
                      <Text style={styles.paymentNotes} numberOfLines={1}>
                        {payment.notes}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
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
        onRefresh={refetch}
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

      {/* Create Prepaid Modal */}
      <CreatePrepaidModal
        visible={showPrepaidModal}
        onClose={() => {
          setShowPrepaidModal(false);
          setSelectedPrepaidParent(null);
        }}
        onSubmit={handleCreatePrepaid}
        parent={selectedPrepaidParent}
        month={selectedMonth}
        loading={createPrepaid.loading}
      />

      {/* Parent View Preview Modal */}
      {previewData && (
        <ParentViewPreviewModal
          visible={showPreviewModal}
          onClose={() => {
            setShowPreviewModal(false);
            setPreviewData(null);
          }}
          parentName={previewData.parentName}
          studentNames={previewData.studentNames}
          monthDisplay={previewData.monthDisplay}
          sessionsTotal={previewData.sessionsTotal}
          sessionsUsed={previewData.sessionsUsed}
          sessionsRemaining={previewData.sessionsRemaining}
          sessionsRolledOver={previewData.sessionsRolledOver}
          amountDue={previewData.amountDue}
          isPaid={previewData.isPaid}
          paidAt={previewData.paidAt}
          notes={previewData.notes}
        />
      )}

      {/* Lesson Details Modal */}
      {monthlyLessonSummary && (
        <LessonDetailsModal
          visible={showLessonDetailsModal}
          onClose={() => setShowLessonDetailsModal(false)}
          filterType={lessonFilterType}
          families={monthlyLessonSummary.families}
          monthDisplay={monthDisplay}
          prepaidPayments={paidPrepaidForDisplay}
          onGenerateInvoice={(parentId, lessonIds) => {
            // For now, just call the quick invoice for the family
            // In a future enhancement, this could filter to specific lessons
            handleQuickInvoice(parentId);
            setShowLessonDetailsModal(false);
          }}
        />
      )}

      {/* Send Reminder Modal */}
      <SendReminderModal
        visible={showReminderModal}
        onClose={() => {
          setShowReminderModal(false);
          setReminderPayment(null);
        }}
        payment={reminderPayment}
        onSuccess={handleRefresh}
      />

      {/* Monthly Report Export Modal */}
      <MonthlyReportExport
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        summary={monthlyLessonSummary}
        payments={payments}
        month={selectedMonth}
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
  summaryCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
  },
  infoButton: {
    padding: 2,
    borderRadius: borderRadius.full,
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
  summaryCount: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
    marginTop: 2,
  },
  prepaidSummaryContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
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
  markUnpaidButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.status.warning,
  },
  markUnpaidText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.status.warning,
  },
  deleteButton: {
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.status.error,
  },
  switchModeButton: {
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.piano.primary,
  },
  sendReminderButton: {
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.piano.primary,
  },
  reminderIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  reminderIndicatorText: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
    fontStyle: 'italic',
  },
  paymentNotes: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  lessonDatesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.borderLight,
  },
  lessonDatesText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    flex: 1,
  },

  // View mode toggle styles
  viewModeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.md,
    padding: spacing.xs,
    marginBottom: spacing.md,
  },
  viewModeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  viewModeButtonActive: {
    backgroundColor: colors.neutral.white,
    ...shadows.sm,
  },
  viewModeText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.textSecondary,
  },
  viewModeTextActive: {
    color: colors.piano.primary,
  },

  // Section header with action
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  addPrepaidButton: {
    padding: spacing.xs,
  },

  // Prepaid list styles
  prepaidList: {
    gap: spacing.md,
  },
  noPrepaidCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  noPrepaidHeader: {
    marginBottom: spacing.sm,
  },
  noPrepaidName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  noPrepaidStudents: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginTop: 2,
  },
  noPrepaidText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
    marginBottom: spacing.md,
  },
  createPrepaidButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.piano.primary,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  createPrepaidText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.white,
  },

  // Parent prepaid section styles
  parentPrepaidSection: {
    marginBottom: spacing.lg,
  },
  parentNoPrepaidCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.sm,
  },
  parentNoPrepaidTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  parentNoPrepaidText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
  },

  // Filter bar styles
  filterBarContainer: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },

  // Collapsible section styles
  collapsibleSection: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
    overflow: 'hidden',
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 0,
  },
  collapsibleHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  collapsibleTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  collapsibleSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },

  // Clear filters button
  clearFiltersButton: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  clearFiltersText: {
    fontSize: typography.sizes.sm,
    color: colors.piano.primary,
    fontWeight: typography.weights.medium,
  },
});
