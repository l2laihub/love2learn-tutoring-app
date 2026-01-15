/**
 * ReactionPicker Component
 * Quick emoji reaction picker shown on long-press
 */

import React from 'react';
import { View, Pressable, StyleSheet, Text, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../theme';
import { QUICK_REACTIONS } from '../../types/messages';

interface ReactionPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelectReaction: (emoji: string) => void;
  onDelete?: () => void;
  position?: { x: number; y: number };
}

export function ReactionPicker({
  visible,
  onClose,
  onSelectReaction,
  onDelete,
  position,
}: ReactionPickerProps) {
  const handleSelect = (emoji: string) => {
    onSelectReaction(emoji);
    onClose();
  };

  const handleDelete = () => {
    onClose();
    onDelete?.();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[
            styles.container,
            position && {
              position: 'absolute',
              top: position.y - 60,
              left: Math.max(10, Math.min(position.x - 100, 200)),
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.picker}>
            {QUICK_REACTIONS.map((emoji) => (
              <Pressable
                key={emoji}
                onPress={() => handleSelect(emoji)}
                style={({ pressed }) => [
                  styles.emojiButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.emoji}>{emoji}</Text>
              </Pressable>
            ))}
            {onDelete && (
              <>
                <View style={styles.divider} />
                <Pressable
                  onPress={handleDelete}
                  style={({ pressed }) => [
                    styles.deleteButton,
                    pressed && styles.deletePressed,
                  ]}
                >
                  <Ionicons name="trash-outline" size={20} color={colors.accent.main} />
                </Pressable>
              </>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: colors.neutral.white,
    borderRadius: 24,
    padding: spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  picker: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  emojiButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressed: {
    backgroundColor: colors.neutral.borderLight,
    transform: [{ scale: 1.2 }],
  },
  emoji: {
    fontSize: 24,
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: colors.neutral.border,
    alignSelf: 'center',
    marginHorizontal: spacing.xs,
  },
  deleteButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deletePressed: {
    backgroundColor: colors.accent.light,
  },
});
