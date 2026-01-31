/**
 * Settings Index Screen
 * Main settings page for tutors with navigation to sub-settings
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../../../src/theme';
import { useSubscription } from '../../../src/hooks/useSubscription';

type IoniconsName = keyof typeof Ionicons.glyphMap;

interface SettingsItemProps {
  icon: IoniconsName;
  iconColor?: string;
  iconBgColor?: string;
  label: string;
  description?: string;
  value?: string;
  badge?: {
    label: string;
    color: string;
    bgColor: string;
  };
  onPress: () => void;
}

function SettingsItem({
  icon,
  iconColor = colors.primary.main,
  iconBgColor = colors.primary.subtle,
  label,
  description,
  value,
  badge,
  onPress,
}: SettingsItemProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.settingsItem,
        pressed && styles.settingsItemPressed,
      ]}
      onPress={onPress}
    >
      <View style={[styles.settingsIcon, { backgroundColor: iconBgColor }]}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      <View style={styles.settingsContent}>
        <View style={styles.settingsLabelRow}>
          <Text style={styles.settingsLabel}>{label}</Text>
          {badge && (
            <View style={[styles.badge, { backgroundColor: badge.bgColor }]}>
              <Text style={[styles.badgeText, { color: badge.color }]}>
                {badge.label}
              </Text>
            </View>
          )}
        </View>
        {description && (
          <Text style={styles.settingsDescription}>{description}</Text>
        )}
        {value && (
          <Text style={styles.settingsValue}>{value}</Text>
        )}
      </View>
      <Ionicons
        name="chevron-forward"
        size={20}
        color={colors.neutral.textMuted}
      />
    </Pressable>
  );
}

export default function SettingsIndexScreen() {
  const {
    subscription,
    loading,
    isTrial,
    isActive,
    statusDisplay,
    statusColors,
    trialDaysRemaining,
  } = useSubscription();

  // Build subscription status display
  const getSubscriptionValue = () => {
    if (loading) return 'Loading...';
    if (!subscription?.plan) return 'No subscription';

    const planName = subscription.plan === 'pro' ? 'Pro' : 'Solo';
    if (isTrial) {
      return `${planName} (${trialDaysRemaining} days left in trial)`;
    }
    return `${planName} - ${statusDisplay}`;
  };

  const getSubscriptionBadge = () => {
    if (loading || !subscription?.status) return undefined;
    return {
      label: statusDisplay,
      color: statusColors.text,
      bgColor: statusColors.background,
    };
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Subscription & Billing Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subscription & Billing</Text>
          <View style={styles.card}>
            <SettingsItem
              icon="card"
              iconColor={colors.secondary.main}
              iconBgColor={colors.secondary.subtle}
              label="Subscription"
              description="Manage your plan, billing, and invoices"
              badge={getSubscriptionBadge()}
              onPress={() => router.push('/(tabs)/settings/subscription')}
            />
          </View>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            <SettingsItem
              icon="person"
              label="Profile"
              description="Update your profile information"
              onPress={() => router.push('/profile')}
            />
            <View style={styles.divider} />
            <SettingsItem
              icon="time"
              iconColor={colors.status.info}
              iconBgColor={colors.status.infoBg}
              label="Availability"
              description="Set your available time slots"
              onPress={() => router.push('/availability')}
            />
          </View>
        </View>

        {/* Business Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Business</Text>
          <View style={styles.card}>
            <SettingsItem
              icon="document-text"
              iconColor={colors.status.success}
              iconBgColor={colors.status.successBg}
              label="Agreement Templates"
              description="Create and manage parent agreements"
              onPress={() => router.push('/admin/templates')}
            />
            <View style={styles.divider} />
            <SettingsItem
              icon="people"
              iconColor={colors.accent.main}
              iconBgColor={colors.accent.subtle}
              label="Parent Management"
              description="Manage parent accounts and agreements"
              onPress={() => router.push('/admin/parents')}
            />
          </View>
        </View>

        {/* Help Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Help & Support</Text>
          <View style={styles.card}>
            <SettingsItem
              icon="help-circle"
              iconColor={colors.status.info}
              iconBgColor={colors.status.infoBg}
              label="Help Center"
              description="FAQs and documentation"
              onPress={() => {
                // TODO: Implement help center navigation
              }}
            />
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
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
    marginLeft: spacing.xs,
  },
  card: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
    overflow: 'hidden',
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.neutral.white,
  },
  settingsItemPressed: {
    backgroundColor: colors.neutral.background,
  },
  settingsIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  settingsContent: {
    flex: 1,
    marginRight: spacing.sm,
  },
  settingsLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  settingsLabel: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  settingsDescription: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginTop: 2,
  },
  settingsValue: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: colors.neutral.border,
    marginLeft: 44 + spacing.md + spacing.md,
  },
  badge: {
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
  },
  badgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
});
