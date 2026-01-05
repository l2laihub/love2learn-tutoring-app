/**
 * ResponsiveContainer Component
 *
 * A wrapper component that constrains content width on larger screens
 * while allowing full-width on mobile. Centers content horizontally
 * on desktop for a more professional layout.
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, ScrollView, RefreshControl } from 'react-native';
import { useResponsive } from '../../hooks/useResponsive';
import { colors, spacing } from '../../theme';

interface ResponsiveContainerProps {
  children: React.ReactNode;
  /** Custom max width override */
  maxWidth?: number;
  /** Additional styles for the outer container */
  style?: ViewStyle;
  /** Additional styles for the inner content container */
  contentStyle?: ViewStyle;
  /** Whether to add horizontal padding (default: true) */
  withPadding?: boolean;
  /** Whether to use ScrollView wrapper (default: false) */
  scrollable?: boolean;
  /** RefreshControl for pull-to-refresh (only works with scrollable) */
  refreshControl?: React.ReactElement<typeof RefreshControl>;
  /** Whether to center content vertically as well (default: false) */
  centerVertical?: boolean;
  /** Background color for the outer container */
  backgroundColor?: string;
}

export function ResponsiveContainer({
  children,
  maxWidth,
  style,
  contentStyle,
  withPadding = true,
  scrollable = false,
  refreshControl,
  centerVertical = false,
  backgroundColor = colors.neutral.background,
}: ResponsiveContainerProps) {
  const responsive = useResponsive();

  const effectiveMaxWidth = maxWidth ?? responsive.containerMaxWidth;
  const horizontalPadding = withPadding ? responsive.contentPadding : 0;

  const outerStyle: ViewStyle = {
    flex: 1,
    backgroundColor,
    ...style,
  };

  const innerStyle: ViewStyle = {
    flex: scrollable ? undefined : 1,
    width: '100%',
    maxWidth: effectiveMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: horizontalPadding,
    ...(centerVertical && !scrollable ? { justifyContent: 'center' } : {}),
    ...contentStyle,
  };

  if (scrollable) {
    return (
      <View style={outerStyle}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingHorizontal: horizontalPadding },
          ]}
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}
        >
          <View style={[innerStyle, { paddingHorizontal: 0 }]}>
            {children}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={outerStyle}>
      <View style={innerStyle}>
        {children}
      </View>
    </View>
  );
}

/**
 * ResponsiveRow Component
 *
 * A flex row that adapts its layout based on screen size.
 * Stacks vertically on mobile, horizontal on larger screens.
 */
interface ResponsiveRowProps {
  children: React.ReactNode;
  /** Gap between items */
  gap?: number;
  /** Whether to always stack vertically (default: false) */
  alwaysStack?: boolean;
  /** Additional styles */
  style?: ViewStyle;
  /** Whether to wrap items (default: true on desktop) */
  wrap?: boolean;
}

export function ResponsiveRow({
  children,
  gap = spacing.md,
  alwaysStack = false,
  style,
  wrap = true,
}: ResponsiveRowProps) {
  const { isMobile } = useResponsive();

  const shouldStack = alwaysStack || isMobile;

  return (
    <View
      style={[
        {
          flexDirection: shouldStack ? 'column' : 'row',
          flexWrap: !shouldStack && wrap ? 'wrap' : 'nowrap',
          gap,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/**
 * ResponsiveGrid Component
 *
 * A responsive grid that adjusts column count based on screen size.
 */
interface ResponsiveGridProps {
  children: React.ReactNode;
  /** Number of columns on mobile (default: 2) */
  mobileColumns?: number;
  /** Number of columns on tablet (default: 3) */
  tabletColumns?: number;
  /** Number of columns on desktop (default: 4) */
  desktopColumns?: number;
  /** Gap between items */
  gap?: number;
  /** Additional styles */
  style?: ViewStyle;
}

export function ResponsiveGrid({
  children,
  mobileColumns = 2,
  tabletColumns = 3,
  desktopColumns = 4,
  gap = spacing.md,
  style,
}: ResponsiveGridProps) {
  const { isMobile, isTablet, isDesktop } = useResponsive();

  const columns = isDesktop ? desktopColumns : isTablet ? tabletColumns : mobileColumns;
  // Calculate width percentage with gap consideration
  const itemWidth = `${(100 / columns) - 1}%` as const;

  return (
    <View
      style={[
        styles.grid,
        { gap },
        style,
      ]}
    >
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child;
        return React.cloneElement(child as React.ReactElement<{ style?: ViewStyle }>, {
          style: [
            (child.props as { style?: ViewStyle }).style,
            { minWidth: itemWidth, flex: 1 },
          ],
        });
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});

export default ResponsiveContainer;
