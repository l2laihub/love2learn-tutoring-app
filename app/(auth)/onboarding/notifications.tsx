/**
 * Notifications Preferences Screen
 * Third step of parent onboarding - set notification preferences
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '../../../src/contexts/AuthContext';
import { useOnboarding } from '../../../src/hooks/useOnboarding';
import { Button } from '../../../src/components/ui/Button';
import { colors, spacing, typography, borderRadius, shadows } from '../../../src/theme';
import { ParentPreferences } from '../../../src/types/database';

interface NotificationOption {
  key: keyof ParentPreferences['notifications'];
  title: string;
  description: string;
  icon: string;
}

const NOTIFICATION_OPTIONS: NotificationOption[] = [
  {
    key: 'lesson_reminders',
    title: 'Lesson Reminders',
    description: 'Get notified before upcoming lessons',
    icon: 'calendar-outline',
  },
  {
    key: 'worksheet_assigned',
    title: 'New Worksheets',
    description: 'When tutor assigns new worksheets',
    icon: 'document-text-outline',
  },
  {
    key: 'payment_due',
    title: 'Payment Reminders',
    description: 'When payment is due',
    icon: 'card-outline',
  },
  {
    key: 'lesson_notes',
    title: 'Lesson Notes',
    description: 'When tutor adds notes after a lesson',
    icon: 'create-outline',
  },
];

export default function NotificationsScreen() {
  const params = useLocalSearchParams<{
    name: string;
    phone: string;
    contactPreference: string;
  }>();

  const { parent } = useAuthContext();
  const { completeOnboarding, loading } = useOnboarding();

  // Initialize notification states
  const [notifications, setNotifications] = useState<Record<string, boolean>>({
    lesson_reminders: true,
    worksheet_assigned: true,
    payment_due: true,
    lesson_notes: true,
  });

  const toggleNotification = (key: string) => {
    setNotifications((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleBack = () => {
    router.back();
  };

  const handleComplete = async () => {
    // Build preferences object
    const preferences: ParentPreferences = {
      notifications: {
        lesson_reminders: notifications.lesson_reminders,
        lesson_reminders_hours_before: 24,
        worksheet_assigned: notifications.worksheet_assigned,
        payment_due: notifications.payment_due,
        lesson_notes: notifications.lesson_notes,
      },
      contact_preference: (params.contactPreference as 'email' | 'phone' | 'text') || 'email',
    };

    // Complete onboarding with all collected data
    const success = await completeOnboarding({
      name: params.name || parent?.name || '',
      phone: params.phone || null,
      preferences,
    });

    if (success) {
      router.replace('/(auth)/onboarding/complete');
    } else {
      const message = 'Failed to save your preferences. Please try again.';
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('Error', message);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.neutral.text} />
        </Pressable>
        <Text style={styles.stepIndicator}>Step 2 of 2</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <Text style={styles.title}>Notification Preferences</Text>
        <Text style={styles.subtitle}>
          Stay updated on your children's tutoring journey. You can change these anytime in settings.
        </Text>

        {/* Notification Options */}
        <View style={styles.optionsList}>
          {NOTIFICATION_OPTIONS.map((option) => (
            <View key={option.key} style={styles.optionCard}>
              <View style={styles.optionIcon}>
                <Ionicons
                  name={option.icon as keyof typeof Ionicons.glyphMap}
                  size={24}
                  color={colors.primary.main}
                />
              </View>
              <View style={styles.optionInfo}>
                <Text style={styles.optionTitle}>{option.title}</Text>
                <Text style={styles.optionDescription}>{option.description}</Text>
              </View>
              <Switch
                value={notifications[option.key]}
                onValueChange={() => toggleNotification(option.key)}
                trackColor={{
                  false: colors.neutral.border,
                  true: colors.primary.main,
                }}
                thumbColor={colors.neutral.white}
                ios_backgroundColor={colors.neutral.border}
              />
            </View>
          ))}
        </View>

        {/* Info Note */}
        <View style={styles.infoNote}>
          <Ionicons
            name="information-circle-outline"
            size={18}
            color={colors.neutral.textSecondary}
          />
          <Text style={styles.infoText}>
            Notifications will be sent to your email. Push notifications coming soon!
          </Text>
        </View>

        {/* Spacer */}
        <View style={styles.spacer} />
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Button
          title={loading ? 'Saving...' : 'Complete Setup'}
          onPress={handleComplete}
          disabled={loading}
          style={styles.completeButton}
          icon={
            loading ? (
              <ActivityIndicator color={colors.neutral.white} size="small" />
            ) : (
              <Ionicons name="checkmark-circle" size={20} color={colors.neutral.white} />
            )
          }
          iconPosition="right"
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  backButton: {
    padding: spacing.sm,
  },
  stepIndicator: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    fontWeight: typography.weights.medium,
  },
  headerSpacer: {
    width: 40,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.xl,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  optionsList: {
    gap: spacing.md,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  optionInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  optionTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginBottom: 2,
  },
  optionDescription: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.neutral.background,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  infoText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    lineHeight: 20,
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
  completeButton: {
    width: '100%',
  },
});
