/**
 * MessageComposer Component
 * Text input with image picker and emoji picker for sending messages
 *
 * Design: Clean, modern input area with clear affordances
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
  Text,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../theme';
import { MessageImagePicker } from './MessageImagePicker';
import { EmojiPicker } from './EmojiPicker';

interface MessageComposerProps {
  onSend: (content: string, images: string[]) => Promise<void>;
  placeholder?: string;
  disabled?: boolean;
}

// Composer specific colors
const composerColors = {
  container: '#FFFFFF',
  border: '#E8EDF2',
  inputBackground: '#F5F7F9',
  inputText: '#1B3A4B',
  placeholder: '#9AA8B5',
  iconDefault: '#8A9BA8',
  iconActive: '#2D8A94',
  sendButton: {
    inactive: '#E8EDF2',
    active: '#2D8A94',
    pressed: '#237680',
    icon: '#FFFFFF',
    iconInactive: '#9AA8B5',
  },
  badge: {
    background: '#FF6B6B',
    text: '#FFFFFF',
  },
};

export function MessageComposer({
  onSend,
  placeholder = 'Type a message...',
  disabled = false,
}: MessageComposerProps) {
  const [content, setContent] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [sending, setSending] = useState(false);

  const canSend = (content.trim().length > 0 || images.length > 0) && !sending && !disabled;

  const handleSend = useCallback(async () => {
    if (!canSend) return;

    try {
      setSending(true);
      await onSend(content.trim(), images);
      setContent('');
      setImages([]);
      setShowImagePicker(false);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  }, [content, images, onSend, canSend]);

  const handleEmojiSelect = useCallback((emoji: string) => {
    setContent((prev) => prev + emoji);
  }, []);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      <View style={styles.container}>
        {/* Image Preview */}
        {showImagePicker && (
          <View style={styles.imagePickerContainer}>
            <MessageImagePicker
              images={images}
              onImagesChange={setImages}
              maxImages={5}
              disabled={disabled}
            />
          </View>
        )}

        {/* Input Row */}
        <View style={styles.inputRow}>
          {/* Image Button */}
          <Pressable
            onPress={() => setShowImagePicker(!showImagePicker)}
            disabled={disabled}
            style={({ pressed }) => [
              styles.iconButton,
              showImagePicker && styles.activeIconButton,
              pressed && styles.iconPressed,
            ]}
          >
            <Ionicons
              name={showImagePicker ? 'images' : 'images-outline'}
              size={24}
              color={showImagePicker ? composerColors.iconActive : composerColors.iconDefault}
            />
            {images.length > 0 && (
              <View style={styles.imageBadge}>
                <Text style={styles.imageBadgeText}>{images.length}</Text>
              </View>
            )}
          </Pressable>

          {/* Emoji Button */}
          <Pressable
            onPress={() => setShowEmojiPicker(true)}
            disabled={disabled}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.iconPressed,
            ]}
          >
            <Ionicons
              name="happy-outline"
              size={24}
              color={composerColors.iconDefault}
            />
          </Pressable>

          {/* Text Input */}
          <TextInput
            style={styles.input}
            value={content}
            onChangeText={setContent}
            placeholder={placeholder}
            placeholderTextColor={composerColors.placeholder}
            multiline
            maxLength={2000}
            editable={!disabled}
          />

          {/* Send Button */}
          <Pressable
            onPress={handleSend}
            disabled={!canSend}
            style={({ pressed }) => [
              styles.sendButton,
              canSend && styles.sendButtonActive,
              pressed && canSend && styles.sendButtonPressed,
            ]}
          >
            {sending ? (
              <ActivityIndicator size="small" color={composerColors.sendButton.icon} />
            ) : (
              <Ionicons
                name="send"
                size={20}
                color={canSend ? composerColors.sendButton.icon : composerColors.sendButton.iconInactive}
              />
            )}
          </Pressable>
        </View>
      </View>

      {/* Emoji Picker Modal */}
      <EmojiPicker
        visible={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
        onSelectEmoji={handleEmojiSelect}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: composerColors.container,
    borderTopWidth: 1,
    borderTopColor: composerColors.border,
  },
  imagePickerContainer: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: composerColors.border,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  iconButton: {
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 21,
    position: 'relative',
  },
  activeIconButton: {
    backgroundColor: '#E0F2F1', // Light teal
  },
  iconPressed: {
    opacity: 0.7,
  },
  imageBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: composerColors.badge.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  imageBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: composerColors.badge.text,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: composerColors.inputBackground,
    borderRadius: 21,
    fontSize: 16,
    color: composerColors.inputText,
    letterSpacing: 0.1,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: composerColors.sendButton.inactive,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonActive: {
    backgroundColor: composerColors.sendButton.active,
  },
  sendButtonPressed: {
    backgroundColor: composerColors.sendButton.pressed,
  },
});
