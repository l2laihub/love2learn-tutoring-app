/**
 * ParentGroupSelector Component
 * Dropdown/modal to select "All Parents", a saved group, or individual parents
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  Text,
  Modal,
  FlatList,
  TextInput,
  SectionList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../theme';
import { ParentGroupWithMembers, MessageRecipientType } from '../../types/messages';
import { Parent, ParentWithStudents } from '../../types/database';

export interface Selection {
  type: MessageRecipientType;
  groupId?: string;
  groupName?: string;
  parentIds?: string[];
  parentNames?: string[];
}

interface ParentGroupSelectorProps {
  groups: ParentGroupWithMembers[];
  parents: ParentWithStudents[];
  selected: Selection;
  onSelect: (selection: Selection) => void;
  disabled?: boolean;
}

export function ParentGroupSelector({
  groups,
  parents,
  selected,
  onSelect,
  disabled = false,
}: ParentGroupSelectorProps) {
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingParentIds, setPendingParentIds] = useState<Set<string>>(new Set());

  // Filter to only show parents with role 'parent' (not tutor)
  const parentList = useMemo(() => {
    return parents.filter(p => p.role === 'parent');
  }, [parents]);

  // Filter parents based on search query
  const filteredParents = useMemo(() => {
    if (!searchQuery.trim()) return parentList;
    const query = searchQuery.toLowerCase();
    return parentList.filter(p =>
      p.name.toLowerCase().includes(query) ||
      p.email.toLowerCase().includes(query)
    );
  }, [parentList, searchQuery]);

  // Initialize pending selection when modal opens
  const openModal = () => {
    if (selected.type === 'parent' && selected.parentIds) {
      setPendingParentIds(new Set(selected.parentIds));
    } else {
      setPendingParentIds(new Set());
    }
    setSearchQuery('');
    setShowModal(true);
  };

  const handleSelectAll = () => {
    onSelect({ type: 'all' });
    setShowModal(false);
  };

  const handleSelectGroup = (groupId: string, groupName: string) => {
    onSelect({ type: 'group', groupId, groupName });
    setShowModal(false);
  };

  const handleToggleParent = (parentId: string) => {
    setPendingParentIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(parentId)) {
        newSet.delete(parentId);
      } else {
        newSet.add(parentId);
      }
      return newSet;
    });
  };

  const handleConfirmParentSelection = () => {
    if (pendingParentIds.size === 0) return;

    const selectedParents = parentList.filter(p => pendingParentIds.has(p.id));
    const parentNames = selectedParents.map(p => p.name);

    onSelect({
      type: 'parent',
      parentIds: Array.from(pendingParentIds),
      parentNames,
    });
    setShowModal(false);
  };

  // Compute display text for the selector button
  const displayText = useMemo(() => {
    if (selected.type === 'all') {
      return 'All Parents';
    } else if (selected.type === 'group') {
      return selected.groupName || 'Select Group';
    } else if (selected.type === 'parent' && selected.parentIds?.length) {
      const count = selected.parentIds.length;
      if (count === 1 && selected.parentNames?.[0]) {
        return selected.parentNames[0];
      }
      return `${count} parent${count > 1 ? 's' : ''} selected`;
    }
    return 'Select Recipients';
  }, [selected]);

  const getIcon = () => {
    if (selected.type === 'all') return 'people';
    if (selected.type === 'group') return 'people-circle';
    return 'person';
  };

  return (
    <>
      <Pressable
        onPress={() => !disabled && openModal()}
        disabled={disabled}
        style={({ pressed }) => [
          styles.selector,
          pressed && styles.pressed,
          disabled && styles.disabled,
        ]}
      >
        <View style={styles.selectorContent}>
          <Ionicons
            name={getIcon()}
            size={20}
            color={colors.primary.main}
          />
          <Text style={styles.selectorText}>{displayText}</Text>
        </View>
        <Ionicons
          name="chevron-down"
          size={20}
          color={colors.neutral.textMuted}
        />
      </Pressable>

      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Pressable
              onPress={() => setShowModal(false)}
              style={styles.headerButton}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Text style={styles.modalTitle}>Send To</Text>
            {pendingParentIds.size > 0 ? (
              <Pressable
                onPress={handleConfirmParentSelection}
                style={styles.headerButton}
              >
                <Text style={styles.doneText}>Done ({pendingParentIds.size})</Text>
              </Pressable>
            ) : (
              <View style={styles.headerButton} />
            )}
          </View>

          {/* All Parents Option */}
          <Pressable
            onPress={handleSelectAll}
            style={({ pressed }) => [
              styles.optionItem,
              selected.type === 'all' && styles.selectedOption,
              pressed && styles.optionPressed,
            ]}
          >
            <View style={styles.optionContent}>
              <Ionicons
                name="people"
                size={24}
                color={selected.type === 'all' ? colors.primary.main : colors.neutral.text}
              />
              <View style={styles.optionText}>
                <Text
                  style={[
                    styles.optionLabel,
                    selected.type === 'all' && styles.selectedLabel,
                  ]}
                >
                  All Parents
                </Text>
                <Text style={styles.memberCount}>
                  Send to everyone ({parentList.length})
                </Text>
              </View>
            </View>
            {selected.type === 'all' && (
              <Ionicons name="checkmark-circle" size={24} color={colors.primary.main} />
            )}
          </Pressable>

          {/* Groups Section */}
          {groups.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Groups</Text>
              </View>
              {groups.map((group) => {
                const isSelected = selected.type === 'group' && selected.groupId === group.id;
                return (
                  <Pressable
                    key={group.id}
                    onPress={() => handleSelectGroup(group.id, group.name)}
                    style={({ pressed }) => [
                      styles.optionItem,
                      isSelected && styles.selectedOption,
                      pressed && styles.optionPressed,
                    ]}
                  >
                    <View style={styles.optionContent}>
                      <Ionicons
                        name="people-circle"
                        size={24}
                        color={isSelected ? colors.primary.main : colors.neutral.text}
                      />
                      <View style={styles.optionText}>
                        <Text style={[styles.optionLabel, isSelected && styles.selectedLabel]}>
                          {group.name}
                        </Text>
                        <Text style={styles.memberCount}>
                          {group.member_count || 0} member{(group.member_count || 0) !== 1 ? 's' : ''}
                        </Text>
                      </View>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={24} color={colors.primary.main} />
                    )}
                  </Pressable>
                );
              })}
            </>
          )}

          {/* Individual Parents Section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Individual Parents</Text>
          </View>

          {/* Search Input */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color={colors.neutral.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by name or email..."
              placeholderTextColor={colors.neutral.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={colors.neutral.textMuted} />
              </Pressable>
            )}
          </View>

          {/* Parent List */}
          <FlatList
            data={filteredParents}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const isChecked = pendingParentIds.has(item.id);
              const studentCount = item.students?.length || 0;
              return (
                <Pressable
                  onPress={() => handleToggleParent(item.id)}
                  style={({ pressed }) => [
                    styles.parentItem,
                    isChecked && styles.parentItemSelected,
                    pressed && styles.optionPressed,
                  ]}
                >
                  <View style={styles.checkbox}>
                    {isChecked ? (
                      <Ionicons name="checkbox" size={24} color={colors.primary.main} />
                    ) : (
                      <Ionicons name="square-outline" size={24} color={colors.neutral.border} />
                    )}
                  </View>
                  <View style={styles.parentInfo}>
                    <Text style={[styles.parentName, isChecked && styles.selectedLabel]}>
                      {item.name}
                    </Text>
                    <Text style={styles.parentEmail}>{item.email}</Text>
                    {studentCount > 0 && (
                      <Text style={styles.studentCount}>
                        {studentCount} student{studentCount !== 1 ? 's' : ''}
                      </Text>
                    )}
                  </View>
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  {searchQuery ? 'No parents match your search' : 'No parents available'}
                </Text>
              </View>
            }
            contentContainerStyle={styles.listContent}
          />

          {/* Hint */}
          <View style={styles.hintContainer}>
            <Text style={styles.hint}>
              Select individual parents to message specific families, or choose "All Parents" or a group.
            </Text>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: colors.neutral.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  pressed: {
    backgroundColor: colors.neutral.border,
  },
  disabled: {
    opacity: 0.5,
  },
  selectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  selectorText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.neutral.text,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.neutral.white,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.neutral.text,
  },
  headerButton: {
    minWidth: 70,
  },
  cancelText: {
    fontSize: 16,
    color: colors.neutral.textMuted,
  },
  doneText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary.main,
    textAlign: 'right',
  },
  sectionHeader: {
    backgroundColor: colors.neutral.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.neutral.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  selectedOption: {
    backgroundColor: colors.primary.light + '20',
  },
  optionPressed: {
    backgroundColor: colors.neutral.background,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  optionText: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.neutral.text,
  },
  selectedLabel: {
    color: colors.primary.main,
  },
  memberCount: {
    fontSize: 13,
    color: colors.neutral.textMuted,
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.background,
    margin: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.neutral.text,
    paddingVertical: spacing.xs,
  },
  parentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
    gap: spacing.md,
  },
  parentItemSelected: {
    backgroundColor: colors.primary.light + '10',
  },
  checkbox: {
    width: 24,
  },
  parentInfo: {
    flex: 1,
  },
  parentName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.neutral.text,
  },
  parentEmail: {
    fontSize: 13,
    color: colors.neutral.textMuted,
    marginTop: 2,
  },
  studentCount: {
    fontSize: 12,
    color: colors.neutral.textSecondary,
    marginTop: 2,
  },
  listContent: {
    flexGrow: 1,
  },
  emptyState: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.neutral.textMuted,
    textAlign: 'center',
  },
  hintContainer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
    backgroundColor: colors.neutral.background,
  },
  hint: {
    fontSize: 13,
    color: colors.neutral.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
