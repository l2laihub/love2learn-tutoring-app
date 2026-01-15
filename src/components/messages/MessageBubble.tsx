/**
 * MessageBubble Component
 * Displays a single message with sender info and reactions
 *
 * Design: "Refined & Warm Conversational"
 * - Excellent readability with strong contrast
 * - Warm, inviting colors for received messages
 * - Clear visual hierarchy with sender prominence
 * - Subtle shadows for depth without heaviness
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  Text,
  GestureResponderEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../theme';
import { MessageWithDetails } from '../../types/messages';
import { useAuthContext } from '../../contexts/AuthContext';
import { MessageImageGallery } from './MessageImageGallery';
import { ReactionBar } from './ReactionBar';
import { ReactionPicker } from './ReactionPicker';
import { format, isToday, isYesterday } from 'date-fns';

interface MessageBubbleProps {
  message: MessageWithDetails;
  onToggleReaction: (emoji: string) => void;
  onDelete?: () => void;
  // Selection mode props
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (messageId: string) => void;
}

// Chat-specific color palette for better readability
const chatColors = {
  // Own message bubble - rich teal with excellent white contrast
  ownBubble: {
    background: '#2D8A94', // Slightly darker teal for better contrast
    text: '#FFFFFF',
    timestamp: 'rgba(255, 255, 255, 0.8)',
  },
  // Other message bubble - warm cream/sand tone for friendliness
  otherBubble: {
    background: '#F5F0E8', // Warm cream - not cold gray
    text: '#2C3E50', // Rich dark blue-gray for readability
    timestamp: '#8B7E6A', // Warm muted brown
  },
  // Sender info
  sender: {
    name: '#1B3A4B', // Navy - strong and readable
    avatar: '#7CB342', // Green from brand
    avatarText: '#FFFFFF',
  },
};

export function MessageBubble({
  message,
  onToggleReaction,
  onDelete,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect,
}: MessageBubbleProps) {
  const { parent } = useAuthContext();
  const isOwnMessage = parent?.id === message.sender_id;
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [pressPosition, setPressPosition] = useState({ x: 0, y: 0 });

  // Safely get sender info with fallbacks
  const senderName = message.sender?.name || 'Unknown';
  const senderInitial = senderName.charAt(0).toUpperCase();

  const handleLongPress = useCallback((event: GestureResponderEvent) => {
    // Don't show reaction picker in selection mode
    if (isSelectionMode) return;
    const { pageX, pageY } = event.nativeEvent;
    setPressPosition({ x: pageX, y: pageY });
    setShowReactionPicker(true);
  }, [isSelectionMode]);

  const handlePress = useCallback(() => {
    // In selection mode, toggle selection on tap
    if (isSelectionMode && onToggleSelect) {
      onToggleSelect(message.id);
    }
  }, [isSelectionMode, onToggleSelect, message.id]);

  const handleSelectReaction = useCallback((emoji: string) => {
    onToggleReaction(emoji);
  }, [onToggleReaction]);

  // Smart date formatting
  const messageDate = new Date(message.created_at);
  const formattedTime = format(messageDate, 'h:mm a');
  const formattedDate = isToday(messageDate)
    ? 'Today'
    : isYesterday(messageDate)
    ? 'Yesterday'
    : format(messageDate, 'MMM d');

  return (
    <>
      <Pressable
        onPress={handlePress}
        onLongPress={handleLongPress}
        delayLongPress={300}
        style={[
          styles.container,
          isOwnMessage ? styles.ownMessage : styles.otherMessage,
          isSelectionMode && styles.selectionModeContainer,
          isSelected && styles.selectedContainer,
        ]}
      >
        {/* Selection Checkbox */}
        {isSelectionMode && (
          <View style={[styles.checkbox, isOwnMessage && styles.checkboxRight]}>
            <Ionicons
              name={isSelected ? 'checkbox' : 'square-outline'}
              size={24}
              color={isSelected ? colors.primary.main : colors.neutral.textMuted}
            />
          </View>
        )}
        {/* Sender Info (for other people's messages) */}
        {!isOwnMessage && (
          <View style={styles.senderRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {senderInitial}
              </Text>
            </View>
            <Text style={styles.senderName}>{senderName}</Text>
          </View>
        )}

        {/* Message Bubble */}
        <View
          style={[
            styles.bubble,
            isOwnMessage ? styles.ownBubble : styles.otherBubble,
          ]}
        >
          {/* Images */}
          {message.images && message.images.length > 0 && (
            <View style={styles.imageContainer}>
              <MessageImageGallery images={message.images} />
            </View>
          )}

          {/* Text Content */}
          {message.content && (
            <Text
              style={[
                styles.messageText,
                isOwnMessage ? styles.ownText : styles.otherText,
              ]}
            >
              {message.content}
            </Text>
          )}

          {/* Timestamp */}
          <Text
            style={[
              styles.timestamp,
              isOwnMessage ? styles.ownTimestamp : styles.otherTimestamp,
            ]}
          >
            {formattedTime} {formattedDate !== 'Today' && `· ${formattedDate}`}
          </Text>
        </View>

        {/* Reactions */}
        <View style={isOwnMessage ? styles.ownReactions : styles.otherReactions}>
          <ReactionBar
            reactions={message.reactions}
            onToggleReaction={onToggleReaction}
          />
        </View>
      </Pressable>

      {/* Reaction Picker Modal */}
      <ReactionPicker
        visible={showReactionPicker}
        onClose={() => setShowReactionPicker(false)}
        onSelectReaction={handleSelectReaction}
        onDelete={onDelete}
        position={pressPosition}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  ownMessage: {
    alignItems: 'flex-end',
  },
  otherMessage: {
    alignItems: 'flex-start',
  },

  // Sender Info Styling - More prominent
  senderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    marginLeft: 2,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: chatColors.sender.avatar,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
    // Subtle shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: chatColors.sender.avatarText,
    letterSpacing: 0.3,
  },
  senderName: {
    fontSize: 14,
    fontWeight: '600',
    color: chatColors.sender.name,
    letterSpacing: 0.2,
  },

  // Message Bubble Styling
  bubble: {
    maxWidth: '82%',
    borderRadius: 18,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 2,
    // Subtle shadow for floating effect
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  ownBubble: {
    backgroundColor: chatColors.ownBubble.background,
    borderBottomRightRadius: 6,
  },
  otherBubble: {
    backgroundColor: chatColors.otherBubble.background,
    borderBottomLeftRadius: 6,
  },

  // Image container
  imageContainer: {
    marginBottom: spacing.xs,
    marginHorizontal: -2,
    marginTop: -2,
    borderRadius: 12,
    overflow: 'hidden',
  },

  // Message Text Styling - Larger and more readable
  messageText: {
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0.15,
  },
  ownText: {
    color: chatColors.ownBubble.text,
  },
  otherText: {
    color: chatColors.otherBubble.text,
  },

  // Timestamp Styling - More visible but still subtle
  timestamp: {
    fontSize: 12,
    marginTop: 6,
    letterSpacing: 0.2,
  },
  ownTimestamp: {
    color: chatColors.ownBubble.timestamp,
    textAlign: 'right',
  },
  otherTimestamp: {
    color: chatColors.otherBubble.timestamp,
  },

  // Reactions positioning
  ownReactions: {
    alignSelf: 'flex-end',
    marginTop: 6,
  },
  otherReactions: {
    alignSelf: 'flex-start',
    marginTop: 6,
  },

  // Selection mode styles
  selectionModeContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  selectedContainer: {
    backgroundColor: 'rgba(45, 138, 148, 0.08)',
    borderRadius: 12,
    marginHorizontal: spacing.xs,
  },
  checkbox: {
    paddingTop: spacing.sm,
    paddingRight: spacing.sm,
  },
  checkboxRight: {
    order: 1,
    paddingRight: 0,
    paddingLeft: spacing.sm,
  },
});
