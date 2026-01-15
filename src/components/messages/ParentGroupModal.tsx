/**
 * ParentGroupModal Component
 * Modal for creating/editing parent groups
 */

import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../theme';
import {
  useParentsForGroupSelection,
  useCreateParentGroup,
  useUpdateParentGroup,
} from '../../hooks';
import { ParentGroupWithMembers } from '../../types/messages';
import { Parent } from '../../types/database';

interface ParentGroupModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  editGroup?: ParentGroupWithMembers | null; // If provided, edit mode
}

export function ParentGroupModal({
  visible,
  onClose,
  onSuccess,
  editGroup,
}: ParentGroupModalProps) {
  const { parents, loading: loadingParents } = useParentsForGroupSelection();
  const { mutate: createGroup, loading: creating } = useCreateParentGroup();
  const { mutate: updateGroup, loading: updating } = useUpdateParentGroup();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedParentIds, setSelectedParentIds] = useState<Set<string>>(new Set());

  const isEditMode = !!editGroup;
  const isLoading = creating || updating;

  // Initialize form when editing
  useEffect(() => {
    if (editGroup) {
      setName(editGroup.name);
      setDescription(editGroup.description || '');
      setSelectedParentIds(new Set(editGroup.members.map((m) => m.id)));
    } else {
      setName('');
      setDescription('');
      setSelectedParentIds(new Set());
    }
  }, [editGroup, visible]);

  const canSave = name.trim().length > 0 && selectedParentIds.size > 0;

  const handleClose = useCallback(() => {
    setName('');
    setDescription('');
    setSelectedParentIds(new Set());
    onClose();
  }, [onClose]);

  const toggleParent = useCallback((parentId: string) => {
    setSelectedParentIds((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) {
        next.delete(parentId);
      } else {
        next.add(parentId);
      }
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!canSave) return;

    try {
      const memberIds = Array.from(selectedParentIds);

      if (isEditMode && editGroup) {
        await updateGroup(editGroup.id, {
          name: name.trim(),
          description: description.trim() || null,
          member_ids: memberIds,
        });
        Alert.alert('Success', 'Group updated successfully!');
      } else {
        await createGroup({
          name: name.trim(),
          description: description.trim() || null,
          member_ids: memberIds,
        });
        Alert.alert('Success', 'Group created successfully!');
      }

      handleClose();
      onSuccess?.();
    } catch (error) {
      console.error('Error saving group:', error);
      Alert.alert('Error', 'Failed to save group. Please try again.');
    }
  }, [canSave, isEditMode, editGroup, name, description, selectedParentIds, createGroup, updateGroup, handleClose, onSuccess]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleClose} disabled={isLoading}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Text style={styles.title}>
            {isEditMode ? 'Edit Group' : 'New Group'}
          </Text>
          <Pressable
            onPress={handleSave}
            disabled={!canSave || isLoading}
            style={({ pressed }) => [
              styles.saveButton,
              (!canSave || isLoading) && styles.saveButtonDisabled,
              pressed && canSave && !isLoading && styles.saveButtonPressed,
            ]}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.neutral.textInverse} />
            ) : (
              <Text
                style={[
                  styles.saveText,
                  (!canSave || isLoading) && styles.saveTextDisabled,
                ]}
              >
                Save
              </Text>
            )}
          </Pressable>
        </View>

        <ScrollView style={styles.content}>
          {/* Name */}
          <View style={styles.section}>
            <Text style={styles.label}>Group Name *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g., Piano Students, Monday Class"
              placeholderTextColor={colors.neutral.textMuted}
              maxLength={50}
              editable={!isLoading}
            />
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.label}>Description (Optional)</Text>
            <TextInput
              style={[styles.input, styles.descriptionInput]}
              value={description}
              onChangeText={setDescription}
              placeholder="Add a description..."
              placeholderTextColor={colors.neutral.textMuted}
              multiline
              maxLength={200}
              editable={!isLoading}
            />
          </View>

          {/* Select Parents */}
          <View style={styles.section}>
            <Text style={styles.label}>
              Select Parents * ({selectedParentIds.size} selected)
            </Text>

            {loadingParents ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.primary.main} />
                <Text style={styles.loadingText}>Loading parents...</Text>
              </View>
            ) : parents.length === 0 ? (
              <Text style={styles.emptyText}>No parents available</Text>
            ) : (
              <View style={styles.parentList}>
                {parents.map((parent) => {
                  const isSelected = selectedParentIds.has(parent.id);
                  return (
                    <Pressable
                      key={parent.id}
                      onPress={() => toggleParent(parent.id)}
                      disabled={isLoading}
                      style={({ pressed }) => [
                        styles.parentItem,
                        isSelected && styles.parentItemSelected,
                        pressed && styles.parentItemPressed,
                      ]}
                    >
                      <View style={styles.parentInfo}>
                        <View
                          style={[
                            styles.avatar,
                            isSelected && styles.avatarSelected,
                          ]}
                        >
                          <Text style={styles.avatarText}>
                            {parent.name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View>
                          <Text style={styles.parentName}>{parent.name}</Text>
                          <Text style={styles.parentEmail}>{parent.email}</Text>
                        </View>
                      </View>
                      <Ionicons
                        name={isSelected ? 'checkbox' : 'square-outline'}
                        size={24}
                        color={isSelected ? colors.primary.main : colors.neutral.textMuted}
                      />
                    </Pressable>
                  );
                })}
              </View>
            )}
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
  cancelText: {
    fontSize: 16,
    color: colors.neutral.textMuted,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.neutral.text,
  },
  saveButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary.main,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: colors.neutral.backgroundAlt,
  },
  saveButtonPressed: {
    backgroundColor: colors.primary.dark,
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral.textInverse,
  },
  saveTextDisabled: {
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
  input: {
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: 16,
    color: colors.neutral.text,
    backgroundColor: colors.neutral.white,
  },
  descriptionInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  loadingText: {
    marginLeft: spacing.sm,
    fontSize: 14,
    color: colors.neutral.textMuted,
  },
  emptyText: {
    padding: spacing.md,
    fontSize: 14,
    color: colors.neutral.textMuted,
    fontStyle: 'italic',
  },
  parentList: {
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  parentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  parentItemSelected: {
    backgroundColor: colors.primary.light + '20',
  },
  parentItemPressed: {
    backgroundColor: colors.neutral.backgroundAlt,
  },
  parentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.secondary.light,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  avatarSelected: {
    backgroundColor: colors.primary.main,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral.textInverse,
  },
  parentName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.neutral.text,
  },
  parentEmail: {
    fontSize: 13,
    color: colors.neutral.textMuted,
  },
});
