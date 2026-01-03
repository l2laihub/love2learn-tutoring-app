/**
 * Love2Learn Design System
 *
 * Aesthetic: "Playful Sophistication" - A warm, approachable design that feels
 * both educational and premium. Soft rounded corners meet confident colors.
 * The dual-color system (coral for piano, green for math) creates instant
 * visual recognition while maintaining harmony.
 */

export const colors = {
  // Primary - Piano (Coral palette)
  piano: {
    primary: '#FF6B6B',
    light: '#FF9A9A',
    dark: '#E85555',
    subtle: '#FFF0F0',
    gradient: ['#FF6B6B', '#FF8E8E'],
  },

  // Secondary - Math (Green palette)
  math: {
    primary: '#4CAF50',
    light: '#81C784',
    dark: '#388E3C',
    subtle: '#E8F5E9',
    gradient: ['#4CAF50', '#66BB6A'],
  },

  // Neutrals - Warm grays for a friendly feel
  neutral: {
    white: '#FFFFFF',
    background: '#FAFBFC',
    surface: '#FFFFFF',
    border: '#E8ECF0',
    borderLight: '#F0F3F5',
    text: '#1A2B3C',
    textSecondary: '#5A6B7C',
    textMuted: '#8A9BAC',
    textInverse: '#FFFFFF',
    overlay: 'rgba(26, 43, 60, 0.5)',
  },

  // Status colors
  status: {
    success: '#4CAF50',
    successBg: '#E8F5E9',
    warning: '#FFC107',
    warningBg: '#FFF8E1',
    error: '#F44336',
    errorBg: '#FFEBEE',
    info: '#2196F3',
    infoBg: '#E3F2FD',
    paid: '#4CAF50',
    partial: '#FFC107',
    unpaid: '#F44336',
  },

  // Shadows
  shadow: {
    color: '#1A2B3C',
    opacity: 0.08,
  },
} as const;

export const typography = {
  // Using system fonts initially, can swap for custom fonts later
  // Recommended: "Nunito" for headers (friendly, rounded), "Inter" for body
  fonts: {
    heading: 'System',
    body: 'System',
    mono: 'monospace',
  },

  sizes: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 17,
    lg: 20,
    xl: 24,
    '2xl': 30,
    '3xl': 36,
    '4xl': 48,
  },

  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },

  lineHeights: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.7,
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 64,
} as const;

export const borderRadius = {
  none: 0,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  '2xl': 28,
  full: 9999,
} as const;

export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: colors.shadow.color,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: colors.shadow.color,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: colors.shadow.color,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 5,
  },
  xl: {
    shadowColor: colors.shadow.color,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
} as const;

export const animation = {
  timing: {
    fast: 150,
    normal: 250,
    slow: 400,
    verySlow: 600,
  },
  easing: {
    default: 'ease-out',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
} as const;

// Helper to get subject color
export const getSubjectColor = (subject: 'piano' | 'math') => {
  return subject === 'piano' ? colors.piano : colors.math;
};

// Helper to get payment status color
export const getPaymentStatusColor = (status: 'paid' | 'partial' | 'unpaid') => {
  return colors.status[status];
};

export const theme = {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  animation,
  getSubjectColor,
  getPaymentStatusColor,
} as const;

export type Theme = typeof theme;
export default theme;
