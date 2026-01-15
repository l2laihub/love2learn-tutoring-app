/**
 * ReactionBar Component
 * Displays reaction summary under messages
 * Tap to toggle your own reaction
 */

import React from 'react';
import { View, Pressable, StyleSheet, Text } from 'react-native';
import { colors, spacing } from '../../theme';
import { ReactionSummary } from '../../types/messages';

interface ReactionBarProps {
  reactions: ReactionSummary[];
  onToggleReaction: (emoji: string) => void;
  disabled?: boolean;
}

export function ReactionBar({
  reactions,
  onToggleReaction,
  disabled = false,
}: ReactionBarProps) {
  if (reactions.length === 0) return null;

  return (
    <View style={styles.container}>
      {reactions.map((reaction) => (
        <Pressable
          key={reaction.emoji}
          onPress={() => !disabled && onToggleReaction(reaction.emoji)}
          disabled={disabled}
          style={({ pressed }) => [
            styles.reactionButton,
            reaction.reacted_by_me && styles.reactedByMe,
            pressed && !disabled && styles.pressed,
          ]}
        >
          <Text style={styles.emoji}>{reaction.emoji}</Text>
          <Text
            style={[
              styles.count,
              reaction.reacted_by_me && styles.countActive,
            ]}
          >
            {reaction.count}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  reactionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.backgroundAlt,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  reactedByMe: {
    backgroundColor: colors.primary.light,
    borderColor: colors.primary.main,
  },
  pressed: {
    opacity: 0.7,
  },
  emoji: {
    fontSize: 14,
    marginRight: 4,
  },
  count: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.neutral.textMuted,
  },
  countActive: {
    color: colors.primary.dark,
  },
});
