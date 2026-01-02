import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, borderRadius, spacing, typography, shadows } from '../../theme';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'piano' | 'math';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  textStyle,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const buttonStyles = [
    styles.base,
    styles[`variant_${variant}`],
    styles[`size_${size}`],
    fullWidth && styles.fullWidth,
    isDisabled && styles.disabled,
    style,
  ];

  const textStyles = [
    styles.text,
    styles[`text_${variant}`],
    styles[`textSize_${size}`],
    textStyle,
  ];

  const iconSize = size === 'sm' ? 16 : size === 'md' ? 20 : 24;
  const iconColor = getIconColor(variant);

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        buttonStyles,
        pressed && !isDisabled && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={iconColor} size="small" />
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <Ionicons
              name={icon}
              size={iconSize}
              color={iconColor}
              style={styles.iconLeft}
            />
          )}
          <Text style={textStyles}>{title}</Text>
          {icon && iconPosition === 'right' && (
            <Ionicons
              name={icon}
              size={iconSize}
              color={iconColor}
              style={styles.iconRight}
            />
          )}
        </>
      )}
    </Pressable>
  );
}

function getIconColor(variant: ButtonVariant): string {
  switch (variant) {
    case 'primary':
    case 'piano':
    case 'math':
      return colors.neutral.textInverse;
    case 'secondary':
      return colors.neutral.text;
    case 'outline':
    case 'ghost':
      return colors.piano.primary;
    default:
      return colors.neutral.text;
  }
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    ...shadows.sm,
  },

  // Variants
  variant_primary: {
    backgroundColor: colors.piano.primary,
  },
  variant_secondary: {
    backgroundColor: colors.neutral.background,
    ...shadows.none,
  },
  variant_outline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.piano.primary,
    ...shadows.none,
  },
  variant_ghost: {
    backgroundColor: 'transparent',
    ...shadows.none,
  },
  variant_piano: {
    backgroundColor: colors.piano.primary,
  },
  variant_math: {
    backgroundColor: colors.math.primary,
  },

  // Sizes
  size_sm: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 36,
  },
  size_md: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
  },
  size_lg: {
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.xl,
    minHeight: 56,
  },

  // States
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },

  // Text
  text: {
    fontWeight: typography.weights.semibold,
    textAlign: 'center',
  },
  text_primary: {
    color: colors.neutral.textInverse,
  },
  text_secondary: {
    color: colors.neutral.text,
  },
  text_outline: {
    color: colors.piano.primary,
  },
  text_ghost: {
    color: colors.piano.primary,
  },
  text_piano: {
    color: colors.neutral.textInverse,
  },
  text_math: {
    color: colors.neutral.textInverse,
  },

  textSize_sm: {
    fontSize: typography.sizes.sm,
  },
  textSize_md: {
    fontSize: typography.sizes.base,
  },
  textSize_lg: {
    fontSize: typography.sizes.md,
  },

  // Icons
  iconLeft: {
    marginRight: spacing.sm,
  },
  iconRight: {
    marginLeft: spacing.sm,
  },
});

export default Button;
