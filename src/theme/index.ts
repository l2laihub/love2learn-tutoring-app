/**
 * Love2Learn Design System
 *
 * Aesthetic: "Nurturing Growth" - A fresh, natural design inspired by the
 * Love2Learn Academy logo featuring growth, learning, and care themes.
 * The teal-green-coral palette creates visual hierarchy:
 * - Teal: Primary brand, headers, navigation
 * - Green: Success, growth, math subject
 * - Coral: Warm accent for CTAs, urgency, highlights
 *
 * Logo Colors Reference:
 * - Teal (#3D9CA8): Sky/nurturing environment
 * - Green (#7CB342): Growth/leaves/learning
 * - Navy (#1B3A4B): Text/authority/trust
 * - Coral (#FF6B6B): Warm accent for engagement
 */

export const colors = {
  // Brand Colors (from logo + accent)
  brand: {
    teal: '#3D9CA8',
    tealLight: '#5FB3BC',
    tealDark: '#2D7A84',
    green: '#7CB342',
    greenLight: '#A5D66B',
    greenDark: '#5D8A2F',
    coral: '#FF6B6B',
    coralLight: '#FF9A9A',
    coralDark: '#E85555',
    navy: '#1B3A4B',
  },

  // Primary - Teal (main brand color from logo sky)
  primary: {
    main: '#3D9CA8',
    primary: '#3D9CA8', // Alias for consistency
    light: '#5FB3BC',
    dark: '#2D7A84',
    subtle: '#E8F5F7',
    gradient: ['#3D9CA8', '#5FB3BC'] as const,
  },

  // Secondary - Green (growth/leaves from logo)
  secondary: {
    main: '#7CB342',
    primary: '#7CB342', // Alias for consistency
    light: '#A5D66B',
    dark: '#5D8A2F',
    subtle: '#F1F8E9',
    gradient: ['#7CB342', '#A5D66B'] as const,
  },

  // Accent - Coral (warm highlight for CTAs and urgency)
  accent: {
    main: '#FF6B6B',
    primary: '#FF6B6B', // Alias for consistency
    light: '#FF9A9A',
    dark: '#E85555',
    subtle: '#FFF0F0',
    gradient: ['#FF6B6B', '#FF8E8E'] as const,
  },

  // Subject-specific colors (mapped to brand)
  piano: {
    primary: '#3D9CA8', // Teal for piano
    light: '#5FB3BC',
    dark: '#2D7A84',
    subtle: '#E8F5F7',
    gradient: ['#3D9CA8', '#5FB3BC'] as const,
  },

  math: {
    primary: '#7CB342', // Green for math
    light: '#A5D66B',
    dark: '#5D8A2F',
    subtle: '#F1F8E9',
    gradient: ['#7CB342', '#A5D66B'] as const,
  },

  // Additional subject colors
  subjects: {
    reading: {
      primary: '#9C27B0',
      light: '#CE93D8',
      dark: '#7B1FA2',
      subtle: '#F3E5F5',
      gradient: ['#9C27B0', '#CE93D8'] as const,
    },
    speech: {
      primary: '#FF9800',
      light: '#FFCC80',
      dark: '#F57C00',
      subtle: '#FFF3E0',
      gradient: ['#FF9800', '#FFCC80'] as const,
    },
    english: {
      primary: '#2196F3',
      light: '#90CAF9',
      dark: '#1976D2',
      subtle: '#E3F2FD',
      gradient: ['#2196F3', '#90CAF9'] as const,
    },
  },

  // Neutrals - Cool grays with slight teal undertone
  neutral: {
    white: '#FFFFFF',
    background: '#F8FAFB',
    surface: '#FFFFFF',
    border: '#E0E8EC',
    borderLight: '#F0F4F6',
    text: '#1B3A4B', // Navy from logo
    textSecondary: '#4A6572',
    textMuted: '#8A9BA8',
    textInverse: '#FFFFFF',
    overlay: 'rgba(27, 58, 75, 0.5)',
  },

  // Status colors
  status: {
    success: '#7CB342', // Green from brand
    successBg: '#F1F8E9',
    warning: '#FFC107',
    warningBg: '#FFF8E1',
    error: '#E53935',
    errorBg: '#FFEBEE',
    info: '#3D9CA8', // Teal from brand
    infoBg: '#E8F5F7',
    paid: '#7CB342',
    partial: '#FFC107',
    unpaid: '#E53935',
  },

  // Shadows
  shadow: {
    color: '#1B3A4B',
    opacity: 0.08,
  },
} as const;

// Avatar colors for initials (using brand palette)
export const avatarColors = [
  '#3D9CA8', // Teal
  '#7CB342', // Green
  '#FF6B6B', // Coral
  '#9C27B0', // Purple
  '#FF9800', // Orange
  '#2196F3', // Blue
  '#1B3A4B', // Navy
  '#00BCD4', // Cyan
] as const;

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

// Responsive breakpoints (in pixels)
export const breakpoints = {
  sm: 640,   // Small devices (phones landscape)
  md: 768,   // Medium devices (tablets portrait)
  lg: 1024,  // Large devices (tablets landscape, small laptops)
  xl: 1280,  // Extra large (desktops)
  '2xl': 1536, // Large desktops
} as const;

// Container max-widths for centered content
export const containers = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1200,
  '2xl': 1400,
} as const;

// Layout constants
export const layout = {
  sidebarWidth: 280,
  sidebarCollapsedWidth: 72,
  headerHeight: 64,
  tabBarHeight: 60,
  contentMaxWidth: 1200,
} as const;

// Subject type including all default subjects
export type Subject = 'piano' | 'math' | 'reading' | 'speech' | 'english';

/**
 * Subject color palette structure
 */
export interface SubjectColorPalette {
  primary: string;
  light: string;
  dark: string;
  subtle: string;
  gradient: readonly [string, string];
}

/**
 * Custom subject definition (from tutor_settings)
 */
export interface CustomSubject {
  id: string;
  name: string;
  color: string;
}

/**
 * Generate a lighter shade of a hex color
 */
function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, (num >> 16) + amt);
  const G = Math.min(255, ((num >> 8) & 0x00ff) + amt);
  const B = Math.min(255, (num & 0x0000ff) + amt);
  return `#${((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1).toUpperCase()}`;
}

/**
 * Generate a darker shade of a hex color
 */
function darkenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, (num >> 16) - amt);
  const G = Math.max(0, ((num >> 8) & 0x00ff) - amt);
  const B = Math.max(0, (num & 0x0000ff) - amt);
  return `#${((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1).toUpperCase()}`;
}

/**
 * Generate a subtle/pastel shade of a hex color
 */
function subtleColor(hex: string): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const R = Math.round(((num >> 16) + 255 * 4) / 5);
  const G = Math.round((((num >> 8) & 0x00ff) + 255 * 4) / 5);
  const B = Math.round(((num & 0x0000ff) + 255 * 4) / 5);
  return `#${((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1).toUpperCase()}`;
}

/**
 * Generate a full color palette from a base color
 */
export function generateColorPalette(baseColor: string): SubjectColorPalette {
  return {
    primary: baseColor,
    light: lightenColor(baseColor, 30),
    dark: darkenColor(baseColor, 15),
    subtle: subtleColor(baseColor),
    gradient: [baseColor, lightenColor(baseColor, 30)] as const,
  };
}

/**
 * Get subject color palette.
 * Checks custom subjects first (by ID or name), then falls back to default subjects.
 *
 * @param subject - Subject key, ID, or name
 * @param customSubjects - Optional array of custom subjects to check first
 * @returns Color palette for the subject
 */
export const getSubjectColor = (
  subject: Subject | string,
  customSubjects?: CustomSubject[]
): SubjectColorPalette => {
  // Check custom subjects first (by ID or name)
  if (customSubjects) {
    const customSubject = customSubjects.find(
      s => s.id === subject || s.name.toLowerCase() === subject.toString().toLowerCase()
    );
    if (customSubject) {
      return generateColorPalette(customSubject.color);
    }
  }

  // Check default subjects
  const subjectLower = subject.toString().toLowerCase() as Subject;
  switch (subjectLower) {
    case 'piano':
      return colors.piano;
    case 'math':
      return colors.math;
    case 'reading':
      return colors.subjects.reading;
    case 'speech':
      return colors.subjects.speech;
    case 'english':
      return colors.subjects.english;
    default:
      return colors.primary;
  }
};

// Helper to get payment status color
export const getPaymentStatusColor = (status: 'paid' | 'partial' | 'unpaid') => {
  return colors.status[status];
};

// Helper to get avatar color by index or name
export const getAvatarColor = (indexOrName: number | string): string => {
  if (typeof indexOrName === 'number') {
    return avatarColors[indexOrName % avatarColors.length];
  }
  // Generate consistent color from name
  const hash = indexOrName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return avatarColors[hash % avatarColors.length];
};

export const theme = {
  colors,
  avatarColors,
  typography,
  spacing,
  borderRadius,
  shadows,
  animation,
  breakpoints,
  containers,
  layout,
  getSubjectColor,
  getPaymentStatusColor,
  getAvatarColor,
  generateColorPalette,
} as const;

export type Theme = typeof theme;
export default theme;
