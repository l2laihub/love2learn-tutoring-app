/**
 * MessageThreadCard Component
 * Displays a single thread preview in the thread list
 *
 * Design: Refined card with clear visual hierarchy
 * - Strong subject/title prominence
 * - Warm, readable preview text
 * - Clear unread state indication
 */

import React from 'react';
import { View, Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../theme';
import { ThreadWithPreview } from '../../types/messages';
import { formatDistanceToNow } from 'date-fns';

interface MessageThreadCardProps {
  thread: ThreadWithPreview;
  onPress: () => void;
  // Selection mode props
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (threadId: string) => void;
}

// Thread card specific colors
const cardColors = {
  background: '#FFFFFF',
  backgroundUnread: '#F0F9FF', // Light blue tint for unread
  backgroundPressed: '#F5F7F9',
  border: '#E8EDF2',
  avatar: {
    default: '#F0F4F6',
    unread: '#E0F2F1', // Light teal for unread
    iconDefault: '#8A9BA8',
    iconUnread: '#2D8A94',
  },
  badge: {
    background: '#E8F5E9',
    text: '#2E7D32',
  },
  subject: {
    default: '#1B3A4B',
    unread: '#1B3A4B',
  },
  preview: {
    text: '#5A6B7A',
    sender: '#2C3E50',
  },
  time: '#8A9BA8',
  unreadBadge: {
    background: '#FF6B6B',
    text: '#FFFFFF',
  },
};

export function MessageThreadCard({
  thread,
  onPress,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect,
}: MessageThreadCardProps) {
  const hasUnread = thread.unread_count > 0;
  const timeAgo = thread.latest_message_created_at
    ? formatDistanceToNow(new Date(thread.latest_message_created_at), { addSuffix: true })
    : formatDistanceToNow(new Date(thread.created_at), { addSuffix: true });

  const handlePress = () => {
    if (isSelectionMode && onToggleSelect) {
      onToggleSelect(thread.id);
    } else {
      onPress();
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.container,
        hasUnread && styles.unreadContainer,
        pressed && styles.pressed,
        isSelected && styles.selectedContainer,
      ]}
    >
      {/* Selection Checkbox */}
      {isSelectionMode && (
        <View style={styles.checkbox}>
          <Ionicons
            name={isSelected ? 'checkbox' : 'square-outline'}
            size={24}
            color={isSelected ? colors.primary.main : colors.neutral.textMuted}
          />
        </View>
      )}

      {/* Avatar/Icon */}
      <View style={[styles.avatar, hasUnread && styles.unreadAvatar]}>
        <Ionicons
          name={thread.recipient_type === 'all' ? 'megaphone' : 'people'}
          size={24}
          color={hasUnread ? cardColors.avatar.iconUnread : cardColors.avatar.iconDefault}
        />
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Header Row */}
        <View style={styles.headerRow}>
          <Text
            style={[styles.subject, hasUnread && styles.unreadText]}
            numberOfLines={1}
          >
            {thread.subject}
          </Text>
          <Text style={styles.time}>{timeAgo}</Text>
        </View>

        {/* Recipient Type Badge */}
        <View style={styles.metaRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {thread.recipient_type === 'all'
                ? 'All Parents'
                : thread.group_name || 'Group'}
            </Text>
          </View>
          <Text style={styles.participantCount}>
            {thread.participant_count} recipient{thread.participant_count !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* Preview */}
        {thread.latest_message_content && (
          <Text style={styles.preview} numberOfLines={2}>
            <Text style={styles.senderName}>
              {thread.latest_message_sender_name}:
            </Text>{' '}
            {thread.latest_message_content}
          </Text>
        )}
      </View>

      {/* Unread Badge */}
      {hasUnread && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadBadgeText}>
            {thread.unread_count > 99 ? '99+' : thread.unread_count}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: spacing.md,
    backgroundColor: cardColors.background,
    borderBottomWidth: 1,
    borderBottomColor: cardColors.border,
  },
  unreadContainer: {
    backgroundColor: cardColors.backgroundUnread,
  },
  pressed: {
    backgroundColor: cardColors.backgroundPressed,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: cardColors.avatar.default,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  unreadAvatar: {
    backgroundColor: cardColors.avatar.unread,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  subject: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: cardColors.subject.default,
    marginRight: spacing.sm,
    letterSpacing: 0.1,
  },
  unreadText: {
    fontWeight: '700',
    color: cardColors.subject.unread,
  },
  time: {
    fontSize: 12,
    fontWeight: '500',
    color: cardColors.time,
    letterSpacing: 0.2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  badge: {
    backgroundColor: cardColors.badge.background,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 3,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: cardColors.badge.text,
    letterSpacing: 0.3,
  },
  participantCount: {
    fontSize: 12,
    fontWeight: '500',
    color: cardColors.time,
    letterSpacing: 0.2,
  },
  preview: {
    fontSize: 14,
    color: cardColors.preview.text,
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  senderName: {
    fontWeight: '600',
    color: cardColors.preview.sender,
  },
  unreadBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: cardColors.unreadBadge.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: spacing.sm,
    alignSelf: 'center',
  },
  unreadBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: cardColors.unreadBadge.text,
    letterSpacing: 0.2,
  },

  // Selection mode styles
  selectedContainer: {
    backgroundColor: 'rgba(45, 138, 148, 0.1)',
  },
  checkbox: {
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
});
