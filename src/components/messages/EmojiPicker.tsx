/**
 * EmojiPicker Component
 * Full emoji picker modal for composing messages
 * Uses a grid of common emojis with category tabs
 */

import React, { useState } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  Text,
  Modal,
  ScrollView,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../theme';

// Common emoji categories
const EMOJI_CATEGORIES = {
  recent: {
    name: 'Recent',
    icon: 'time-outline' as const,
    emojis: ['👍', '❤️', '😊', '😂', '😮', '😢', '🎉', '👏', '🙏', '💪'],
  },
  smileys: {
    name: 'Smileys',
    icon: 'happy-outline' as const,
    emojis: [
      '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂',
      '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋',
      '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐',
      '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '😮', '🤯', '😳',
      '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '😈', '👿', '💀',
    ],
  },
  gestures: {
    name: 'Gestures',
    icon: 'hand-left-outline' as const,
    emojis: [
      '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞',
      '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍',
      '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🙏',
      '✍️', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠',
    ],
  },
  hearts: {
    name: 'Hearts',
    icon: 'heart-outline' as const,
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
      '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '♥️',
    ],
  },
  celebration: {
    name: 'Celebration',
    icon: 'balloon-outline' as const,
    emojis: [
      '🎉', '🎊', '🎈', '🎁', '🎀', '🎄', '🎃', '🎗️', '🎟️', '🎫',
      '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '⭐', '🌟', '✨', '💫',
      '🔥', '💥', '💯', '🎵', '🎶', '🎤', '🎧', '🎸', '🎹', '🎺',
    ],
  },
  objects: {
    name: 'Objects',
    icon: 'cube-outline' as const,
    emojis: [
      '📱', '💻', '🖥️', '🖨️', '⌨️', '🖱️', '💾', '💿', '📀', '📷',
      '📹', '🎥', '📞', '☎️', '📺', '📻', '⏰', '⏱️', '⏲️', '🕰️',
      '📚', '📖', '📝', '✏️', '🖊️', '🖋️', '✒️', '📌', '📍', '🔒',
    ],
  },
};

type CategoryKey = keyof typeof EMOJI_CATEGORIES;

interface EmojiPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
}

export function EmojiPicker({ visible, onClose, onSelectEmoji }: EmojiPickerProps) {
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('recent');
  const [searchQuery, setSearchQuery] = useState('');

  const handleSelect = (emoji: string) => {
    onSelectEmoji(emoji);
    onClose();
  };

  const categoryKeys = Object.keys(EMOJI_CATEGORIES) as CategoryKey[];
  const currentEmojis = EMOJI_CATEGORIES[activeCategory].emojis;

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
          <Text style={styles.title}>Select Emoji</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.neutral.text} />
          </Pressable>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons
            name="search"
            size={20}
            color={colors.neutral.textMuted}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search emojis..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={colors.neutral.textMuted}
          />
        </View>

        {/* Category Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryTabs}
        >
          {categoryKeys.map((key) => {
            const category = EMOJI_CATEGORIES[key];
            const isActive = key === activeCategory;
            return (
              <Pressable
                key={key}
                onPress={() => setActiveCategory(key)}
                style={[styles.categoryTab, isActive && styles.activeCategoryTab]}
              >
                <Ionicons
                  name={category.icon}
                  size={20}
                  color={isActive ? colors.primary.main : colors.neutral.textMuted}
                />
                <Text
                  style={[
                    styles.categoryName,
                    isActive && styles.activeCategoryName,
                  ]}
                >
                  {category.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Emoji Grid */}
        <ScrollView style={styles.emojiGrid} showsVerticalScrollIndicator={false}>
          <View style={styles.emojiRow}>
            {currentEmojis.map((emoji) => (
              <Pressable
                key={emoji}
                onPress={() => handleSelect(emoji)}
                style={({ pressed }) => [
                  styles.emojiButton,
                  pressed && styles.emojiPressed,
                ]}
              >
                <Text style={styles.emoji}>{emoji}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>
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
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.neutral.text,
  },
  closeButton: {
    padding: spacing.xs,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.neutral.backgroundAlt,
    borderRadius: 8,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm,
    fontSize: 16,
    color: colors.neutral.text,
  },
  categoryTabs: {
    maxHeight: 50,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  categoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginHorizontal: spacing.xs,
  },
  activeCategoryTab: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary.main,
  },
  categoryName: {
    marginLeft: spacing.xs,
    fontSize: 13,
    color: colors.neutral.textMuted,
  },
  activeCategoryName: {
    color: colors.primary.main,
    fontWeight: '500',
  },
  emojiGrid: {
    flex: 1,
    padding: spacing.md,
  },
  emojiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  emojiButton: {
    width: '12.5%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  emojiPressed: {
    backgroundColor: colors.primary.light,
  },
  emoji: {
    fontSize: 28,
  },
});
