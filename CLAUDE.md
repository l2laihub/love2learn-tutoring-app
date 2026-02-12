# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Love2Learn is a cross-platform tutoring management app built with React Native/Expo and Supabase. It supports iOS, Android, and Web platforms with role-based access for tutors and parents.

## Common Commands

```bash
# Development
npm start              # Start Expo dev server (press w=web, a=android, i=ios)
npm run web            # Start directly in web browser
npm run ios            # Start on iOS simulator
npm run android        # Start on Android emulator

# Code Quality
npm run typecheck      # TypeScript type checking
npm run lint           # ESLint

# Database (Supabase CLI)
npx supabase db push              # Push migrations to remote
npx supabase db reset             # Reset local DB with migrations + seed
npx supabase migration new <name> # Create new migration

# Utility Scripts
npx tsx scripts/extend-recurring-lessons.ts          # Extend recurring lesson series
npx tsx scripts/extend-recurring-lessons.ts --dry-run # Preview without changes

# Troubleshooting
npx expo start --clear            # Clear Metro cache
npx expo install --fix            # Fix dependency versions
```

## Architecture

### Tech Stack
- **Frontend**: React Native 0.81 + Expo 54 + Expo Router 6 (file-based routing)
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Real-time)
- **State**: Custom hooks wrapping Supabase queries (no Redux/Zustand)
- **Language**: TypeScript with strict mode

### Path Aliases (tsconfig.json)
```typescript
import { Button } from '@components/ui/Button';
import { useStudents } from '@hooks/useStudents';
import { theme } from '@theme';
import { supabase } from '@lib/supabase';
```

### Routing & Navigation

The app uses Expo Router with file-based routing. Key route groups:

- `app/_layout.tsx` — Root layout wraps app in `AuthProvider`, handles auth-gated redirects
- `app/(tabs)/_layout.tsx` — Main tab navigation, role-aware (tutors see different tabs than parents)
- `app/(auth)/` — Login, register, forgot-password, onboarding flows
- `app/landing.tsx` — Landing page for unauthenticated users

**Auth redirect flow** in root layout:
1. Unauthenticated users → `/landing`
2. Authenticated tutor needing onboarding → `/(auth)/onboarding/tutor/business`
3. Authenticated parent needing onboarding → `/(auth)/onboarding/welcome`
4. Otherwise → `/(tabs)/`

**Responsive layout**: Desktop (≥1024px) shows a sidebar instead of bottom tabs. Controlled by `useResponsive()` hook and `DesktopSidebar` component.

**Tabs by role**:
- Tutor: Home, Calendar, Messages, Payments, More
- Parent: Home, Calendar (Schedule), Messages, More

### Data Flow Pattern

All data fetching uses custom hooks in `src/hooks/` that wrap Supabase queries:
```typescript
// Query hooks return { data, loading, error, refetch }
const { data: students, loading, refetch } = useStudents();

// Mutation hooks return { mutate, loading, error }
const { mutate: createStudent } = useCreateStudent();
```

Hooks rely on Supabase RLS for role-based filtering — tutors see all records, parents see only their own.

Key hook families: `useStudents`, `useLessons`, `usePayments`, `useMessages`, `useNotifications`, `useTutorAvailability`, `useSharedResources`, `useAssignments`

## Key Implementation Details

### Authentication & RLS

**Auth state** is managed via `AuthContext` (`src/contexts/AuthContext.tsx`) which provides:
- `user`, `session`, `parent` (the database record)
- `role`, `isTutor`, `isParent` — role helpers
- `needsOnboarding`, `tutorNeedsOnboarding`, `parentNeedsOnboarding`
- `signIn`, `signUp`, `signOut`, `resetPassword`

**RLS circular dependency**: The `parents` table RLS policies call `is_tutor()`, which queries `parents` — causing infinite recursion. Solved with `get_current_user_parent()`, a `SECURITY DEFINER` function that bypasses RLS to return the current user's record. The auth library (`src/lib/auth.ts`) uses this RPC instead of a direct query.

**Role caching**: On login, the user's role is cached in SecureStore (native) or localStorage (web) keyed by user ID. This prevents incorrect redirects when database queries are slow, especially on Android cold start (20s timeout).

**Multi-tutor data isolation**: Recent migrations add `tutor_id` filtering to RLS policies so each tutor only sees their own students/lessons/payments. Parents see data scoped to their `parent_id`.

### Supabase Client (`src/lib/supabase.ts`)

**Hybrid storage**: iOS SecureStore has a 2048-byte limit but Supabase JWTs exceed this. Solution: AsyncStorage stores the session, with a migration path from the old SecureStore implementation. Web uses localStorage. In-memory fallback if both fail.

### Lesson System

- **Combined Sessions**: Multiple students can be in one lesson via `session_id` in `lesson_sessions` table. Grouped in the UI as `GroupedLesson` objects.
- **Recurring series**: weekly, bi-weekly, monthly. Detected by matching student + subject + time + day of week.
- **Color-coded by subject**: Piano=#3D9CA8, Math=#7CB342, Reading=#9C27B0, Speech=#FF9800, English=#2196F3. Custom subjects supported with custom colors.
- **Parent actions**: Request reschedules and drop-in sessions.
- **Payment modes**: `invoice` (billed after) or `prepaid` (balance deducted per session).

### Theme System (`src/theme/index.ts`)

Brand colors: primary teal (#3D9CA8), secondary green (#7CB342), accent coral (#FF6B6B), navy text (#1B3A4B).

Key helpers:
- `getSubjectColor(subject, customSubjects?)` — returns color palette for a subject
- `generateColorPalette(baseColor)` — creates light/dark/subtle variants
- `getPaymentStatusColor(status)` — returns status indicator color

Responsive breakpoints: sm=640, md=768, lg=1024 (desktop sidebar activates), xl=1280.

### Database Conventions

- Always create new migrations (`npx supabase migration new <name>`), never edit existing ones
- ~92 migrations exist in `supabase/migrations/`, run in chronological order
- RLS policies control all data access — test carefully when modifying
- Key tables: `parents` (all users — both tutors and parents), `students`, `scheduled_lessons`, `lesson_sessions`, `payments`, `messages`, `message_threads`, `notifications`
- When modifying RLS policies, beware the `is_tutor()` recursion issue — use `SECURITY DEFINER` functions when needed

## Environment Variables

Required in `.env`:
```env
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
```

Optional:
```env
EXPO_PUBLIC_OPENAI_API_KEY=sk-proj-xxx  # AI worksheet generation
RESEND_API_KEY=re_xxx                   # Email notifications
```

## Platform Considerations

- **iOS**: SecureStore limited to 2048 bytes — session stored in AsyncStorage
- **Android**: 20s timeout for initial auth due to slower storage access on cold start
- **Windows/WSL**: Metro watchman issues — polling mode enabled in metro.config.js
- **Web**: react-native-web provides browser support; `detectSessionInUrl` enabled for password recovery redirects

## Documentation

Detailed docs in `/docs/`:
- QUICKSTART.md - 5-minute setup
- ARCHITECTURE.md - Design patterns
- COMPONENTS.md - UI component reference
- IMPLEMENTATION_STATUS.md - MVP tracking
