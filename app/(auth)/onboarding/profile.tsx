/**
 * Profile Completion Screen
 * Second step of parent onboarding - verify/update profile information
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '../../../src/contexts/AuthContext';
import { Input } from '../../../src/components/ui/Input';
import { Button } from '../../../src/components/ui/Button';
import { colors, spacing, typography, borderRadius } from '../../../src/theme';

type ContactPreference = 'email' | 'phone' | 'text';

export default function ProfileScreen() {
  const { parent } = useAuthContext();

  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [contactPreference, setContactPreference] = useState<ContactPreference>('email');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize form with parent data
  useEffect(() => {
    if (parent) {
      setName(parent.name || '');
      setPhone(parent.phone || '');
      // Get contact preference from existing preferences if available
      const prefs = parent.preferences as { contact_preference?: ContactPreference } | null;
      if (prefs?.contact_preference) {
        setContactPreference(prefs.contact_preference);
      }
    }
  }, [parent]);

  const formatPhone = (text: string): string => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length <= 3) {
      return cleaned;
    } else if (cleaned.length <= 6) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    } else {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }

    // Phone is optional, but validate format if provided
    if (phone) {
      const phoneDigits = phone.replace(/\D/g, '');
      if (phoneDigits.length > 0 && phoneDigits.length < 10) {
        newErrors.phone = 'Please enter a complete phone number';
      }
    }

    // If contact preference is phone or text, phone is required
    if ((contactPreference === 'phone' || contactPreference === 'text') && !phone) {
      newErrors.phone = 'Phone number required for this contact preference';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleBack = () => {
    router.back();
  };

  const handleContinue = () => {
    if (!validate()) return;

    // Store form data in router params to pass to next screen
    router.push({
      pathname: '/(auth)/onboarding/notifications',
      params: {
        name: name.trim(),
        phone: phone.trim() || '',
        contactPreference,
      },
    });
  };

  const contactOptions: { value: ContactPreference; label: string; icon: string }[] = [
    { value: 'email', label: 'Email', icon: 'mail-outline' },
    { value: 'phone', label: 'Phone', icon: 'call-outline' },
    { value: 'text', label: 'Text', icon: 'chatbubble-outline' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.neutral.text} />
          </Pressable>
          <Text style={styles.stepIndicator}>Step 1 of 2</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Title */}
          <Text style={styles.title}>Complete Your Profile</Text>
          <Text style={styles.subtitle}>
            Make sure your information is correct so your tutor can reach you.
          </Text>

          {/* Form */}
          <View style={styles.form}>
            {/* Name Input */}
            <Input
              label="Full Name"
              placeholder="Enter your full name"
              value={name}
              onChangeText={setName}
              error={errors.name}
              autoCapitalize="words"
            />

            {/* Email Display (locked) */}
            <View style={styles.lockedField}>
              <Text style={styles.lockedLabel}>Email</Text>
              <View style={styles.lockedInput}>
                <Text style={styles.lockedValue}>{parent?.email || ''}</Text>
                <View style={styles.lockedBadge}>
                  <Ionicons name="lock-closed" size={12} color={colors.neutral.textMuted} />
                  <Text style={styles.lockedBadgeText}>Verified</Text>
                </View>
              </View>
            </View>

            {/* Phone Input */}
            <Input
              label="Phone Number"
              placeholder="(555) 123-4567"
              value={phone}
              onChangeText={(text) => setPhone(formatPhone(text))}
              error={errors.phone}
              keyboardType="phone-pad"
              maxLength={14}
            />

            {/* Contact Preference */}
            <View style={styles.preferenceSection}>
              <Text style={styles.preferenceLabel}>Preferred Contact Method</Text>
              <View style={styles.preferenceOptions}>
                {contactOptions.map((option) => (
                  <Pressable
                    key={option.value}
                    style={[
                      styles.preferenceOption,
                      contactPreference === option.value && styles.preferenceOptionSelected,
                    ]}
                    onPress={() => setContactPreference(option.value)}
                  >
                    <Ionicons
                      name={option.icon as keyof typeof Ionicons.glyphMap}
                      size={20}
                      color={
                        contactPreference === option.value
                          ? colors.primary.main
                          : colors.neutral.textSecondary
                      }
                    />
                    <Text
                      style={[
                        styles.preferenceOptionText,
                        contactPreference === option.value && styles.preferenceOptionTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                    {contactPreference === option.value && (
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color={colors.primary.main}
                        style={styles.checkIcon}
                      />
                    )}
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          {/* Spacer */}
          <View style={styles.spacer} />
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <Button
            title="Continue"
            onPress={handleContinue}
            style={styles.continueButton}
            icon={<Ionicons name="arrow-forward" size={20} color={colors.neutral.white} />}
            iconPosition="right"
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.white,
  },
  keyboardView: {
    flex: 1,
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
  form: {
    gap: spacing.md,
  },
  lockedField: {
    marginBottom: spacing.md,
  },
  lockedLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
    marginBottom: spacing.xs,
  },
  lockedInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  lockedValue: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.neutral.white,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  lockedBadgeText: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
  },
  preferenceSection: {
    marginTop: spacing.md,
  },
  preferenceLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
    marginBottom: spacing.sm,
  },
  preferenceOptions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  preferenceOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  preferenceOptionSelected: {
    backgroundColor: colors.primary.subtle,
    borderColor: colors.primary.main,
  },
  preferenceOptionText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    fontWeight: typography.weights.medium,
  },
  preferenceOptionTextSelected: {
    color: colors.primary.main,
  },
  checkIcon: {
    position: 'absolute',
    top: 4,
    right: 4,
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
  },
});
