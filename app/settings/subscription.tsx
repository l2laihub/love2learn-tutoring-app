/**
 * Subscription Settings Screen
 * View subscription plan details and billing information
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../../src/theme';
import { useSubscription } from '../../src/hooks/useSubscription';
import { useResponsive } from '../../src/hooks/useResponsive';

export default function SubscriptionSettingsScreen() {
  const { subscription, loading, error, refresh, isActive, isTrial, trialDaysRemaining } = useSubscription();
  const { isDesktop } = useResponsive();

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Text style={styles.loadingText}>Loading subscription...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Determine subscription status
  const isPastDue = subscription?.status === 'past_due';
  const isCancelled = subscription?.status === 'cancelled' || subscription?.status === 'expired';

  // Format dates
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Trial days remaining is already provided by the hook

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          isDesktop && styles.scrollContentDesktop,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Card */}
        <View style={styles.statusCard}>
          <View style={[
            styles.statusBadge,
            isActive && styles.statusBadgeActive,
            isPastDue && styles.statusBadgePastDue,
            isCancelled && styles.statusBadgeCanceled,
          ]}>
            <Ionicons
              name={isActive ? 'checkmark-circle' : isPastDue ? 'alert-circle' : 'close-circle'}
              size={20}
              color={colors.neutral.white}
            />
            <Text style={styles.statusBadgeText}>
              {isTrial ? 'Trial' : isActive ? 'Active' : isPastDue ? 'Past Due' : 'Inactive'}
            </Text>
          </View>

          <Text style={styles.planName}>
            {subscription?.plan || 'Love2Learn Pro'}
          </Text>

          {isTrial && (
            <View style={styles.trialInfo}>
              <Ionicons name="time-outline" size={18} color={colors.status.warning} />
              <Text style={styles.trialInfoText}>
                {trialDaysRemaining} {trialDaysRemaining === 1 ? 'day' : 'days'} remaining in trial
              </Text>
            </View>
          )}
        </View>

        {/* Plan Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Plan Details</Text>

          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="ribbon-outline" size={20} color={colors.primary.main} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Current Plan</Text>
                <Text style={styles.detailValue}>
                  {subscription?.plan === 'solo' ? 'Solo Tutor' : subscription?.plan === 'pro' ? 'Pro' : 'Free Trial'}
                </Text>
              </View>
            </View>

            <View style={styles.detailDivider} />

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="calendar-outline" size={20} color={colors.primary.main} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>{isTrial ? 'Trial Ends' : 'Subscription Status'}</Text>
                <Text style={styles.detailValue}>
                  {isTrial && subscription?.trialEndsAt
                    ? formatDate(subscription.trialEndsAt.toISOString())
                    : subscription?.subscriptionEndsAt
                      ? `Renews ${formatDate(subscription.subscriptionEndsAt.toISOString())}`
                      : isActive ? 'Active' : 'Inactive'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Features */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Included Features</Text>

          <View style={styles.featuresCard}>
            {[
              { icon: 'people', label: 'Unlimited Students' },
              { icon: 'calendar', label: 'Calendar & Scheduling' },
              { icon: 'card', label: 'Payment Tracking' },
              { icon: 'chatbubbles', label: 'Parent Messaging' },
              { icon: 'document-text', label: 'Worksheet Generator' },
              { icon: 'folder-open', label: 'Resource Sharing' },
              { icon: 'notifications', label: 'Email Notifications' },
              { icon: 'shield-checkmark', label: 'Parent Agreements' },
            ].map((feature, index) => (
              <View key={feature.label} style={styles.featureRow}>
                <Ionicons
                  name={feature.icon as any}
                  size={20}
                  color={colors.status.success}
                />
                <Text style={styles.featureLabel}>{feature.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Manage Subscription */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Manage Subscription</Text>

          <View style={styles.manageCard}>
            <Pressable style={styles.manageButton}>
              <Ionicons name="card-outline" size={20} color={colors.primary.main} />
              <Text style={styles.manageButtonText}>Update Payment Method</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.neutral.textMuted} />
            </Pressable>

            <View style={styles.manageDivider} />

            <Pressable style={styles.manageButton}>
              <Ionicons name="receipt-outline" size={20} color={colors.primary.main} />
              <Text style={styles.manageButtonText}>View Billing History</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.neutral.textMuted} />
            </Pressable>

            <View style={styles.manageDivider} />

            <Pressable style={styles.manageButton}>
              <Ionicons name="help-circle-outline" size={20} color={colors.primary.main} />
              <Text style={styles.manageButtonText}>Contact Support</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.neutral.textMuted} />
            </Pressable>
          </View>
        </View>

        {/* Info Note */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color={colors.primary.main} />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Need Help?</Text>
            <Text style={styles.infoText}>
              If you have any questions about your subscription or need assistance,
              please contact our support team.
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
  scrollContentDesktop: {
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
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
  statusCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral.textMuted,
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  statusBadgeActive: {
    backgroundColor: colors.status.success,
  },
  statusBadgePastDue: {
    backgroundColor: colors.status.warning,
  },
  statusBadgeCanceled: {
    backgroundColor: colors.status.error,
  },
  statusBadgeText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
  },
  planName: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
    marginBottom: spacing.sm,
  },
  trialInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.status.warningBg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  trialInfoText: {
    fontSize: typography.sizes.sm,
    color: colors.status.warning,
    fontWeight: typography.weights.medium,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginBottom: spacing.md,
  },
  detailCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  detailIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },
  detailValue: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
    marginTop: 2,
  },
  detailDivider: {
    height: 1,
    backgroundColor: colors.neutral.border,
    marginVertical: spacing.sm,
    marginLeft: 40 + spacing.md,
  },
  featuresCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  featureLabel: {
    fontSize: typography.sizes.base,
    color: colors.neutral.text,
  },
  manageCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
    overflow: 'hidden',
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  manageButtonText: {
    flex: 1,
    fontSize: typography.sizes.base,
    color: colors.neutral.text,
  },
  manageDivider: {
    height: 1,
    backgroundColor: colors.neutral.border,
    marginHorizontal: spacing.md,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: colors.primary.subtle,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary.main,
  },
  infoContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  infoTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.primary.dark,
    marginBottom: spacing.xs,
  },
  infoText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    lineHeight: 20,
  },
});
