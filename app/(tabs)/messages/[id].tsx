/**
 * Thread Detail Screen
 * Shows all messages in a thread with ability to reply
 */

import React, { useCallback, useRef, useEffect, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Text,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Alert,
} from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../../src/theme';
import { useAuthContext } from '../../../src/contexts/AuthContext';
import {
  useMessageThread,
  useSendMessage,
  useToggleReaction,
  useArchiveThread,
  useDeleteMessage,
  useDeleteThread,
  useBulkDeleteMessages,
} from '../../../src/hooks';
import { useFileUpload } from '../../../src/hooks/useFileUpload';
import { MessageBubble, MessageComposer } from '../../../src/components/messages';
import { MessageWithDetails } from '../../../src/types/messages';

export default function ThreadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { parent, isTutor } = useAuthContext();
  const { thread, loading, error, refetch, markAsRead } = useMessageThread(id || null);
  const { mutate: sendMessage, loading: sending } = useSendMessage();
  const { mutate: toggleReaction } = useToggleReaction();
  const { mutate: archiveThread } = useArchiveThread();
  const { mutate: deleteMessage } = useDeleteMessage();
  const { mutate: deleteThread } = useDeleteThread();
  const { mutate: bulkDeleteMessages, loading: bulkDeleting } = useBulkDeleteMessages();
  const { uploadFile } = useFileUpload();
  const flatListRef = useRef<FlatList>(null);
  const [showMenu, setShowMenu] = useState(false);

  // Selection mode state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());

  // Track if thread was previously loaded (to detect deletion)
  const [wasLoaded, setWasLoaded] = useState(false);

  // Mark as read when viewing
  useEffect(() => {
    if (id && parent?.id) {
      markAsRead();
    }
  }, [id, parent?.id, markAsRead]);

  // Track when thread is loaded
  useEffect(() => {
    if (thread && !wasLoaded) {
      setWasLoaded(true);
    }
  }, [thread, wasLoaded]);

  // Navigate back if thread was deleted (thread becomes null after being loaded)
  useEffect(() => {
    if (wasLoaded && !loading && !thread) {
      // Thread was deleted - navigate back to messages list
      router.back();
    }
  }, [wasLoaded, loading, thread]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (thread?.messages.length) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [thread?.messages.length]);

  const handleSendMessage = useCallback(async (content: string, images: string[]) => {
    if (!id) return;

    try {
      // Upload images first if any
      const uploadedPaths: string[] = [];
      for (const imageUri of images) {
        const fileName = `message_${Date.now()}.jpg`;
        const result = await uploadFile(
          'session-media',
          `messages/${id}`, // Use thread ID as folder
          imageUri,
          fileName,
          'image/jpeg'
        );

        if (result?.path) {
          uploadedPaths.push(result.path);
        }
      }

      // Send the message
      await sendMessage({
        thread_id: id,
        content,
        images: uploadedPaths,
      });

      // Refetch to get the new message
      refetch();
    } catch (err) {
      console.error('Error sending message:', err);
    }
  }, [id, sendMessage, uploadFile, refetch]);

  const handleToggleReaction = useCallback(async (messageId: string, emoji: string) => {
    await toggleReaction({ message_id: messageId, emoji });
    refetch();
  }, [toggleReaction, refetch]);

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    const confirmMessage = 'Are you sure you want to delete this message?';

    const performDelete = async () => {
      const success = await deleteMessage(messageId);
      if (success) {
        refetch();
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(confirmMessage)) {
        await performDelete();
      }
    } else {
      Alert.alert(
        'Delete Message',
        confirmMessage,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: performDelete },
        ]
      );
    }
  }, [deleteMessage, refetch]);

  const handleArchiveThread = useCallback(async () => {
    setShowMenu(false);
    const confirmMessage = 'Are you sure you want to archive this conversation? It will no longer appear in the messages list.';

    const performArchive = async () => {
      try {
        const success = await archiveThread(id!);
        if (success) {
          router.back();
        } else {
          if (Platform.OS === 'web') {
            window.alert('Failed to archive thread. Please make sure the database migration has been applied.');
          } else {
            Alert.alert('Error', 'Failed to archive thread. Please make sure the database migration has been applied.');
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to archive thread';
        if (Platform.OS === 'web') {
          window.alert(errorMessage);
        } else {
          Alert.alert('Error', errorMessage);
        }
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(confirmMessage)) {
        await performArchive();
      }
    } else {
      Alert.alert(
        'Archive Thread',
        confirmMessage,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Archive', onPress: performArchive },
        ]
      );
    }
  }, [archiveThread, id]);

  const handleDeleteThread = useCallback(async () => {
    setShowMenu(false);
    const confirmMessage = 'Are you sure you want to permanently delete this conversation? This action cannot be undone.';

    const performDelete = async () => {
      try {
        const success = await deleteThread(id!);
        if (success) {
          router.back();
        } else {
          if (Platform.OS === 'web') {
            window.alert('Failed to delete thread. Please make sure the database migration has been applied.');
          } else {
            Alert.alert('Error', 'Failed to delete thread. Please make sure the database migration has been applied.');
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to delete thread';
        if (Platform.OS === 'web') {
          window.alert(errorMessage);
        } else {
          Alert.alert('Error', errorMessage);
        }
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(confirmMessage)) {
        await performDelete();
      }
    } else {
      Alert.alert(
        'Delete Thread',
        confirmMessage,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: performDelete },
        ]
      );
    }
  }, [deleteThread, id]);

  const canDeleteMessage = useCallback((message: MessageWithDetails) => {
    // Tutor can delete any message, others can only delete their own
    return isTutor || message.sender_id === parent?.id;
  }, [isTutor, parent?.id]);

  // Selection mode handlers
  const handleEnterSelectionMode = useCallback(() => {
    setIsSelectionMode(true);
    setSelectedMessageIds(new Set());
    setShowMenu(false);
  }, []);

  const handleExitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedMessageIds(new Set());
  }, []);

  const handleToggleMessageSelect = useCallback((messageId: string) => {
    setSelectedMessageIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (thread?.messages) {
      setSelectedMessageIds(new Set(thread.messages.map((m) => m.id)));
    }
  }, [thread?.messages]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedMessageIds.size === 0) return;

    const confirmMessage = `Are you sure you want to delete ${selectedMessageIds.size} message${selectedMessageIds.size > 1 ? 's' : ''}?`;

    const performBulkDelete = async () => {
      try {
        const deleted = await bulkDeleteMessages(Array.from(selectedMessageIds));
        if (deleted > 0) {
          handleExitSelectionMode();
          refetch();
        } else {
          if (Platform.OS === 'web') {
            window.alert('Failed to delete messages');
          } else {
            Alert.alert('Error', 'Failed to delete messages');
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to delete messages';
        if (Platform.OS === 'web') {
          window.alert(errorMessage);
        } else {
          Alert.alert('Error', errorMessage);
        }
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(confirmMessage)) {
        await performBulkDelete();
      }
    } else {
      Alert.alert(
        'Delete Messages',
        confirmMessage,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: performBulkDelete },
        ]
      );
    }
  }, [selectedMessageIds, bulkDeleteMessages, handleExitSelectionMode, refetch]);

  const renderMessage = ({ item }: { item: MessageWithDetails }) => (
    <MessageBubble
      message={item}
      onToggleReaction={(emoji) => handleToggleReaction(item.id, emoji)}
      onDelete={canDeleteMessage(item) ? () => handleDeleteMessage(item.id) : undefined}
      isSelectionMode={isSelectionMode}
      isSelected={selectedMessageIds.has(item.id)}
      onToggleSelect={handleToggleMessageSelect}
    />
  );

  if (loading && !thread) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary.main} />
        <Text style={styles.loadingText}>Loading conversation...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Failed to load conversation</Text>
        <Text style={styles.errorSubtext}>{error.message}</Text>
      </View>
    );
  }

  if (!thread) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Conversation not found</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: isSelectionMode ? `${selectedMessageIds.size} selected` : thread.subject,
          headerBackTitle: 'Messages',
          headerLeft: isSelectionMode ? () => (
            <Pressable onPress={handleExitSelectionMode} style={styles.headerButton}>
              <Text style={styles.headerButtonText}>Cancel</Text>
            </Pressable>
          ) : undefined,
          headerRight: isTutor ? () => (
            isSelectionMode ? (
              <View style={styles.headerActions}>
                <Pressable onPress={handleSelectAll} style={styles.headerButton}>
                  <Text style={styles.headerButtonText}>Select All</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => setShowMenu(!showMenu)}
                style={styles.menuButton}
              >
                <Ionicons name="ellipsis-vertical" size={22} color={colors.neutral.textInverse} />
              </Pressable>
            )
          ) : undefined,
        }}
      />

      {/* Dropdown Menu for Tutor */}
      {showMenu && isTutor && !isSelectionMode && (
        <Pressable style={styles.menuOverlay} onPress={() => setShowMenu(false)}>
          <Pressable style={styles.menuDropdown} onPress={(e) => e.stopPropagation()}>
            <Pressable
              style={styles.menuItem}
              onPress={handleEnterSelectionMode}
            >
              <Ionicons name="checkbox-outline" size={20} color={colors.neutral.text} />
              <Text style={styles.menuItemText}>Select Messages</Text>
            </Pressable>
            <Pressable
              style={styles.menuItem}
              onPress={handleArchiveThread}
            >
              <Ionicons name="archive-outline" size={20} color={colors.neutral.text} />
              <Text style={styles.menuItemText}>Archive Thread</Text>
            </Pressable>
            <Pressable
              style={[styles.menuItem, styles.menuItemDestructive]}
              onPress={handleDeleteThread}
            >
              <Ionicons name="trash-outline" size={20} color={colors.accent.main} />
              <Text style={[styles.menuItemText, styles.menuItemTextDestructive]}>Delete Thread</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      )}

      {/* Selection Mode Action Bar */}
      {isSelectionMode && selectedMessageIds.size > 0 && (
        <View style={styles.selectionBar}>
          <Text style={styles.selectionBarText}>
            {selectedMessageIds.size} message{selectedMessageIds.size > 1 ? 's' : ''} selected
          </Text>
          <Pressable
            style={[styles.selectionBarButton, bulkDeleting && styles.selectionBarButtonDisabled]}
            onPress={handleBulkDelete}
            disabled={bulkDeleting}
          >
            <Ionicons name="trash-outline" size={20} color={colors.neutral.white} />
            <Text style={styles.selectionBarButtonText}>
              {bulkDeleting ? 'Deleting...' : 'Delete'}
            </Text>
          </Pressable>
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        {/* Thread Info Header */}
        <View style={styles.threadHeader}>
          <View style={styles.recipientInfo}>
            <Text style={styles.recipientLabel}>
              {thread.recipient_type === 'all'
                ? 'All Parents'
                : thread.recipient_type === 'group'
                  ? thread.group?.name || 'Group'
                  : `${thread.participants?.length || 0} Selected Parent${(thread.participants?.length || 0) !== 1 ? 's' : ''}`}
            </Text>
            <Text style={styles.participantCount}>
              {thread.participants?.length || 0} participant
              {(thread.participants?.length || 0) !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={thread.messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          style={styles.messageList}
          contentContainerStyle={styles.messageListContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => {
            flatListRef.current?.scrollToEnd({ animated: false });
          }}
        />

        {/* Message Composer */}
        <MessageComposer
          onSend={handleSendMessage}
          placeholder="Type a reply..."
          disabled={sending}
        />
      </KeyboardAvoidingView>
    </>
  );
}

// Enhanced chat colors for better visual hierarchy
const chatScreenColors = {
  background: '#FAFBFC', // Subtle off-white, warmer than pure gray
  headerBackground: '#FFFFFF',
  headerBorder: '#E8EDF2',
  recipientBadge: {
    background: '#E8F5E9', // Light green for "All Parents" badge
    text: '#2E7D32', // Dark green text
  },
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: chatScreenColors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: chatScreenColors.background,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 16,
    fontWeight: '500',
    color: colors.neutral.textSecondary,
    letterSpacing: 0.2,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.accent.main,
    marginBottom: spacing.xs,
    letterSpacing: 0.2,
  },
  errorSubtext: {
    fontSize: 14,
    color: colors.neutral.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  threadHeader: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: chatScreenColors.headerBackground,
    borderBottomWidth: 1,
    borderBottomColor: chatScreenColors.headerBorder,
  },
  recipientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recipientLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: chatScreenColors.recipientBadge.text,
    backgroundColor: chatScreenColors.recipientBadge.background,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: 6,
    letterSpacing: 0.3,
    overflow: 'hidden',
  },
  participantCount: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.neutral.textSecondary,
    letterSpacing: 0.2,
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    paddingVertical: spacing.md,
    paddingBottom: spacing.lg,
  },
  menuButton: {
    padding: spacing.sm,
    marginRight: -spacing.xs,
  },
  menuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  menuDropdown: {
    position: 'absolute',
    top: 8,
    right: spacing.md,
    backgroundColor: colors.neutral.white,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    minWidth: 180,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  menuItemDestructive: {
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
  },
  menuItemText: {
    fontSize: 15,
    color: colors.neutral.text,
  },
  menuItemTextDestructive: {
    color: colors.accent.main,
  },

  // Header button styles
  headerButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  headerButtonText: {
    fontSize: 16,
    color: colors.neutral.textInverse,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  // Selection mode styles
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primary.dark,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  selectionBarText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.neutral.white,
  },
  selectionBarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accent.main,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  selectionBarButtonDisabled: {
    opacity: 0.6,
  },
  selectionBarButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral.white,
  },
});
