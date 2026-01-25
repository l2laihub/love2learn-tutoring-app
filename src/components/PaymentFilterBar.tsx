/**
 * PaymentFilterBar Component
 * Search, filter, and sort controls for the Payments screen
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import { SearchInput } from './ui/Input';
import { useResponsive } from '../hooks/useResponsive';

export type PaymentFilterStatus = 'all' | 'unpaid' | 'partial' | 'paid';
export type PaymentSortOption = 'name-asc' | 'name-desc' | 'amount-high' | 'amount-low' | 'status';

interface PaymentFilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filterStatus: PaymentFilterStatus;
  onFilterStatusChange: (status: PaymentFilterStatus) => void;
  sortOption: PaymentSortOption;
  onSortChange: (option: PaymentSortOption) => void;
  totalCount: number;
  filteredCount: number;
}

const STATUS_OPTIONS: { value: PaymentFilterStatus; label: string; color: string; bgColor: string }[] = [
  { value: 'all', label: 'All', color: colors.neutral.text, bgColor: colors.neutral.background },
  { value: 'unpaid', label: 'Unpaid', color: colors.status.error, bgColor: `${colors.status.error}15` },
  { value: 'partial', label: 'Partial', color: colors.status.warning, bgColor: `${colors.status.warning}15` },
  { value: 'paid', label: 'Paid', color: colors.status.success, bgColor: `${colors.status.success}15` },
];

const SORT_OPTIONS: { value: PaymentSortOption; label: string }[] = [
  { value: 'name-asc', label: 'Name (A-Z)' },
  { value: 'name-desc', label: 'Name (Z-A)' },
  { value: 'amount-high', label: 'Amount (High to Low)' },
  { value: 'amount-low', label: 'Amount (Low to High)' },
  { value: 'status', label: 'Status (Unpaid first)' },
];

export function PaymentFilterBar({
  searchQuery,
  onSearchChange,
  filterStatus,
  onFilterStatusChange,
  sortOption,
  onSortChange,
  totalCount,
  filteredCount,
}: PaymentFilterBarProps) {
  const { isMobile } = useResponsive();
  const [showSortModal, setShowSortModal] = useState(false);

  const currentSortLabel = SORT_OPTIONS.find(o => o.value === sortOption)?.label || 'Sort';
  const isFiltered = searchQuery.trim() !== '' || filterStatus !== 'all';

  return (
    <View style={[styles.container, isMobile && styles.containerMobile]}>
      {/* Search Row */}
      <View style={styles.searchRow}>
        <SearchInput
          value={searchQuery}
          onChangeText={onSearchChange}
          onClear={() => onSearchChange('')}
          placeholder="Search families..."
          containerStyle={styles.searchInput}
        />
      </View>

      {/* Filters Row */}
      <View style={[styles.filtersRow, isMobile && styles.filtersRowMobile]}>
        {/* Status Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.pillsContainer}
          contentContainerStyle={styles.pillsContent}
        >
          {STATUS_OPTIONS.map(option => {
            const isActive = filterStatus === option.value;
            return (
              <Pressable
                key={option.value}
                style={[
                  styles.statusPill,
                  isActive && { backgroundColor: option.bgColor, borderColor: option.color },
                ]}
                onPress={() => onFilterStatusChange(option.value)}
              >
                <Text
                  style={[
                    styles.statusPillText,
                    isActive && { color: option.color, fontWeight: typography.weights.semibold },
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Sort Button */}
        <Pressable
          style={styles.sortButton}
          onPress={() => setShowSortModal(true)}
        >
          <Ionicons name="swap-vertical" size={16} color={colors.neutral.textSecondary} />
          {!isMobile && (
            <Text style={styles.sortButtonText} numberOfLines={1}>
              {currentSortLabel}
            </Text>
          )}
          <Ionicons name="chevron-down" size={14} color={colors.neutral.textSecondary} />
        </Pressable>
      </View>

      {/* Result Count */}
      {isFiltered && (
        <View style={styles.resultRow}>
          <Text style={styles.resultCount}>
            Showing {filteredCount} of {totalCount} families
          </Text>
          <Pressable
            style={styles.clearButton}
            onPress={() => {
              onSearchChange('');
              onFilterStatusChange('all');
            }}
          >
            <Text style={styles.clearButtonText}>Clear filters</Text>
          </Pressable>
        </View>
      )}

      {/* Sort Modal */}
      <Modal
        visible={showSortModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSortModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowSortModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sort by</Text>
            {SORT_OPTIONS.map(option => {
              const isSelected = sortOption === option.value;
              return (
                <Pressable
                  key={option.value}
                  style={[styles.sortOption, isSelected && styles.sortOptionSelected]}
                  onPress={() => {
                    onSortChange(option.value);
                    setShowSortModal(false);
                  }}
                >
                  <Text
                    style={[
                      styles.sortOptionText,
                      isSelected && styles.sortOptionTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark" size={20} color={colors.piano.primary} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  containerMobile: {
    gap: spacing.xs,
  },
  searchRow: {
    flexDirection: 'row',
  },
  searchInput: {
    flex: 1,
    marginBottom: 0,
  },
  filtersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  filtersRowMobile: {
    gap: spacing.xs,
  },
  pillsContainer: {
    flex: 1,
  },
  pillsContent: {
    gap: spacing.xs,
    paddingRight: spacing.sm,
  },
  statusPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral.surface,
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  statusPillText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    fontWeight: typography.weights.medium,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral.surface,
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  sortButtonText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    maxWidth: 120,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
  },
  resultCount: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
  },
  clearButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  clearButtonText: {
    fontSize: typography.sizes.sm,
    color: colors.piano.primary,
    fontWeight: typography.weights.medium,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 300,
    ...shadows.lg,
  },
  modalTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginBottom: spacing.md,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
  },
  sortOptionSelected: {
    backgroundColor: `${colors.piano.primary}10`,
  },
  sortOptionText: {
    fontSize: typography.sizes.base,
    color: colors.neutral.text,
  },
  sortOptionTextSelected: {
    color: colors.piano.primary,
    fontWeight: typography.weights.medium,
  },
});

export default PaymentFilterBar;
