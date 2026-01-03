import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { colors, borderRadius, spacing, typography } from '../../theme';

type BadgeVariant = 'piano' | 'math' | 'reading' | 'speech' | 'english' | 'paid' | 'partial' | 'unpaid' | 'neutral' | 'info';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  style?: StyleProp<ViewStyle>;
}

export function Badge({
  label,
  variant = 'neutral',
  size = 'md',
  style,
}: BadgeProps) {
  return (
    <View style={[styles.base, styles[`variant_${variant}`], styles[`size_${size}`], style]}>
      <Text style={[styles.text, styles[`text_${variant}`], styles[`textSize_${size}`]]}>
        {label}
      </Text>
    </View>
  );
}

// Subject badge with icon
type SubjectType = 'piano' | 'math' | 'reading' | 'speech' | 'english';

interface SubjectBadgeProps {
  subject: string;
  size?: BadgeSize;
  style?: StyleProp<ViewStyle>;
}

const SUBJECT_LABELS: Record<string, string> = {
  piano: '🎹 Piano',
  math: '➗ Math',
  reading: '📖 Reading',
  speech: '🎤 Speech',
  english: '📝 English',
};

const VALID_VARIANTS: SubjectType[] = ['piano', 'math', 'reading', 'speech', 'english'];

export function SubjectBadge({ subject, size = 'md', style }: SubjectBadgeProps) {
  const label = SUBJECT_LABELS[subject] || `📚 ${subject.charAt(0).toUpperCase() + subject.slice(1)}`;
  const variant: BadgeVariant = VALID_VARIANTS.includes(subject as SubjectType) ? (subject as SubjectType) : 'neutral';
  return <Badge label={label} variant={variant} size={size} style={style} />;
}

// Payment status badge
interface PaymentBadgeProps {
  status: 'paid' | 'partial' | 'unpaid';
  size?: BadgeSize;
  style?: StyleProp<ViewStyle>;
}

export function PaymentBadge({ status, size = 'md', style }: PaymentBadgeProps) {
  const labels = {
    paid: '✓ Paid',
    partial: '◐ Partial',
    unpaid: '○ Unpaid',
  };
  return <Badge label={labels[status]} variant={status} size={size} style={style} />;
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    borderRadius: borderRadius.full,
  },

  // Sizes
  size_sm: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  size_md: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
  },

  // Variants
  variant_piano: {
    backgroundColor: colors.piano.subtle,
  },
  variant_math: {
    backgroundColor: colors.math.subtle,
  },
  variant_reading: {
    backgroundColor: '#F3E5F5',
  },
  variant_speech: {
    backgroundColor: '#FFF3E0',
  },
  variant_english: {
    backgroundColor: '#E3F2FD',
  },
  variant_paid: {
    backgroundColor: colors.math.subtle,
  },
  variant_partial: {
    backgroundColor: '#FFF8E1',
  },
  variant_unpaid: {
    backgroundColor: '#FFEBEE',
  },
  variant_neutral: {
    backgroundColor: colors.neutral.background,
  },
  variant_info: {
    backgroundColor: '#E3F2FD',
  },

  // Text
  text: {
    fontWeight: typography.weights.medium,
  },
  text_piano: {
    color: colors.piano.dark,
  },
  text_math: {
    color: colors.math.dark,
  },
  text_reading: {
    color: '#9C27B0',
  },
  text_speech: {
    color: '#FF9800',
  },
  text_english: {
    color: '#2196F3',
  },
  text_paid: {
    color: colors.math.dark,
  },
  text_partial: {
    color: '#F57C00',
  },
  text_unpaid: {
    color: colors.status.error,
  },
  text_neutral: {
    color: colors.neutral.textSecondary,
  },
  text_info: {
    color: '#1565C0',
  },

  textSize_sm: {
    fontSize: typography.sizes.xs,
  },
  textSize_md: {
    fontSize: typography.sizes.sm,
  },
});

export default Badge;
