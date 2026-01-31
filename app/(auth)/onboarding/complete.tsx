/**
 * Completion Screen
 * Final step of parent onboarding - shows success and next steps
 */

import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '../../../src/contexts/AuthContext';
import { useTutorInfo } from '../../../src/hooks/useParentInvitation';
import { Button } from '../../../src/components/ui/Button';
import { colors, spacing, typography, borderRadius, shadows } from '../../../src/theme';

interface FeatureItem {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
}

const FEATURES: FeatureItem[] = [
  {
    icon: 'calendar',
    title: 'View Lesson Schedule',
    description: "See all your children's upcoming lessons",
  },
  {
    icon: 'document-text',
    title: 'Access Worksheets',
    description: 'Print assigned worksheets for practice',
  },
  {
    icon: 'card',
    title: 'Track Payments',
    description: 'View payment history and status',
  },
];

export default function CompleteScreen() {
  const { parent, refreshParent } = useAuthContext();
  const { tutorInfo, refetch: fetchTutorInfo } = useTutorInfo();
  const firstName = parent?.name?.split(' ')[0] ?? '';

  // Get tutor display name for branding
  const tutorDisplayName = tutorInfo?.businessName || tutorInfo?.tutorName;

  // Fetch tutor info on mount
  useEffect(() => {
    fetchTutorInfo();
  }, [fetchTutorInfo]);

  // Animation values
  const checkScale = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const featureTranslateY = useRef(new Animated.Value(30)).current;

  useEffect(() => {
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
        Animated.timing(featureTranslateY, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [checkScale, contentOpacity, featureTranslateY]);

  const handleGoToDashboard = async () => {
    // Refresh parent data to update onboarding_completed_at in context
    await refreshParent();
    // Navigate to main tabs and reset navigation stack
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
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

        {/* Title */}
        <Animated.View style={{ opacity: contentOpacity }}>
          <Text style={styles.title}>
            You're All Set{firstName ? `, ${firstName}` : ''}!
          </Text>
          <Text style={styles.subtitle}>
            Your parent portal is ready. Here's what you can do:
          </Text>
        </Animated.View>

        {/* Feature List */}
        <Animated.View
          style={[
            styles.featuresList,
            {
              opacity: contentOpacity,
              transform: [{ translateY: featureTranslateY }],
            },
          ]}
        >
          {FEATURES.map((feature, index) => (
            <View key={index} style={styles.featureCard}>
              <View style={styles.featureIcon}>
                <Ionicons name={feature.icon} size={24} color={colors.primary.main} />
              </View>
              <View style={styles.featureInfo}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </View>
            </View>
          ))}
        </Animated.View>

        {/* Spacer */}
        <View style={styles.spacer} />

        {/* Help Note */}
        <Animated.View style={[styles.helpNote, { opacity: contentOpacity }]}>
          <Ionicons name="help-circle-outline" size={18} color={colors.neutral.textSecondary} />
          <Text style={styles.helpText}>
            Need help? Contact {tutorDisplayName || 'your tutor'} anytime through the app.
          </Text>
        </Animated.View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Button
          title="Go to Dashboard"
          onPress={handleGoToDashboard}
          style={styles.dashboardButton}
          icon={<Ionicons name="home" size={20} color={colors.neutral.white} />}
          iconPosition="left"
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
    alignItems: 'center',
  },
  successContainer: {
    marginTop: spacing['2xl'],
    marginBottom: spacing.xl,
  },
  successCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
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
  featuresList: {
    width: '100%',
    gap: spacing.md,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  featureInfo: {
    flex: 1,
  },
  featureTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginBottom: 2,
  },
  featureDescription: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },
  spacer: {
    flex: 1,
  },
  helpNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.lg,
  },
  helpText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
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
