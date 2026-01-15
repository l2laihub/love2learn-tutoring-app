/**
 * Messages Tab Screen
 * Lists all message threads with previews
 * Tutor can create new messages, manage groups, and bulk delete/archive threads
 */

import React, { useState, useCallback } from 'react';
import { View, Pressable, StyleSheet, Text, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../../src/theme';
import { useAuthContext } from '../../../src/contexts/AuthContext';
import {
  useMessageThreads,
  useBulkDeleteThreads,
  useBulkArchiveThreads,
} from '../../../src/hooks';
import { MessageThreadList, NewMessageModal, ManageGroupsModal } from '../../../src/components/messages';

export default function MessagesScreen() {
  const { isTutor } = useAuthContext();
  const { threads, loading, error, refetch, unreadCount } = useMessageThreads();
  const { mutate: bulkDeleteThreads, loading: bulkDeleting } = useBulkDeleteThreads();
  const { mutate: bulkArchiveThreads, loading: bulkArchiving } = useBulkArchiveThreads();

  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [showManageGroupsModal, setShowManageGroupsModal] = useState(false);

  // Selection mode state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedThreadIds, setSelectedThreadIds] = useState<Set<string>>(new Set());

  const handleNewMessageSuccess = () => {
    refetch();
  };

  // Selection mode handlers
  const handleEnterSelectionMode = useCallback(() => {
    setIsSelectionMode(true);
    setSelectedThreadIds(new Set());
  }, []);

  const handleExitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedThreadIds(new Set());
  }, []);

  const handleToggleThreadSelect = useCallback((threadId: string) => {
    setSelectedThreadIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(threadId)) {
        newSet.delete(threadId);
      } else {
        newSet.add(threadId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (threads) {
      setSelectedThreadIds(new Set(threads.map((t) => t.id)));
    }
  }, [threads]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedThreadIds.size === 0) return;

    const confirmMessage = `Are you sure you want to permanently delete ${selectedThreadIds.size} conversation${selectedThreadIds.size > 1 ? 's' : ''}? This cannot be undone.`;

    const performDelete = async () => {
      try {
        const deleted = await bulkDeleteThreads(Array.from(selectedThreadIds));
        if (deleted > 0) {
          handleExitSelectionMode();
          refetch();
        } else {
          if (Platform.OS === 'web') {
            window.alert('Failed to delete threads. Please make sure the database migration has been applied.');
          } else {
            Alert.alert('Error', 'Failed to delete threads. Please make sure the database migration has been applied.');
          }
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to delete threads';
        if (Platform.OS === 'web') {
          window.alert(errorMsg);
        } else {
          Alert.alert('Error', errorMsg);
        }
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(confirmMessage)) {
        await performDelete();
      }
    } else {
      Alert.alert(
        'Delete Threads',
        confirmMessage,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: performDelete,
          },
        ]
      );
    }
  }, [selectedThreadIds, bulkDeleteThreads, handleExitSelectionMode, refetch]);

  const handleBulkArchive = useCallback(async () => {
    if (selectedThreadIds.size === 0) return;

    const confirmMessage = `Archive ${selectedThreadIds.size} conversation${selectedThreadIds.size > 1 ? 's' : ''}? They will no longer appear in the list.`;

    const performArchive = async () => {
      try {
        const archived = await bulkArchiveThreads(Array.from(selectedThreadIds));
        if (archived > 0) {
          handleExitSelectionMode();
          refetch();
        } else {
          if (Platform.OS === 'web') {
            window.alert('Failed to archive threads. Please make sure the database migration has been applied.');
          } else {
            Alert.alert('Error', 'Failed to archive threads. Please make sure the database migration has been applied.');
          }
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to archive threads';
        if (Platform.OS === 'web') {
          window.alert(errorMsg);
        } else {
          Alert.alert('Error', errorMsg);
        }
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(confirmMessage)) {
        await performArchive();
      }
    } else {
      Alert.alert(
        'Archive Threads',
        confirmMessage,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Archive',
            onPress: performArchive,
          },
        ]
      );
    }
  }, [selectedThreadIds, bulkArchiveThreads, handleExitSelectionMode, refetch]);

  const isProcessing = bulkDeleting || bulkArchiving;

  return (
    <View style={styles.container}>
      {/* Thread List */}
      <MessageThreadList
        threads={threads}
        loading={loading}
        error={error}
        onRefresh={refetch}
        isSelectionMode={isSelectionMode}
        selectedThreadIds={selectedThreadIds}
        onToggleSelect={handleToggleThreadSelect}
        ListHeaderComponent={
          isTutor ? (
            <View style={styles.header}>
              {isSelectionMode ? (
                // Selection mode header
                <>
                  <View style={styles.headerInfo}>
                    <Pressable onPress={handleExitSelectionMode} style={styles.cancelButton}>
                      <Ionicons name="close" size={24} color={colors.neutral.text} />
                    </Pressable>
                    <Text style={styles.selectionCount}>
                      {selectedThreadIds.size} selected
                    </Text>
                  </View>
                  <Pressable onPress={handleSelectAll} style={styles.selectAllButton}>
                    <Text style={styles.selectAllText}>Select All</Text>
                  </Pressable>
                </>
              ) : (
                // Normal header
                <>
                  <View style={styles.headerInfo}>
                    <Text style={styles.headerTitle}>Messages</Text>
                    {unreadCount > 0 && (
                      <Text style={styles.unreadBadge}>{unreadCount} unread</Text>
                    )}
                  </View>
                  <View style={styles.headerActions}>
                    <Pressable
                      onPress={handleEnterSelectionMode}
                      style={({ pressed }) => [
                        styles.iconButton,
                        pressed && styles.buttonPressed,
                      ]}
                    >
                      <Ionicons name="checkbox-outline" size={22} color={colors.neutral.text} />
                    </Pressable>
                    <Pressable
                      onPress={() => setShowManageGroupsModal(true)}
                      style={({ pressed }) => [
                        styles.groupsButton,
                        pressed && styles.buttonPressed,
                      ]}
                    >
                      <Ionicons name="people" size={20} color={colors.primary.main} />
                      <Text style={styles.groupsButtonText}>Groups</Text>
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          ) : undefined
        }
      />

      {/* Selection Mode Action Bar */}
      {isSelectionMode && selectedThreadIds.size > 0 && (
        <View style={styles.selectionBar}>
          <Pressable
            style={[styles.selectionBarButton, styles.archiveButton, isProcessing && styles.buttonDisabled]}
            onPress={handleBulkArchive}
            disabled={isProcessing}
          >
            <Ionicons name="archive-outline" size={20} color={colors.neutral.white} />
            <Text style={styles.selectionBarButtonText}>
              {bulkArchiving ? 'Archiving...' : 'Archive'}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.selectionBarButton, styles.deleteButton, isProcessing && styles.buttonDisabled]}
            onPress={handleBulkDelete}
            disabled={isProcessing}
          >
            <Ionicons name="trash-outline" size={20} color={colors.neutral.white} />
            <Text style={styles.selectionBarButtonText}>
              {bulkDeleting ? 'Deleting...' : 'Delete'}
            </Text>
          </Pressable>
        </View>
      )}

      {/* FAB for tutors to create new message (hidden in selection mode) */}
      {isTutor && !isSelectionMode && (
        <Pressable
          onPress={() => setShowNewMessageModal(true)}
          style={({ pressed }) => [
            styles.fab,
            pressed && styles.fabPressed,
          ]}
        >
          <Ionicons name="create" size={28} color={colors.neutral.textInverse} />
        </Pressable>
      )}

      {/* New Message Modal */}
      <NewMessageModal
        visible={showNewMessageModal}
        onClose={() => setShowNewMessageModal(false)}
        onSuccess={handleNewMessageSuccess}
      />

      {/* Manage Groups Modal */}
      <ManageGroupsModal
        visible={showManageGroupsModal}
        onClose={() => setShowManageGroupsModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.neutral.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.neutral.text,
  },
  unreadBadge: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.accent.main,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconButton: {
    padding: spacing.sm,
    borderRadius: 8,
  },
  groupsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary.light,
    borderRadius: 8,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  groupsButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.primary.main,
  },

  // Selection mode styles
  cancelButton: {
    padding: spacing.xs,
    marginRight: spacing.xs,
  },
  selectionCount: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.neutral.text,
  },
  selectAllButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  selectAllText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.primary.main,
  },

  // Selection bar
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    backgroundColor: colors.neutral.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
  },
  selectionBarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  archiveButton: {
    backgroundColor: colors.primary.main,
  },
  deleteButton: {
    backgroundColor: colors.accent.main,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  selectionBarButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral.white,
  },

  // FAB
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabPressed: {
    backgroundColor: colors.primary.dark,
    transform: [{ scale: 0.95 }],
  },
});
