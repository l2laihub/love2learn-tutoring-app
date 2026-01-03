/**
 * PaymentFormModal
 * Modal for creating and editing payment records
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
import { ParentWithStudents, PaymentWithParent } from '../types/database';

interface PaymentFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: PaymentFormData) => Promise<void>;
  parents: ParentWithStudents[];
  parentsLoading?: boolean;
  initialData?: PaymentWithParent | null;
  mode: 'create' | 'edit';
}

export interface PaymentFormData {
  parent_id: string;
  month: string;
  amount_due: number;
  amount_paid: number;
  notes?: string;
}

export function PaymentFormModal({
  visible,
  onClose,
  onSubmit,
  parents,
  parentsLoading = false,
  initialData,
  mode,
}: PaymentFormModalProps) {
  const [selectedParent, setSelectedParent] = useState<string>('');
  const [month, setMonth] = useState<string>('');
  const [amountDue, setAmountDue] = useState<string>('');
  const [amountPaid, setAmountPaid] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form
  useEffect(() => {
    if (visible) {
      if (initialData && mode === 'edit') {
        setSelectedParent(initialData.parent_id);
        setMonth(initialData.month.split('T')[0]);
        setAmountDue(initialData.amount_due.toString());
        setAmountPaid(initialData.amount_paid.toString());
        setNotes(initialData.notes || '');
      } else {
        // Default to current month
        const now = new Date();
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        setMonth(firstOfMonth.toISOString().split('T')[0]);
        setSelectedParent('');
        setAmountDue('');
        setAmountPaid('0');
        setNotes('');
      }
      setError(null);
    }
  }, [visible, initialData, mode]);

  const handleSubmit = async () => {
    if (!selectedParent) {
      setError('Please select a family');
      return;
    }
    if (!month) {
      setError('Please select a month');
      return;
    }
    if (!amountDue || parseFloat(amountDue) <= 0) {
      setError('Please enter a valid amount due');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        parent_id: selectedParent,
        month,
        amount_due: parseFloat(amountDue),
        amount_paid: parseFloat(amountPaid) || 0,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save payment');
    } finally {
      setSubmitting(false);
    }
  };

  // Format amount input
  const handleAmountChange = (value: string, setter: (v: string) => void) => {
    // Allow only numbers and decimal point
    const cleaned = value.replace(/[^0-9.]/g, '');
    // Only allow one decimal point
    const parts = cleaned.split('.');
    if (parts.length > 2) return;
    if (parts[1] && parts[1].length > 2) return;
    setter(cleaned);
  };

  // Get month display name
  const getMonthDisplay = () => {
    if (!month) return '';
    const date = new Date(month + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

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
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.neutral.text} />
          </Pressable>
          <Text style={styles.title}>
            {mode === 'create' ? 'Record Payment' : 'Edit Payment'}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Family Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Family</Text>
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
                    onPress={() => setSelectedParent(parent.id)}
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

          {/* Month */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Month</Text>
            <TextInput
              style={styles.textInput}
              value={month}
              onChangeText={setMonth}
              placeholder="YYYY-MM-DD (first of month)"
              placeholderTextColor={colors.neutral.textMuted}
            />
            {month && (
              <Text style={styles.monthPreview}>{getMonthDisplay()}</Text>
            )}
          </View>

          {/* Amount Due */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Amount Due</Text>
            <View style={styles.amountContainer}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={styles.amountInput}
                value={amountDue}
                onChangeText={(v) => handleAmountChange(v, setAmountDue)}
                placeholder="0.00"
                placeholderTextColor={colors.neutral.textMuted}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          {/* Amount Paid */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Amount Paid</Text>
            <View style={styles.amountContainer}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={styles.amountInput}
                value={amountPaid}
                onChangeText={(v) => handleAmountChange(v, setAmountPaid)}
                placeholder="0.00"
                placeholderTextColor={colors.neutral.textMuted}
                keyboardType="decimal-pad"
              />
            </View>
            {/* Quick fill buttons */}
            <View style={styles.quickFillRow}>
              <Pressable
                style={styles.quickFillButton}
                onPress={() => setAmountPaid('0')}
              >
                <Text style={styles.quickFillText}>Unpaid</Text>
              </Pressable>
              <Pressable
                style={styles.quickFillButton}
                onPress={() => {
                  if (amountDue) {
                    setAmountPaid((parseFloat(amountDue) / 2).toFixed(2));
                  }
                }}
              >
                <Text style={styles.quickFillText}>Half</Text>
              </Pressable>
              <Pressable
                style={[styles.quickFillButton, styles.quickFillButtonFull]}
                onPress={() => setAmountPaid(amountDue)}
              >
                <Text style={[styles.quickFillText, styles.quickFillTextFull]}>
                  Full
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Notes */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Notes (optional)</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Payment method, check number, etc."
              placeholderTextColor={colors.neutral.textMuted}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />
          </View>

          {/* Preview */}
          {amountDue && (
            <View style={styles.previewCard}>
              <Text style={styles.previewTitle}>Payment Status</Text>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Due:</Text>
                <Text style={styles.previewValue}>${parseFloat(amountDue || '0').toFixed(2)}</Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Paid:</Text>
                <Text style={[styles.previewValue, { color: colors.status.success }]}>
                  ${parseFloat(amountPaid || '0').toFixed(2)}
                </Text>
              </View>
              <View style={styles.previewDivider} />
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Outstanding:</Text>
                <Text style={[
                  styles.previewValue,
                  { color: (parseFloat(amountDue) - parseFloat(amountPaid || '0')) > 0
                    ? colors.status.error
                    : colors.status.success
                  },
                ]}>
                  ${Math.max(0, parseFloat(amountDue) - parseFloat(amountPaid || '0')).toFixed(2)}
                </Text>
              </View>
            </View>
          )}

          {/* Error */}
          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={18} color={colors.status.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>

        {/* Submit */}
        <View style={styles.footer}>
          <Pressable
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={colors.neutral.white} />
            ) : (
              <>
                <Ionicons
                  name={mode === 'create' ? 'add-circle' : 'checkmark-circle'}
                  size={20}
                  color={colors.neutral.white}
                />
                <Text style={styles.submitButtonText}>
                  {mode === 'create' ? 'Record Payment' : 'Save Changes'}
                </Text>
              </>
            )}
          </Pressable>
        </View>
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
  monthPreview: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginTop: spacing.xs,
    marginLeft: spacing.xs,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    paddingHorizontal: spacing.md,
  },
  currencySymbol: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.textSecondary,
    marginRight: spacing.sm,
  },
  amountInput: {
    flex: 1,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    paddingVertical: spacing.md,
  },
  quickFillRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  quickFillButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    alignItems: 'center',
  },
  quickFillButtonFull: {
    backgroundColor: colors.status.success,
    borderColor: colors.status.success,
  },
  quickFillText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.textSecondary,
  },
  quickFillTextFull: {
    color: colors.neutral.white,
  },
  previewCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  previewTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.textSecondary,
    marginBottom: spacing.md,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  previewLabel: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
  },
  previewValue: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  previewDivider: {
    height: 1,
    backgroundColor: colors.neutral.border,
    marginVertical: spacing.sm,
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
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
  },
});

export default PaymentFormModal;
