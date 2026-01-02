# Architecture Guide

This document explains the architecture and code organization of the Love2Learn tutoring app.

## Overview

The app follows a clean architecture pattern with clear separation of concerns:

```
┌─────────────────────────────────────────────────────┐
│                    Screens (app/)                    │
│         UI Layer - Expo Router Pages                │
├─────────────────────────────────────────────────────┤
│                 Components (src/components/)         │
│           Reusable UI Components                    │
├─────────────────────────────────────────────────────┤
│                   Hooks (src/hooks/)                │
│         Data Fetching & State Management            │
├─────────────────────────────────────────────────────┤
│                   Lib (src/lib/)                    │
│            Supabase Client & Utilities              │
├─────────────────────────────────────────────────────┤
│                 Supabase Backend                    │
│        PostgreSQL + Auth + Storage                  │
└─────────────────────────────────────────────────────┘
```

## Directory Structure

### `/app` - Screens (Expo Router)

File-based routing powered by Expo Router. Each file becomes a route.

```
app/
├── _layout.tsx           # Root layout with auth provider
├── (tabs)/               # Tab navigator group
│   ├── _layout.tsx       # Tab bar configuration
│   ├── index.tsx         # Home screen (/)
│   ├── calendar.tsx      # Calendar (/calendar)
│   ├── students.tsx      # Students list (/students)
│   ├── worksheets.tsx    # Worksheet generator (/worksheets)
│   └── payments.tsx      # Payment tracking (/payments)
├── (auth)/               # Auth group (unauthenticated)
│   ├── _layout.tsx       # Auth layout (no tabs)
│   ├── login.tsx         # Login screen
│   └── register.tsx      # Registration screen
├── student/
│   └── [id].tsx          # Dynamic student detail (/student/123)
└── parent/
    └── [id].tsx          # Dynamic parent detail (/parent/456)
```

**Key Concepts:**
- `_layout.tsx` - Defines layout wrapper for sibling routes
- `(group)` - Route groups for organization, doesn't affect URL
- `[param]` - Dynamic route segments

### `/src/components` - UI Components

#### Base UI Components (`/src/components/ui/`)

Atomic, reusable components without business logic:

| Component | Purpose | Key Props |
|-----------|---------|-----------|
| `Card` | Container with elevation | `variant`, `accent`, `onPress` |
| `Button` | Tappable button | `variant`, `size`, `loading`, `icon` |
| `Badge` | Status indicators | `variant`, `size`, `color` |
| `Avatar` | User avatar with initials | `name`, `imageUrl`, `size` |
| `Input` | Text input field | `label`, `error`, `icon` |
| `SegmentedControl` | Tab selector | `segments`, `selectedKey` |
| `EmptyState` | Empty content placeholder | `variant`, `title`, `action` |
| `Header` | Screen header | `title`, `leftAction`, `rightAction` |

#### Feature Components (`/src/components/`)

Business-specific components that compose base UI:

| Component | Purpose |
|-----------|---------|
| `LessonCard` | Display lesson info with time/subject |
| `StudentCard` | Student profile card |
| `PaymentCard` | Payment status with progress |
| `Calendar` | Week view calendar |
| `WorksheetGenerator` | Worksheet configuration UI |

### `/src/hooks` - Data Hooks

Custom hooks for data fetching and mutations using Supabase:

```typescript
// Example: useStudents hook
const {
  students,          // Student[]
  loading,           // boolean
  error,             // Error | null
  refetch,           // () => Promise<void>
  createStudent,     // (input) => Promise<Student>
  updateStudent,     // (id, input) => Promise<Student>
  deleteStudent,     // (id) => Promise<void>
} = useStudents();
```

| Hook | Data | Operations |
|------|------|------------|
| `useStudents` | Students list | CRUD + search |
| `useParents` | Parents list | CRUD + with students |
| `useLessons` | Scheduled lessons | CRUD + by date range |
| `usePayments` | Payment records | CRUD + summary stats |
| `useAssignments` | Worksheet assignments | CRUD + by student |

### `/src/lib` - Utilities

#### `supabase.ts` - Supabase Client

```typescript
import { supabase } from '@/lib/supabase';

// Use in hooks
const { data, error } = await supabase
  .from('students')
  .select('*');
```

Features:
- Typed client with Database generics
- Secure token storage (SecureStore on native, localStorage on web)
- Auto token refresh
- Environment variable configuration

#### `auth.ts` - Auth Helpers

```typescript
import { signIn, signOut, getCurrentUser } from '@/lib/auth';

// Sign in
await signIn(email, password);

// Get current user
const user = await getCurrentUser();

// Sign out
await signOut();
```

### `/src/theme` - Design System

Centralized design tokens:

```typescript
import { colors, spacing, typography, shadows, borderRadius } from '@/theme';

// Colors
colors.piano.primary     // '#FF6B6B'
colors.math.primary      // '#4CAF50'
colors.neutral.text      // '#1A2B3C'
colors.status.paid       // '#4CAF50'

// Spacing (multiples of 4)
spacing.xs   // 4
spacing.sm   // 8
spacing.md   // 12
spacing.base // 16
spacing.lg   // 24
spacing.xl   // 32

// Typography
typography.sizes.sm      // 14
typography.sizes.base    // 16
typography.weights.bold  // '700'

// Shadows
shadows.sm   // Small elevation
shadows.md   // Medium elevation
shadows.lg   // Large elevation
```

### `/src/types` - TypeScript Definitions

#### `database.ts`

Generated types matching Supabase schema:

```typescript
// Table row types
type Student = Tables<'students'>;
type Parent = Tables<'parents'>;
type ScheduledLesson = Tables<'scheduled_lessons'>;

// Insert/Update types
type InsertStudent = InsertTables<'students'>;
type UpdateStudent = UpdateTables<'students'>;

// Extended types with relations
interface StudentWithParent extends Student {
  parent: Parent;
}

interface ScheduledLessonWithStudent extends ScheduledLesson {
  student: StudentWithParent;
}
```

## Data Flow

### Reading Data

```
Screen → useHook → Supabase Query → PostgreSQL
                         ↓
Screen ← useState ← Data/Error
```

Example:
```typescript
// In screen component
function StudentsScreen() {
  const { students, loading, error } = useStudents();

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <FlatList
      data={students}
      renderItem={({ item }) => <StudentCard student={item} />}
    />
  );
}
```

### Writing Data

```
Screen → useHook.mutate → Supabase Mutation → PostgreSQL
                                    ↓
Screen ← Optimistic Update ← Success/Error
```

Example:
```typescript
function AddStudentScreen() {
  const { createStudent } = useStudents();

  const handleSubmit = async (data) => {
    try {
      await createStudent(data);
      router.back();
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  return <StudentForm onSubmit={handleSubmit} />;
}
```

## State Management

The app uses a simple state pattern:

1. **Server State** - Managed by hooks with Supabase
2. **Local State** - React `useState` for UI state
3. **Auth State** - Context provider in root layout

No global state library (Redux, Zustand) is needed due to:
- Supabase real-time subscriptions for live updates
- Component-level state for UI interactions
- URL state via Expo Router for navigation

## Authentication Flow

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   App Start │────▶│ Check Auth   │────▶│ Auth State  │
└─────────────┘     └──────────────┘     └─────────────┘
                           │                    │
                           ▼                    ▼
                    ┌──────────────┐     ┌─────────────┐
                    │ No Session   │     │ Has Session │
                    └──────────────┘     └─────────────┘
                           │                    │
                           ▼                    ▼
                    ┌──────────────┐     ┌─────────────┐
                    │ Auth Screens │     │ Main App    │
                    └──────────────┘     └─────────────┘
```

Implementation in `app/_layout.tsx`:
```typescript
function RootLayoutNav() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <SplashScreen />;

  return (
    <Stack>
      {isAuthenticated ? (
        <Stack.Screen name="(tabs)" />
      ) : (
        <Stack.Screen name="(auth)" />
      )}
    </Stack>
  );
}
```

## Database Schema

```
┌─────────────┐       ┌──────────────┐       ┌─────────────────┐
│   parents   │───────│   students   │───────│scheduled_lessons│
└─────────────┘       └──────────────┘       └─────────────────┘
      │                      │
      │                      │
      ▼                      ▼
┌─────────────┐       ┌──────────────┐
│  payments   │       │ assignments  │
└─────────────┘       └──────────────┘
```

See `supabase/schema.sql` for complete schema with:
- Table definitions
- Foreign key relationships
- Row Level Security (RLS) policies
- Indexes for performance
- Triggers for timestamps

## Best Practices

### Component Design

1. **Keep components small** - Single responsibility
2. **Use TypeScript** - Full type coverage
3. **Compose, don't inherit** - Prefer composition
4. **Extract hooks** - Reusable logic in hooks

### Performance

1. **Memoize callbacks** - `useCallback` for handlers
2. **Virtualized lists** - `FlatList` for long lists
3. **Lazy loading** - Dynamic imports for heavy components
4. **Image optimization** - Use Expo Image with caching

### Error Handling

1. **Try-catch in hooks** - Catch and expose errors
2. **Error boundaries** - Catch render errors
3. **User feedback** - Show meaningful error messages
4. **Logging** - Console in dev, analytics in prod
