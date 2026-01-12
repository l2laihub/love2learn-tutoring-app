/**
 * LessonDetailsModal
 * Shows filtered lesson details by status (Ready to Bill, Invoiced, Collected)
 * Allows tutors to see detailed breakdown and perform batch actions
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import { LessonDetail, FamilyLessonSummary } from '../hooks/usePayments';
import { TutoringSubject, PaymentWithParent } from '../types/database';

// Subject display names
const SUBJECT_NAMES: Record<TutoringSubject, string> = {
  math: 'Math',
  piano: 'Piano',
  reading: 'Reading',
  speech: 'Speech',
  english: 'English',
};

export type LessonFilterType = 'ready_to_bill' | 'invoiced' | 'collected' | 'all';

// Interface for prepaid payment display
export interface PrepaidPaymentDisplay {
  id: string;
  parentId: string;
  parentName: string;
  studentNames: string[];
  sessionsTotal: number;
  sessionsUsed: number;
  amountPaid: number;
  paidAt?: string;
}

interface LessonDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  filterType: LessonFilterType;
  families: FamilyLessonSummary[];
  monthDisplay: string;
  onGenerateInvoice?: (parentId: string, lessonIds: string[]) => void;
  // Prepaid payments for the Collected view
  prepaidPayments?: PrepaidPaymentDisplay[];
}

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function formatLessonDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function getFilterTitle(filterType: LessonFilterType): string {
  switch (filterType) {
    case 'ready_to_bill':
      return 'Ready to Bill';
    case 'invoiced':
      return 'Invoiced';
    case 'collected':
      return 'Collected';
    case 'all':
      return 'All Lessons';
  }
}

function getFilterIcon(filterType: LessonFilterType): string {
  switch (filterType) {
    case 'ready_to_bill':
      return 'checkmark-circle-outline';
    case 'invoiced':
      return 'document-text-outline';
    case 'collected':
      return 'cash-outline';
    case 'all':
      return 'list-outline';
  }
}

function getFilterColor(filterType: LessonFilterType): string {
  switch (filterType) {
    case 'ready_to_bill':
      return colors.status.warning;
    case 'invoiced':
      return colors.piano.primary;
    case 'collected':
      return colors.math.primary;
    case 'all':
      return colors.neutral.text;
  }
}

export function LessonDetailsModal({
  visible,
  onClose,
  filterType,
  families,
  monthDisplay,
  onGenerateInvoice,
  prepaidPayments = [],
}: LessonDetailsModalProps) {
  const [selectedLessons, setSelectedLessons] = useState<Set<string>>(new Set());
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set());

  // Filter lessons based on filterType
  const filteredData = useMemo(() => {
    const result: { family: FamilyLessonSummary; lessons: LessonDetail[] }[] = [];

    families.forEach((family) => {
      const filteredLessons = family.lessons.filter((lesson) => {
        if (lesson.status === 'cancelled') return false;

        switch (filterType) {
          case 'ready_to_bill':
            return lesson.status === 'completed' && lesson.payment_status === 'none';
          case 'invoiced':
            return lesson.payment_status === 'invoiced';
          case 'collected':
            return lesson.payment_status === 'paid';
          case 'all':
            return true;
        }
      });

      if (filteredLessons.length > 0) {
        result.push({ family, lessons: filteredLessons });
      }
    });

    return result;
  }, [families, filterType]);

  // Filter prepaid payments (only show in 'collected' view)
  const filteredPrepaid = useMemo(() => {
    if (filterType !== 'collected') return [];
    return prepaidPayments;
  }, [prepaidPayments, filterType]);

  // Calculate totals (including prepaid)
  const totals = useMemo(() => {
    let lessonCount = 0;
    let totalAmount = 0;
    let prepaidCount = 0;
    let prepaidAmount = 0;

    filteredData.forEach(({ lessons }) => {
      lessonCount += lessons.length;
      lessons.forEach((lesson) => {
        totalAmount += lesson.calculated_amount;
      });
    });

    // Add prepaid amounts for collected view
    filteredPrepaid.forEach((prepaid) => {
      prepaidCount += 1;
      prepaidAmount += prepaid.amountPaid;
    });

    return {
      lessonCount,
      totalAmount,
      prepaidCount,
      prepaidAmount,
      grandTotal: totalAmount + prepaidAmount,
      totalFamilies: filteredData.length + filteredPrepaid.length,
    };
  }, [filteredData, filteredPrepaid]);

  const toggleFamily = (parentId: string) => {
    setExpandedFamilies((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(parentId)) {
        newSet.delete(parentId);
      } else {
        newSet.add(parentId);
      }
      return newSet;
    });
  };

  const toggleLesson = (lessonId: string) => {
    setSelectedLessons((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(lessonId)) {
        newSet.delete(lessonId);
      } else {
        newSet.add(lessonId);
      }
      return newSet;
    });
  };

  const toggleAllLessonsForFamily = (lessons: LessonDetail[]) => {
    const lessonIds = lessons.map((l) => l.id);
    const allSelected = lessonIds.every((id) => selectedLessons.has(id));

    setSelectedLessons((prev) => {
      const newSet = new Set(prev);
      if (allSelected) {
        lessonIds.forEach((id) => newSet.delete(id));
      } else {
        lessonIds.forEach((id) => newSet.add(id));
      }
      return newSet;
    });
  };

  const handleGenerateInvoice = (parentId: string, lessons: LessonDetail[]) => {
    const selectedLessonIds = lessons
      .filter((l) => selectedLessons.has(l.id))
      .map((l) => l.id);

    if (selectedLessonIds.length === 0) {
      if (Platform.OS === 'web') {
        window.alert('Please select at least one lesson to invoice.');
      } else {
        Alert.alert('No Selection', 'Please select at least one lesson to invoice.');
      }
      return;
    }

    if (onGenerateInvoice) {
      onGenerateInvoice(parentId, selectedLessonIds);
    }
  };

  const filterColor = getFilterColor(filterType);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.headerIcon, { backgroundColor: filterColor + '20' }]}>
                <Ionicons
                  name={getFilterIcon(filterType) as any}
                  size={24}
                  color={filterColor}
                />
              </View>
              <View style={styles.headerText}>
                <Text style={styles.title}>{getFilterTitle(filterType)}</Text>
                <Text style={styles.subtitle}>{monthDisplay}</Text>
              </View>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.neutral.text} />
            </Pressable>
          </View>

          {/* Summary Bar */}
          <View style={[styles.summaryBar, { borderLeftColor: filterColor }]}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>
                {filterType === 'collected' && totals.prepaidCount > 0
                  ? `${totals.lessonCount}+${totals.prepaidCount}`
                  : totals.lessonCount}
              </Text>
              <Text style={styles.summaryLabel}>
                {filterType === 'collected' && totals.prepaidCount > 0
                  ? 'items'
                  : `lesson${totals.lessonCount !== 1 ? 's' : ''}`}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: filterColor }]}>
                {formatCurrency(totals.grandTotal)}
              </Text>
              <Text style={styles.summaryLabel}>total</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{totals.totalFamilies}</Text>
              <Text style={styles.summaryLabel}>
                famil{totals.totalFamilies !== 1 ? 'ies' : 'y'}
              </Text>
            </View>
          </View>

          {/* Content */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {filteredData.length === 0 && filteredPrepaid.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons
                  name={getFilterIcon(filterType) as any}
                  size={48}
                  color={colors.neutral.textMuted}
                />
                <Text style={styles.emptyTitle}>No items found</Text>
                <Text style={styles.emptyText}>
                  There are no {getFilterTitle(filterType).toLowerCase()} items for{' '}
                  {monthDisplay}.
                </Text>
              </View>
            ) : (
              <>
                {/* Prepaid Payments Section (for Collected view) */}
                {filteredPrepaid.length > 0 && (
                  <View style={styles.prepaidSection}>
                    <View style={styles.prepaidSectionHeader}>
                      <Ionicons name="calendar" size={16} color={colors.piano.primary} />
                      <Text style={styles.prepaidSectionTitle}>Prepaid Payments</Text>
                    </View>
                    {filteredPrepaid.map((prepaid) => (
                      <View key={prepaid.id} style={styles.prepaidCard}>
                        <View style={styles.prepaidHeader}>
                          <View style={styles.prepaidInfo}>
                            <Text style={styles.prepaidName}>{prepaid.parentName}</Text>
                            <Text style={styles.prepaidStudents}>
                              {prepaid.studentNames.join(', ')}
                            </Text>
                          </View>
                          <View style={styles.prepaidAmountSection}>
                            <Text style={styles.prepaidAmount}>
                              {formatCurrency(prepaid.amountPaid)}
                            </Text>
                            <View style={styles.prepaidBadge}>
                              <Text style={styles.prepaidBadgeText}>Prepaid</Text>
                            </View>
                          </View>
                        </View>
                        <View style={styles.prepaidDetails}>
                          <View style={styles.prepaidDetailItem}>
                            <Ionicons name="calendar-outline" size={14} color={colors.neutral.textSecondary} />
                            <Text style={styles.prepaidDetailText}>
                              {prepaid.sessionsUsed}/{prepaid.sessionsTotal} sessions used
                            </Text>
                          </View>
                          {prepaid.paidAt && (
                            <View style={styles.prepaidDetailItem}>
                              <Ionicons name="checkmark-circle" size={14} color={colors.math.primary} />
                              <Text style={styles.prepaidDetailText}>
                                Paid {prepaid.paidAt}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* Invoice-based Lessons Section */}
                {filteredData.length > 0 && (
                  <View style={filteredPrepaid.length > 0 ? styles.invoiceSection : undefined}>
                    {filteredPrepaid.length > 0 && (
                      <View style={styles.invoiceSectionHeader}>
                        <Ionicons name="receipt-outline" size={16} color={colors.piano.primary} />
                        <Text style={styles.invoiceSectionTitle}>Invoice Payments</Text>
                      </View>
                    )}
                    {filteredData.map(({ family, lessons }) => {
                      const isExpanded = expandedFamilies.has(family.parent_id);
                      const familyTotal = lessons.reduce(
                        (sum, l) => sum + l.calculated_amount,
                        0
                      );
                      const selectedCount = lessons.filter((l) =>
                        selectedLessons.has(l.id)
                      ).length;

                      return (
                        <View key={family.parent_id} style={styles.familyCard}>
                          {/* Family Header */}
                          <Pressable
                            style={styles.familyHeader}
                            onPress={() => toggleFamily(family.parent_id)}
                          >
                            <View style={styles.familyInfo}>
                              <Text style={styles.familyName}>{family.parent_name}</Text>
                              <Text style={styles.familyMeta}>
                                {lessons.length} lesson{lessons.length !== 1 ? 's' : ''} •{' '}
                                {formatCurrency(familyTotal)}
                              </Text>
                            </View>
                            <View style={styles.familyActions}>
                              {filterType === 'ready_to_bill' &&
                                selectedCount > 0 &&
                                onGenerateInvoice && (
                                  <Pressable
                                    style={styles.invoiceChip}
                                    onPress={() => handleGenerateInvoice(family.parent_id, lessons)}
                                  >
                                    <Ionicons
                                      name="receipt-outline"
                                      size={14}
                                      color={colors.piano.primary}
                                    />
                                    <Text style={styles.invoiceChipText}>
                                      Invoice ({selectedCount})
                                    </Text>
                                  </Pressable>
                                )}
                              <Ionicons
                                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                                size={20}
                                color={colors.neutral.textSecondary}
                              />
                            </View>
                          </Pressable>

                          {/* Expanded Lesson List */}
                          {isExpanded && (
                            <View style={styles.lessonList}>
                              {/* Select All Toggle (for ready_to_bill) */}
                              {filterType === 'ready_to_bill' && onGenerateInvoice && (
                                <Pressable
                                  style={styles.selectAllRow}
                                  onPress={() => toggleAllLessonsForFamily(lessons)}
                                >
                                  <Ionicons
                                    name={
                                      lessons.every((l) => selectedLessons.has(l.id))
                                        ? 'checkbox'
                                        : 'square-outline'
                                    }
                                    size={20}
                                    color={colors.piano.primary}
                                  />
                                  <Text style={styles.selectAllText}>Select All</Text>
                                </Pressable>
                              )}

                              {lessons.map((lesson) => (
                                <LessonRow
                                  key={lesson.id}
                                  lesson={lesson}
                                  filterType={filterType}
                                  isSelected={selectedLessons.has(lesson.id)}
                                  onToggle={
                                    filterType === 'ready_to_bill' && onGenerateInvoice
                                      ? () => toggleLesson(lesson.id)
                                      : undefined
                                  }
                                />
                              ))}

                              {/* Family Total */}
                              <View style={styles.familyTotalRow}>
                                <Text style={styles.familyTotalLabel}>Total</Text>
                                <Text style={styles.familyTotalAmount}>
                                  {formatCurrency(familyTotal)}
                                </Text>
                              </View>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Pressable onPress={onClose} style={styles.doneButton}>
              <Text style={styles.doneButtonText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Individual lesson row component
 */
interface LessonRowProps {
  lesson: LessonDetail;
  filterType: LessonFilterType;
  isSelected: boolean;
  onToggle?: () => void;
}

function LessonRow({ lesson, filterType, isSelected, onToggle }: LessonRowProps) {
  return (
    <Pressable
      style={[styles.lessonRow, isSelected && styles.lessonRowSelected]}
      onPress={onToggle}
      disabled={!onToggle}
    >
      {/* Checkbox (for ready_to_bill) */}
      {onToggle && (
        <Ionicons
          name={isSelected ? 'checkbox' : 'square-outline'}
          size={20}
          color={isSelected ? colors.piano.primary : colors.neutral.textMuted}
          style={styles.lessonCheckbox}
        />
      )}

      {/* Lesson Info */}
      <View style={styles.lessonInfo}>
        <View style={styles.lessonTopRow}>
          <Text style={styles.lessonDate}>{formatLessonDate(lesson.scheduled_at)}</Text>
          {lesson.is_combined_session && (
            <View style={styles.combinedBadge}>
              <Ionicons name="people" size={10} color={colors.piano.primary} />
            </View>
          )}
        </View>
        <Text style={styles.lessonStudent}>{lesson.student_name}</Text>
        <Text style={styles.lessonMeta}>
          {SUBJECT_NAMES[lesson.subject]} • {lesson.duration_min}min
        </Text>
      </View>

      {/* Amount & Status */}
      <View style={styles.lessonRight}>
        <Text style={styles.lessonAmount}>{formatCurrency(lesson.calculated_amount)}</Text>
        <Text style={styles.lessonRate}>{lesson.rate_display}</Text>
        {filterType === 'all' && (
          <View
            style={[
              styles.statusChip,
              {
                backgroundColor:
                  lesson.payment_status === 'paid'
                    ? colors.math.subtle
                    : lesson.payment_status === 'invoiced'
                    ? colors.piano.subtle
                    : colors.status.warningBg,
              },
            ]}
          >
            <Text
              style={[
                styles.statusChipText,
                {
                  color:
                    lesson.payment_status === 'paid'
                      ? colors.math.primary
                      : lesson.payment_status === 'invoiced'
                      ? colors.piano.primary
                      : colors.status.warning,
                },
              ]}
            >
              {lesson.payment_status === 'none'
                ? 'Ready'
                : lesson.payment_status.charAt(0).toUpperCase() +
                  lesson.payment_status.slice(1)}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.neutral.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '90%',
    ...shadows.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.neutral.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    gap: 2,
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },
  closeButton: {
    padding: spacing.xs,
  },

  // Summary Bar
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: colors.neutral.white,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: borderRadius.md,
    borderLeftWidth: 4,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
  },
  summaryLabel: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textSecondary,
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.neutral.border,
  },

  // Content
  content: {
    padding: spacing.lg,
    maxHeight: 500,
  },
  emptyState: {
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
  },

  // Family Card
  familyCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
    overflow: 'hidden',
  },
  familyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  familyInfo: {
    flex: 1,
  },
  familyName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  familyMeta: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginTop: 2,
  },
  familyActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  invoiceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.piano.subtle,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  invoiceChipText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.piano.primary,
  },

  // Lesson List
  lessonList: {
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
    padding: spacing.md,
    backgroundColor: colors.neutral.background,
  },
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
    marginBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  selectAllText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.piano.primary,
  },
  lessonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  lessonRowSelected: {
    backgroundColor: colors.piano.subtle,
    borderColor: colors.piano.primary,
    borderWidth: 1,
  },
  lessonCheckbox: {
    marginRight: spacing.sm,
  },
  lessonInfo: {
    flex: 1,
  },
  lessonTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  lessonDate: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
  },
  combinedBadge: {
    backgroundColor: colors.piano.subtle,
    padding: 2,
    borderRadius: borderRadius.full,
  },
  lessonStudent: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginTop: 2,
  },
  lessonMeta: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textSecondary,
  },
  lessonRight: {
    alignItems: 'flex-end',
  },
  lessonAmount: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
  },
  lessonRate: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textSecondary,
  },
  statusChip: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginTop: 2,
  },
  statusChipText: {
    fontSize: 10,
    fontWeight: typography.weights.medium,
  },

  // Family Total
  familyTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
  },
  familyTotalLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  familyTotalAmount: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
  },

  // Footer
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
    backgroundColor: colors.neutral.white,
  },
  doneButton: {
    backgroundColor: colors.piano.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
  },

  // Prepaid Section
  prepaidSection: {
    marginBottom: spacing.md,
  },
  prepaidSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  prepaidSectionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.piano.primary,
  },
  prepaidCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.piano.primary,
    ...shadows.sm,
  },
  prepaidHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  prepaidInfo: {
    flex: 1,
  },
  prepaidName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  prepaidStudents: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginTop: 2,
  },
  prepaidAmountSection: {
    alignItems: 'flex-end',
  },
  prepaidAmount: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.math.primary,
  },
  prepaidBadge: {
    backgroundColor: colors.piano.subtle,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginTop: spacing.xs,
  },
  prepaidBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.piano.primary,
  },
  prepaidDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
  },
  prepaidDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  prepaidDetailText: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textSecondary,
  },

  // Invoice Section (when showing both prepaid and invoice)
  invoiceSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
  },
  invoiceSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  invoiceSectionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.piano.primary,
  },
});

export default LessonDetailsModal;
