/**
 * Subscription Selection Screen
 * Love2Learn Tutoring App
 *
 * Third step of tutor onboarding - choose a subscription plan
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../../src/lib/supabase';
import { Button } from '../../../../src/components/ui/Button';
import { colors, typography, spacing, borderRadius, shadows } from '../../../../src/theme';

interface PlanFeature {
  text: string;
  included: boolean;
}

interface Plan {
  id: 'solo' | 'pro';
  name: string;
  price: number;
  period: string;
  description: string;
  features: PlanFeature[];
  popular?: boolean;
}

const PLANS: Plan[] = [
  {
    id: 'solo',
    name: 'Solo',
    price: 29,
    period: '/month',
    description: 'Perfect for individual tutors just getting started',
    features: [
      { text: 'Up to 25 students', included: true },
      { text: 'Lesson scheduling', included: true },
      { text: 'Payment tracking', included: true },
      { text: 'Worksheet generator', included: true },
      { text: 'Parent portal', included: true },
      { text: 'Email notifications', included: true },
      { text: 'Advanced analytics', included: false },
      { text: 'Priority support', included: false },
      { text: 'White-label branding', included: false },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 49,
    period: '/month',
    description: 'For growing tutoring businesses',
    popular: true,
    features: [
      { text: 'Unlimited students', included: true },
      { text: 'Lesson scheduling', included: true },
      { text: 'Payment tracking', included: true },
      { text: 'Worksheet generator', included: true },
      { text: 'Parent portal', included: true },
      { text: 'Email notifications', included: true },
      { text: 'Advanced analytics', included: true },
      { text: 'Priority support', included: true },
      { text: 'White-label branding', included: true },
    ],
  },
];

export default function SubscriptionScreen() {
  const [selectedPlan, setSelectedPlan] = useState<'solo' | 'pro'>('solo');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartTrial = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Authentication error. Please try again.');
        return;
      }

      // Calculate trial end date (14 days from now)
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 14);

      // Save selected plan to user metadata
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          subscription_plan: selectedPlan,
          subscription_status: 'trialing',
          trial_ends_at: trialEndsAt.toISOString(),
        },
      });

      if (updateError) {
        console.error('Error saving subscription:', updateError);
        setError('Failed to save subscription. Please try again.');
        return;
      }

      // Navigate to completion screen
      router.push('/(auth)/onboarding/tutor/complete');
    } catch (err) {
      console.error('Error starting trial:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: '75%' }]} />
          </View>
          <Text style={styles.progressText}>Step 3 of 4</Text>
        </View>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color={colors.neutral.text} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <View style={styles.headerIcon}>
              <Ionicons name="diamond" size={32} color={colors.accent.main} />
            </View>
            <Text style={styles.title}>Choose Your Plan</Text>
            <Text style={styles.subtitle}>
              Start with a 14-day free trial. No credit card required.
            </Text>
          </View>
        </View>

        {/* Plans */}
        <View style={styles.plansContainer}>
          {PLANS.map((plan) => (
            <TouchableOpacity
              key={plan.id}
              style={[
                styles.planCard,
                selectedPlan === plan.id && styles.planCardSelected,
                plan.popular && styles.planCardPopular,
              ]}
              onPress={() => setSelectedPlan(plan.id)}
              activeOpacity={0.7}
            >
              {plan.popular && (
                <View style={styles.popularBadge}>
                  <Text style={styles.popularBadgeText}>Most Popular</Text>
                </View>
              )}

              <View style={styles.planHeader}>
                <View style={styles.planNameRow}>
                  <Text style={[
                    styles.planName,
                    selectedPlan === plan.id && styles.planNameSelected,
                  ]}>
                    {plan.name}
                  </Text>
                  {selectedPlan === plan.id && (
                    <View style={styles.checkmark}>
                      <Ionicons name="checkmark" size={16} color={colors.neutral.white} />
                    </View>
                  )}
                </View>
                <View style={styles.priceRow}>
                  <Text style={styles.priceCurrency}>$</Text>
                  <Text style={[
                    styles.priceAmount,
                    selectedPlan === plan.id && styles.priceAmountSelected,
                  ]}>
                    {plan.price}
                  </Text>
                  <Text style={styles.pricePeriod}>{plan.period}</Text>
                </View>
                <Text style={styles.planDescription}>{plan.description}</Text>
              </View>

              <View style={styles.featuresContainer}>
                {plan.features.map((feature, index) => (
                  <View key={index} style={styles.featureRow}>
                    <Ionicons
                      name={feature.included ? 'checkmark-circle' : 'close-circle'}
                      size={20}
                      color={feature.included ? colors.status.success : colors.neutral.textMuted}
                    />
                    <Text style={[
                      styles.featureText,
                      !feature.included && styles.featureTextDisabled,
                    ]}>
                      {feature.text}
                    </Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Trial Info */}
        <View style={styles.trialInfo}>
          <Ionicons name="shield-checkmark" size={20} color={colors.secondary.main} />
          <Text style={styles.trialInfoText}>
            Your 14-day free trial includes all features. Cancel anytime.
          </Text>
        </View>

        {/* Error Message */}
        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={20} color={colors.status.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Spacer */}
        <View style={styles.spacer} />
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Button
          title={isLoading ? 'Starting Trial...' : `Start 14-Day Free Trial`}
          onPress={handleStartTrial}
          disabled={isLoading}
          loading={isLoading}
          icon="rocket"
          iconPosition="left"
          style={styles.continueButton}
        />
        <Text style={styles.footerNote}>
          You won't be charged until your trial ends
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.white,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.xl,
  },
  progressContainer: {
    marginBottom: spacing.xl,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.neutral.borderLight,
    borderRadius: borderRadius.full,
    marginBottom: spacing.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary.main,
    borderRadius: borderRadius.full,
  },
  progressText: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
    textAlign: 'center',
  },
  header: {
    marginBottom: spacing.xl,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -spacing.sm,
    marginBottom: spacing.sm,
  },
  headerContent: {
    alignItems: 'center',
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accent.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.base,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  plansContainer: {
    gap: spacing.base,
  },
  planCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: colors.neutral.border,
    position: 'relative',
  },
  planCardSelected: {
    borderColor: colors.primary.main,
    backgroundColor: colors.primary.subtle,
  },
  planCardPopular: {
    borderColor: colors.accent.main,
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    right: spacing.lg,
    backgroundColor: colors.accent.main,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  popularBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
  },
  planHeader: {
    marginBottom: spacing.base,
    paddingBottom: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.borderLight,
  },
  planNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  planName: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
  },
  planNameSelected: {
    color: colors.primary.main,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
  },
  priceCurrency: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.textSecondary,
  },
  priceAmount: {
    fontSize: typography.sizes['3xl'],
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
  },
  priceAmountSelected: {
    color: colors.primary.main,
  },
  pricePeriod: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textMuted,
    marginLeft: spacing.xs,
  },
  planDescription: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },
  featuresContainer: {
    gap: spacing.sm,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  featureText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.text,
    flex: 1,
  },
  featureTextDisabled: {
    color: colors.neutral.textMuted,
  },
  trialInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondary.subtle,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  trialInfoText: {
    fontSize: typography.sizes.sm,
    color: colors.secondary.dark,
    fontWeight: typography.weights.medium,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.status.errorBg,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.base,
  },
  errorText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.status.error,
    marginLeft: spacing.sm,
  },
  spacer: {
    flex: 1,
    minHeight: spacing.xl,
  },
  footer: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
  },
  continueButton: {
    width: '100%',
    marginBottom: spacing.sm,
  },
  footerNote: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
    textAlign: 'center',
  },
});
