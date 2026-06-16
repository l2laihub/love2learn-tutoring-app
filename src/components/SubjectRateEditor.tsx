/**
 * SubjectRateEditor
 * Presentational, fully-controlled editor for ONE subject's rate: a base rate
 * row (amount + 30m/60m base duration) plus optional explicit per-duration
 * tier prices. Shared by RateSettingsModal and StudentRateSettingsModal.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '../theme';
import { DURATION_TIERS, SubjectRateFormState } from '../lib/subjectRateForm';

interface SubjectRateEditorProps {
  label: string;
  emoji: string;
  formState: SubjectRateFormState;
  /** Placeholder for the rate input — e.g. the tutor-wide rate being overridden. */
  ratePlaceholder?: string;
  onRateChange: (value: string) => void;
  onDurationChange: (duration: number) => void;
  onToggleTiers: () => void;
  onTierPriceChange: (duration: number, value: string) => void;
}

export function SubjectRateEditor({
  label,
  emoji,
  formState,
  ratePlaceholder,
  onRateChange,
  onDurationChange,
  onToggleTiers,
  onTierPriceChange,
}: SubjectRateEditorProps) {
  return (
    <View style={styles.subjectRateCard}>
      <View style={styles.subjectHeader}>
        <Text style={styles.subjectEmoji}>{emoji}</Text>
        <Text style={styles.subjectName}>{label}</Text>
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
              onChangeText={onRateChange}
              keyboardType="decimal-pad"
              placeholder={ratePlaceholder ?? ''}
              placeholderTextColor={colors.neutral.textMuted}
            />
          </View>
          <Text style={styles.perTextSmall}>per</Text>
          {[30, 60].map((dur) => (
            <Pressable
              key={dur}
              style={[styles.durationOptionSmall, formState.duration === dur && styles.durationOptionSmallSelected]}
              onPress={() => onDurationChange(dur)}
            >
              <Text
                style={[
                  styles.durationOptionTextSmall,
                  formState.duration === dur && styles.durationOptionTextSmallSelected,
                ]}
              >
                {dur}m
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Duration tiers */}
      {formState.enabled && (
        <View style={styles.tiersSection}>
          <Pressable style={styles.tiersToggle} onPress={onToggleTiers}>
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
                {DURATION_TIERS.map((dur) => (
                  <View key={dur} style={styles.tierInputRow}>
                    <View style={styles.tierInputContainer}>
                      <Text style={styles.currencySymbolTiny}>$</Text>
                      <TextInput
                        style={styles.tierInput}
                        value={formState.tierPrices?.[dur] || ''}
                        onChangeText={(value) => onTierPriceChange(dur, value)}
                        keyboardType="decimal-pad"
                        placeholder="—"
                        placeholderTextColor={colors.neutral.textMuted}
                      />
                    </View>
                    <Text style={styles.tierLabel}>/{dur}m</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.tiersHint}>Leave empty to use base rate calculation</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
  tierLabel: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textSecondary,
    marginLeft: 2,
  },
  tiersHint: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
    fontStyle: 'italic',
    width: '100%',
    marginTop: spacing.xs,
  },
});
