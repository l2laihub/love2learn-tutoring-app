/**
 * useResponsive Hook
 *
 * Provides responsive design utilities for React Native apps with web support.
 * Uses window dimensions to determine breakpoints and provide adaptive layouts.
 */

import { useWindowDimensions } from 'react-native';
import { useMemo } from 'react';

// Breakpoint values (in pixels)
export const breakpoints = {
  sm: 640,   // Small devices (phones)
  md: 768,   // Medium devices (tablets portrait)
  lg: 1024,  // Large devices (tablets landscape, small laptops)
  xl: 1280,  // Extra large (desktops)
  '2xl': 1536, // Large desktops
} as const;

export type Breakpoint = keyof typeof breakpoints;

export interface ResponsiveInfo {
  // Current dimensions
  width: number;
  height: number;

  // Device type booleans
  isMobile: boolean;      // < 640px
  isTablet: boolean;      // >= 640px && < 1024px
  isDesktop: boolean;     // >= 1024px
  isLargeDesktop: boolean; // >= 1280px

  // Breakpoint checks (min-width style)
  isSmUp: boolean;   // >= 640px
  isMdUp: boolean;   // >= 768px
  isLgUp: boolean;   // >= 1024px
  isXlUp: boolean;   // >= 1280px
  is2xlUp: boolean;  // >= 1536px

  // Column calculations for grids
  columns: {
    stats: number;    // For stat cards grid
    actions: number;  // For action buttons grid
    cards: number;    // For general card grids
  };

  // Container max-width
  containerMaxWidth: number;

  // Content padding
  contentPadding: number;
}

/**
 * Hook that provides responsive breakpoint information and utilities
 */
export function useResponsive(): ResponsiveInfo {
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    // Device type detection
    const isMobile = width < breakpoints.sm;
    const isTablet = width >= breakpoints.sm && width < breakpoints.lg;
    const isDesktop = width >= breakpoints.lg;
    const isLargeDesktop = width >= breakpoints.xl;

    // Breakpoint checks (min-width style, like Tailwind)
    const isSmUp = width >= breakpoints.sm;
    const isMdUp = width >= breakpoints.md;
    const isLgUp = width >= breakpoints.lg;
    const isXlUp = width >= breakpoints.xl;
    const is2xlUp = width >= breakpoints['2xl'];

    // Calculate optimal column counts for different grids
    const statsColumns = isLargeDesktop ? 6 : isDesktop ? 4 : isTablet ? 3 : 2;
    const actionsColumns = isDesktop ? 6 : isTablet ? 4 : 4;
    const cardsColumns = isLargeDesktop ? 4 : isDesktop ? 3 : isTablet ? 2 : 1;

    // Container max-width based on screen size
    const containerMaxWidth = is2xlUp ? 1400 : isXlUp ? 1200 : isLgUp ? 960 : isMdUp ? 720 : width;

    // Content padding - larger on desktop
    const contentPadding = isDesktop ? 32 : isTablet ? 24 : 16;

    return {
      width,
      height,
      isMobile,
      isTablet,
      isDesktop,
      isLargeDesktop,
      isSmUp,
      isMdUp,
      isLgUp,
      isXlUp,
      is2xlUp,
      columns: {
        stats: statsColumns,
        actions: actionsColumns,
        cards: cardsColumns,
      },
      containerMaxWidth,
      contentPadding,
    };
  }, [width, height]);
}

/**
 * Helper to calculate grid item width based on columns and gap
 */
export function getGridItemWidth(columns: number, gap: number, containerWidth: number): number {
  return (containerWidth - (gap * (columns - 1))) / columns;
}

/**
 * Helper to get responsive value based on breakpoints
 * Similar to Tailwind's responsive prefixes
 */
export function getResponsiveValue<T>(
  responsive: ResponsiveInfo,
  values: {
    base: T;
    sm?: T;
    md?: T;
    lg?: T;
    xl?: T;
    '2xl'?: T;
  }
): T {
  if (responsive.is2xlUp && values['2xl'] !== undefined) return values['2xl'];
  if (responsive.isXlUp && values.xl !== undefined) return values.xl;
  if (responsive.isLgUp && values.lg !== undefined) return values.lg;
  if (responsive.isMdUp && values.md !== undefined) return values.md;
  if (responsive.isSmUp && values.sm !== undefined) return values.sm;
  return values.base;
}

export default useResponsive;
