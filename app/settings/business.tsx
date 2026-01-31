/**
 * Business Profile Settings Screen
 * Allows tutors to update their business profile information
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../../src/theme';
import {
  useTutorProfile,
  useUpdateBusinessInfo,
  useLogoUpload,
  TIMEZONE_OPTIONS,
} from '../../src/hooks/useTutorProfile';
import { useResponsive } from '../../src/hooks/useResponsive';

// Phone number formatting
function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 0) return '';
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
  return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
}

function unformatPhoneNumber(phone: string): string {
  return phone.replace(/\D/g, '');
}

export default function BusinessSettingsScreen() {
  const { data: profile, loading, error, refetch } = useTutorProfile();
  const updateBusinessInfo = useUpdateBusinessInfo();
  const logoUpload = useLogoUpload();
  const { isDesktop } = useResponsive();

  // Form state
  const [businessName, setBusinessName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [showTimezoneDropdown, setShowTimezoneDropdown] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  // Initialize form from profile
  useEffect(() => {
    if (profile) {
      setBusinessName(profile.name || '');
      setContactEmail(profile.email || '');
      setContactPhone(profile.phone ? formatPhoneNumber(profile.phone) : '');
      setTimezone(profile.timezone || 'America/New_York');
      setLogoUrl(profile.logoUrl);
      setHasChanges(false);
    }
  }, [profile]);

  // Track changes
  const handleFieldChange = useCallback((setter: (value: string) => void, value: string) => {
    setter(value);
    setHasChanges(true);
  }, []);

  // Handle phone formatting
  const handlePhoneChange = (value: string) => {
    const formatted = formatPhoneNumber(value);
    setContactPhone(formatted);
    setHasChanges(true);
  };

  // Handle timezone selection
  const handleTimezoneSelect = (value: string) => {
    setTimezone(value);
    setShowTimezoneDropdown(false);
    setHasChanges(true);
  };

  // Handle logo upload
  const handleLogoUpload = async () => {
    if (!profile?.id) return;

    const url = await logoUpload.uploadLogo(profile.id, (newUrl) => {
      setLogoUrl(newUrl);
      setHasChanges(true);
    });

    if (url) {
      setLogoUrl(url);
      setHasChanges(true);
    }
  };

  // Handle logo delete
  const handleLogoDelete = async () => {
    if (!logoUrl) return;

    Alert.alert(
      'Remove Logo',
      'Are you sure you want to remove your business logo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const success = await logoUpload.deleteLogo(logoUrl);
            if (success) {
              setLogoUrl(null);
              setHasChanges(true);
            }
          },
        },
      ]
    );
  };

  // Handle save
  const handleSave = async () => {
    // Validate
    if (!businessName.trim()) {
      Alert.alert('Validation Error', 'Business name is required');
      return;
    }

    if (!contactEmail.trim() || !contactEmail.includes('@')) {
      Alert.alert('Validation Error', 'Valid email address is required');
      return;
    }

    setSaving(true);

    try {
      const success = await updateBusinessInfo.mutate({
        name: businessName.trim(),
        email: contactEmail.trim(),
        phone: unformatPhoneNumber(contactPhone) || null,
        timezone,
      });

      if (success) {
        await refetch();
        setHasChanges(false);
        Alert.alert('Success', 'Business profile updated successfully');
      } else {
        Alert.alert('Error', updateBusinessInfo.error?.message || 'Failed to save changes');
      }
    } catch (err) {
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    if (hasChanges) {
      Alert.alert(
        'Discard Changes',
        'Are you sure you want to discard your changes?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => router.back(),
          },
        ]
      );
    } else {
      router.back();
    }
  };

  // Get selected timezone label
  const selectedTimezoneLabel = TIMEZONE_OPTIONS.find(tz => tz.value === timezone)?.label || timezone;

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !profile) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={colors.status.error} />
          <Text style={styles.errorTitle}>Failed to Load Profile</Text>
          <Text style={styles.errorText}>{error?.message || 'Profile not found'}</Text>
          <Pressable style={styles.retryButton} onPress={refetch}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            isDesktop && styles.scrollContentDesktop,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Business Logo</Text>
            <View style={styles.logoSection}>
              <Pressable
                style={styles.logoContainer}
                onPress={handleLogoUpload}
                disabled={logoUpload.uploading}
              >
                {logoUpload.uploading ? (
                  <View style={styles.logoPlaceholder}>
                    <ActivityIndicator size="small" color={colors.primary.main} />
                  </View>
                ) : logoUrl ? (
                  <Image source={{ uri: logoUrl }} style={styles.logoImage} />
                ) : (
                  <View style={styles.logoPlaceholder}>
                    <Ionicons name="image-outline" size={40} color={colors.neutral.textMuted} />
                    <Text style={styles.logoPlaceholderText}>Add Logo</Text>
                  </View>
                )}
                <View style={styles.logoEditBadge}>
                  <Ionicons name="camera" size={16} color={colors.neutral.white} />
                </View>
              </Pressable>

              {logoUrl && (
                <Pressable style={styles.deleteLogoButton} onPress={handleLogoDelete}>
                  <Ionicons name="trash-outline" size={18} color={colors.status.error} />
                  <Text style={styles.deleteLogoText}>Remove Logo</Text>
                </Pressable>
              )}
            </View>
            <Text style={styles.hint}>
              Square image recommended (1:1 ratio). Max 5MB.
            </Text>
          </View>

          {/* Business Information Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Business Information</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Business Name *</Text>
              <TextInput
                style={styles.input}
                value={businessName}
                onChangeText={(value) => handleFieldChange(setBusinessName, value)}
                placeholder="Your Business Name"
                placeholderTextColor={colors.neutral.textMuted}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Contact Email *</Text>
              <TextInput
                style={styles.input}
                value={contactEmail}
                onChangeText={(value) => handleFieldChange(setContactEmail, value)}
                placeholder="email@example.com"
                placeholderTextColor={colors.neutral.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Contact Phone</Text>
              <TextInput
                style={styles.input}
                value={contactPhone}
                onChangeText={handlePhoneChange}
                placeholder="(555) 123-4567"
                placeholderTextColor={colors.neutral.textMuted}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          {/* Timezone Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Timezone Settings</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Timezone</Text>
              <Pressable
                style={styles.dropdownButton}
                onPress={() => setShowTimezoneDropdown(!showTimezoneDropdown)}
              >
                <Text style={styles.dropdownText}>{selectedTimezoneLabel}</Text>
                <Ionicons
                  name={showTimezoneDropdown ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={colors.neutral.textSecondary}
                />
              </Pressable>

              {showTimezoneDropdown && (
                <View style={styles.dropdownList}>
                  {TIMEZONE_OPTIONS.map((tz) => (
                    <Pressable
                      key={tz.value}
                      style={[
                        styles.dropdownItem,
                        timezone === tz.value && styles.dropdownItemSelected,
                      ]}
                      onPress={() => handleTimezoneSelect(tz.value)}
                    >
                      <Text
                        style={[
                          styles.dropdownItemText,
                          timezone === tz.value && styles.dropdownItemTextSelected,
                        ]}
                      >
                        {tz.label}
                      </Text>
                      {timezone === tz.value && (
                        <Ionicons name="checkmark" size={20} color={colors.primary.main} />
                      )}
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.timezoneNote}>
              <Ionicons name="information-circle-outline" size={18} color={colors.neutral.textMuted} />
              <Text style={styles.timezoneNoteText}>
                This timezone affects how dates and times are displayed in your calendar and scheduling.
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <Pressable
              style={[styles.button, styles.cancelButton]}
              onPress={handleCancel}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>

            <Pressable
              style={[
                styles.button,
                styles.saveButton,
                (!hasChanges || saving) && styles.saveButtonDisabled,
              ]}
              onPress={handleSave}
              disabled={!hasChanges || saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.neutral.white} />
              ) : (
                <Text style={styles.saveButtonText}>Save Changes</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.background,
  },
  keyboardView: {
    flex: 1,
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  errorTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  errorText: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  retryButton: {
    backgroundColor: colors.primary.main,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  retryButtonText: {
    color: colors.neutral.white,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
  },
  section: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  sectionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginBottom: spacing.md,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.neutral.background,
    borderWidth: 2,
    borderColor: colors.neutral.border,
    borderStyle: 'dashed',
  },
  logoImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  logoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoPlaceholderText: {
    marginTop: spacing.xs,
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
  },
  logoEditBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    backgroundColor: colors.primary.main,
    borderRadius: borderRadius.full,
    padding: 6,
    borderWidth: 2,
    borderColor: colors.neutral.white,
  },
  deleteLogoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  deleteLogoText: {
    fontSize: typography.sizes.sm,
    color: colors.status.error,
    fontWeight: typography.weights.medium,
  },
  hint: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.neutral.background,
    borderWidth: 1.5,
    borderColor: colors.neutral.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.sizes.base,
    color: colors.neutral.text,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.neutral.background,
    borderWidth: 1.5,
    borderColor: colors.neutral.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  dropdownText: {
    fontSize: typography.sizes.base,
    color: colors.neutral.text,
  },
  dropdownList: {
    marginTop: spacing.sm,
    backgroundColor: colors.neutral.white,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: borderRadius.md,
    maxHeight: 250,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
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
  timezoneNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.sm,
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.md,
  },
  timezoneNoteText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  button: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  cancelButton: {
    backgroundColor: colors.neutral.white,
    borderWidth: 1.5,
    borderColor: colors.neutral.border,
  },
  cancelButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
  },
  saveButton: {
    backgroundColor: colors.primary.main,
  },
  saveButtonDisabled: {
    backgroundColor: colors.neutral.border,
  },
  saveButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
  },
});
