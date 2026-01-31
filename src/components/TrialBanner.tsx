/**
 * TrialBanner Component
 * Shows trial status information at the top of screens
 *
 * Display logic:
 * - Shows days remaining in trial
 * - Becomes more urgent when < 3 days left
 * - Dismissible (persists dismiss for 24h unless < 3 days)
 * - Shows "Subscribe to continue" link
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useSubscription } from '../hooks/useSubscription';
import { colors, spacing, typography, borderRadius } from '../theme';

const DISMISS_KEY = 'trial_banner_dismissed_at';
const DISMISS_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

interface TrialBannerProps {
  /** Whether the banner can be dismissed */
  dismissible?: boolean;
  /** Callback when subscribe is pressed */
  onSubscribePress?: () => void;
  /** Custom style for the container */
  style?: object;
}

/**
 * Banner showing trial status
 *
 * @example
 * ```tsx
 * function DashboardScreen() {
 *   return (
 *     <View style={{ flex: 1 }}>
 *       <TrialBanner />
 *       <DashboardContent />
 *     </View>
 *   );
 * }
 * ```
 */
export function TrialBanner({
  dismissible = true,
  onSubscribePress,
  style,
}: TrialBannerProps) {
  const {
    loading,
    isTrial,
    isActive,
    trialDaysRemaining,
    isTrialExpiringSoon,
    redirectToCheckout,
  } = useSubscription();

  const [dismissed, setDismissed] = useState(false);
  const [checking, setChecking] = useState(true);
  const fadeAnim = useState(new Animated.Value(1))[0];

  // Check if banner was recently dismissed
  useEffect(() => {
    const checkDismissed = async () => {
      try {
        const dismissedAt = await AsyncStorage.getItem(DISMISS_KEY);
        if (dismissedAt) {
          const dismissedTime = parseInt(dismissedAt, 10);
          const now = Date.now();
          // If dismissed less than 24h ago AND not expiring soon, stay dismissed
          if (now - dismissedTime < DISMISS_DURATION_MS && !isTrialExpiringSoon) {
            setDismissed(true);
          }
        }
      } catch (error) {
        console.error('Error checking banner dismiss status:', error);
      } finally {
        setChecking(false);
      }
    };

    checkDismissed();
  }, [isTrialExpiringSoon]);

  // Handle dismiss
  const handleDismiss = async () => {
    // Animate out
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(async () => {
      setDismissed(true);
      try {
        await AsyncStorage.setItem(DISMISS_KEY, Date.now().toString());
      } catch (error) {
        console.error('Error saving banner dismiss:', error);
      }
    });
  };

  // Handle subscribe press
  const handleSubscribe = async () => {
    if (onSubscribePress) {
      onSubscribePress();
    } else {
      try {
        await redirectToCheckout('solo');
      } catch (error) {
        console.error('Checkout error:', error);
      }
    }
  };

  // Don't show if loading, checking dismiss, dismissed, or not in trial
  if (loading || checking || dismissed || !isTrial || !isActive) {
    return null;
  }

  // Determine banner style based on urgency
  const isUrgent = isTrialExpiringSoon;
  const bannerStyle = isUrgent ? styles.bannerUrgent : styles.banner;
  const textColor = isUrgent ? colors.neutral.textInverse : colors.neutral.text;
  const iconColor = isUrgent ? colors.neutral.textInverse : colors.status.info;

  // Format message
  const daysText = trialDaysRemaining === 1 ? 'day' : 'days';
  const message = trialDaysRemaining > 0
    ? `${trialDaysRemaining} ${daysText} left in your trial`
    : 'Your trial ends today';

  return (
    <Animated.View style={[bannerStyle, { opacity: fadeAnim }, style]}>
      <View style={styles.content}>
        <View style={styles.messageContainer}>
          <Ionicons
            name={isUrgent ? 'time-outline' : 'sparkles-outline'}
            size={18}
            color={iconColor}
          />
          <Text style={[styles.message, { color: textColor }]}>
            {message}
          </Text>
        </View>

        <Pressable
          onPress={handleSubscribe}
          style={({ pressed }) => [
            styles.subscribeButton,
            isUrgent && styles.subscribeButtonUrgent,
            pressed && styles.subscribeButtonPressed,
          ]}
        >
          <Text
            style={[
              styles.subscribeText,
              isUrgent && styles.subscribeTextUrgent,
            ]}
          >
            Subscribe now
          </Text>
          <Ionicons
            name="arrow-forward"
            size={14}
            color={isUrgent ? colors.primary.main : colors.neutral.textInverse}
          />
        </Pressable>
      </View>

      {dismissible && !isTrialExpiringSoon && (
        <Pressable
          onPress={handleDismiss}
          style={styles.dismissButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={18} color={textColor} />
        </Pressable>
      )}
    </Animated.View>
  );
}

/**
 * Compact version of trial banner for use in headers
 */
export function TrialBadge() {
  const { isTrial, isActive, trialDaysRemaining, isTrialExpiringSoon } = useSubscription();

  if (!isTrial || !isActive) {
    return null;
  }

  const isUrgent = isTrialExpiringSoon;

  return (
    <View
      style={[
        styles.badge,
        isUrgent ? styles.badgeUrgent : styles.badgeNormal,
      ]}
    >
      <Ionicons
        name="time-outline"
        size={12}
        color={isUrgent ? colors.status.error : colors.status.info}
      />
      <Text
        style={[
          styles.badgeText,
          isUrgent ? styles.badgeTextUrgent : styles.badgeTextNormal,
        ]}
      >
        {trialDaysRemaining}d left
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
    backgroundColor: colors.status.infoBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary.light,
  },

  bannerUrgent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
    backgroundColor: colors.accent.main,
    borderBottomWidth: 1,
    borderBottomColor: colors.accent.dark,
  },

  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },

  messageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },

  message: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },

  subscribeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primary.main,
    borderRadius: borderRadius.md,
  },

  subscribeButtonUrgent: {
    backgroundColor: colors.neutral.surface,
  },

  subscribeButtonPressed: {
    opacity: 0.8,
  },

  subscribeText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.textInverse,
  },

  subscribeTextUrgent: {
    color: colors.primary.main,
  },

  dismissButton: {
    marginLeft: spacing.sm,
    padding: spacing.xs,
  },

  // Badge styles
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
  },

  badgeNormal: {
    backgroundColor: colors.status.infoBg,
  },

  badgeUrgent: {
    backgroundColor: colors.status.errorBg,
  },

  badgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },

  badgeTextNormal: {
    color: colors.status.info,
  },

  badgeTextUrgent: {
    color: colors.status.error,
  },
});

export default TrialBanner;
