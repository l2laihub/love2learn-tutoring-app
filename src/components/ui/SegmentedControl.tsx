import React from 'react';
import { View, Text, Pressable, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { colors, borderRadius, spacing, typography } from '../../theme';

interface Segment {
  key: string;
  label: string;
  icon?: string;
}

interface SegmentedControlProps {
  segments: Segment[];
  selectedKey: string;
  onSelect: (key: string) => void;
  style?: StyleProp<ViewStyle>;
  variant?: 'default' | 'piano-math';
}

export function SegmentedControl({
  segments,
  selectedKey,
  onSelect,
  style,
  variant = 'default',
}: SegmentedControlProps) {
  const selectedIndex = segments.findIndex((s) => s.key === selectedKey);

  const getActiveColor = (key: string) => {
    if (variant === 'piano-math') {
      return key === 'piano' ? colors.piano.primary : colors.math.primary;
    }
    return colors.piano.primary;
  };

  return (
    <View style={[styles.container, style]}>
      {segments.map((segment, index) => {
        const isSelected = segment.key === selectedKey;
        const activeColor = getActiveColor(segment.key);

        return (
          <Pressable
            key={segment.key}
            onPress={() => onSelect(segment.key)}
            style={[
              styles.segment,
              isSelected && [styles.segmentActive, { backgroundColor: activeColor }],
              index === 0 && styles.segmentFirst,
              index === segments.length - 1 && styles.segmentLast,
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                isSelected && styles.segmentTextActive,
              ]}
            >
              {segment.icon && `${segment.icon} `}
              {segment.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Tab bar variant for worksheet generator
interface TabBarProps {
  tabs: Array<{ key: string; label: string; emoji?: string }>;
  selectedTab: string;
  onSelectTab: (key: string) => void;
  style?: StyleProp<ViewStyle>;
}

export function TabBar({ tabs, selectedTab, onSelectTab, style }: TabBarProps) {
  return (
    <View style={[styles.tabBar, style]}>
      {tabs.map((tab) => {
        const isSelected = tab.key === selectedTab;
        const tabColor = tab.key === 'piano' ? colors.piano : colors.math;

        return (
          <Pressable
            key={tab.key}
            onPress={() => onSelectTab(tab.key)}
            style={[styles.tab, isSelected && styles.tabActive]}
          >
            <Text style={styles.tabEmoji}>{tab.emoji}</Text>
            <Text
              style={[
                styles.tabText,
                isSelected && { color: tabColor.primary },
              ]}
            >
              {tab.label}
            </Text>
            {isSelected && (
              <View
                style={[styles.tabIndicator, { backgroundColor: tabColor.primary }]}
              />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.lg,
    padding: spacing.xs,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
  },
  segmentFirst: {
    borderTopLeftRadius: borderRadius.md,
    borderBottomLeftRadius: borderRadius.md,
  },
  segmentLast: {
    borderTopRightRadius: borderRadius.md,
    borderBottomRightRadius: borderRadius.md,
  },
  segmentActive: {
    backgroundColor: colors.piano.primary,
  },
  segmentText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.neutral.textSecondary,
  },
  segmentTextActive: {
    color: colors.neutral.textInverse,
  },

  // Tab bar styles
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    position: 'relative',
  },
  tabActive: {},
  tabEmoji: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  tabText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.textSecondary,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: spacing.xl,
    right: spacing.xl,
    height: 3,
    borderRadius: 2,
  },
});

export default SegmentedControl;
