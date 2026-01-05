/**
 * Admin Dashboard Screen
 * Overview of key metrics and quick actions
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAdminDashboard } from '../../src/hooks/useAdmin';
import { useResponsive } from '../../src/hooks/useResponsive';
import { colors, spacing, typography, borderRadius } from '../../src/theme';

// Layout constants for responsive design
const layoutConstants = {
  contentMaxWidth: 1200,
};

type IoniconsName = keyof typeof Ionicons.glyphMap;

interface StatCardProps {
  title: string;
  value: number;
  icon: IoniconsName;
  color: string;
  bgColor: string;
  onPress?: () => void;
}

function StatCard({ title, value, icon, color, bgColor, onPress }: StatCardProps) {
  return (
    <TouchableOpacity
      style={[styles.statCard, { borderLeftColor: color }]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={[styles.statIconContainer, { backgroundColor: bgColor }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <View style={styles.statContent}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statTitle}>{title}</Text>
      </View>
      {onPress && (
        <Ionicons name="chevron-forward" size={20} color={colors.neutral.textMuted} />
      )}
    </TouchableOpacity>
  );
}

interface QuickActionProps {
  title: string;
  description: string;
  icon: IoniconsName;
  color: string;
  onPress: () => void;
}

function QuickAction({ title, description, icon, color, onPress }: QuickActionProps) {
  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress}>
      <View style={[styles.quickActionIcon, { backgroundColor: color }]}>
        <Ionicons name={icon} size={20} color="#FFFFFF" />
      </View>
      <View style={styles.quickActionContent}>
        <Text style={styles.quickActionTitle}>{title}</Text>
        <Text style={styles.quickActionDescription}>{description}</Text>
      </View>
      <Ionicons name="arrow-forward" size={18} color={color} />
    </TouchableOpacity>
  );
}

export default function AdminDashboard() {
  const { stats, loading, error, refetch } = useAdminDashboard();
  const [refreshing, setRefreshing] = React.useState(false);
  const responsive = useResponsive();

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={colors.status.error} />
          <Text style={styles.errorTitle}>Error Loading Dashboard</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={refetch}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
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
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Admin Overview</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.push('/(tabs)')}
          >
            <Ionicons name="arrow-back" size={20} color={colors.primary.main} />
            <Text style={styles.backButtonText}>Back to App</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>At a Glance</Text>
          <View style={[
            styles.statsGrid,
            responsive.isDesktop && styles.statsGridDesktop,
          ]}>
            <StatCard
              title="Total Parents"
              value={stats?.totalParents || 0}
              icon="people"
              color="#3D9CA8"
              bgColor="#E8F5F7"
              onPress={() => router.push('/admin/parents')}
            />
            <StatCard
              title="Active Accounts"
              value={stats?.activeParents || 0}
              icon="checkmark-circle"
              color="#7CB342"
              bgColor="#E8F5E9"
            />
            <StatCard
              title="Signed Agreements"
              value={stats?.signedAgreements || 0}
              icon="document-text"
              color="#7CB342"
              bgColor="#E8F5E9"
              onPress={() => router.push('/admin/agreements')}
            />
            <StatCard
              title="Pending Agreements"
              value={stats?.pendingAgreements || 0}
              icon="time"
              color="#FFA726"
              bgColor="#FFF8E1"
              onPress={() => router.push('/admin/agreements')}
            />
            <StatCard
              title="Total Students"
              value={stats?.totalStudents || 0}
              icon="school"
              color="#5C6BC0"
              bgColor="#E8EAF6"
            />
            <StatCard
              title="Pending Invitations"
              value={stats?.pendingInvitations || 0}
              icon="mail"
              color="#FF6B6B"
              bgColor="#FFEBEE"
            />
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={[
            styles.quickActions,
            responsive.isDesktop && styles.quickActionsDesktop,
          ]}>
            <QuickAction
              title="View Agreements"
              description="Review signed parent agreements"
              icon="document-text"
              color="#3D9CA8"
              onPress={() => router.push('/admin/agreements')}
            />
            <QuickAction
              title="Manage Parents"
              description="Reset onboarding, resend invitations"
              icon="people"
              color="#7CB342"
              onPress={() => router.push('/admin/parents')}
            />
            <QuickAction
              title="Edit Templates"
              description="Modify agreement content"
              icon="create"
              color="#FF6B6B"
              onPress={() => router.push('/admin/templates')}
            />
          </View>
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color="#3D9CA8" />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Admin Panel</Text>
            <Text style={styles.infoText}>
              Use this panel to manage parent agreements, reset onboarding status,
              and customize agreement templates. Changes made here will affect the
              parent experience.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing['3xl'],
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  errorTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  errorText: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  retryButton: {
    backgroundColor: colors.primary.main,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  retryButtonText: {
    color: colors.neutral.white,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  headerTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  backButtonText: {
    fontSize: typography.sizes.sm,
    color: colors.primary.main,
    fontWeight: typography.weights.medium,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginBottom: spacing.md,
  },
  statsGrid: {
    gap: spacing.md,
  },
  statsGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    minWidth: '48%',
    flex: 1,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
  },
  statTitle: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginTop: 2,
  },
  quickActions: {
    gap: spacing.md,
  },
  quickActionsDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    minWidth: '30%',
    flex: 1,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  quickActionContent: {
    flex: 1,
  },
  quickActionTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  quickActionDescription: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginTop: 2,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#E8F5F7',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderLeftWidth: 4,
    borderLeftColor: '#3D9CA8',
  },
  infoContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  infoTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: '#2D7A84',
    marginBottom: spacing.xs,
  },
  infoText: {
    fontSize: typography.sizes.sm,
    color: '#4A6572',
    lineHeight: 20,
  },
});
