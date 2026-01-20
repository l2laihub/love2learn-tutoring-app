/**
 * RateSettingsModal.tsx
 * Modal for tutors to configure their rates per subject with base duration
 * Supports rates like $35/30min for piano, $45/60min for math
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import { SubjectRates, SubjectRateConfig, TutoringSubject, DurationPrices } from '../types/database';
import { useTutorSettings, useUpdateTutorSettings, formatRateDisplay } from '../hooks/useTutorSettings';

interface RateSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  onSave?: () => void;
}

// Subject display info with default durations
const SUBJECTS: { key: TutoringSubject; label: string; emoji: string; defaultDuration: number }[] = [
  { key: 'piano', label: 'Piano', emoji: '🎹', defaultDuration: 30 },
  { key: 'math', label: 'Math', emoji: '➗', defaultDuration: 60 },
  { key: 'reading', label: 'Reading', emoji: '📖', defaultDuration: 60 },
  { key: 'speech', label: 'Speech', emoji: '🗣️', defaultDuration: 60 },
  { key: 'english', label: 'English', emoji: '📝', defaultDuration: 60 },
];

// Duration options for picker
const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];

// Common duration tiers for explicit pricing
const DURATION_TIERS = [30, 45, 60, 90] as const;

interface SubjectRateFormState {
  rate: string;
  duration: number;
  enabled: boolean;
  useTiers: boolean;  // Whether to use explicit duration tier pricing
  tierPrices: Record<number, string>;  // Explicit prices per duration (e.g., { 30: '35', 45: '50', 60: '65' })
}

export function RateSettingsModal({ visible, onClose, onSave }: RateSettingsModalProps) {
  const { data: settings, loading, refetch } = useTutorSettings();
  const updateSettings = useUpdateTutorSettings();

  // Form state
  const [defaultRate, setDefaultRate] = useState('45');
  const [defaultDuration, setDefaultDuration] = useState(60);
  const [combinedRate, setCombinedRate] = useState('40');
  const [subjectRates, setSubjectRates] = useState<Record<string, SubjectRateFormState>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize form when settings load
  useEffect(() => {
    if (settings) {
      setDefaultRate(settings.default_rate.toString());
      setDefaultDuration(settings.default_base_duration);
      setCombinedRate(settings.combined_session_rate.toString());

      const rates: Record<string, SubjectRateFormState> = {};
      SUBJECTS.forEach(subject => {
        const rateConfig = settings.subject_rates?.[subject.key];
        if (rateConfig && rateConfig.rate > 0) {
          // Check if duration_prices are set
          const hasTiers = rateConfig.duration_prices && Object.keys(rateConfig.duration_prices).length > 0;
          const tierPrices: Record<number, string> = {};

          if (hasTiers && rateConfig.duration_prices) {
            // Load existing tier prices
            DURATION_TIERS.forEach(dur => {
              const price = rateConfig.duration_prices?.[dur as keyof DurationPrices];
              tierPrices[dur] = price !== undefined && price !== null ? price.toString() : '';
            });
          }

          rates[subject.key] = {
            rate: rateConfig.rate.toString(),
            duration: rateConfig.base_duration,
            enabled: true,
            useTiers: hasTiers || false,
            tierPrices,
          };
        } else {
          rates[subject.key] = {
            rate: '',
            duration: subject.defaultDuration,
            enabled: false,
            useTiers: false,
            tierPrices: {},
          };
        }
      });
      setSubjectRates(rates);
      setHasChanges(false);
    }
  }, [settings]);

  // Track changes
  const handleDefaultRateChange = (value: string) => {
    setDefaultRate(value);
    setHasChanges(true);
  };

  const handleDefaultDurationChange = (duration: number) => {
    setDefaultDuration(duration);
    setHasChanges(true);
  };

  const handleCombinedRateChange = (value: string) => {
    setCombinedRate(value);
    setHasChanges(true);
  };

  const handleSubjectRateChange = (subject: string, value: string) => {
    setSubjectRates(prev => ({
      ...prev,
      [subject]: { ...prev[subject], rate: value, enabled: value.trim() !== '' },
    }));
    setHasChanges(true);
  };

  const handleSubjectDurationChange = (subject: string, duration: number) => {
    setSubjectRates(prev => ({
      ...prev,
      [subject]: { ...prev[subject], duration },
    }));
    setHasChanges(true);
  };

  const handleToggleTiers = (subject: string) => {
    setSubjectRates(prev => ({
      ...prev,
      [subject]: {
        ...prev[subject],
        useTiers: !prev[subject]?.useTiers,
        tierPrices: prev[subject]?.tierPrices || {},
      },
    }));
    setHasChanges(true);
  };

  const handleTierPriceChange = (subject: string, duration: number, value: string) => {
    setSubjectRates(prev => ({
      ...prev,
      [subject]: {
        ...prev[subject],
        tierPrices: {
          ...prev[subject]?.tierPrices,
          [duration]: value,
        },
        enabled: true, // Enable subject when tier price is set
      },
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    // Validate inputs
    const parsedDefault = parseFloat(defaultRate);
    const parsedCombined = parseFloat(combinedRate);

    if (isNaN(parsedDefault) || parsedDefault <= 0) {
      Alert.alert('Invalid Rate', 'Please enter a valid default rate');
      return;
    }

    if (isNaN(parsedCombined) || parsedCombined <= 0) {
      Alert.alert('Invalid Rate', 'Please enter a valid combined session rate');
      return;
    }

    // Build subject rates object (only include enabled subjects with valid rates)
    const parsedSubjectRates: SubjectRates = {};
    for (const subject of SUBJECTS) {
      const formState = subjectRates[subject.key];
      if (formState?.enabled && formState.rate.trim() !== '') {
        const parsed = parseFloat(formState.rate);
        if (!isNaN(parsed) && parsed > 0) {
          const rateConfig: SubjectRateConfig = {
            rate: parsed,
            base_duration: formState.duration,
          };

          // Add duration_prices if tier mode is enabled
          if (formState.useTiers && formState.tierPrices) {
            const durationPrices: Record<string, number> = {};
            let hasTierPrices = false;

            // Use string keys explicitly for JSON compatibility
            DURATION_TIERS.forEach(dur => {
              // Access with both number and string key for safety
              const tierPricesObj = formState.tierPrices as Record<string | number, string>;
              const priceStr = tierPricesObj[dur] || tierPricesObj[String(dur)];
              if (priceStr && priceStr.trim() !== '') {
                const priceVal = parseFloat(priceStr);
                if (!isNaN(priceVal) && priceVal > 0) {
                  // Store with string key for JSON/database compatibility
                  durationPrices[String(dur)] = priceVal;
                  hasTierPrices = true;
                }
              }
            });

            if (hasTierPrices) {
              rateConfig.duration_prices = durationPrices as DurationPrices;
            }
          }

          parsedSubjectRates[subject.key] = rateConfig;
        }
      }
    }

    // DEBUG: Log what we're about to save
    console.log('[RateSettingsModal] Saving subject_rates:', JSON.stringify(parsedSubjectRates, null, 2));

    const result = await updateSettings.mutate({
      default_rate: parsedDefault,
      default_base_duration: defaultDuration,
      combined_session_rate: parsedCombined,
      subject_rates: parsedSubjectRates,
    });

    if (result) {
      setHasChanges(false);
      await refetch();
      onSave?.();
      Alert.alert('Success', 'Rate settings saved successfully');
    } else {
      Alert.alert('Error', updateSettings.error?.message || 'Failed to save settings');
    }
  };

  const handleClose = () => {
    if (hasChanges) {
      Alert.alert(
        'Unsaved Changes',
        'You have unsaved changes. Are you sure you want to close?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: onClose },
        ]
      );
    } else {
      onClose();
    }
  };

  // Calculate example amounts - now supports tier pricing
  const calculateExample = (lessonDuration: number, subjectKey: string): { amount: number; isTier: boolean } => {
    const formState = subjectRates[subjectKey];

    // Check for tier pricing first
    if (formState?.enabled && formState.useTiers && formState.tierPrices) {
      const tierPrice = formState.tierPrices[lessonDuration];
      if (tierPrice && tierPrice.trim() !== '') {
        const parsed = parseFloat(tierPrice);
        if (!isNaN(parsed) && parsed > 0) {
          return { amount: parsed, isTier: true };
        }
      }
    }

    // Fall back to linear calculation
    const { rate, duration } = getSubjectRate(subjectKey);
    return { amount: (lessonDuration / duration) * rate, isTier: false };
  };

  const getSubjectRate = (subjectKey: string): { rate: number; duration: number } => {
    const formState = subjectRates[subjectKey];
    if (formState?.enabled && formState.rate) {
      const parsed = parseFloat(formState.rate);
      if (!isNaN(parsed) && parsed > 0) {
        return { rate: parsed, duration: formState.duration };
      }
    }
    return { rate: parseFloat(defaultRate) || 45, duration: defaultDuration };
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.closeButton} onPress={handleClose}>
            <Ionicons name="close" size={24} color={colors.neutral.text} />
          </Pressable>
          <Text style={styles.title}>Rate Settings</Text>
          <Pressable
            style={[styles.saveButton, !hasChanges && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!hasChanges || updateSettings.loading}
          >
            {updateSettings.loading ? (
              <ActivityIndicator size="small" color={colors.neutral.white} />
            ) : (
              <Text style={[styles.saveButtonText, !hasChanges && styles.saveButtonTextDisabled]}>
                Save
              </Text>
            )}
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.piano.primary} />
            <Text style={styles.loadingText}>Loading settings...</Text>
          </View>
        ) : (
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Default Rate */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Default Rate</Text>
              <Text style={styles.sectionDescription}>
                This rate applies to lessons when no subject-specific rate is set.
              </Text>
              <View style={styles.rateRow}>
                <View style={styles.rateInputContainer}>
                  <Text style={styles.currencySymbol}>$</Text>
                  <TextInput
                    style={styles.rateInput}
                    value={defaultRate}
                    onChangeText={handleDefaultRateChange}
                    keyboardType="decimal-pad"
                    placeholder="45"
                    placeholderTextColor={colors.neutral.textMuted}
                  />
                </View>
                <Text style={styles.perText}>per</Text>
                <View style={styles.durationPicker}>
                  {DURATION_OPTIONS.filter(d => [30, 60].includes(d)).map(duration => (
                    <Pressable
                      key={duration}
                      style={[
                        styles.durationOption,
                        defaultDuration === duration && styles.durationOptionSelected,
                      ]}
                      onPress={() => handleDefaultDurationChange(duration)}
                    >
                      <Text
                        style={[
                          styles.durationOptionText,
                          defaultDuration === duration && styles.durationOptionTextSelected,
                        ]}
                      >
                        {duration}min
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            {/* Combined Session Rate */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Combined Session Rate</Text>
              <Text style={styles.sectionDescription}>
                Flat rate per student for group/combined sessions (regardless of duration).
              </Text>
              <View style={styles.rateInputContainer}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={styles.rateInput}
                  value={combinedRate}
                  onChangeText={handleCombinedRateChange}
                  keyboardType="decimal-pad"
                  placeholder="40"
                  placeholderTextColor={colors.neutral.textMuted}
                />
                <Text style={styles.rateUnit}>/session</Text>
              </View>
            </View>

            {/* Subject-Specific Rates */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Subject Rates</Text>
              <Text style={styles.sectionDescription}>
                Set custom rates for specific subjects. Leave empty to use default rate.
              </Text>

              <View style={styles.subjectRatesContainer}>
                {SUBJECTS.map(subject => {
                  const formState = subjectRates[subject.key] || { rate: '', duration: subject.defaultDuration, enabled: false, useTiers: false, tierPrices: {} };
                  return (
                    <View key={subject.key} style={styles.subjectRateCard}>
                      <View style={styles.subjectHeader}>
                        <Text style={styles.subjectEmoji}>{subject.emoji}</Text>
                        <Text style={styles.subjectName}>{subject.label}</Text>
                        {formState.enabled && (
                          <View style={styles.customBadge}>
                            <Text style={styles.customBadgeText}>{formState.useTiers ? 'Tiers' : 'Custom'}</Text>
                          </View>
                        )}
                      </View>

                      {/* Base rate row */}
                      <View style={styles.subjectRateRow}>
                        <View style={styles.subjectInputGroup}>
                          <View style={styles.subjectRateInputContainer}>
                            <Text style={styles.currencySymbolSmall}>$</Text>
                            <TextInput
                              style={styles.subjectRateInput}
                              value={formState.rate}
                              onChangeText={(value) => handleSubjectRateChange(subject.key, value)}
                              keyboardType="decimal-pad"
                              placeholder=""
                              placeholderTextColor={colors.neutral.textMuted}
                            />
                          </View>
                          <Text style={styles.perTextSmall}>per</Text>
                          <Pressable
                            style={[
                              styles.durationOptionSmall,
                              formState.duration === 30 && styles.durationOptionSmallSelected,
                            ]}
                            onPress={() => handleSubjectDurationChange(subject.key, 30)}
                          >
                            <Text
                              style={[
                                styles.durationOptionTextSmall,
                                formState.duration === 30 && styles.durationOptionTextSmallSelected,
                              ]}
                            >
                              30m
                            </Text>
                          </Pressable>
                          <Pressable
                            style={[
                              styles.durationOptionSmall,
                              formState.duration === 60 && styles.durationOptionSmallSelected,
                            ]}
                            onPress={() => handleSubjectDurationChange(subject.key, 60)}
                          >
                            <Text
                              style={[
                                styles.durationOptionTextSmall,
                                formState.duration === 60 && styles.durationOptionTextSmallSelected,
                              ]}
                            >
                              60m
                            </Text>
                          </Pressable>
                        </View>
                      </View>

                      {/* Duration Tiers toggle and inputs */}
                      {formState.enabled && (
                        <View style={styles.tiersSection}>
                          <Pressable
                            style={styles.tiersToggle}
                            onPress={() => handleToggleTiers(subject.key)}
                          >
                            <Ionicons
                              name={formState.useTiers ? 'checkbox' : 'square-outline'}
                              size={20}
                              color={formState.useTiers ? colors.piano.primary : colors.neutral.textMuted}
                            />
                            <Text style={styles.tiersToggleText}>Custom prices per duration</Text>
                          </Pressable>

                          {formState.useTiers && (
                            <View style={styles.tiersInputsContainer}>
                              <View style={styles.tiersGrid}>
                                {DURATION_TIERS.map(dur => (
                                  <View key={dur} style={styles.tierInputRow}>
                                    <View style={styles.tierInputContainer}>
                                      <Text style={styles.currencySymbolTiny}>$</Text>
                                      <TextInput
                                        style={styles.tierInput}
                                        value={formState.tierPrices?.[dur] || ''}
                                        onChangeText={(value) => handleTierPriceChange(subject.key, dur, value)}
                                        keyboardType="decimal-pad"
                                        placeholder="—"
                                        placeholderTextColor={colors.neutral.textMuted}
                                      />
                                    </View>
                                    <Text style={styles.tierLabel}>/{dur}m</Text>
                                  </View>
                                ))}
                              </View>
                              <Text style={styles.tiersHint}>
                                Leave empty to use base rate calculation
                              </Text>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Example Calculations */}
            <View style={styles.exampleSection}>
              <Text style={styles.exampleTitle}>Example Calculations</Text>
              <View style={styles.exampleCard}>
                {(() => {
                  const pianoRate = getSubjectRate('piano');
                  const mathRate = getSubjectRate('math');
                  const piano30 = calculateExample(30, 'piano');
                  const piano45 = calculateExample(45, 'piano');
                  const piano60 = calculateExample(60, 'piano');
                  const math60 = calculateExample(60, 'math');
                  return (
                    <>
                      <View style={styles.exampleRow}>
                        <Text style={styles.exampleLabel}>
                          30-min Piano{piano30.isTier ? ' (tier)' : ` (${formatRateDisplay(pianoRate.rate, pianoRate.duration)})`}:
                        </Text>
                        <Text style={[styles.exampleValue, piano30.isTier && styles.exampleValueTier]}>
                          ${piano30.amount.toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.exampleRow}>
                        <Text style={styles.exampleLabel}>
                          45-min Piano{piano45.isTier ? ' (tier)' : ` (${formatRateDisplay(pianoRate.rate, pianoRate.duration)})`}:
                        </Text>
                        <Text style={[styles.exampleValue, piano45.isTier && styles.exampleValueTier]}>
                          ${piano45.amount.toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.exampleRow}>
                        <Text style={styles.exampleLabel}>
                          60-min Piano{piano60.isTier ? ' (tier)' : ` (${formatRateDisplay(pianoRate.rate, pianoRate.duration)})`}:
                        </Text>
                        <Text style={[styles.exampleValue, piano60.isTier && styles.exampleValueTier]}>
                          ${piano60.amount.toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.exampleRow}>
                        <Text style={styles.exampleLabel}>
                          60-min Math{math60.isTier ? ' (tier)' : ` (${formatRateDisplay(mathRate.rate, mathRate.duration)})`}:
                        </Text>
                        <Text style={[styles.exampleValue, math60.isTier && styles.exampleValueTier]}>
                          ${math60.amount.toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.exampleRow}>
                        <Text style={styles.exampleLabel}>Combined session (2 students):</Text>
                        <Text style={styles.exampleValue}>
                          ${(parseFloat(combinedRate || '40') * 2).toFixed(2)}
                        </Text>
                      </View>
                    </>
                  );
                })()}
              </View>
            </View>

            <View style={styles.bottomPadding} />
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
    backgroundColor: colors.neutral.white,
  },
  closeButton: {
    padding: spacing.xs,
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  saveButton: {
    backgroundColor: colors.piano.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    minWidth: 70,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: colors.neutral.border,
  },
  saveButtonText: {
    color: colors.neutral.white,
    fontWeight: typography.weights.semibold,
    fontSize: typography.sizes.sm,
  },
  saveButtonTextDisabled: {
    color: colors.neutral.textMuted,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: typography.sizes.md,
    color: colors.neutral.textSecondary,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  section: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  sectionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginBottom: spacing.xs,
  },
  sectionDescription: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rateInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    paddingHorizontal: spacing.md,
    flex: 1,
    maxWidth: 120,
  },
  currencySymbol: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginRight: spacing.xs,
  },
  rateInput: {
    flex: 1,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    paddingVertical: spacing.md,
  },
  rateUnit: {
    fontSize: typography.sizes.md,
    color: colors.neutral.textSecondary,
    marginLeft: spacing.xs,
  },
  perText: {
    fontSize: typography.sizes.md,
    color: colors.neutral.textSecondary,
  },
  durationPicker: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  durationOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    backgroundColor: colors.neutral.background,
  },
  durationOptionSelected: {
    borderColor: colors.piano.primary,
    backgroundColor: colors.piano.subtle,
  },
  durationOptionText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    fontWeight: typography.weights.medium,
  },
  durationOptionTextSelected: {
    color: colors.piano.primary,
  },
  subjectRatesContainer: {
    gap: spacing.sm,
  },
  subjectRateCard: {
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral.borderLight,
  },
  subjectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  subjectEmoji: {
    fontSize: typography.sizes.lg,
  },
  subjectName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
    flex: 1,
  },
  customBadge: {
    backgroundColor: colors.piano.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  customBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
  },
  subjectRateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subjectInputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  subjectRateInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    paddingHorizontal: spacing.sm,
    width: 80,
  },
  currencySymbolSmall: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
  },
  subjectRateInput: {
    flex: 1,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    textAlign: 'right',
    minWidth: 40,
  },
  perTextSmall: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },
  durationOptionSmall: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    backgroundColor: colors.neutral.white,
  },
  durationOptionSmallSelected: {
    borderColor: colors.piano.primary,
    backgroundColor: colors.piano.subtle,
  },
  durationOptionTextSmall: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textSecondary,
    fontWeight: typography.weights.medium,
  },
  durationOptionTextSmallSelected: {
    color: colors.piano.primary,
  },
  exampleSection: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  exampleTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.textSecondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  exampleCard: {
    backgroundColor: colors.piano.subtle,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.piano.primary,
  },
  exampleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  exampleLabel: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    flex: 1,
  },
  exampleValue: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.piano.primary,
  },
  exampleValueTier: {
    color: colors.status.success,
  },
  bottomPadding: {
    height: spacing.xl,
  },
  // Duration tiers styles
  tiersSection: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.borderLight,
  },
  tiersToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  tiersToggleText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },
  tiersInputsContainer: {
    marginTop: spacing.sm,
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
  },
  tiersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tierInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tierLabel: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textSecondary,
    marginLeft: 2,
  },
  tierInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    paddingLeft: spacing.sm,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
    gap: 2,
  },
  currencySymbolTiny: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
  },
  tierInput: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
    width: 45,
    paddingVertical: 4,
    textAlign: 'right',
  },
  tiersHint: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
    fontStyle: 'italic',
    width: '100%',
    marginTop: spacing.xs,
  },
});
