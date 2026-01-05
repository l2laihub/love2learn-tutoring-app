/**
 * Admin Parent Management Screen
 * Manage parents, reset onboarding, and view status
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAdminParents, ParentWithAgreementStatus } from '../../src/hooks/useAdmin';
import { useResponsive } from '../../src/hooks/useResponsive';
import { colors, spacing, typography, borderRadius } from '../../src/theme';

// Layout constants for responsive design
const layoutConstants = {
  contentMaxWidth: 1200,
};

interface ParentCardProps {
  parent: ParentWithAgreementStatus;
  onResetOnboarding: () => void;
  isResetting: boolean;
}

function ParentCard({ parent, onResetOnboarding, isResetting }: ParentCardProps) {
  // Determine status
  const hasAccount = parent.userId !== null;
  const onboardingComplete = parent.onboardingCompletedAt !== null;
  const agreementSigned = parent.agreementSignedAt !== null;
  const invitationPending = parent.invitationSentAt !== null && !hasAccount;

  const getStatusInfo = () => {
    if (hasAccount && onboardingComplete && agreementSigned) {
      return { text: 'Fully Active', color: '#2E7D32', bg: '#E8F5E9', icon: 'checkmark-circle' as const };
    }
    if (hasAccount && agreementSigned && !onboardingComplete) {
      return { text: 'Onboarding Incomplete', color: '#F57C00', bg: '#FFF8E1', icon: 'time' as const };
    }
    if (hasAccount && !agreementSigned) {
      return { text: 'Pending Agreement', color: '#F57C00', bg: '#FFF8E1', icon: 'document-text' as const };
    }
    if (invitationPending) {
      return { text: 'Invitation Sent', color: '#1976D2', bg: '#E3F2FD', icon: 'mail' as const };
    }
    return { text: 'Not Invited', color: '#757575', bg: '#F5F5F5', icon: 'remove-circle' as const };
  };

  const status = getStatusInfo();
  const showResetButton = hasAccount && (onboardingComplete || agreementSigned);

  const handleResetPress = () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        `Reset onboarding for ${parent.name}?\n\nThis will:\n- Clear their onboarding progress\n- Revoke their signed agreement\n- Require them to sign a new agreement\n\nThis action cannot be undone.`
      );
      if (confirmed) {
        onResetOnboarding();
      }
    } else {
      Alert.alert(
        'Reset Onboarding',
        `Reset onboarding for ${parent.name}?\n\nThis will:\n• Clear their onboarding progress\n• Revoke their signed agreement\n• Require them to sign a new agreement\n\nThis action cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Reset',
            style: 'destructive',
            onPress: onResetOnboarding,
          },
        ]
      );
    }
  };

  return (
    <View style={styles.parentCard}>
      {/* Header */}
      <View style={styles.parentHeader}>
        <View style={styles.parentAvatar}>
          <Text style={styles.parentAvatarText}>
            {parent.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
          </Text>
        </View>
        <View style={styles.parentInfo}>
          <Text style={styles.parentName}>{parent.name}</Text>
          <Text style={styles.parentEmail}>{parent.email}</Text>
        </View>
      </View>

      {/* Status & Details */}
      <View style={styles.statusSection}>
        <View style={styles.statusRow}>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Ionicons name={status.icon} size={14} color={status.color} />
            <Text style={[styles.statusText, { color: status.color }]}>{status.text}</Text>
          </View>
          <Text style={styles.studentCount}>
            {parent.studentCount} student{parent.studentCount !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* Detail Pills */}
        <View style={styles.detailPills}>
          <View style={[styles.detailPill, hasAccount && styles.detailPillActive]}>
            <Ionicons
              name={hasAccount ? 'checkmark-circle' : 'close-circle'}
              size={12}
              color={hasAccount ? '#2E7D32' : '#9E9E9E'}
            />
            <Text style={[styles.detailPillText, hasAccount && styles.detailPillTextActive]}>
              Account
            </Text>
          </View>
          <View style={[styles.detailPill, onboardingComplete && styles.detailPillActive]}>
            <Ionicons
              name={onboardingComplete ? 'checkmark-circle' : 'close-circle'}
              size={12}
              color={onboardingComplete ? '#2E7D32' : '#9E9E9E'}
            />
            <Text style={[styles.detailPillText, onboardingComplete && styles.detailPillTextActive]}>
              Onboarded
            </Text>
          </View>
          <View style={[styles.detailPill, agreementSigned && styles.detailPillActive]}>
            <Ionicons
              name={agreementSigned ? 'checkmark-circle' : 'close-circle'}
              size={12}
              color={agreementSigned ? '#2E7D32' : '#9E9E9E'}
            />
            <Text style={[styles.detailPillText, agreementSigned && styles.detailPillTextActive]}>
              Agreement
            </Text>
          </View>
        </View>
      </View>

      {/* Actions */}
      {showResetButton && (
        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={[styles.resetButton, isResetting && styles.resetButtonDisabled]}
            onPress={handleResetPress}
            disabled={isResetting}
          >
            {isResetting ? (
              <ActivityIndicator size="small" color="#C62828" />
            ) : (
              <>
                <Ionicons name="refresh" size={16} color="#C62828" />
                <Text style={styles.resetButtonText}>Reset Onboarding</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function AdminParents() {
  const { parents, loading, error, actionLoading, refetch, resetOnboarding } = useAdminParents();
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [resettingParentId, setResettingParentId] = useState<string | null>(null);
  const responsive = useResponsive();

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleResetOnboarding = async (parentId: string, parentName: string) => {
    setResettingParentId(parentId);
    const success = await resetOnboarding(parentId, true);
    setResettingParentId(null);

    if (success) {
      if (Platform.OS === 'web') {
        window.alert(`Successfully reset onboarding for ${parentName}`);
      } else {
        Alert.alert('Success', `Successfully reset onboarding for ${parentName}`);
      }
    } else {
      if (Platform.OS === 'web') {
        window.alert('Failed to reset onboarding. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to reset onboarding. Please try again.');
      }
    }
  };

  // Filter parents based on search query
  const filteredParents = useMemo(() => {
    if (!searchQuery.trim()) return parents;

    const query = searchQuery.toLowerCase();
    return parents.filter(
      p => p.name.toLowerCase().includes(query) || p.email.toLowerCase().includes(query)
    );
  }, [parents, searchQuery]);

  // Stats
  const stats = useMemo(() => {
    return {
      total: parents.length,
      active: parents.filter(p => p.userId !== null).length,
      pending: parents.filter(p => p.userId === null).length,
      fullyOnboarded: parents.filter(
        p => p.userId !== null && p.onboardingCompletedAt !== null && p.agreementSignedAt !== null
      ).length,
    };
  }, [parents]);

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Text style={styles.loadingText}>Loading parents...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={colors.neutral.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search parents..."
            placeholderTextColor={colors.neutral.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={colors.neutral.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#2E7D32' }]}>{stats.active}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#F57C00' }]}>{stats.pending}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#1976D2' }]}>{stats.fullyOnboarded}</Text>
          <Text style={styles.statLabel}>Complete</Text>
        </View>
      </View>

      {/* Error Banner */}
      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={20} color="#C62828" />
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      )}

      {/* Parents List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            padding: responsive.contentPadding,
            maxWidth: layoutConstants.contentMaxWidth,
            alignSelf: 'center',
            width: '100%',
          },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {filteredParents.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color={colors.neutral.textMuted} />
            <Text style={styles.emptyStateTitle}>
              {searchQuery ? 'No Results' : 'No Parents'}
            </Text>
            <Text style={styles.emptyStateText}>
              {searchQuery
                ? `No parents found matching "${searchQuery}"`
                : 'No parents have been added yet.'}
            </Text>
          </View>
        ) : (
          filteredParents.map(parent => (
            <ParentCard
              key={parent.id}
              parent={parent}
              onResetOnboarding={() => handleResetOnboarding(parent.id, parent.name)}
              isResetting={resettingParentId === parent.id}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
  },
  searchContainer: {
    padding: spacing.md,
    backgroundColor: colors.neutral.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.sizes.base,
    color: colors.neutral.text,
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: colors.neutral.white,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
  },
  statLabel: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.neutral.border,
    marginHorizontal: spacing.sm,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    padding: spacing.md,
    gap: spacing.sm,
  },
  errorBannerText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: '#C62828',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing['3xl'],
  },
  emptyStateTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  emptyStateText: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
  },
  parentCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  parentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  parentAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E8F5F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  parentAvatarText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: '#3D9CA8',
  },
  parentInfo: {
    flex: 1,
  },
  parentName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  parentEmail: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginTop: 2,
  },
  statusSection: {
    marginBottom: spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    gap: 4,
  },
  statusText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  studentCount: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },
  detailPills: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  detailPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.background,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    gap: 4,
  },
  detailPillActive: {
    backgroundColor: '#E8F5E9',
  },
  detailPillText: {
    fontSize: typography.sizes.xs,
    color: '#9E9E9E',
  },
  detailPillTextActive: {
    color: '#2E7D32',
  },
  actionsSection: {
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
    paddingTop: spacing.md,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFEBEE',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  resetButtonDisabled: {
    opacity: 0.6,
  },
  resetButtonText: {
    fontSize: typography.sizes.sm,
    color: '#C62828',
    fontWeight: typography.weights.medium,
  },
});
