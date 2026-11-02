/**
 * ReportMessageModal
 * Report a message and optionally block its sender (App Store Guideline 1.2).
 */

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../../theme';
import { REPORT_REASONS, ReportReason, reportMessage } from '../../hooks/useModeration';

interface ReportMessageModalProps {
  visible: boolean;
  messageId: string | null;
  senderName: string;
  onClose: () => void;
  /** Called after a successful report. `blocked` is true if the sender was blocked. */
  onReported: (blocked: boolean) => void;
}

export function ReportMessageModal({
  visible,
  messageId,
  senderName,
  onClose,
  onReported,
}: ReportMessageModalProps) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [block, setBlock] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ blocked: boolean } | null>(null);

  useEffect(() => {
    if (visible) {
      setReason(null);
      setDetails('');
      setBlock(true);
      setError(null);
      setDone(null);
    }
  }, [visible, messageId]);

  const close = () => {
    if (sending) return;
    if (done) onReported(done.blocked);
    onClose();
  };

  const submit = async () => {
    if (!messageId || !reason) return;
    setSending(true);
    setError(null);
    const result = await reportMessage({ messageId, reason, details, block });
    setSending(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setDone({ blocked: result.blocked });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          {done ? (
            <>
              <View style={[styles.iconWrap, styles.iconDone]}>
                <Ionicons name="checkmark" size={28} color={colors.status.success} />
              </View>
              <Text style={styles.title}>Thanks for reporting</Text>
              <Text style={styles.body}>
                We review every report within 24 hours and remove content or accounts that break
                our Terms.
                {done.blocked ? ` You won't see messages from ${senderName} anymore.` : ''}
              </Text>
              <Pressable style={[styles.button, styles.primary]} onPress={close}>
                <Text style={styles.primaryText}>Done</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.iconWrap}>
                <Ionicons name="flag" size={26} color={colors.status.error} />
              </View>
              <Text style={styles.title}>Report message</Text>
              <Text style={styles.body}>Why are you reporting this message from {senderName}?</Text>

              {REPORT_REASONS.map((r) => {
                const selected = reason === r.value;
                return (
                  <Pressable
                    key={r.value}
                    style={[styles.option, selected && styles.optionSelected]}
                    onPress={() => setReason(r.value)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                  >
                    <Ionicons
                      name={selected ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={selected ? colors.primary.main : colors.neutral.textMuted}
                    />
                    <Text style={styles.optionText}>{r.label}</Text>
                  </Pressable>
                );
              })}

              <TextInput
                style={styles.input}
                value={details}
                onChangeText={setDetails}
                placeholder="Add details (optional)"
                placeholderTextColor={colors.neutral.textMuted}
                multiline
                maxLength={1000}
                editable={!sending}
              />

              <Pressable
                style={styles.blockRow}
                onPress={() => setBlock((b) => !b)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: block }}
              >
                <Ionicons
                  name={block ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={block ? colors.primary.main : colors.neutral.textMuted}
                />
                <Text style={styles.blockText}>Also block {senderName}</Text>
              </Pressable>

              {error && <Text style={styles.error}>{error}</Text>}

              <View style={styles.actions}>
                <Pressable style={[styles.button, styles.cancel]} onPress={close} disabled={sending}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.button, styles.danger, (!reason || sending) && styles.disabled]}
                  onPress={submit}
                  disabled={!reason || sending}
                >
                  {sending ? (
                    <ActivityIndicator color={colors.neutral.white} />
                  ) : (
                    <Text style={styles.primaryText}>Report</Text>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.neutral.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    ...shadows.lg,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.status.errorBg,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  iconDone: {
    backgroundColor: colors.status.successBg,
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  body: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    marginBottom: spacing.sm,
  },
  optionSelected: {
    borderColor: colors.primary.main,
    backgroundColor: colors.primary.subtle,
  },
  optionText: {
    fontSize: typography.sizes.base,
    color: colors.neutral.text,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.sizes.sm,
    color: colors.neutral.text,
    minHeight: 64,
    textAlignVertical: 'top',
    marginTop: spacing.xs,
  },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  blockText: {
    fontSize: typography.sizes.base,
    color: colors.neutral.text,
  },
  error: {
    marginTop: spacing.md,
    fontSize: typography.sizes.sm,
    color: colors.status.error,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  button: {
    flex: 1,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  cancel: {
    backgroundColor: colors.neutral.background,
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  cancelText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  danger: {
    backgroundColor: colors.status.error,
  },
  primary: {
    backgroundColor: colors.primary.main,
  },
  primaryText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
  },
  disabled: {
    opacity: 0.4,
  },
});

export default ReportMessageModal;
