/**
 * SendReminderModal
 * Modal for sending payment reminders to parents
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
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import {
  PaymentWithParent,
  PaymentReminder,
  PaymentReminderType,
  getReminderTypeInfo,
} from '../types/database';
import {
  usePaymentReminders,
  useSendPaymentReminder,
  useCanSendReminder,
  formatRelativeTime,
} from '../hooks/usePaymentReminders';

interface SendReminderModalProps {
  visible: boolean;
  onClose: () => void;
  payment: PaymentWithParent | null;
  onSuccess?: () => void;
}

const REMINDER_TYPES: PaymentReminderType[] = [
  'friendly',
  'due_date',
  'past_due_3',
  'past_due_7',
  'past_due_14',
  'manual',
];

export function SendReminderModal({
  visible,
  onClose,
  payment,
  onSuccess,
}: SendReminderModalProps) {
  const [selectedType, setSelectedType] = useState<PaymentReminderType>('manual');
  const [customMessage, setCustomMessage] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  // Hooks
  const { data: reminders, loading: loadingReminders, refetch: refetchReminders } = usePaymentReminders(payment?.id);
  const { sendReminder, loading: sending } = useSendPaymentReminder();
  const { canSend, reason: cannotSendReason, loading: checkingCanSend } = useCanSendReminder(payment?.id, selectedType);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setSelectedType('manual');
      setCustomMessage('');
      setShowHistory(false);
    }
  }, [visible]);

  const handleSend = async () => {
    if (!payment) return;

    const result = await sendReminder({
      payment_id: payment.id,
      reminder_type: selectedType,
      custom_message: selectedType === 'manual' && customMessage.trim() ? customMessage.trim() : undefined,
    });

    if (result.success) {
      // Show success message
      if (Platform.OS === 'web') {
        window.alert('Reminder sent successfully!');
      }
      await refetchReminders();
      onSuccess?.();
      onClose();
    } else {
      // Show error message
      const message = result.duplicate
        ? 'This type of reminder was already sent today.'
        : result.message || 'Failed to send reminder.';
      if (Platform.OS === 'web') {
        window.alert(message);
      }
    }
  };

  if (!payment) return null;

  const parentName = payment.parent?.name || 'Unknown';
  const balanceDue = payment.amount_due - payment.amount_paid;
  const monthDisplay = new Date(payment.month).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Send Payment Reminder</Text>
              <Text style={styles.subtitle}>{parentName} - {monthDisplay}</Text>
            </View>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.neutral.text} />
            </Pressable>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Balance Summary */}
            <View style={styles.balanceCard}>
              <View style={styles.balanceRow}>
                <Text style={styles.balanceLabel}>Balance Due:</Text>
                <Text style={styles.balanceAmount}>${balanceDue.toFixed(2)}</Text>
              </View>
              {payment.amount_paid > 0 && (
                <Text style={styles.partialNote}>
                  (${payment.amount_paid.toFixed(2)} of ${payment.amount_due.toFixed(2)} paid)
                </Text>
              )}
            </View>

            {/* Reminder Type Selection */}
            <Text style={styles.sectionTitle}>Select Reminder Type</Text>
            <View style={styles.typeGrid}>
              {REMINDER_TYPES.map((type) => {
                const info = getReminderTypeInfo(type);
                const isSelected = selectedType === type;
                return (
                  <Pressable
                    key={type}
                    style={[
                      styles.typeButton,
                      isSelected && { backgroundColor: info.bgColor, borderColor: info.color },
                    ]}
                    onPress={() => setSelectedType(type)}
                  >
                    <Ionicons
                      name={info.icon as keyof typeof Ionicons.glyphMap}
                      size={20}
                      color={isSelected ? info.color : colors.neutral.textSecondary}
                    />
                    <Text
                      style={[
                        styles.typeLabel,
                        isSelected && { color: info.color, fontWeight: typography.weights.semibold },
                      ]}
                    >
                      {info.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Custom Message (for manual type) */}
            {selectedType === 'manual' && (
              <View style={styles.messageSection}>
                <Text style={styles.sectionTitle}>Custom Message (Optional)</Text>
                <TextInput
                  style={styles.messageInput}
                  value={customMessage}
                  onChangeText={setCustomMessage}
                  placeholder="Add a personal message to the reminder..."
                  placeholderTextColor={colors.neutral.textMuted}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            )}

            {/* Cannot Send Warning */}
            {!checkingCanSend && !canSend && cannotSendReason && (
              <View style={styles.warningBanner}>
                <Ionicons name="warning-outline" size={18} color={colors.status.warning} />
                <Text style={styles.warningText}>{cannotSendReason}</Text>
              </View>
            )}

            {/* Reminder History Toggle */}
            <Pressable
              style={styles.historyToggle}
              onPress={() => setShowHistory(!showHistory)}
            >
              <View style={styles.historyToggleLeft}>
                <Ionicons
                  name={showHistory ? 'chevron-down' : 'chevron-forward'}
                  size={18}
                  color={colors.neutral.textSecondary}
                />
                <Text style={styles.historyToggleText}>Reminder History</Text>
              </View>
              {reminders.length > 0 && (
                <View style={styles.historyBadge}>
                  <Text style={styles.historyBadgeText}>{reminders.length}</Text>
                </View>
              )}
            </Pressable>

            {/* Reminder History List */}
            {showHistory && (
              <View style={styles.historyList}>
                {loadingReminders ? (
                  <ActivityIndicator size="small" color={colors.piano.primary} />
                ) : reminders.length === 0 ? (
                  <Text style={styles.historyEmpty}>No reminders sent yet</Text>
                ) : (
                  reminders.map((reminder) => (
                    <ReminderHistoryItem key={reminder.id} reminder={reminder} />
                  ))
                )}
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Pressable style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[
                styles.sendButton,
                (sending || checkingCanSend || !canSend) && styles.sendButtonDisabled,
              ]}
              onPress={handleSend}
              disabled={sending || checkingCanSend || !canSend}
            >
              {sending ? (
                <ActivityIndicator size="small" color={colors.neutral.white} />
              ) : (
                <>
                  <Ionicons name="mail-outline" size={18} color={colors.neutral.white} />
                  <Text style={styles.sendButtonText}>Send Reminder</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// History item component
function ReminderHistoryItem({ reminder }: { reminder: PaymentReminder }) {
  const info = getReminderTypeInfo(reminder.reminder_type);
  const sentDate = new Date(reminder.sent_at);

  return (
    <View style={styles.historyItem}>
      <View style={[styles.historyIcon, { backgroundColor: info.bgColor }]}>
        <Ionicons
          name={info.icon as keyof typeof Ionicons.glyphMap}
          size={14}
          color={info.color}
        />
      </View>
      <View style={styles.historyContent}>
        <Text style={styles.historyType}>{info.label}</Text>
        <Text style={styles.historyTime}>{formatRelativeTime(reminder.sent_at)}</Text>
        {reminder.message && (
          <Text style={styles.historyMessage} numberOfLines={2}>
            {reminder.message}
          </Text>
        )}
      </View>
      <View style={styles.historyStatus}>
        {reminder.email_sent ? (
          <Ionicons name="checkmark-circle" size={16} color={colors.status.success} />
        ) : (
          <Ionicons name="alert-circle" size={16} color={colors.status.warning} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
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
    padding: spacing.base,
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
  content: {
    padding: spacing.base,
    maxHeight: 400,
  },
  balanceCard: {
    backgroundColor: colors.status.errorBg,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: typography.sizes.base,
    color: colors.neutral.text,
  },
  balanceAmount: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.status.error,
  },
  partialNote: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.textSecondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    backgroundColor: colors.neutral.background,
  },
  typeLabel: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },
  messageSection: {
    marginBottom: spacing.lg,
  },
  messageInput: {
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    padding: spacing.md,
    fontSize: typography.sizes.base,
    color: colors.neutral.text,
    minHeight: 80,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.status.warningBg,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  warningText: {
    fontSize: typography.sizes.sm,
    color: colors.status.warning,
    flex: 1,
  },
  historyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.borderLight,
  },
  historyToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  historyToggleText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.textSecondary,
  },
  historyBadge: {
    backgroundColor: colors.piano.subtle,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  historyBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.piano.primary,
  },
  historyList: {
    paddingTop: spacing.sm,
  },
  historyEmpty: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.borderLight,
  },
  historyIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyContent: {
    flex: 1,
  },
  historyType: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
  },
  historyTime: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
    marginTop: 2,
  },
  historyMessage: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textSecondary,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  historyStatus: {
    paddingTop: 2,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.base,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.neutral.textSecondary,
  },
  sendButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.piano.primary,
  },
  sendButtonDisabled: {
    backgroundColor: colors.neutral.textMuted,
  },
  sendButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
  },
});
