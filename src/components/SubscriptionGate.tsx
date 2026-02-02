/**
 * SubscriptionGate Component
 * Protects content that requires an active subscription
 *
 * Shows paywall or warning based on subscription status:
 * - Active/Trial: Renders children
 * - Expired/No subscription: Shows paywall with subscribe button
 * - Past Due: Shows warning with update payment button
 */

import React, { ReactNode, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { useSubscription } from '../hooks/useSubscription';
import { SubscriptionPlan } from '../lib/stripe';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';

interface SubscriptionGateProps {
  /** Content to show when subscription is active */
  children: ReactNode;
  /** Custom loading component */
  loadingComponent?: ReactNode;
  /** Custom expired component */
  expiredComponent?: ReactNode;
  /** Whether to show the gate (set to false to bypass) */
  enabled?: boolean;
  /** Feature name for messaging (e.g., "Student Management") */
  featureName?: string;
}

/**
 * Wraps content that requires an active subscription
 *
 * @example
 * ```tsx
 * <SubscriptionGate featureName="Student Management">
 *   <StudentList />
 * </SubscriptionGate>
 * ```
 */
export function SubscriptionGate({
  children,
  loadingComponent,
  expiredComponent,
  enabled = true,
  featureName = 'this feature',
}: SubscriptionGateProps) {
  const {
    loading,
    isActive,
    subscription,
    redirectToCheckout,
    redirectToPortal,
  } = useSubscription();
  const [actionLoading, setActionLoading] = useState(false);

  // If gate is disabled, render children directly
  if (!enabled) {
    return <>{children}</>;
  }

  // Loading state
  if (loading) {
    if (loadingComponent) {
      return <>{loadingComponent}</>;
    }
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary.main} />
        <Text style={styles.loadingText}>Checking subscription...</Text>
      </View>
    );
  }

  // Active subscription - render children
  if (isActive) {
    return <>{children}</>;
  }

  // Past due - show warning with update payment option
  if (subscription?.status === 'past_due') {
    return (
      <View style={styles.container}>
        <Card style={styles.card}>
          <View style={styles.iconContainer}>
            <View style={[styles.iconCircle, { backgroundColor: colors.status.warningBg }]}>
              <Ionicons
                name="warning-outline"
                size={48}
                color={colors.status.warning}
              />
            </View>
          </View>

          <Text style={styles.title}>Payment Issue</Text>

          <Text style={styles.description}>
            Your subscription payment failed. Please update your payment method to
            continue using {featureName}.
          </Text>

          <View style={styles.buttonContainer}>
            <Button
              title="Update Payment Method"
              onPress={async () => {
                setActionLoading(true);
                try {
                  await redirectToPortal();
                } finally {
                  setActionLoading(false);
                }
              }}
              loading={actionLoading}
              icon="card-outline"
              fullWidth
            />
          </View>

          <Text style={styles.helpText}>
            Need help? Contact support for assistance.
          </Text>
        </Card>
      </View>
    );
  }

  // Custom expired component
  if (expiredComponent) {
    return <>{expiredComponent}</>;
  }

  // No subscription or expired - show paywall
  return <SubscriptionPaywall featureName={featureName} />;
}

/**
 * Paywall component for users without active subscription
 */
interface PaywallProps {
  featureName?: string;
}

function SubscriptionPaywall({ featureName = 'Love2Learn' }: PaywallProps) {
  const { redirectToCheckout } = useSubscription();
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>('solo');
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      await redirectToCheckout(selectedPlan);
    } catch (error) {
      console.error('Checkout error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Card style={styles.paywallCard}>
        {/* Header */}
        <View style={styles.iconContainer}>
          <View style={[styles.iconCircle, { backgroundColor: colors.primary.subtle }]}>
            <Ionicons
              name="diamond-outline"
              size={48}
              color={colors.primary.main}
            />
          </View>
        </View>

        <Text style={styles.title}>Subscribe to Access</Text>

        <Text style={styles.description}>
          Get access to {featureName} and all premium features with a Love2Learn subscription.
        </Text>

        {/* Plan Selection */}
        <View style={styles.planContainer}>
          <PlanOption
            name="Solo"
            price="$19"
            period="/month"
            description="Perfect for independent tutors"
            features={[
              'Unlimited students',
              'Lesson scheduling',
              'Payment tracking',
              'Parent communication',
            ]}
            selected={selectedPlan === 'solo'}
            onSelect={() => setSelectedPlan('solo')}
          />

          <PlanOption
            name="Pro"
            price="$39"
            period="/month"
            description="For growing tutoring businesses"
            features={[
              'Everything in Solo',
              'Group sessions',
              'Advanced analytics',
              'Priority support',
            ]}
            selected={selectedPlan === 'pro'}
            onSelect={() => setSelectedPlan('pro')}
            highlighted
          />
        </View>

        {/* Trial Badge */}
        <View style={styles.trialBadge}>
          <Ionicons name="gift-outline" size={16} color={colors.secondary.main} />
          <Text style={styles.trialText}>14-day free trial included</Text>
        </View>

        {/* Subscribe Button */}
        <Button
          title={`Start Free Trial - ${selectedPlan === 'solo' ? 'Solo' : 'Pro'}`}
          onPress={handleSubscribe}
          loading={loading}
          icon="rocket-outline"
          fullWidth
          size="lg"
        />

        <Text style={styles.termsText}>
          Cancel anytime. No commitment required.
        </Text>
      </Card>
    </View>
  );
}

/**
 * Individual plan option card
 */
interface PlanOptionProps {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  selected: boolean;
  onSelect: () => void;
  highlighted?: boolean;
}

function PlanOption({
  name,
  price,
  period,
  description,
  features,
  selected,
  onSelect,
  highlighted,
}: PlanOptionProps) {
  return (
    <View
      style={[
        styles.planOption,
        selected && styles.planOptionSelected,
        highlighted && styles.planOptionHighlighted,
      ]}
      onTouchEnd={onSelect}
    >
      {highlighted && (
        <View style={styles.popularBadge}>
          <Text style={styles.popularText}>POPULAR</Text>
        </View>
      )}

      <View style={styles.planHeader}>
        <Text style={styles.planName}>{name}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.planPrice}>{price}</Text>
          <Text style={styles.planPeriod}>{period}</Text>
        </View>
        <Text style={styles.planDescription}>{description}</Text>
      </View>

      <View style={styles.featuresContainer}>
        {features.map((feature, index) => (
          <View key={index} style={styles.featureRow}>
            <Ionicons
              name="checkmark-circle"
              size={16}
              color={colors.secondary.main}
            />
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}
      </View>

      {/* Selection indicator */}
      <View style={styles.selectionIndicator}>
        <Ionicons
          name={selected ? 'radio-button-on' : 'radio-button-off'}
          size={24}
          color={selected ? colors.primary.main : colors.neutral.textMuted}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.base,
    backgroundColor: colors.neutral.background,
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

  card: {
    padding: spacing.xl,
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
  },

  paywallCard: {
    padding: spacing.xl,
    maxWidth: 500,
    width: '100%',
  },

  iconContainer: {
    marginBottom: spacing.lg,
    alignItems: 'center',
  },

  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },

  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },

  description: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
  },

  buttonContainer: {
    width: '100%',
    marginTop: spacing.lg,
  },

  helpText: {
    marginTop: spacing.md,
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
    textAlign: 'center',
  },

  // Plan selection styles
  planContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },

  planOption: {
    flex: 1,
    padding: spacing.base,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.neutral.border,
    backgroundColor: colors.neutral.surface,
    position: 'relative',
  },

  planOptionSelected: {
    borderColor: colors.primary.main,
    backgroundColor: colors.primary.subtle,
  },

  planOptionHighlighted: {
    borderColor: colors.secondary.main,
  },

  popularBadge: {
    position: 'absolute',
    top: -10,
    right: spacing.md,
    backgroundColor: colors.secondary.main,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },

  popularText: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    color: colors.neutral.textInverse,
    letterSpacing: 0.5,
  },

  planHeader: {
    marginBottom: spacing.md,
  },

  planName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },

  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginVertical: spacing.xs,
  },

  planPrice: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
  },

  planPeriod: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
    marginLeft: 2,
  },

  planDescription: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textSecondary,
  },

  featuresContainer: {
    gap: spacing.xs,
  },

  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },

  featureText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    flex: 1,
  },

  selectionIndicator: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
  },

  trialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.secondary.subtle,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },

  trialText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.secondary.dark,
  },

  termsText: {
    marginTop: spacing.md,
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
    textAlign: 'center',
  },
});

export default SubscriptionGate;
