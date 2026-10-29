/**
 * DeleteAccountSection
 * DaLesson Tutoring App
 *
 * "Delete Account" button plus a confirmation modal. Required by
 * App Store Guideline 5.1.1(v) for apps that let users create accounts.
 * The user must type DELETE before the request is sent.
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '../contexts/AuthContext';
import { deleteAccount } from '../lib/account';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';

const CONFIRM_WORD = 'DELETE';

export function DeleteAccountSection() {
  const { isTutor } = useAuthContext();
  const [visible, setVisible] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (deleting) return;
    setVisible(false);
    setConfirmText('');
    setError(null);
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    const result = await deleteAccount();
    setDeleting(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    setVisible(false);
    const message = 'Your DaLesson account has been deleted.';
    if (Platform.OS === 'web') {
      window.alert(message);
    } else {
      Alert.alert('Account deleted', message);
    }
    router.replace('/landing');
  };

  const canDelete = confirmText.trim().toUpperCase() === CONFIRM_WORD && !deleting;

  return (
    <>
      <Pressable
        style={styles.deleteButton}
        onPress={() => setVisible(true)}
        accessibilityRole="button"
        accessibilityLabel="Delete account"
      >
        <Ionicons name="trash-outline" size={20} color={colors.status.error} />
        <Text style={styles.deleteText}>Delete Account</Text>
      </Pressable>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.card}>
            <View style={styles.iconWrap}>
              <Ionicons name="warning" size={28} color={colors.status.error} />
            </View>
            <Text style={styles.title}>Delete your account?</Text>

            {isTutor ? (
              <Text style={styles.body}>
                This permanently deletes your DaLesson account and your business data: students,
                lessons, notes, payment records, worksheets and messages. Any active subscription is
                cancelled. Families you invited keep their own logins but will no longer see your
                studio. This cannot be undone.
              </Text>
            ) : (
              <Text style={styles.body}>
                This permanently deletes your DaLesson login and your personal account settings.
                Your tutor keeps their lesson and payment records for your family. To have those
                removed too, ask your tutor or email privacy@dalesson.app. This cannot be undone.
              </Text>
            )}

            <Text style={styles.label}>
              Type <Text style={styles.bold}>{CONFIRM_WORD}</Text> to confirm
            </Text>
            <TextInput
              style={styles.input}
              value={confirmText}
              onChangeText={setConfirmText}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder={CONFIRM_WORD}
              placeholderTextColor={colors.neutral.textMuted}
              editable={!deleting}
              accessibilityLabel={`Type ${CONFIRM_WORD} to confirm`}
            />

            {error && <Text style={styles.error}>{error}</Text>}

            <View style={styles.actions}>
              <Pressable style={[styles.button, styles.cancel]} onPress={close} disabled={deleting}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.button, styles.confirm, !canDelete && styles.disabled]}
                onPress={handleDelete}
                disabled={!canDelete}
              >
                {deleting ? (
                  <ActivityIndicator color={colors.neutral.white} />
                ) : (
                  <Text style={styles.confirmText}>Delete</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  deleteText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.status.error,
  },
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
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  body: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.text,
    marginBottom: spacing.sm,
  },
  bold: {
    fontWeight: typography.weights.bold,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.sizes.base,
    color: colors.neutral.text,
    letterSpacing: 1,
  },
  error: {
    marginTop: spacing.md,
    fontSize: typography.sizes.sm,
    color: colors.status.error,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
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
  confirm: {
    backgroundColor: colors.status.error,
  },
  disabled: {
    opacity: 0.4,
  },
  confirmText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
  },
});

export default DeleteAccountSection;
