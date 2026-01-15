/**
 * ManageGroupsModal Component
 * Modal to list and manage all parent groups
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  Text,
  Modal,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../theme';
import { useParentGroups, useDeleteParentGroup } from '../../hooks';
import { ParentGroupWithMembers } from '../../types/messages';
import { ParentGroupModal } from './ParentGroupModal';

interface ManageGroupsModalProps {
  visible: boolean;
  onClose: () => void;
}

export function ManageGroupsModal({ visible, onClose }: ManageGroupsModalProps) {
  const { groups, loading, refetch } = useParentGroups();
  const { mutate: deleteGroup, loading: deleting } = useDeleteParentGroup();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ParentGroupWithMembers | null>(null);

  const handleDeleteGroup = useCallback((group: ParentGroupWithMembers) => {
    Alert.alert(
      'Delete Group',
      `Are you sure you want to delete "${group.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteGroup(group.id);
            if (success) {
              refetch();
            }
          },
        },
      ]
    );
  }, [deleteGroup, refetch]);

  const handleCreateSuccess = useCallback(() => {
    refetch();
    setShowCreateModal(false);
  }, [refetch]);

  const handleEditSuccess = useCallback(() => {
    refetch();
    setEditingGroup(null);
  }, [refetch]);

  const renderGroupItem = ({ item }: { item: ParentGroupWithMembers }) => (
    <View style={styles.groupItem}>
      <View style={styles.groupInfo}>
        <View style={styles.groupIcon}>
          <Ionicons name="people-circle" size={24} color={colors.primary.main} />
        </View>
        <View style={styles.groupDetails}>
          <Text style={styles.groupName}>{item.name}</Text>
          {item.description && (
            <Text style={styles.groupDescription} numberOfLines={1}>
              {item.description}
            </Text>
          )}
          <Text style={styles.memberCount}>
            {item.member_count || item.members.length} member
            {(item.member_count || item.members.length) !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={() => setEditingGroup(item)}
          style={({ pressed }) => [styles.actionButton, pressed && styles.actionPressed]}
        >
          <Ionicons name="pencil" size={20} color={colors.primary.main} />
        </Pressable>
        <Pressable
          onPress={() => handleDeleteGroup(item)}
          disabled={deleting}
          style={({ pressed }) => [styles.actionButton, pressed && styles.actionPressed]}
        >
          <Ionicons name="trash-outline" size={20} color={colors.accent.main} />
        </Pressable>
      </View>
    </View>
  );

  const renderEmptyComponent = () => {
    if (loading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Text style={styles.loadingText}>Loading groups...</Text>
        </View>
      );
    }

    return (
      <View style={styles.centered}>
        <Ionicons name="people-outline" size={48} color={colors.neutral.textMuted} />
        <Text style={styles.emptyTitle}>No Groups Yet</Text>
        <Text style={styles.emptySubtext}>
          Create a group to easily send messages to specific parents
        </Text>
      </View>
    );
  };

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
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.neutral.text} />
          </Pressable>
          <Text style={styles.title}>Manage Groups</Text>
          <Pressable
            onPress={() => setShowCreateModal(true)}
            style={({ pressed }) => [
              styles.addButton,
              pressed && styles.addButtonPressed,
            ]}
          >
            <Ionicons name="add" size={24} color={colors.neutral.textInverse} />
          </Pressable>
        </View>

        {/* Group List */}
        <FlatList
          data={groups}
          renderItem={renderGroupItem}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={renderEmptyComponent}
          contentContainerStyle={groups.length === 0 ? styles.emptyContainer : undefined}
          showsVerticalScrollIndicator={false}
        />
      </View>

      {/* Create Group Modal */}
      <ParentGroupModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
      />

      {/* Edit Group Modal */}
      <ParentGroupModal
        visible={!!editingGroup}
        onClose={() => setEditingGroup(null)}
        onSuccess={handleEditSuccess}
        editGroup={editingGroup}
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
  closeButton: {
    padding: spacing.xs,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.neutral.text,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonPressed: {
    backgroundColor: colors.primary.dark,
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  groupInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  groupIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary.light,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  groupDetails: {
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral.text,
  },
  groupDescription: {
    fontSize: 13,
    color: colors.neutral.textMuted,
    marginTop: 2,
  },
  memberCount: {
    fontSize: 12,
    color: colors.secondary.dark,
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.neutral.backgroundAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionPressed: {
    opacity: 0.7,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyContainer: {
    flexGrow: 1,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 16,
    color: colors.neutral.textMuted,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.neutral.text,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.neutral.textMuted,
    textAlign: 'center',
    maxWidth: 280,
  },
});
