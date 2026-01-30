/**
 * NewMessageModal Component
 * Modal for tutors to create new announcements/messages
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
  Text,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../theme';
import { useParentGroups, useCreateThread, useParents } from '../../hooks';
import { useFileUpload } from '../../hooks/useFileUpload';
import { MessageRecipientType } from '../../types/messages';
import { ParentGroupSelector, Selection } from './ParentGroupSelector';
import { MessageImagePicker } from './MessageImagePicker';
import { EmojiPicker } from './EmojiPicker';

interface NewMessageModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (threadId: string) => void;
}

export function NewMessageModal({
  visible,
  onClose,
  onSuccess,
}: NewMessageModalProps) {
  const { groups } = useParentGroups();
  const { data: parents } = useParents();
  const { mutate: createThread, loading: creating } = useCreateThread();
  const { uploadFile } = useFileUpload();

  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [images, setImages] = useState<string[]>([]); // Local URIs
  const [recipientSelection, setRecipientSelection] = useState<Selection>({ type: 'all' });
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploading, setUploading] = useState(false);

  const canSend =
    subject.trim().length > 0 &&
    content.trim().length > 0 &&
    (recipientSelection.type === 'all' ||
      (recipientSelection.type === 'group' && recipientSelection.groupId) ||
      (recipientSelection.type === 'parent' && recipientSelection.parentIds && recipientSelection.parentIds.length > 0));

  const handleClose = useCallback(() => {
    setSubject('');
    setContent('');
    setImages([]);
    setRecipientSelection({ type: 'all' });
    onClose();
  }, [onClose]);

  const handleSend = useCallback(async () => {
    if (!canSend) return;

    try {
      setUploading(true);

      // Upload images first
      const uploadedPaths: string[] = [];
      const uploadFolder = `messages/${Date.now()}`; // Temporary folder for new thread
      for (const imageUri of images) {
        const fileName = `message_${Date.now()}.jpg`;
        const result = await uploadFile(
          'session-media',
          uploadFolder,
          imageUri,
          fileName,
          'image/jpeg'
        );

        if (result?.path) {
          uploadedPaths.push(result.path);
        }
      }

      setUploading(false);

      // Create thread with appropriate recipient type
      const threadId = await createThread({
        subject: subject.trim(),
        content: content.trim(),
        recipient_type: recipientSelection.type,
        group_id: recipientSelection.type === 'group' ? recipientSelection.groupId : undefined,
        parent_ids: recipientSelection.type === 'parent' ? recipientSelection.parentIds : undefined,
        images: uploadedPaths,
      });

      if (threadId) {
        if (Platform.OS === 'web') {
          window.alert('Message sent successfully!');
        } else {
          Alert.alert('Success', 'Message sent successfully!');
        }
        handleClose();
        onSuccess?.(threadId);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      if (Platform.OS === 'web') {
        window.alert('Failed to send message. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to send message. Please try again.');
      }
      setUploading(false);
    }
  }, [canSend, subject, content, images, recipientSelection, createThread, uploadFile, handleClose, onSuccess]);

  const handleEmojiSelect = useCallback((emoji: string) => {
    setContent((prev) => prev + emoji);
  }, []);

  const isLoading = creating || uploading;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleClose} disabled={isLoading}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Text style={styles.title}>New Message</Text>
          <Pressable
            onPress={handleSend}
            disabled={!canSend || isLoading}
            style={({ pressed }) => [
              styles.sendButton,
              (!canSend || isLoading) && styles.sendButtonDisabled,
              pressed && canSend && !isLoading && styles.sendButtonPressed,
            ]}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.neutral.textInverse} />
            ) : (
              <Text
                style={[
                  styles.sendText,
                  (!canSend || isLoading) && styles.sendTextDisabled,
                ]}
              >
                Send
              </Text>
            )}
          </Pressable>
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          {/* Recipient Selector */}
          <View style={styles.section}>
            <Text style={styles.label}>To</Text>
            <ParentGroupSelector
              groups={groups}
              parents={parents}
              selected={recipientSelection}
              onSelect={setRecipientSelection}
              disabled={isLoading}
            />
          </View>

          {/* Subject */}
          <View style={styles.section}>
            <Text style={styles.label}>Subject</Text>
            <TextInput
              style={styles.input}
              value={subject}
              onChangeText={setSubject}
              placeholder="Enter subject..."
              placeholderTextColor={colors.neutral.textMuted}
              maxLength={100}
              editable={!isLoading}
            />
          </View>

          {/* Message Content */}
          <View style={styles.section}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Message</Text>
              <Pressable
                onPress={() => setShowEmojiPicker(true)}
                disabled={isLoading}
                style={styles.emojiButton}
              >
                <Ionicons
                  name="happy-outline"
                  size={20}
                  color={colors.primary.main}
                />
              </Pressable>
            </View>
            <TextInput
              style={[styles.input, styles.messageInput]}
              value={content}
              onChangeText={setContent}
              placeholder="Type your message..."
              placeholderTextColor={colors.neutral.textMuted}
              multiline
              maxLength={2000}
              editable={!isLoading}
            />
          </View>

          {/* Images */}
          <View style={styles.section}>
            <Text style={styles.label}>Images (Optional)</Text>
            <MessageImagePicker
              images={images}
              onImagesChange={setImages}
              maxImages={5}
              disabled={isLoading}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Emoji Picker */}
      <EmojiPicker
        visible={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
        onSelectEmoji={handleEmojiSelect}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.white,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  cancelText: {
    fontSize: 16,
    color: colors.neutral.textMuted,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.neutral.text,
  },
  sendButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary.main,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.neutral.border,
  },
  sendButtonPressed: {
    backgroundColor: colors.primary.dark,
  },
  sendText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral.textInverse,
  },
  sendTextDisabled: {
    color: colors.neutral.textMuted,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  section: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.neutral.textMuted,
    marginBottom: spacing.sm,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  emojiButton: {
    padding: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: 16,
    color: colors.neutral.text,
    backgroundColor: colors.neutral.white,
  },
  messageInput: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
});
