# Love2Learn Tutoring App

A mobile application for managing piano and math tutoring lessons, built with React Native and Expo.

## Features

- **Lesson Scheduling** - Calendar view for managing tutoring sessions
- **Student Management** - Track students and parent contact information
- **Payment Tracking** - Monitor monthly payments with status indicators
- **AI Worksheets** - Generate custom piano and math worksheets
- **Multi-subject Support** - Piano (coral theme) and Math (green theme)

## Tech Stack

- **Frontend**: React Native + Expo (SDK 54)
- **Navigation**: Expo Router (file-based routing)
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Language**: TypeScript
- **Styling**: React Native StyleSheet with custom theme system

## Prerequisites

- Node.js 18+ (LTS recommended)
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- For iOS: macOS with Xcode
- For Android: Android Studio with emulator
- Expo Go app on your phone (for physical device testing)

## Quick Start

### 1. Clone and Install

```bash
cd love2learn-tutoring-app
npm install
```

### 2. Environment Setup

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your Supabase credentials:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_OPENAI_API_KEY=your-openai-key  # Optional, for worksheet generation
```

### 3. Start Development Server

```bash
# Start Expo development server
npm start

# Or start with specific platform
npm run ios      # iOS Simulator
npm run android  # Android Emulator
npm run web      # Web browser
```

### 4. Run on Device

1. Install **Expo Go** from App Store (iOS) or Play Store (Android)
2. Scan the QR code shown in terminal with Expo Go
3. The app will load on your device

## Project Structure

```
love2learn-tutoring-app/
├── app/                      # Expo Router screens
│   ├── (tabs)/              # Tab navigator screens
│   │   ├── index.tsx        # Home screen
│   │   ├── calendar.tsx     # Calendar screen
│   │   ├── students.tsx     # Students list
│   │   ├── worksheets.tsx   # Worksheet generator
│   │   └── payments.tsx     # Payment tracking
│   ├── (auth)/              # Auth screens
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── student/[id].tsx     # Student detail
│   ├── parent/[id].tsx      # Parent detail
│   └── _layout.tsx          # Root layout
├── src/
│   ├── components/          # Reusable components
│   │   ├── ui/             # Base UI components
│   │   │   ├── Card.tsx
│   │   │   ├── Button.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Avatar.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── SegmentedControl.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   └── Header.tsx
│   │   ├── LessonCard.tsx
│   │   ├── StudentCard.tsx
│   │   ├── PaymentCard.tsx
│   │   ├── Calendar.tsx
│   │   └── WorksheetGenerator.tsx
│   ├── hooks/               # Data fetching hooks
│   │   ├── useStudents.ts
│   │   ├── useParents.ts
│   │   ├── useLessons.ts
│   │   ├── usePayments.ts
│   │   └── useAssignments.ts
│   ├── lib/                 # Utilities
│   │   ├── supabase.ts     # Supabase client
│   │   └── auth.ts         # Auth helpers
│   ├── theme/               # Design system
│   │   └── index.ts        # Colors, typography, spacing
│   └── types/               # TypeScript definitions
│       └── database.ts     # Database types
├── supabase/
│   ├── migrations/         # Database migrations
│   │   ├── 20260102000000_initial_schema.sql
│   │   └── 20260102000001_rls_policies.sql
│   └── seed.sql            # Sample data for development
├── assets/                  # Images, fonts
├── app.config.ts           # Expo configuration
├── package.json
└── tsconfig.json
```

## Database Setup

### Option 1: Supabase CLI (Recommended)

```bash
# Link to your Supabase project (get project ID from dashboard URL)
npx supabase link --project-ref YOUR_PROJECT_ID

# Push migrations to remote database
npx supabase db push

# (Optional) Run seed data
# Copy and run supabase/seed.sql in SQL Editor
```

### Option 2: Manual via Dashboard

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run migrations in order:
   - First: `supabase/migrations/20260102000000_initial_schema.sql`
   - Then: `supabase/migrations/20260102000001_rls_policies.sql`
3. (Optional) Run `supabase/seed.sql` for sample data
4. Copy your project URL and anon key to `.env`

### Option 3: Local Supabase (Docker required)

```bash
# Start local Supabase
npx supabase start

# Apply migrations + seed data
npx supabase db reset

# Get local credentials
npx supabase status
```

### Disabling RLS for Development

If testing without authentication:

```sql
ALTER TABLE parents DISABLE ROW LEVEL SECURITY;
ALTER TABLE students DISABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_lessons DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE assignments DISABLE ROW LEVEL SECURITY;
```

## Development Workflow

### Type Checking

```bash
npm run typecheck
```

### Linting

```bash
npm run lint
```

### Building for Production

```bash
# Install EAS CLI
npm install -g eas-cli

# Configure EAS
eas build:configure

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android
```

## Theme System

The app uses a consistent design system defined in `src/theme/index.ts`:

### Colors

```typescript
// Piano theme (coral)
colors.piano.primary    // #FF6B6B
colors.piano.light      // #FF9A9A
colors.piano.dark       // #E85555

// Math theme (green)
colors.math.primary     // #4CAF50
colors.math.light       // #81C784
colors.math.dark        // #388E3C

// Status colors
colors.status.paid      // Green
colors.status.partial   // Yellow
colors.status.unpaid    // Red
```

### Helper Functions

```typescript
import { getSubjectColor, getPaymentStatusColor } from '@/theme';

const subjectColors = getSubjectColor('piano');  // Returns piano color palette
const statusColor = getPaymentStatusColor('paid'); // Returns green
```

## Troubleshooting

### Metro Bundler Issues on Windows

If you see `EISDIR: illegal operation on a directory` error:

1. Use WSL (Windows Subsystem for Linux)
2. Or run via Expo Go on a physical device
3. Or use the web version: `npm run web`

### Expo Dependencies Warning

If you see version mismatch warnings:

```bash
npx expo install --fix
```

### Clear Cache

```bash
# Clear Metro cache
npx expo start --clear

# Clear npm cache
npm cache clean --force
rm -rf node_modules
npm install
```

### iOS Simulator Not Working

```bash
# Ensure Xcode is installed
xcode-select --install

# Open iOS Simulator manually
open -a Simulator
```

### Android Emulator Not Found

1. Open Android Studio
2. Go to Tools > AVD Manager
3. Create and start an emulator
4. Then run `npm run android`

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `EXPO_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `EXPO_PUBLIC_OPENAI_API_KEY` | No | OpenAI API key for worksheets |

## Contributing

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make your changes
3. Run type check: `npm run typecheck`
4. Commit: `git commit -m "Add my feature"`
5. Push: `git push origin feature/my-feature`
6. Open a Pull Request

## License

MIT License - see LICENSE file for details
