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
npx tsx scripts/extend-recurring-lessons.ts

# Troubleshooting
npx expo start --clear            # Clear Metro cache
npx expo install --fix            # Fix dependency versions
```

## Architecture

### Tech Stack
- **Frontend**: React Native 0.81 + Expo 54 + Expo Router 6 (file-based routing)
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Real-time)
- **Language**: TypeScript with strict mode

### Directory Structure
```
app/                    # Expo Router screens (file-based routing)
├── (tabs)/            # Tab navigation group (main app screens)
├── (auth)/            # Auth screens (login, register, onboarding)
├── student/[id].tsx   # Dynamic routes use [param] syntax
└── _layout.tsx        # Root layout with AuthProvider

src/
├── components/        # Reusable UI components
│   └── ui/           # Base components (Card, Button, Badge, Input, etc.)
├── hooks/            # Data hooks wrapping Supabase queries
├── lib/              # Supabase client (supabase.ts) and auth (auth.ts)
├── contexts/         # React contexts (AuthContext)
├── theme/            # Design system (colors, spacing, typography)
└── types/            # TypeScript definitions (database.ts)

supabase/
├── migrations/       # 50+ SQL migrations (run in order)
└── config.toml       # Supabase CLI config
```

### Data Flow Pattern
All data fetching uses custom hooks that wrap Supabase queries:
```typescript
const { data, loading, error, refetch, create, update } = useStudents();
```

Key hooks: `useStudents`, `useParents`, `useLessons`, `usePayments`, `useAssignments`, `useTutorAvailability`, `useSharedResources`, `useNotifications`

### Path Aliases (tsconfig.json)
```typescript
import { Button } from '@components/ui/Button';
import { useStudents } from '@hooks';
import { theme } from '@theme';
import { supabase } from '@lib/supabase';
```

## Key Implementation Details

### Authentication
- Hybrid storage: AsyncStorage for session data + SecureStore for tokens (iOS has 2048 byte limit on SecureStore)
- Auth state managed via `AuthContext` in root layout
- Role-based access: `is_tutor()` function in Supabase determines tutor vs parent permissions
- RLS circular dependency solved with `get_current_user_parent()` RPC function

### Lesson System
- Lessons can be combined sessions (multiple students at once)
- Color-coded by subject: Piano=#3D9CA8, Math=#7CB342, Reading=#9C27B0, Speech=#FF9800, English=#2196F3
- Recurrence patterns: weekly, bi-weekly, monthly
- Parents can request reschedules and drop-in sessions

### Database Conventions
- Always create new migrations, never edit existing ones
- RLS policies control data access - test carefully when modifying
- Key tables: `parents` (users), `students`, `scheduled_lessons`, `lesson_sessions`, `payments`

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

- **iOS**: SecureStore limited to 2048 bytes - session stored in AsyncStorage
- **Android**: 20s timeout for initial auth due to slower storage access
- **Windows/WSL**: Metro watchman issues - polling mode enabled in metro.config.js
- **Web**: react-native-web provides browser support

## Documentation

Detailed docs in `/docs/`:
- QUICKSTART.md - 5-minute setup
- ARCHITECTURE.md - Design patterns
- COMPONENTS.md - UI component reference
- IMPLEMENTATION_STATUS.md - MVP tracking

---

## Agent Orchestration

### Quick Reference

| Command | Use For |
|---------|---------|
| `/feature [description]` | New features (full workflow) |
| `/bugfix [description]` | Bug investigation and fix |
| `/review-security` | Security & performance audit |
| `/quickfix [description]` | Simple tasks (<15 min) |

### Agent Delegation Rules

When working on this project, automatically delegate to specialized agents:

#### By File Type/Location
[CUSTOMIZE: Update patterns to match your project structure]

| Path Pattern | Agent |
|--------------|-------|
| `src/components/**/*.tsx` | `@frontend` |
| `src/app/**/*.tsx` | `@frontend` or `@mobile-dev` |
| `src/api/**`, `src/server/**` | `@backend` |
| `**/migrations/**/*.sql` | `@database` |
| `**/*.test.ts`, `**/*.spec.ts` | `@tester` |
| `.github/workflows/**`, `**/Dockerfile` | `@devops` |

#### By Task Type
| Task | Agent Flow |
|------|------------|
| New feature | `@planner` → implementation agent → `@tester` → `@reviewer` |
| Bug fix | `@debugger` → implementation agent → `@tester` → `@reviewer` |
| API changes | `@api-designer` → `@backend` → `@tester` |
| UI design | `@mobile-ui` → `@frontend` or `@mobile-dev` |
| Performance issue | `@performance` → implementation agent |
| Schema changes | `@database` → update types → test |
| Deployment | `@deploy` (with `@security` review if needed) |
| CI/CD changes | `@devops` |

#### Security-Required Reviews

Always run `@security` review when touching:
- [ ] Authentication / authorization code
- [ ] Password / token handling
- [ ] Payment / billing code
- [ ] User input handlers
- [ ] Database queries with user-provided data
- [ ] File uploads
- [ ] API endpoints accepting external data
- [ ] Third-party integrations

#### Database Changes

Always use `@database` agent when:
- [ ] Creating/modifying tables
- [ ] Adding/changing access policies
- [ ] Writing migrations
- [ ] Backfilling data
- [ ] Adding indexes

### Quality Gates

Before merging ANY code:
- [ ] `@reviewer` has approved
- [ ] `@security` has reviewed (if applicable)
- [ ] `@database` has reviewed migrations (if schema changed)
- [ ] All tests pass
- [ ] No TypeScript/lint errors
- [ ] Types regenerated if schema changed
- [ ] Documentation updated (if user-facing)

### Project-Specific Notes

[CUSTOMIZE: Add notes specific to your project]

#### Critical Paths (Extra Care Required)
- **[Path 1]**: [Why it needs extra care]
- **[Path 2]**: [Why it needs extra care]

#### Tech Stack Quick Reference
[CUSTOMIZE: Fill in your actual tech stack]

- **Frontend**: [e.g., React, Vue, Next.js]
- **State**: [e.g., Redux, Zustand, React Query]
- **Backend**: [e.g., Node.js, .NET, Supabase, Django]
- **Database**: [e.g., PostgreSQL, MongoDB, Supabase]
- **Payments**: [e.g., Stripe, PayPal] (if applicable)
- **Hosting**: [e.g., Vercel, Netlify, AWS, Azure]

#### Common Commands
[CUSTOMIZE: Add your project's common commands]

```bash
# Development
npm run dev           # Start dev server
npm test              # Run tests
npm run build         # Production build
npm run lint          # Lint code
npm run typecheck     # Type checking

# Database (if applicable)
# [Add your migration/seed commands]

# Deployment (if applicable)
# [Add your deploy commands]
```

---