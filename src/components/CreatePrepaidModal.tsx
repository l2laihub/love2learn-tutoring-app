/**
 * CreatePrepaidModal
 * Modal for creating prepaid payment plans
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import { ParentWithStudents } from '../types/database';

interface CreatePrepaidModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: {
    parent_id: string;
    sessions_count: number;
    amount: number;
    notes?: string;
  }) => Promise<void>;
  parent: ParentWithStudents | null;
  month: Date;
  rolloverSessions?: number;
  loading?: boolean;
}

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function CreatePrepaidModal({
  visible,
  onClose,
  onSubmit,
  parent,
  month,
  rolloverSessions = 0,
  loading = false,
}: CreatePrepaidModalProps) {
  const [sessionsCount, setSessionsCount] = useState('8');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (visible) {
      setSessionsCount('8');
      setAmount('');
      setNotes('');
      setError(null);
    }
  }, [visible]);

  const monthDisplay = month.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const totalSessions = parseInt(sessionsCount || '0', 10) + rolloverSessions;

  const handleSubmit = async () => {
    setError(null);

    const sessions = parseInt(sessionsCount, 10);
    const amountValue = parseFloat(amount);

    if (!sessions || sessions <= 0) {
      setError('Please enter a valid number of sessions');
      return;
    }

    if (!amountValue || amountValue <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (!parent) {
      setError('No parent selected');
      return;
    }

    try {
      await onSubmit({
        parent_id: parent.id,
        sessions_count: sessions,
        amount: amountValue,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create prepaid plan');
    }
  };

  const suggestAmount = (sessionsNum: number) => {
    // Default suggestion: $45 per session
    return sessionsNum * 45;
  };

  const handleSessionsChange = (value: string) => {
    setSessionsCount(value);
    const num = parseInt(value, 10);
    if (num > 0 && !amount) {
      setAmount(suggestAmount(num).toString());
    }
  };

  if (!parent) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <View style={styles.modalContainer}>
            {/* Header */}
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>Create Prepaid Plan</Text>
                <Text style={styles.subtitle}>{parent.name} - {monthDisplay}</Text>
              </View>
              <Pressable onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={colors.neutral.text} />
              </Pressable>
            </View>

            <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
            {/* Family info */}
            <View style={styles.familyInfo}>
              <Ionicons name="people" size={20} color={colors.piano.primary} />
              <View style={styles.familyInfoText}>
                <Text style={styles.familyName}>{parent.name}</Text>
                <Text style={styles.familyStudents}>
                  {parent.students?.map(s => s.name).join(', ') || 'No students'}
                </Text>
              </View>
            </View>

            {/* Rollover info */}
            {rolloverSessions > 0 && (
              <View style={styles.rolloverInfo}>
                <Ionicons name="refresh" size={16} color={colors.status.info} />
                <Text style={styles.rolloverText}>
                  {rolloverSessions} session{rolloverSessions !== 1 ? 's' : ''} rolling over from last month
                </Text>
              </View>
            )}

            {/* Sessions input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>New Sessions for {monthDisplay}</Text>
              <View style={styles.sessionsInputRow}>
                <Pressable
                  onPress={() => {
                    const current = parseInt(sessionsCount, 10) || 0;
                    if (current > 1) handleSessionsChange((current - 1).toString());
                  }}
                  style={styles.sessionButton}
                >
                  <Ionicons name="remove" size={20} color={colors.neutral.text} />
                </Pressable>
                <TextInput
                  style={styles.sessionsInput}
                  value={sessionsCount}
                  onChangeText={handleSessionsChange}
                  keyboardType="number-pad"
                  textAlign="center"
                />
                <Pressable
                  onPress={() => {
                    const current = parseInt(sessionsCount, 10) || 0;
                    handleSessionsChange((current + 1).toString());
                  }}
                  style={styles.sessionButton}
                >
                  <Ionicons name="add" size={20} color={colors.neutral.text} />
                </Pressable>
              </View>
              {rolloverSessions > 0 && (
                <Text style={styles.totalSessions}>
                  Total available: {totalSessions} sessions ({sessionsCount} new + {rolloverSessions} rollover)
                </Text>
              )}
            </View>

            {/* Amount input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Prepaid Amount</Text>
              <View style={styles.amountInputContainer}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={styles.amountInput}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={colors.neutral.textMuted}
                />
              </View>
              <Pressable
                onPress={() => {
                  const sessions = parseInt(sessionsCount, 10);
                  if (sessions > 0) {
                    setAmount(suggestAmount(sessions).toString());
                  }
                }}
                style={styles.suggestButton}
              >
                <Text style={styles.suggestButtonText}>
                  Suggest: {formatCurrency(suggestAmount(parseInt(sessionsCount, 10) || 0))}
                </Text>
              </Pressable>
            </View>

            {/* Notes input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Notes (optional)</Text>
              <TextInput
                style={styles.notesInput}
                value={notes}
                onChangeText={setNotes}
                placeholder="Add any notes about this prepayment..."
                placeholderTextColor={colors.neutral.textMuted}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Summary */}
            <View style={styles.summary}>
              <Text style={styles.summaryTitle}>Summary</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Sessions</Text>
                <Text style={styles.summaryValue}>{totalSessions}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Amount</Text>
                <Text style={styles.summaryValue}>
                  {amount ? formatCurrency(parseFloat(amount) || 0) : '--'}
                </Text>
              </View>
              {parseInt(sessionsCount, 10) > 0 && parseFloat(amount) > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Per Session</Text>
                  <Text style={styles.summaryValue}>
                    {formatCurrency(parseFloat(amount) / parseInt(sessionsCount, 10))}
                  </Text>
                </View>
              )}
            </View>

            {error && (
              <View style={styles.errorContainer}>
                <Ionicons name="warning" size={16} color={colors.status.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable onPress={onClose} style={styles.cancelButton}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleSubmit}
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.neutral.white} />
              ) : (
                <>
                  <Ionicons name="checkmark" size={18} color={colors.neutral.white} />
                  <Text style={styles.submitButtonText}>Create Plan</Text>
                </>
              )}
            </Pressable>
          </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.neutral.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '90%',
    ...shadows.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginTop: 2,
  },
  closeButton: {
    padding: spacing.xs,
  },
  form: {
    padding: spacing.lg,
  },
  familyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.piano.subtle,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  familyInfoText: {
    marginLeft: spacing.md,
    flex: 1,
  },
  familyName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  familyStudents: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginTop: 2,
  },
  rolloverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.status.infoSubtle,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  rolloverText: {
    fontSize: typography.sizes.sm,
    color: colors.status.info,
    flex: 1,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
    marginBottom: spacing.sm,
  },
  sessionsInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  sessionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.neutral.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  sessionsInput: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
    width: 80,
    textAlign: 'center',
  },
  totalSessions: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    paddingHorizontal: spacing.md,
  },
  currencySymbol: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  amountInput: {
    flex: 1,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    paddingVertical: spacing.md,
    paddingLeft: spacing.xs,
  },
  suggestButton: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  suggestButtonText: {
    fontSize: typography.sizes.sm,
    color: colors.piano.primary,
    textDecorationLine: 'underline',
  },
  notesInput: {
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    padding: spacing.md,
    fontSize: typography.sizes.md,
    color: colors.neutral.text,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  summary: {
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  summaryTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginBottom: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  summaryLabel: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },
  summaryValue: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.status.errorSubtle,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  errorText: {
    fontSize: typography.sizes.sm,
    color: colors.status.error,
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  cancelButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.neutral.textSecondary,
  },
  submitButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    backgroundColor: colors.piano.primary,
    borderRadius: borderRadius.md,
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

export default CreatePrepaidModal;
