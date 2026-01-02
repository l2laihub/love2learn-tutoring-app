import React from 'react';
import { View, Text, StyleSheet, Pressable, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '../../theme';

interface HeaderProps {
  title: string;
  subtitle?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onLeftPress?: () => void;
  onRightPress?: () => void;
  style?: StyleProp<ViewStyle>;
  transparent?: boolean;
}

export function Header({
  title,
  subtitle,
  leftIcon,
  rightIcon,
  onLeftPress,
  onRightPress,
  style,
  transparent = false,
}: HeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + spacing.sm },
        transparent && styles.transparent,
        style,
      ]}
    >
      <View style={styles.leftContainer}>
        {leftIcon && (
          <Pressable onPress={onLeftPress} style={styles.iconButton}>
            <Ionicons name={leftIcon} size={24} color={colors.neutral.text} />
          </Pressable>
        )}
      </View>

      <View style={styles.titleContainer}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>

      <View style={styles.rightContainer}>
        {rightIcon && (
          <Pressable onPress={onRightPress} style={styles.iconButton}>
            <Ionicons name={rightIcon} size={24} color={colors.neutral.text} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

// Large header for home screen
interface LargeHeaderProps {
  greeting: string;
  name: string;
  date: string;
  style?: StyleProp<ViewStyle>;
}

export function LargeHeader({ greeting, name, date, style }: LargeHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.largeHeader, { paddingTop: insets.top + spacing.lg }, style]}>
      <Text style={styles.greeting}>{greeting}</Text>
      <Text style={styles.name}>{name}</Text>
      <Text style={styles.date}>{date}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
    backgroundColor: colors.neutral.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  transparent: {
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
  },
  leftContainer: {
    width: 44,
    alignItems: 'flex-start',
  },
  rightContainer: {
    width: 44,
    alignItems: 'flex-end',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginTop: 2,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: -spacing.sm,
  },

  // Large header styles
  largeHeader: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    backgroundColor: colors.neutral.surface,
  },
  greeting: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    marginBottom: spacing.xs,
  },
  name: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
    marginBottom: spacing.xs,
  },
  date: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
  },
});

export default Header;
