/**
 * GenerateInvoiceModal
 * Modal for auto-generating invoices based on completed lessons
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import { ParentWithStudents, TutoringSubject } from '../types/database';
import {
  useInvoicePreview,
  useGenerateInvoice,
  LessonForInvoice,
} from '../hooks/usePayments';

interface GenerateInvoiceModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  parents: ParentWithStudents[];
  parentsLoading?: boolean;
  initialMonth?: Date;
}

// Subject colors for display
const subjectColors: Record<TutoringSubject, string> = {
  piano: colors.piano.primary,
  math: colors.math.primary,
  reading: '#9C27B0',
  speech: '#FF9800',
  english: '#2196F3',
};

// Format duration as hours and minutes
function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}min`;
  if (mins === 0) return `${hours}hr`;
  return `${hours}hr ${mins}min`;
}

// Format date for display
function formatLessonDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function GenerateInvoiceModal({
  visible,
  onClose,
  onSuccess,
  parents,
  parentsLoading = false,
  initialMonth,
}: GenerateInvoiceModalProps) {
  const [selectedParent, setSelectedParent] = useState<string>('');
  const [month, setMonth] = useState<Date>(initialMonth || new Date());
  const [notes, setNotes] = useState<string>('');
  const [selectedLessons, setSelectedLessons] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<'select-family' | 'review'>('select-family');

  const { preview, loading: previewLoading, error: previewError, refetch } = useInvoicePreview(
    selectedParent || null,
    month
  );
  const { mutate: generateInvoice, loading: generating, error: generateError, reset: resetGenerate } = useGenerateInvoice();

  // Reset form when modal opens
  useEffect(() => {
    if (visible) {
      setSelectedParent('');
      setMonth(initialMonth || new Date());
      setNotes('');
      setSelectedLessons(new Set());
      setStep('select-family');
      resetGenerate();
    }
  }, [visible, initialMonth, resetGenerate]);

  // Select all lessons by default when preview loads
  useEffect(() => {
    if (preview?.lessons) {
      setSelectedLessons(new Set(preview.lessons.map(l => l.id)));
    }
  }, [preview?.lessons]);

  const handleParentSelect = (parentId: string) => {
    setSelectedParent(parentId);
  };

  const handleContinue = () => {
    if (selectedParent) {
      setStep('review');
    }
  };

  const handleBack = () => {
    setStep('select-family');
  };

  const toggleLesson = (lessonId: string) => {
    setSelectedLessons(prev => {
      const newSet = new Set(prev);
      if (newSet.has(lessonId)) {
        newSet.delete(lessonId);
      } else {
        newSet.add(lessonId);
      }
      return newSet;
    });
  };

  const toggleAllLessons = () => {
    if (!preview?.lessons) return;
    if (selectedLessons.size === preview.lessons.length) {
      setSelectedLessons(new Set());
    } else {
      setSelectedLessons(new Set(preview.lessons.map(l => l.id)));
    }
  };

  const getSelectedTotal = (): number => {
    if (!preview?.lessons) return 0;
    return preview.lessons
      .filter(l => selectedLessons.has(l.id))
      .reduce((sum, l) => sum + l.calculated_amount, 0);
  };

  const getSelectedLessons = (): LessonForInvoice[] => {
    if (!preview?.lessons) return [];
    return preview.lessons.filter(l => selectedLessons.has(l.id));
  };

  const handleGenerateInvoice = async () => {
    if (!selectedParent || selectedLessons.size === 0) return;

    const lessonsToInvoice = getSelectedLessons();
    const monthStr = month.toISOString().split('T')[0].slice(0, 8) + '01'; // First of month

    const result = await generateInvoice(selectedParent, monthStr, lessonsToInvoice, notes.trim() || undefined);

    if (result) {
      onSuccess();
      onClose();
    }
  };

  // Navigate month
  const changeMonth = (delta: number) => {
    const newMonth = new Date(month);
    newMonth.setMonth(newMonth.getMonth() + delta);
    setMonth(newMonth);
  };

  const getMonthDisplay = (): string => {
    return month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const error = previewError || generateError;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={step === 'review' ? handleBack : onClose} style={styles.closeButton}>
            <Ionicons
              name={step === 'review' ? 'arrow-back' : 'close'}
              size={24}
              color={colors.neutral.text}
            />
          </Pressable>
          <Text style={styles.title}>
            {step === 'select-family' ? 'Generate Invoice' : 'Review Invoice'}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        {step === 'select-family' ? (
          // Step 1: Select Family and Month
          <>
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {/* Month Selection */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Billing Month</Text>
                <View style={styles.monthSelector}>
                  <Pressable onPress={() => changeMonth(-1)} style={styles.monthArrow}>
                    <Ionicons name="chevron-back" size={24} color={colors.neutral.text} />
                  </Pressable>
                  <Text style={styles.monthText}>{getMonthDisplay()}</Text>
                  <Pressable onPress={() => changeMonth(1)} style={styles.monthArrow}>
                    <Ionicons name="chevron-forward" size={24} color={colors.neutral.text} />
                  </Pressable>
                </View>
              </View>

              {/* Family Selection */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Select Family</Text>
                {parentsLoading ? (
                  <ActivityIndicator size="small" color={colors.piano.primary} />
                ) : parents.length === 0 ? (
                  <Text style={styles.emptyText}>No families found</Text>
                ) : (
                  <View style={styles.parentsList}>
                    {parents.map((parent) => (
                      <Pressable
                        key={parent.id}
                        style={[
                          styles.parentButton,
                          selectedParent === parent.id && styles.parentButtonSelected,
                        ]}
                        onPress={() => handleParentSelect(parent.id)}
                      >
                        <View style={styles.parentInfo}>
                          <Text
                            style={[
                              styles.parentName,
                              selectedParent === parent.id && styles.parentNameSelected,
                            ]}
                            numberOfLines={1}
                          >
                            {parent.name}
                          </Text>
                          <Text style={styles.parentStudents}>
                            {parent.students?.length || 0} student{(parent.students?.length || 0) !== 1 ? 's' : ''}
                          </Text>
                        </View>
                        {selectedParent === parent.id && (
                          <Ionicons name="checkmark-circle" size={24} color={colors.piano.primary} />
                        )}
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>

              {/* Info Card */}
              <View style={styles.infoCard}>
                <Ionicons name="information-circle" size={20} color={colors.piano.primary} />
                <Text style={styles.infoText}>
                  The invoice will be automatically calculated based on completed lessons.
                  Single lessons use hourly rates, combined sessions use flat rates.
                </Text>
              </View>
            </ScrollView>

            {/* Continue Button */}
            <View style={styles.footer}>
              <Pressable
                style={[
                  styles.submitButton,
                  !selectedParent && styles.submitButtonDisabled,
                ]}
                onPress={handleContinue}
                disabled={!selectedParent}
              >
                <Text style={styles.submitButtonText}>Continue</Text>
                <Ionicons name="arrow-forward" size={20} color={colors.neutral.white} />
              </Pressable>
            </View>
          </>
        ) : (
          // Step 2: Review and Confirm
          <>
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {/* Month Header */}
              <View style={styles.reviewHeader}>
                <Text style={styles.reviewMonth}>{getMonthDisplay()}</Text>
                <Text style={styles.reviewFamily}>{preview?.parent_name}</Text>
              </View>

              {previewLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.piano.primary} />
                  <Text style={styles.loadingText}>Loading lessons...</Text>
                </View>
              ) : !preview?.lessons.length ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="calendar-outline" size={48} color={colors.neutral.textMuted} />
                  <Text style={styles.emptyTitle}>No Lessons to Invoice</Text>
                  <Text style={styles.emptySubtitle}>
                    There are no completed lessons for this family in {getMonthDisplay()}.
                  </Text>
                </View>
              ) : (
                <>
                  {/* Lessons List */}
                  <View style={styles.section}>
                    <View style={styles.lessonsHeader}>
                      <Text style={styles.sectionLabel}>
                        Lessons ({selectedLessons.size}/{preview.lessons.length})
                      </Text>
                      <Pressable onPress={toggleAllLessons} style={styles.selectAllButton}>
                        <Text style={styles.selectAllText}>
                          {selectedLessons.size === preview.lessons.length ? 'Deselect All' : 'Select All'}
                        </Text>
                      </Pressable>
                    </View>

                    <View style={styles.lessonsList}>
                      {preview.lessons.map((lesson) => (
                        <Pressable
                          key={lesson.id}
                          style={[
                            styles.lessonCard,
                            selectedLessons.has(lesson.id) && styles.lessonCardSelected,
                          ]}
                          onPress={() => toggleLesson(lesson.id)}
                        >
                          <View style={styles.lessonCheckbox}>
                            <Ionicons
                              name={selectedLessons.has(lesson.id) ? 'checkbox' : 'square-outline'}
                              size={24}
                              color={selectedLessons.has(lesson.id) ? colors.piano.primary : colors.neutral.textMuted}
                            />
                          </View>
                          <View style={styles.lessonInfo}>
                            <View style={styles.lessonTop}>
                              <Text style={styles.lessonStudent}>{lesson.student_name}</Text>
                              <View
                                style={[
                                  styles.subjectBadge,
                                  { backgroundColor: subjectColors[lesson.subject] + '20' },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.subjectText,
                                    { color: subjectColors[lesson.subject] },
                                  ]}
                                >
                                  {lesson.subject}
                                </Text>
                              </View>
                              {lesson.is_combined_session && (
                                <View style={styles.combinedBadge}>
                                  <Ionicons name="people" size={10} color={colors.neutral.white} />
                                  <Text style={styles.combinedBadgeText}>Combined</Text>
                                </View>
                              )}
                            </View>
                            <View style={styles.lessonDetails}>
                              <Text style={styles.lessonDate}>
                                {formatLessonDate(lesson.scheduled_at)}
                              </Text>
                              <Text style={styles.lessonDuration}>
                                {formatDuration(lesson.duration_min)}
                              </Text>
                              <Text style={styles.lessonRate}>
                                {lesson.rate_display}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.lessonAmount}>
                            ${lesson.calculated_amount.toFixed(2)}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  {/* Notes */}
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Notes (optional)</Text>
                    <TextInput
                      style={[styles.textInput, styles.textArea]}
                      value={notes}
                      onChangeText={setNotes}
                      placeholder="Add any notes for this invoice..."
                      placeholderTextColor={colors.neutral.textMuted}
                      multiline
                      numberOfLines={2}
                      textAlignVertical="top"
                    />
                  </View>

                  {/* Summary Card */}
                  <View style={styles.summaryCard}>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Total Lessons</Text>
                      <Text style={styles.summaryValue}>{selectedLessons.size}</Text>
                    </View>
                    {(() => {
                      const selected = getSelectedLessons();
                      const singleCount = selected.filter(l => !l.is_combined_session).length;
                      const combinedCount = selected.filter(l => l.is_combined_session).length;
                      return (
                        <>
                          {singleCount > 0 && (
                            <View style={styles.summaryRow}>
                              <Text style={styles.summaryLabel}>  Single Lessons</Text>
                              <Text style={styles.summaryValue}>{singleCount}</Text>
                            </View>
                          )}
                          {combinedCount > 0 && (
                            <View style={styles.summaryRow}>
                              <Text style={styles.summaryLabel}>  Combined Sessions</Text>
                              <Text style={styles.summaryValue}>{combinedCount}</Text>
                            </View>
                          )}
                        </>
                      );
                    })()}
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Total Time</Text>
                      <Text style={styles.summaryValue}>
                        {formatDuration(
                          getSelectedLessons().reduce((sum, l) => sum + l.duration_min, 0)
                        )}
                      </Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryTotalLabel}>Invoice Total</Text>
                      <Text style={styles.summaryTotalValue}>
                        ${getSelectedTotal().toFixed(2)}
                      </Text>
                    </View>
                  </View>
                </>
              )}

              {/* Error */}
              {error && (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={18} color={colors.status.error} />
                  <Text style={styles.errorText}>
                    {error instanceof Error ? error.message : 'An error occurred'}
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Generate Button */}
            <View style={styles.footer}>
              <Pressable
                style={[
                  styles.submitButton,
                  styles.generateButton,
                  (generating || selectedLessons.size === 0) && styles.submitButtonDisabled,
                ]}
                onPress={handleGenerateInvoice}
                disabled={generating || selectedLessons.size === 0}
              >
                {generating ? (
                  <ActivityIndicator size="small" color={colors.neutral.white} />
                ) : (
                  <>
                    <Ionicons name="receipt" size={20} color={colors.neutral.white} />
                    <Text style={styles.submitButtonText}>
                      Generate Invoice (${getSelectedTotal().toFixed(2)})
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </>
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
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: spacing.base,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  monthArrow: {
    padding: spacing.sm,
  },
  monthText: {
    flex: 1,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    textAlign: 'center',
  },
  parentsList: {
    gap: spacing.sm,
  },
  parentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  parentButtonSelected: {
    borderColor: colors.piano.primary,
    backgroundColor: colors.piano.subtle,
  },
  parentInfo: {
    flex: 1,
  },
  parentName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
  },
  parentNameSelected: {
    color: colors.piano.primary,
  },
  parentStudents: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginTop: 2,
  },
  emptyText: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textMuted,
    textAlign: 'center',
    padding: spacing.lg,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.piano.subtle,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  infoText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.piano.primary,
    lineHeight: 20,
  },
  footer: {
    padding: spacing.base,
    backgroundColor: colors.neutral.white,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.piano.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.md,
  },
  generateButton: {
    backgroundColor: colors.status.success,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
  },
  // Review step styles
  reviewHeader: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  reviewMonth: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
  },
  reviewFamily: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    marginTop: spacing.xs,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  loadingText: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    marginTop: spacing.md,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  lessonsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  selectAllButton: {
    padding: spacing.xs,
  },
  selectAllText: {
    fontSize: typography.sizes.sm,
    color: colors.piano.primary,
    fontWeight: typography.weights.medium,
  },
  lessonsList: {
    gap: spacing.sm,
  },
  lessonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  lessonCardSelected: {
    borderColor: colors.piano.primary,
    backgroundColor: colors.piano.subtle,
  },
  lessonCheckbox: {
    marginRight: spacing.sm,
  },
  lessonInfo: {
    flex: 1,
  },
  lessonTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  lessonStudent: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
  },
  subjectBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  subjectText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    textTransform: 'capitalize',
  },
  combinedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.status.info,
  },
  combinedBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
  },
  lessonDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  lessonDate: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },
  lessonDuration: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
  },
  lessonRate: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
  },
  lessonAmount: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  textInput: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.sizes.base,
    color: colors.neutral.text,
  },
  textArea: {
    minHeight: 60,
    paddingTop: spacing.md,
  },
  summaryCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  summaryLabel: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
  },
  summaryValue: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: colors.neutral.border,
    marginVertical: spacing.sm,
  },
  summaryTotalLabel: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  summaryTotalValue: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.status.success,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.status.errorBg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  errorText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.status.error,
  },
});

export default GenerateInvoiceModal;
