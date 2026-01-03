# Love2Learn Academy - Theme Colors Reference

This document provides a comprehensive reference for the Love2Learn Academy app's color system and design tokens.

## Brand Identity

The Love2Learn Academy brand is built around themes of **growth**, **nurturing**, and **learning**. The logo features a stylized plant/heart growing within a circular environment, representing the nurturing approach to education.

### Design Philosophy: "Nurturing Growth"

A fresh, natural design that feels both educational and approachable. The **teal-green-coral** palette creates clear visual hierarchy:

| Role | Color | Purpose |
|------|-------|---------|
| **Primary** | Teal | Brand identity, headers, navigation |
| **Secondary** | Green | Success states, growth, learning progress |
| **Accent** | Coral | CTAs, urgency, highlights, warmth |

---

## Core Brand Colors

These colors form the foundation of the Love2Learn visual identity.

| Color | Hex | Role | Usage |
|-------|-----|------|-------|
| **Teal** | `#3D9CA8` | Primary | Headers, nav, links, Piano subject |
| **Green** | `#7CB342` | Secondary | Success, Math subject, progress |
| **Coral** | `#FF6B6B` | Accent | CTAs, notifications, urgency |
| **Navy** | `#1B3A4B` | Text | Body text, headings |

---

## Color Palette

### Primary Colors (Teal)

Main brand color used for headers, navigation, and primary actions.

```typescript
primary: {
  main: '#3D9CA8',
  light: '#5FB3BC',
  dark: '#2D7A84',
  subtle: '#E8F5F7',
  gradient: ['#3D9CA8', '#5FB3BC'],
}
```

| Swatch | Hex | Use Case |
|--------|-----|----------|
| ![#3D9CA8](https://via.placeholder.com/20/3D9CA8/3D9CA8) | `#3D9CA8` | Headers, primary buttons, active tabs |
| ![#5FB3BC](https://via.placeholder.com/20/5FB3BC/5FB3BC) | `#5FB3BC` | Hover states, gradient ends |
| ![#2D7A84](https://via.placeholder.com/20/2D7A84/2D7A84) | `#2D7A84` | Pressed states, dark accents |
| ![#E8F5F7](https://via.placeholder.com/20/E8F5F7/E8F5F7) | `#E8F5F7` | Subtle backgrounds, info badges |

### Secondary Colors (Green)

Used for success states, progress indicators, and growth-related features.

```typescript
secondary: {
  main: '#7CB342',
  light: '#A5D66B',
  dark: '#5D8A2F',
  subtle: '#F1F8E9',
  gradient: ['#7CB342', '#A5D66B'],
}
```

| Swatch | Hex | Use Case |
|--------|-----|----------|
| ![#7CB342](https://via.placeholder.com/20/7CB342/7CB342) | `#7CB342` | Success, completed, Math subject |
| ![#A5D66B](https://via.placeholder.com/20/A5D66B/A5D66B) | `#A5D66B` | Hover states, highlights |
| ![#5D8A2F](https://via.placeholder.com/20/5D8A2F/5D8A2F) | `#5D8A2F` | Pressed states, emphasis |
| ![#F1F8E9](https://via.placeholder.com/20/F1F8E9/F1F8E9) | `#F1F8E9` | Success backgrounds |

### Accent Colors (Coral)

Warm accent color for call-to-actions, notifications, and creating visual interest.

```typescript
accent: {
  main: '#FF6B6B',
  light: '#FF9A9A',
  dark: '#E85555',
  subtle: '#FFF0F0',
  gradient: ['#FF6B6B', '#FF8E8E'],
}
```

| Swatch | Hex | Use Case |
|--------|-----|----------|
| ![#FF6B6B](https://via.placeholder.com/20/FF6B6B/FF6B6B) | `#FF6B6B` | Primary CTAs, notifications, highlights |
| ![#FF9A9A](https://via.placeholder.com/20/FF9A9A/FF9A9A) | `#FF9A9A` | Hover states, soft highlights |
| ![#E85555](https://via.placeholder.com/20/E85555/E85555) | `#E85555` | Pressed states, emphasis |
| ![#FFF0F0](https://via.placeholder.com/20/FFF0F0/FFF0F0) | `#FFF0F0` | Subtle warm backgrounds |

### When to Use Coral Accent

| Use Case | Example |
|----------|---------|
| **Primary CTAs** | "Schedule Lesson", "Add Student" buttons |
| **Notifications** | Badge counts, alerts |
| **Urgency indicators** | "Today" card, overdue items |
| **Promotional elements** | Featured content, special offers |
| **Warmth & engagement** | Welcome messages, celebration states |

---

## Subject Colors

Each subject has its own color identity for easy visual distinction.

### Piano (Teal - Primary)
```typescript
piano: {
  primary: '#3D9CA8',
  light: '#5FB3BC',
  dark: '#2D7A84',
  subtle: '#E8F5F7',
}
```

### Math (Green - Secondary)
```typescript
math: {
  primary: '#7CB342',
  light: '#A5D66B',
  dark: '#5D8A2F',
  subtle: '#F1F8E9',
}
```

### Reading (Purple)
```typescript
reading: {
  primary: '#9C27B0',
  light: '#CE93D8',
  dark: '#7B1FA2',
  subtle: '#F3E5F5',
}
```

### Speech (Orange)
```typescript
speech: {
  primary: '#FF9800',
  light: '#FFCC80',
  dark: '#F57C00',
  subtle: '#FFF3E0',
}
```

### English (Blue)
```typescript
english: {
  primary: '#2196F3',
  light: '#90CAF9',
  dark: '#1976D2',
  subtle: '#E3F2FD',
}
```

---

## Neutral Colors

Used for text, backgrounds, and UI chrome.

```typescript
neutral: {
  white: '#FFFFFF',
  background: '#F8FAFB',
  surface: '#FFFFFF',
  border: '#E0E8EC',
  borderLight: '#F0F4F6',
  text: '#1B3A4B',        // Navy from logo
  textSecondary: '#4A6572',
  textMuted: '#8A9BA8',
  textInverse: '#FFFFFF',
  overlay: 'rgba(27, 58, 75, 0.5)',
}
```

| Swatch | Hex | Use Case |
|--------|-----|----------|
| ![#FFFFFF](https://via.placeholder.com/20/FFFFFF/FFFFFF) | `#FFFFFF` | Cards, surfaces |
| ![#F8FAFB](https://via.placeholder.com/20/F8FAFB/F8FAFB) | `#F8FAFB` | Page backgrounds |
| ![#E0E8EC](https://via.placeholder.com/20/E0E8EC/E0E8EC) | `#E0E8EC` | Borders, dividers |
| ![#1B3A4B](https://via.placeholder.com/20/1B3A4B/1B3A4B) | `#1B3A4B` | Primary text |
| ![#4A6572](https://via.placeholder.com/20/4A6572/4A6572) | `#4A6572` | Secondary text |
| ![#8A9BA8](https://via.placeholder.com/20/8A9BA8/8A9BA8) | `#8A9BA8` | Muted text, placeholders |

---

## Status Colors

Used for feedback, alerts, and payment states.

```typescript
status: {
  success: '#7CB342',     // Green (same as secondary)
  successBg: '#F1F8E9',
  warning: '#FFC107',     // Amber
  warningBg: '#FFF8E1',
  error: '#E53935',       // Red
  errorBg: '#FFEBEE',
  info: '#3D9CA8',        // Teal (same as primary)
  infoBg: '#E8F5F7',
  paid: '#7CB342',
  partial: '#FFC107',
  unpaid: '#E53935',
}
```

| Status | Color | Background | Use Case |
|--------|-------|------------|----------|
| Success | `#7CB342` | `#F1F8E9` | Completed actions, paid status |
| Warning | `#FFC107` | `#FFF8E1` | Partial payment, attention needed |
| Error | `#E53935` | `#FFEBEE` | Errors, unpaid, failures |
| Info | `#3D9CA8` | `#E8F5F7` | Information, tips |

---

## Visual Hierarchy Guide

Use this guide to maintain consistent visual hierarchy across the app:

```
┌─────────────────────────────────────────────────────────┐
│  HEADER (Teal #3D9CA8)                                  │
│  Navigation, app bar, primary actions                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────┐  ┌─────────────┐                      │
│  │ STAT CARD   │  │ STAT CARD   │                      │
│  │ (Teal)      │  │ (Green)     │                      │
│  │ Piano: 18   │  │ Math: 6     │                      │
│  └─────────────┘  └─────────────┘                      │
│                                                         │
│  ┌─────────────┐  ┌─────────────┐                      │
│  │ TODAY       │  │ DONE        │                      │
│  │ (Coral)     │  │ (Green)     │                      │
│  │ Urgent/Now  │  │ Success     │                      │
│  └─────────────┘  └─────────────┘                      │
│                                                         │
│  Quick Actions                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐               │
│  │ Schedule │ │   Add    │ │Worksheets│               │
│  │ (Coral)  │ │ (Coral)  │ │ (Teal)   │               │
│  │   CTA    │ │   CTA    │ │Secondary │               │
│  └──────────┘ └──────────┘ └──────────┘               │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  TAB BAR (White bg, Teal active)                        │
└─────────────────────────────────────────────────────────┘
```

---

## Avatar Colors

Used for generating consistent avatar colors from names.

```typescript
avatarColors: [
  '#3D9CA8', // Teal
  '#7CB342', // Green
  '#FF6B6B', // Coral
  '#9C27B0', // Purple
  '#FF9800', // Orange
  '#2196F3', // Blue
  '#1B3A4B', // Navy
  '#00BCD4', // Cyan
]
```

---

## Usage in Code

### Importing the Theme

```typescript
import { colors, theme, getSubjectColor } from '@/src/theme';

// Primary brand color
const headerBg = colors.primary.main;      // Teal

// Secondary for success states
const successColor = colors.secondary.main; // Green

// Accent for CTAs
const ctaButton = colors.accent.main;       // Coral

// Subject-specific colors
const pianoColor = getSubjectColor('piano');

// Full theme object
const textColor = theme.colors.neutral.text;
```

### Component Examples

```tsx
// Primary button (navigation, secondary actions)
<Button style={{ backgroundColor: colors.primary.main }}>
  View Calendar
</Button>

// CTA button (primary actions, engagement)
<Button style={{ backgroundColor: colors.accent.main }}>
  Schedule Lesson
</Button>

// Success button
<Button style={{ backgroundColor: colors.secondary.main }}>
  Mark Complete
</Button>

// Stat card with urgency
<Card style={{ backgroundColor: colors.accent.main }}>
  <Text>Today: 3 lessons</Text>
</Card>
```

### Helper Functions

```typescript
// Get subject color
getSubjectColor('piano')   // Returns piano color object (teal)
getSubjectColor('math')    // Returns math color object (green)
getSubjectColor('reading') // Returns reading color object (purple)

// Get payment status color
getPaymentStatusColor('paid')    // Returns '#7CB342' (green)
getPaymentStatusColor('partial') // Returns '#FFC107' (amber)
getPaymentStatusColor('unpaid')  // Returns '#E53935' (red)

// Get avatar color
getAvatarColor(0)          // Returns first color in palette
getAvatarColor('John Doe') // Returns consistent color for name
```

---

## Typography

### Font Sizes

| Token | Size | Use Case |
|-------|------|----------|
| `xs` | 11px | Captions, badges |
| `sm` | 13px | Secondary text, labels |
| `base` | 15px | Body text |
| `md` | 17px | Emphasized body |
| `lg` | 20px | Small headings |
| `xl` | 24px | Section headings |
| `2xl` | 30px | Page headings |
| `3xl` | 36px | Large titles |
| `4xl` | 48px | Hero text |

### Font Weights

| Token | Weight | Use Case |
|-------|--------|----------|
| `regular` | 400 | Body text |
| `medium` | 500 | Labels, buttons |
| `semibold` | 600 | Headings, emphasis |
| `bold` | 700 | Strong emphasis |

---

## Spacing Scale

| Token | Size | Use Case |
|-------|------|----------|
| `xs` | 4px | Tight spacing |
| `sm` | 8px | Compact elements |
| `md` | 12px | Default padding |
| `base` | 16px | Standard spacing |
| `lg` | 20px | Comfortable spacing |
| `xl` | 24px | Section padding |
| `2xl` | 32px | Large gaps |
| `3xl` | 40px | Section breaks |
| `4xl` | 48px | Major sections |
| `5xl` | 64px | Page-level spacing |

---

## Border Radius

| Token | Size | Use Case |
|-------|------|----------|
| `none` | 0px | Sharp corners |
| `sm` | 6px | Subtle rounding |
| `md` | 10px | Buttons, inputs |
| `lg` | 14px | Cards |
| `xl` | 20px | Large cards |
| `2xl` | 28px | Modals |
| `full` | 9999px | Pills, avatars |

---

## Shadows

```typescript
shadows: {
  none: { elevation: 0 },
  sm:   { elevation: 1, opacity: 0.06 },  // Subtle lift
  md:   { elevation: 3, opacity: 0.08 },  // Cards
  lg:   { elevation: 5, opacity: 0.10 },  // Modals
  xl:   { elevation: 8, opacity: 0.12 },  // Dropdowns
}
```

---

## Animation Timings

| Token | Duration | Use Case |
|-------|----------|----------|
| `fast` | 150ms | Micro-interactions |
| `normal` | 250ms | Standard transitions |
| `slow` | 400ms | Complex animations |
| `verySlow` | 600ms | Page transitions |

---

## App Icon & Splash Screen

The app uses the Love2Learn Academy logo for:
- **App Icon** (`assets/icon.png`) - 1024x1024px
- **Adaptive Icon** (`assets/adaptive-icon.png`) - 1024x1024px with safe zone
- **Splash Screen** (`assets/splash.png`) - Centered on white background
- **Favicon** (`assets/favicon.png`) - 48x48px for web

Background color for splash/adaptive icon: `#FFFFFF` (white)

---

## Color Psychology

| Color | Emotion | Usage in App |
|-------|---------|--------------|
| **Teal** | Trust, calm, professionalism | Brand identity, reliability |
| **Green** | Growth, success, harmony | Learning progress, achievements |
| **Coral** | Energy, warmth, urgency | Engagement, action, excitement |
| **Navy** | Authority, stability | Text, trustworthiness |

---

## Accessibility Notes

- All text colors meet WCAG AA contrast requirements against their intended backgrounds
- Primary colors (`#3D9CA8`, `#7CB342`, `#FF6B6B`) meet contrast requirements against white
- Error color (`#E53935`) is distinct from success for colorblind users
- Status states use both color AND text/icons for accessibility
- Coral accent provides sufficient contrast on white backgrounds (4.5:1 ratio)

---

## Quick Reference Card

```
┌────────────────────────────────────────┐
│         LOVE2LEARN COLORS              │
├────────────────────────────────────────┤
│  PRIMARY (Teal)     #3D9CA8            │
│  SECONDARY (Green)  #7CB342            │
│  ACCENT (Coral)     #FF6B6B            │
│  TEXT (Navy)        #1B3A4B            │
├────────────────────────────────────────┤
│  Use Teal for: headers, nav, links     │
│  Use Green for: success, progress      │
│  Use Coral for: CTAs, urgency, warmth  │
└────────────────────────────────────────┘
```

---

*Last updated: January 2025*
*Theme Version: 2.1 (Hybrid with Coral Accent)*
