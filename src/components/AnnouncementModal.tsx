/**
 * AnnouncementModal Component
 * Allows tutors to send broadcast announcements to all parents
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSendAnnouncement } from '../hooks/useNotifications';
import { NotificationPriority } from '../types/notifications';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';

interface AnnouncementModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const PRIORITY_OPTIONS: { value: NotificationPriority; label: string; icon: string; color: string }[] = [
  { value: 'low', label: 'Low', icon: 'arrow-down-circle-outline', color: colors.neutral.textSecondary },
  { value: 'normal', label: 'Normal', icon: 'remove-circle-outline', color: colors.primary.main },
  { value: 'high', label: 'High', icon: 'arrow-up-circle-outline', color: colors.status.warning },
  { value: 'urgent', label: 'Urgent', icon: 'alert-circle', color: colors.status.error },
];

export function AnnouncementModal({ visible, onClose, onSuccess }: AnnouncementModalProps) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<NotificationPriority>('normal');
  const { sendAnnouncement, loading, error } = useSendAnnouncement();

  // Reset form when modal opens
  useEffect(() => {
    if (visible) {
      setTitle('');
      setMessage('');
      setPriority('normal');
    }
  }, [visible]);

  const handleSend = async () => {
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please enter a title for the announcement.');
      return;
    }

    if (!message.trim()) {
      Alert.alert('Missing Message', 'Please enter a message for the announcement.');
      return;
    }

    const notificationId = await sendAnnouncement({
      title: title.trim(),
      message: message.trim(),
      priority,
    });

    if (notificationId) {
      Alert.alert(
        'Announcement Sent',
        'Your announcement has been sent to all parents.',
        [{ text: 'OK', onPress: onSuccess || onClose }]
      );
    }
  };

  const selectedPriorityInfo = PRIORITY_OPTIONS.find(p => p.value === priority)!;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.neutral.text} />
          </Pressable>
          <Text style={styles.headerTitle}>New Announcement</Text>
          <View style={styles.closeButton} />
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          {/* Info Banner */}
          <View style={styles.infoBanner}>
            <Ionicons name="megaphone" size={20} color={colors.primary.main} />
            <Text style={styles.infoBannerText}>
              This announcement will be sent to all parents and visible in their notifications.
            </Text>
          </View>

          {/* Title Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Title</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Announcement title"
              placeholderTextColor={colors.neutral.textMuted}
              maxLength={100}
            />
            <Text style={styles.charCount}>{title.length}/100</Text>
          </View>

          {/* Message Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Message</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={message}
              onChangeText={setMessage}
              placeholder="Write your announcement message..."
              placeholderTextColor={colors.neutral.textMuted}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              maxLength={1000}
            />
            <Text style={styles.charCount}>{message.length}/1000</Text>
          </View>

          {/* Priority Selection */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Priority</Text>
            <View style={styles.priorityGrid}>
              {PRIORITY_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  style={[
                    styles.priorityOption,
                    priority === option.value && styles.priorityOptionActive,
                    priority === option.value && { borderColor: option.color },
                  ]}
                  onPress={() => setPriority(option.value)}
                >
                  <Ionicons
                    name={option.icon as any}
                    size={20}
                    color={priority === option.value ? option.color : colors.neutral.textMuted}
                  />
                  <Text
                    style={[
                      styles.priorityOptionText,
                      priority === option.value && { color: option.color },
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Error Display */}
          {error && (
            <View style={styles.errorCard}>
              <Ionicons name="alert-circle" size={20} color={colors.status.error} />
              <Text style={styles.errorText}>{error.message}</Text>
            </View>
          )}
        </ScrollView>

        {/* Footer with Send Button */}
        <View style={styles.footer}>
          <Pressable
            style={styles.cancelButton}
            onPress={onClose}
            disabled={loading}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[styles.sendButton, (!title.trim() || !message.trim()) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={loading || !title.trim() || !message.trim()}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.neutral.white} />
            ) : (
              <>
                <Ionicons name="send" size={18} color={colors.neutral.white} />
                <Text style={styles.sendButtonText}>Send Announcement</Text>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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
    padding: spacing.md,
    backgroundColor: colors.neutral.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  content: {
    flex: 1,
    padding: spacing.base,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary.subtle,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  infoBannerText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.primary.dark,
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
    marginBottom: spacing.sm,
  },
  input: {
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
    minHeight: 120,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  priorityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  priorityOption: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.neutral.border,
  },
  priorityOptionActive: {
    backgroundColor: colors.neutral.background,
  },
  priorityOptionText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.textSecondary,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.status.errorBg,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
  },
  errorText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.status.error,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.base,
    backgroundColor: colors.neutral.white,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral.background,
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  cancelButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.neutral.textSecondary,
  },
  sendButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary.main,
  },
  sendButtonDisabled: {
    backgroundColor: colors.neutral.border,
  },
  sendButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
  },
});
