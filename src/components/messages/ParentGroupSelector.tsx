/**
 * ParentGroupSelector Component
 * Dropdown/modal to select "All Parents" or a saved group
 */

import React, { useState } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  Text,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../theme';
import { ParentGroupWithMembers, MessageRecipientType } from '../../types/messages';

interface Selection {
  type: MessageRecipientType;
  groupId?: string;
  groupName?: string;
}

interface ParentGroupSelectorProps {
  groups: ParentGroupWithMembers[];
  selected: Selection;
  onSelect: (selection: Selection) => void;
  disabled?: boolean;
}

export function ParentGroupSelector({
  groups,
  selected,
  onSelect,
  disabled = false,
}: ParentGroupSelectorProps) {
  const [showModal, setShowModal] = useState(false);

  const handleSelect = (selection: Selection) => {
    onSelect(selection);
    setShowModal(false);
  };

  const displayText =
    selected.type === 'all'
      ? 'All Parents'
      : selected.groupName || 'Select Group';

  return (
    <>
      <Pressable
        onPress={() => !disabled && setShowModal(true)}
        disabled={disabled}
        style={({ pressed }) => [
          styles.selector,
          pressed && styles.pressed,
          disabled && styles.disabled,
        ]}
      >
        <View style={styles.selectorContent}>
          <Ionicons
            name={selected.type === 'all' ? 'people' : 'people-circle'}
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
            <Text style={styles.modalTitle}>Send To</Text>
            <Pressable
              onPress={() => setShowModal(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color={colors.neutral.text} />
            </Pressable>
          </View>

          {/* Options */}
          <FlatList
            data={[
              { type: 'all' as const, label: 'All Parents', icon: 'people' as const },
              ...groups.map((g) => ({
                type: 'group' as const,
                groupId: g.id,
                label: g.name,
                memberCount: g.member_count,
                icon: 'people-circle' as const,
              })),
            ]}
            keyExtractor={(item) => item.type === 'all' ? 'all' : item.groupId!}
            renderItem={({ item }) => {
              const isSelected =
                item.type === 'all'
                  ? selected.type === 'all'
                  : selected.groupId === item.groupId;

              return (
                <Pressable
                  onPress={() =>
                    handleSelect(
                      item.type === 'all'
                        ? { type: 'all' }
                        : {
                            type: 'group',
                            groupId: item.groupId,
                            groupName: item.label,
                          }
                    )
                  }
                  style={({ pressed }) => [
                    styles.optionItem,
                    isSelected && styles.selectedOption,
                    pressed && styles.optionPressed,
                  ]}
                >
                  <View style={styles.optionContent}>
                    <Ionicons
                      name={item.icon}
                      size={24}
                      color={isSelected ? colors.primary.main : colors.neutral.text}
                    />
                    <View style={styles.optionText}>
                      <Text
                        style={[
                          styles.optionLabel,
                          isSelected && styles.selectedLabel,
                        ]}
                      >
                        {item.label}
                      </Text>
                      {item.type === 'group' && (
                        <Text style={styles.memberCount}>
                          {item.memberCount} member{item.memberCount !== 1 ? 's' : ''}
                        </Text>
                      )}
                    </View>
                  </View>
                  {isSelected && (
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color={colors.primary.main}
                    />
                  )}
                </Pressable>
              );
            }}
            ListFooterComponent={
              <Text style={styles.hint}>
                Select "All Parents" to send to everyone, or choose a specific group.
              </Text>
            }
          />
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
    backgroundColor: colors.neutral.backgroundAlt,
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
  closeButton: {
    padding: spacing.xs,
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
    backgroundColor: colors.neutral.backgroundAlt,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
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
  hint: {
    padding: spacing.lg,
    fontSize: 14,
    color: colors.neutral.textMuted,
    textAlign: 'center',
  },
});
