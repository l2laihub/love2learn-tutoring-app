/**
 * Business Setup Screen
 * Love2Learn Tutoring App
 *
 * First step of tutor onboarding - business information setup
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../../../src/lib/supabase';
import { useAuthContext } from '../../../../src/contexts/AuthContext';
import { Button } from '../../../../src/components/ui/Button';
import { colors, typography, spacing, borderRadius, shadows } from '../../../../src/theme';

// Common US timezones
const TIMEZONES = [
  { label: 'Eastern Time (ET)', value: 'America/New_York' },
  { label: 'Central Time (CT)', value: 'America/Chicago' },
  { label: 'Mountain Time (MT)', value: 'America/Denver' },
  { label: 'Pacific Time (PT)', value: 'America/Los_Angeles' },
  { label: 'Alaska Time (AKT)', value: 'America/Anchorage' },
  { label: 'Hawaii Time (HT)', value: 'Pacific/Honolulu' },
  { label: 'Arizona Time (MST)', value: 'America/Phoenix' },
];

export default function BusinessSetupScreen() {
  const { parent, refreshParent } = useAuthContext();

  const [businessName, setBusinessName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');
  const [showTimezonePicker, setShowTimezonePicker] = useState(false);
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill from parent data
  useEffect(() => {
    if (parent) {
      setBusinessName(parent.name || '');
      setContactEmail(parent.email || '');
      setContactPhone(parent.phone || '');
    }
  }, [parent]);

  const handlePickLogo = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setLogoUri(result.assets[0].uri);
      }
    } catch (err) {
      console.error('Error picking image:', err);
    }
  };

  const formatPhoneNumber = (text: string) => {
    // Remove all non-digits
    const cleaned = text.replace(/\D/g, '');

    // Format as (XXX) XXX-XXXX
    if (cleaned.length <= 3) {
      return cleaned;
    } else if (cleaned.length <= 6) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    } else {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
    }
  };

  const handleContinue = async () => {
    setError(null);

    if (!businessName.trim()) {
      setError('Please enter your business name');
      return;
    }

    if (!contactEmail.trim()) {
      setError('Please enter a contact email');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contactEmail.trim())) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);

    try {
      // Update parent record with business info
      if (parent?.id) {
        const updateData: Record<string, any> = {
          name: businessName.trim(),
          email: contactEmail.trim().toLowerCase(),
          phone: contactPhone.trim() || null,
        };

        // If we have a logo, upload it
        if (logoUri) {
          const fileName = `${parent.id}-logo-${Date.now()}.jpg`;
          const response = await fetch(logoUri);
          const blob = await response.blob();

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, blob, {
              contentType: 'image/jpeg',
              upsert: true,
            });

          if (uploadError) {
            console.error('Logo upload error:', uploadError);
          } else if (uploadData) {
            const { data: { publicUrl } } = supabase.storage
              .from('avatars')
              .getPublicUrl(fileName);
            updateData.avatar_url = publicUrl;
          }
        }

        const { error: updateError } = await supabase
          .from('parents')
          .update(updateData)
          .eq('id', parent.id);

        if (updateError) {
          console.error('Error updating parent:', updateError);
          setError('Failed to save business information. Please try again.');
          return;
        }

        // Store timezone in tutor_settings or user metadata
        // For now, we'll store it in the user's metadata
        const { error: metaError } = await supabase.auth.updateUser({
          data: { timezone }
        });

        if (metaError) {
          console.error('Error updating timezone:', metaError);
        }

        // Refresh parent data
        await refreshParent();
      }

      // Navigate to next step
      router.push('/(auth)/onboarding/tutor/subjects');
    } catch (err) {
      console.error('Error saving business info:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedTimezone = TIMEZONES.find(tz => tz.value === timezone);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Progress Indicator */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: '25%' }]} />
            </View>
            <Text style={styles.progressText}>Step 1 of 4</Text>
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons name="business" size={32} color={colors.primary.main} />
            </View>
            <Text style={styles.title}>Set Up Your Business</Text>
            <Text style={styles.subtitle}>
              Tell us about your tutoring business so we can personalize your experience
            </Text>
          </View>

          {/* Logo Upload */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Business Logo (Optional)</Text>
            <TouchableOpacity
              style={styles.logoUpload}
              onPress={handlePickLogo}
              disabled={isLoading}
            >
              {logoUri ? (
                <Image source={{ uri: logoUri }} style={styles.logoImage} />
              ) : (
                <View style={styles.logoPlaceholder}>
                  <Ionicons name="camera-outline" size={32} color={colors.neutral.textMuted} />
                  <Text style={styles.logoPlaceholderText}>Add Logo</Text>
                </View>
              )}
              <View style={styles.logoEditBadge}>
                <Ionicons name="pencil" size={14} color={colors.neutral.white} />
              </View>
            </TouchableOpacity>
          </View>

          {/* Form Fields */}
          <View style={styles.form}>
            {/* Business Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Business Name *</Text>
              <View style={styles.inputContainer}>
                <Ionicons
                  name="business-outline"
                  size={20}
                  color={colors.neutral.textMuted}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Love to Learn Academy"
                  placeholderTextColor={colors.neutral.textMuted}
                  value={businessName}
                  onChangeText={setBusinessName}
                  autoCapitalize="words"
                  editable={!isLoading}
                />
              </View>
            </View>

            {/* Contact Email */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Contact Email *</Text>
              <View style={styles.inputContainer}>
                <Ionicons
                  name="mail-outline"
                  size={20}
                  color={colors.neutral.textMuted}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="contact@yourbusiness.com"
                  placeholderTextColor={colors.neutral.textMuted}
                  value={contactEmail}
                  onChangeText={setContactEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  editable={!isLoading}
                />
              </View>
            </View>

            {/* Contact Phone */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Contact Phone (Optional)</Text>
              <View style={styles.inputContainer}>
                <Ionicons
                  name="call-outline"
                  size={20}
                  color={colors.neutral.textMuted}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="(555) 123-4567"
                  placeholderTextColor={colors.neutral.textMuted}
                  value={contactPhone}
                  onChangeText={(text) => setContactPhone(formatPhoneNumber(text))}
                  keyboardType="phone-pad"
                  editable={!isLoading}
                  maxLength={14}
                />
              </View>
            </View>

            {/* Timezone */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Timezone *</Text>
              <TouchableOpacity
                style={styles.inputContainer}
                onPress={() => setShowTimezonePicker(!showTimezonePicker)}
                disabled={isLoading}
              >
                <Ionicons
                  name="time-outline"
                  size={20}
                  color={colors.neutral.textMuted}
                  style={styles.inputIcon}
                />
                <Text style={styles.selectText}>
                  {selectedTimezone?.label || 'Select timezone'}
                </Text>
                <Ionicons
                  name={showTimezonePicker ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={colors.neutral.textMuted}
                />
              </TouchableOpacity>

              {/* Timezone Dropdown */}
              {showTimezonePicker && (
                <View style={styles.dropdown}>
                  {TIMEZONES.map((tz) => (
                    <TouchableOpacity
                      key={tz.value}
                      style={[
                        styles.dropdownItem,
                        timezone === tz.value && styles.dropdownItemSelected,
                      ]}
                      onPress={() => {
                        setTimezone(tz.value);
                        setShowTimezonePicker(false);
                      }}
                    >
                      <Text style={[
                        styles.dropdownItemText,
                        timezone === tz.value && styles.dropdownItemTextSelected,
                      ]}>
                        {tz.label}
                      </Text>
                      {timezone === tz.value && (
                        <Ionicons name="checkmark" size={20} color={colors.primary.main} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
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
            title={isLoading ? 'Saving...' : 'Continue'}
            onPress={handleContinue}
            disabled={isLoading}
            loading={isLoading}
            icon="arrow-forward"
            iconPosition="right"
            style={styles.continueButton}
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
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary.subtle,
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
  section: {
    marginBottom: spacing.xl,
  },
  sectionLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.textSecondary,
    marginBottom: spacing.sm,
  },
  logoUpload: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.neutral.background,
    alignSelf: 'center',
    position: 'relative',
    ...shadows.sm,
  },
  logoImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  logoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoPlaceholderText: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
    marginTop: spacing.xs,
  },
  logoEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.neutral.white,
  },
  form: {
    gap: spacing.base,
  },
  inputGroup: {
    marginBottom: spacing.sm,
  },
  inputLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
    marginBottom: spacing.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.base,
    borderWidth: 1,
    borderColor: colors.neutral.borderLight,
    minHeight: 52,
  },
  inputIcon: {
    marginRight: spacing.md,
  },
  input: {
    flex: 1,
    height: 52,
    fontSize: typography.sizes.base,
    color: colors.neutral.text,
  },
  selectText: {
    flex: 1,
    fontSize: typography.sizes.base,
    color: colors.neutral.text,
    paddingVertical: spacing.base,
  },
  dropdown: {
    marginTop: spacing.sm,
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    ...shadows.md,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.borderLight,
  },
  dropdownItemSelected: {
    backgroundColor: colors.primary.subtle,
  },
  dropdownItemText: {
    fontSize: typography.sizes.base,
    color: colors.neutral.text,
  },
  dropdownItemTextSelected: {
    color: colors.primary.main,
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
  },
});
