# Quick Start Guide

Get the Love2Learn app running in 5 minutes.

## Prerequisites

- Node.js 18+ installed
- npm installed
- Expo Go app on your phone (optional, for device testing)

## Steps

### 1. Install Dependencies

```bash
cd love2learn-tutoring-app
npm install
```

### 2. Create Environment File

```bash
cp .env.example .env
```

For quick testing without Supabase, leave the default values. The app will show a warning but still run with mock auth.

### 3. Start the App

```bash
npm start
```

### 4. Open the App

Choose one:

| Platform | How to Open |
|----------|-------------|
| **Web** | Press `w` in terminal, or open http://localhost:8081 |
| **iOS** | Press `i` (requires macOS + Xcode) |
| **Android** | Press `a` (requires Android Studio) |
| **Phone** | Scan QR code with Expo Go app |

## What You'll See

1. **Splash screen** - Brief loading state
2. **Home screen** - Today's lessons summary (empty initially)
3. **Tab bar** - Navigate between Home, Calendar, Students, Worksheets, Payments

## Next Steps

### Set Up Supabase (For Real Data)

1. Create account at [supabase.com](https://supabase.com)
2. Create new project
3. Run database schema:
   - Go to SQL Editor
   - Paste contents of `supabase/schema.sql`
   - Click Run
4. Copy credentials to `.env`:
   - Settings > API > Project URL
   - Settings > API > anon public key

### Add Test Data

After setting up Supabase, you can add data through:
- The app UI (add students, schedule lessons)
- Supabase dashboard (Table Editor)
- SQL queries in SQL Editor

### Example Test Data SQL

```sql
-- Insert a test parent
INSERT INTO parents (id, user_id, name, email, phone)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM auth.users LIMIT 1),
  'Smith Family',
  'smith@example.com',
  '555-0123'
);

-- Insert a test student
INSERT INTO students (id, parent_id, name, age, grade_level)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM parents LIMIT 1),
  'Alice Smith',
  8,
  '3rd'
);
```

## Troubleshooting

### "Metro bundler error on Windows"

Use one of these alternatives:
- Run via WSL (Windows Subsystem for Linux)
- Use `npm run web` for browser testing
- Test on physical device with Expo Go

### "Supabase connection error"

- Check your `.env` file has correct values
- Verify Supabase project is active
- Check network connectivity

### "Module not found"

```bash
rm -rf node_modules
npm install
```

### "Expo version mismatch"

```bash
npx expo install --fix
```

## Useful Commands

```bash
# Start development server
npm start

# Clear cache and start
npx expo start --clear

# Type check
npm run typecheck

# Lint code
npm run lint

# Start specific platform
npm run ios
npm run android
npm run web
```

## Documentation

- [Full Setup Guide](./SETUP.md) - Detailed installation instructions
- [Architecture](./ARCHITECTURE.md) - Code structure and patterns
- [Components](./COMPONENTS.md) - UI component reference
- [README](../README.md) - Project overview
