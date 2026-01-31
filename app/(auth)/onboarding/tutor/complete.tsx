/**
 * Onboarding Complete Screen
 * Love2Learn Tutoring App
 *
 * Final step of tutor onboarding - welcome message and getting started tips
 */

import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../../src/lib/supabase';
import { useAuthContext } from '../../../../src/contexts/AuthContext';
import { Button } from '../../../../src/components/ui/Button';
import { colors, typography, spacing, borderRadius, shadows } from '../../../../src/theme';

interface TipItem {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
}

const GETTING_STARTED_TIPS: TipItem[] = [
  {
    icon: 'people',
    title: 'Add Your First Student',
    description: 'Import existing students or invite parents to register',
  },
  {
    icon: 'calendar',
    title: 'Schedule Lessons',
    description: 'Set up recurring lessons and manage your calendar',
  },
  {
    icon: 'document-text',
    title: 'Create Worksheets',
    description: 'Generate custom worksheets for your students',
  },
  {
    icon: 'card',
    title: 'Track Payments',
    description: 'Send invoices and track payment status',
  },
];

export default function OnboardingCompleteScreen() {
  const { parent, refreshParent } = useAuthContext();
  const businessName = parent?.name || 'Your Business';

  // Animation values
  const checkScale = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const tipTranslateY = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    // Mark onboarding as complete
    const markOnboardingComplete = async () => {
      if (parent?.id) {
        const { error } = await supabase
          .from('parents')
          .update({
            onboarding_completed_at: new Date().toISOString(),
          })
          .eq('id', parent.id);

        if (error) {
          console.error('Error marking onboarding complete:', error);
        }
      }
    };

    markOnboardingComplete();

    // Animate in sequence
    Animated.sequence([
      // Check mark bounces in
      Animated.spring(checkScale, {
        toValue: 1,
        friction: 4,
        tension: 50,
        useNativeDriver: true,
      }),
      // Content fades in
      Animated.parallel([
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(tipTranslateY, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [checkScale, contentOpacity, tipTranslateY, parent?.id]);

  const handleGoToDashboard = async () => {
    // Refresh parent data to update onboarding_completed_at in context
    await refreshParent();
    // Navigate to main tabs and reset navigation stack
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Progress Indicator - Complete */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: '100%' }]} />
          </View>
          <Text style={styles.progressText}>Setup Complete!</Text>
        </View>

        {/* Success Animation */}
        <Animated.View
          style={[
            styles.successContainer,
            { transform: [{ scale: checkScale }] },
          ]}
        >
          <View style={styles.successCircle}>
            <Ionicons name="checkmark" size={64} color={colors.neutral.white} />
          </View>
        </Animated.View>

        {/* Welcome Message */}
        <Animated.View style={{ opacity: contentOpacity }}>
          <Text style={styles.title}>Welcome to Love2Learn!</Text>
          <Text style={styles.subtitle}>
            {businessName} is all set up and ready to go.
          </Text>
        </Animated.View>

        {/* Getting Started Tips */}
        <Animated.View
          style={[
            styles.tipsContainer,
            {
              opacity: contentOpacity,
              transform: [{ translateY: tipTranslateY }],
            },
          ]}
        >
          <Text style={styles.tipsTitle}>Quick Start Guide</Text>
          {GETTING_STARTED_TIPS.map((tip, index) => (
            <View key={index} style={styles.tipCard}>
              <View style={styles.tipIcon}>
                <Ionicons name={tip.icon} size={24} color={colors.primary.main} />
              </View>
              <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>{tip.title}</Text>
                <Text style={styles.tipDescription}>{tip.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.neutral.textMuted} />
            </View>
          ))}
        </Animated.View>

        {/* Spacer */}
        <View style={styles.spacer} />

        {/* Trial Reminder */}
        <Animated.View style={[styles.trialReminder, { opacity: contentOpacity }]}>
          <Ionicons name="time-outline" size={18} color={colors.secondary.dark} />
          <Text style={styles.trialReminderText}>
            Your 14-day free trial has started. Explore all features!
          </Text>
        </Animated.View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Button
          title="Go to Dashboard"
          onPress={handleGoToDashboard}
          icon="home"
          iconPosition="left"
          style={styles.dashboardButton}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.white,
  },
  content: {
    flex: 1,
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
    backgroundColor: colors.status.success,
    borderRadius: borderRadius.full,
  },
  progressText: {
    fontSize: typography.sizes.xs,
    color: colors.status.success,
    textAlign: 'center',
    fontWeight: typography.weights.medium,
  },
  successContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  successCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.status.success,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
  },
  title: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  tipsContainer: {
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
  },
  tipsTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginBottom: spacing.base,
    paddingHorizontal: spacing.sm,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  tipIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginBottom: 2,
  },
  tipDescription: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },
  spacer: {
    flex: 1,
    minHeight: spacing.lg,
  },
  trialReminder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondary.subtle,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  trialReminderText: {
    fontSize: typography.sizes.sm,
    color: colors.secondary.dark,
    fontWeight: typography.weights.medium,
  },
  footer: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
  },
  dashboardButton: {
    width: '100%',
  },
});
