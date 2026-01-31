/**
 * Subscription Management Screen
 * Allows tutors to manage their subscription, view plan details, and access billing
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Platform,
  RefreshControl,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../../../src/theme';
import { useSubscription } from '../../../src/hooks/useSubscription';
import { TrialBanner } from '../../../src/components/TrialBanner';
import { SubscriptionPlan } from '../../../src/lib/stripe';

// Plan feature lists
const PLAN_FEATURES = {
  solo: {
    name: 'Solo',
    price: 29,
    students: 'Up to 20 students',
    features: [
      'Core scheduling features',
      'Lesson tracking & notes',
      'Parent messaging',
      'Payment tracking',
      'Basic reports',
    ],
  },
  pro: {
    name: 'Pro',
    price: 49,
    students: 'Unlimited students',
    features: [
      'Everything in Solo',
      'AI worksheet generation',
      'Advanced analytics',
      'Priority support',
      'Custom branding',
      'Bulk operations',
    ],
  },
};

type IoniconsName = keyof typeof Ionicons.glyphMap;

interface ActionButtonProps {
  icon: IoniconsName;
  label: string;
  description?: string;
  onPress: () => void;
  loading?: boolean;
  variant?: 'default' | 'primary';
}

function ActionButton({
  icon,
  label,
  description,
  onPress,
  loading = false,
  variant = 'default',
}: ActionButtonProps) {
  const isPrimary = variant === 'primary';

  return (
    <Pressable
      style={({ pressed }) => [
        styles.actionButton,
        isPrimary && styles.actionButtonPrimary,
        pressed && styles.actionButtonPressed,
      ]}
      onPress={onPress}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={isPrimary ? colors.neutral.textInverse : colors.primary.main}
        />
      ) : (
        <Ionicons
          name={icon}
          size={20}
          color={isPrimary ? colors.neutral.textInverse : colors.primary.main}
        />
      )}
      <View style={styles.actionButtonContent}>
        <Text
          style={[
            styles.actionButtonLabel,
            isPrimary && styles.actionButtonLabelPrimary,
          ]}
        >
          {label}
        </Text>
        {description && (
          <Text
            style={[
              styles.actionButtonDescription,
              isPrimary && styles.actionButtonDescriptionPrimary,
            ]}
          >
            {description}
          </Text>
        )}
      </View>
      <Ionicons
        name="chevron-forward"
        size={20}
        color={isPrimary ? colors.neutral.textInverse : colors.neutral.textMuted}
      />
    </Pressable>
  );
}

interface CancelModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  subscriptionEndsAt: Date | null;
  loading: boolean;
}

function CancelConfirmationModal({
  visible,
  onClose,
  onConfirm,
  subscriptionEndsAt,
  loading,
}: CancelModalProps) {
  const formatDate = (date: Date | null) => {
    if (!date) return 'the end of your current billing period';
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalIconContainer}>
            <Ionicons
              name="warning"
              size={32}
              color={colors.status.error}
            />
          </View>

          <Text style={styles.modalTitle}>Cancel Subscription?</Text>

          <Text style={styles.modalMessage}>
            Are you sure you want to cancel your subscription? You will lose access to:
          </Text>

          <View style={styles.modalWarningList}>
            <View style={styles.modalWarningItem}>
              <Ionicons name="close-circle" size={16} color={colors.status.error} />
              <Text style={styles.modalWarningText}>AI worksheet generation</Text>
            </View>
            <View style={styles.modalWarningItem}>
              <Ionicons name="close-circle" size={16} color={colors.status.error} />
              <Text style={styles.modalWarningText}>Full student management</Text>
            </View>
            <View style={styles.modalWarningItem}>
              <Ionicons name="close-circle" size={16} color={colors.status.error} />
              <Text style={styles.modalWarningText}>Payment tracking features</Text>
            </View>
          </View>

          <View style={styles.modalInfoBox}>
            <Ionicons name="information-circle" size={18} color={colors.status.info} />
            <Text style={styles.modalInfoText}>
              Your access will continue until {formatDate(subscriptionEndsAt)}.
            </Text>
          </View>

          <View style={styles.modalButtons}>
            <Pressable
              style={[styles.modalButton, styles.modalButtonSecondary]}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.modalButtonSecondaryText}>Keep Subscription</Text>
            </Pressable>

            <Pressable
              style={[styles.modalButton, styles.modalButtonDanger]}
              onPress={onConfirm}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.neutral.textInverse} />
              ) : (
                <Text style={styles.modalButtonDangerText}>Cancel Anyway</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function SubscriptionScreen() {
  const {
    subscription,
    loading,
    error,
    isActive,
    isTrial,
    trialDaysRemaining,
    statusDisplay,
    statusColors,
    redirectToCheckout,
    redirectToPortal,
    refresh,
  } = useSubscription();

  const [refreshing, setRefreshing] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleManageBilling = async () => {
    try {
      setPortalLoading(true);
      await redirectToPortal();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to open billing portal';
      if (Platform.OS === 'web') {
        alert(message);
      } else {
        Alert.alert('Error', message);
      }
    } finally {
      setPortalLoading(false);
    }
  };

  const handleUpgrade = async (plan: SubscriptionPlan) => {
    try {
      await redirectToCheckout(plan);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start checkout';
      if (Platform.OS === 'web') {
        alert(message);
      } else {
        Alert.alert('Error', message);
      }
    }
  };

  const handleCancelSubscription = () => {
    setShowCancelModal(true);
  };

  const handleConfirmCancel = async () => {
    // Cancel goes through Stripe portal
    setShowCancelModal(false);
    await handleManageBilling();
  };

  // Format next billing date
  const formatNextBillingDate = () => {
    if (isTrial && subscription?.trialEndsAt) {
      return subscription.trialEndsAt.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    }
    if (subscription?.subscriptionEndsAt) {
      return subscription.subscriptionEndsAt.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    }
    return 'N/A';
  };

  // Get current plan details
  const currentPlan = subscription?.plan
    ? PLAN_FEATURES[subscription.plan]
    : null;

  const canUpgrade = subscription?.plan === 'solo';
  const hasSubscription = !!subscription?.stripeSubscriptionId;

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary.main} />
        <Text style={styles.loadingText}>Loading subscription...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Trial Banner */}
        {isTrial && (
          <TrialBanner
            dismissible={false}
            style={styles.trialBanner}
          />
        )}

        {/* Current Subscription Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Plan</Text>
          <View style={styles.card}>
            <View style={styles.planHeader}>
              <View style={styles.planInfo}>
                <Text style={styles.planName}>
                  {currentPlan?.name || 'No Plan'}
                </Text>
                {currentPlan && (
                  <Text style={styles.planPrice}>
                    ${currentPlan.price}
                    <Text style={styles.planPricePeriod}>/month</Text>
                  </Text>
                )}
              </View>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: statusColors.background },
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    { color: statusColors.text },
                  ]}
                >
                  {statusDisplay}
                </Text>
              </View>
            </View>

            {/* Plan meta info */}
            <View style={styles.planMeta}>
              {isTrial && (
                <View style={styles.planMetaItem}>
                  <Ionicons
                    name="time-outline"
                    size={16}
                    color={colors.status.info}
                  />
                  <Text style={styles.planMetaText}>
                    {trialDaysRemaining} days left in trial
                  </Text>
                </View>
              )}
              {currentPlan && (
                <View style={styles.planMetaItem}>
                  <Ionicons
                    name="people-outline"
                    size={16}
                    color={colors.neutral.textSecondary}
                  />
                  <Text style={styles.planMetaText}>{currentPlan.students}</Text>
                </View>
              )}
              {hasSubscription && (
                <View style={styles.planMetaItem}>
                  <Ionicons
                    name="calendar-outline"
                    size={16}
                    color={colors.neutral.textSecondary}
                  />
                  <Text style={styles.planMetaText}>
                    {isTrial ? 'Trial ends: ' : 'Next billing: '}
                    {formatNextBillingDate()}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Plan Features */}
        {currentPlan && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What's Included</Text>
            <View style={styles.card}>
              {currentPlan.features.map((feature, index) => (
                <View
                  key={index}
                  style={[
                    styles.featureItem,
                    index < currentPlan.features.length - 1 &&
                      styles.featureItemBorder,
                  ]}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={colors.status.success}
                  />
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Upgrade Section */}
        {canUpgrade && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Upgrade Your Plan</Text>
            <View style={[styles.card, styles.upgradeCard]}>
              <View style={styles.upgradeHeader}>
                <View style={styles.upgradeBadge}>
                  <Ionicons name="star" size={14} color={colors.accent.main} />
                  <Text style={styles.upgradeBadgeText}>RECOMMENDED</Text>
                </View>
                <Text style={styles.upgradeTitle}>Pro Plan</Text>
                <Text style={styles.upgradePrice}>
                  ${PLAN_FEATURES.pro.price}
                  <Text style={styles.upgradePricePeriod}>/month</Text>
                </Text>
              </View>

              <Text style={styles.upgradeDescription}>
                Unlock unlimited students, AI worksheets, and priority support.
              </Text>

              <View style={styles.upgradeFeatures}>
                {['AI worksheet generation', 'Unlimited students', 'Priority support'].map(
                  (feature, index) => (
                    <View key={index} style={styles.upgradeFeatureItem}>
                      <Ionicons
                        name="add-circle"
                        size={16}
                        color={colors.secondary.main}
                      />
                      <Text style={styles.upgradeFeatureText}>{feature}</Text>
                    </View>
                  )
                )}
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.upgradeButton,
                  pressed && styles.upgradeButtonPressed,
                ]}
                onPress={() => handleUpgrade('pro')}
              >
                <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
                <Ionicons
                  name="arrow-forward"
                  size={18}
                  color={colors.neutral.textInverse}
                />
              </Pressable>
            </View>
          </View>
        )}

        {/* Manage Subscription Actions */}
        {hasSubscription && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Manage Subscription</Text>
            <View style={styles.card}>
              <ActionButton
                icon="card"
                label="Manage Billing"
                description="Update payment method and view details"
                onPress={handleManageBilling}
                loading={portalLoading}
                variant="primary"
              />

              <View style={styles.actionDivider} />

              <ActionButton
                icon="card-outline"
                label="Update Payment Method"
                description="Change your card or payment method"
                onPress={handleManageBilling}
                loading={portalLoading}
              />

              <View style={styles.actionDivider} />

              <ActionButton
                icon="receipt-outline"
                label="View Invoices"
                description="Download past invoices and receipts"
                onPress={handleManageBilling}
                loading={portalLoading}
              />
            </View>
          </View>
        )}

        {/* No Subscription State */}
        {!hasSubscription && !loading && (
          <View style={styles.section}>
            <View style={[styles.card, styles.noSubCard]}>
              <Ionicons
                name="sparkles"
                size={48}
                color={colors.primary.main}
              />
              <Text style={styles.noSubTitle}>Start Your Journey</Text>
              <Text style={styles.noSubDescription}>
                Choose a plan to unlock all the tools you need to grow your tutoring business.
              </Text>

              <View style={styles.noSubButtons}>
                <Pressable
                  style={({ pressed }) => [
                    styles.noSubButton,
                    styles.noSubButtonSecondary,
                    pressed && styles.noSubButtonPressed,
                  ]}
                  onPress={() => handleUpgrade('solo')}
                >
                  <Text style={styles.noSubButtonSecondaryText}>Start with Solo</Text>
                  <Text style={styles.noSubButtonPrice}>${PLAN_FEATURES.solo.price}/mo</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.noSubButton,
                    styles.noSubButtonPrimary,
                    pressed && styles.noSubButtonPressed,
                  ]}
                  onPress={() => handleUpgrade('pro')}
                >
                  <Text style={styles.noSubButtonPrimaryText}>Go Pro</Text>
                  <Text style={[styles.noSubButtonPrice, styles.noSubButtonPricePrimary]}>
                    ${PLAN_FEATURES.pro.price}/mo
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {/* Cancel Subscription Link */}
        {hasSubscription && isActive && (
          <View style={styles.cancelSection}>
            <Pressable
              style={styles.cancelButton}
              onPress={handleCancelSubscription}
            >
              <Text style={styles.cancelButtonText}>Cancel Subscription</Text>
            </Pressable>
            <Text style={styles.cancelNote}>
              You can cancel anytime. Your access continues until the end of your billing period.
            </Text>
          </View>
        )}

        {/* Error Display */}
        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={20} color={colors.status.error} />
            <Text style={styles.errorText}>{error.message}</Text>
          </View>
        )}
      </ScrollView>

      {/* Cancel Confirmation Modal */}
      <CancelConfirmationModal
        visible={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleConfirmCancel}
        subscriptionEndsAt={subscription?.subscriptionEndsAt || null}
        loading={portalLoading}
      />
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
    backgroundColor: colors.neutral.background,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
  },

  // Trial Banner
  trialBanner: {
    marginBottom: spacing.lg,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },

  // Section styles
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
    padding: spacing.lg,
    ...shadows.sm,
  },

  // Plan Header
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  planInfo: {
    flex: 1,
  },
  planName: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
  },
  planPrice: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    color: colors.primary.main,
    marginTop: spacing.xs,
  },
  planPricePeriod: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.regular,
    color: colors.neutral.textSecondary,
  },
  statusBadge: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
  },
  statusBadgeText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },

  // Plan Meta
  planMeta: {
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
    gap: spacing.sm,
  },
  planMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  planMetaText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },

  // Features
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  featureItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.borderLight,
  },
  featureText: {
    fontSize: typography.sizes.base,
    color: colors.neutral.text,
    flex: 1,
  },

  // Upgrade Section
  upgradeCard: {
    borderWidth: 2,
    borderColor: colors.secondary.light,
    backgroundColor: colors.secondary.subtle,
  },
  upgradeHeader: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  upgradeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accent.subtle,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
    marginBottom: spacing.sm,
  },
  upgradeBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.accent.dark,
  },
  upgradeTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
  },
  upgradePrice: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    color: colors.secondary.main,
    marginTop: spacing.xs,
  },
  upgradePricePeriod: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.regular,
    color: colors.neutral.textSecondary,
  },
  upgradeDescription: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  upgradeFeatures: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  upgradeFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  upgradeFeatureText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.text,
    fontWeight: typography.weights.medium,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.secondary.main,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    ...shadows.sm,
  },
  upgradeButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  upgradeButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.textInverse,
  },

  // Action Buttons
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral.white,
  },
  actionButtonPrimary: {
    backgroundColor: colors.primary.main,
  },
  actionButtonPressed: {
    opacity: 0.9,
  },
  actionButtonContent: {
    flex: 1,
  },
  actionButtonLabel: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  actionButtonLabelPrimary: {
    color: colors.neutral.textInverse,
  },
  actionButtonDescription: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginTop: 2,
  },
  actionButtonDescriptionPrimary: {
    color: colors.neutral.textInverse,
    opacity: 0.8,
  },
  actionDivider: {
    height: 1,
    backgroundColor: colors.neutral.border,
    marginVertical: spacing.xs,
  },

  // No Subscription State
  noSubCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  noSubTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
    marginTop: spacing.md,
  },
  noSubDescription: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  noSubButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
  },
  noSubButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
  },
  noSubButtonSecondary: {
    backgroundColor: colors.neutral.background,
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  noSubButtonPrimary: {
    backgroundColor: colors.primary.main,
    ...shadows.sm,
  },
  noSubButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  noSubButtonSecondaryText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  noSubButtonPrimaryText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.textInverse,
  },
  noSubButtonPrice: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginTop: 2,
  },
  noSubButtonPricePrimary: {
    color: colors.neutral.textInverse,
    opacity: 0.8,
  },

  // Cancel Section
  cancelSection: {
    alignItems: 'center',
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
    marginTop: spacing.lg,
  },
  cancelButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  cancelButtonText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
    textDecorationLine: 'underline',
  },
  cancelNote: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xl,
  },

  // Error
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.status.errorBg,
    borderRadius: borderRadius.md,
    marginTop: spacing.lg,
  },
  errorText: {
    fontSize: typography.sizes.sm,
    color: colors.status.error,
    flex: 1,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.neutral.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalContent: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 400,
    ...shadows.lg,
  },
  modalIconContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  modalMessage: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  modalWarningList: {
    backgroundColor: colors.status.errorBg,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  modalWarningItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  modalWarningText: {
    fontSize: typography.sizes.sm,
    color: colors.status.error,
  },
  modalInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.status.infoBg,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  modalInfoText: {
    fontSize: typography.sizes.sm,
    color: colors.status.info,
    flex: 1,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  modalButton: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  modalButtonSecondary: {
    backgroundColor: colors.neutral.background,
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  modalButtonSecondaryText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  modalButtonDanger: {
    backgroundColor: colors.status.error,
  },
  modalButtonDangerText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.textInverse,
  },
});
