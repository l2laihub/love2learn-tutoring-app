import React from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { colors, borderRadius, shadows, spacing } from '../../theme';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'elevated' | 'outlined' | 'filled';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  onPress?: () => void;
  disabled?: boolean;
  accentColor?: string;
  accentPosition?: 'left' | 'top';
}

export function Card({
  children,
  style,
  variant = 'elevated',
  padding = 'md',
  onPress,
  disabled = false,
  accentColor,
  accentPosition = 'left',
}: CardProps) {
  const cardStyle = [
    styles.base,
    styles[variant],
    styles[`padding_${padding}`],
    accentColor && accentPosition === 'left' && styles.accentLeft,
    accentColor && accentPosition === 'top' && styles.accentTop,
    disabled && styles.disabled,
    style,
  ];

  const content = (
    <>
      {accentColor && (
        <View
          style={[
            styles.accent,
            accentPosition === 'left' ? styles.accentLeftBar : styles.accentTopBar,
            { backgroundColor: accentColor },
          ]}
        />
      )}
      {children}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [
          cardStyle,
          pressed && styles.pressed,
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={cardStyle}>{content}</View>;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: borderRadius.lg,
    backgroundColor: colors.neutral.surface,
    overflow: 'hidden',
    position: 'relative',
  },
  elevated: {
    ...shadows.md,
  },
  outlined: {
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  filled: {
    backgroundColor: colors.neutral.background,
  },
  padding_none: {
    padding: 0,
  },
  padding_sm: {
    padding: spacing.sm,
  },
  padding_md: {
    padding: spacing.base,
  },
  padding_lg: {
    padding: spacing.xl,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  accentLeft: {
    paddingLeft: spacing.base + 4,
  },
  accentTop: {
    paddingTop: spacing.base + 4,
  },
  accent: {
    position: 'absolute',
  },
  accentLeftBar: {
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: borderRadius.lg,
    borderBottomLeftRadius: borderRadius.lg,
  },
  accentTopBar: {
    left: 0,
    right: 0,
    top: 0,
    height: 4,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
  },
});

export default Card;
