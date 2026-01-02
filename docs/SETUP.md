# Development Setup Guide

This guide walks you through setting up the Love2Learn tutoring app for local development.

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Installation](#installation)
3. [Supabase Setup](#supabase-setup)
4. [Running the App](#running-the-app)
5. [Development Tools](#development-tools)
6. [Platform-Specific Setup](#platform-specific-setup)

---

## System Requirements

### Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| Node.js | 18.x or 20.x LTS | JavaScript runtime |
| npm | 9.x+ | Package manager |
| Git | 2.x+ | Version control |

### Optional (for native development)

| Software | Version | Platform | Purpose |
|----------|---------|----------|---------|
| Xcode | 15+ | macOS only | iOS builds |
| Android Studio | Latest | Any | Android builds |
| Watchman | Latest | macOS | File watching |

### Check Your Setup

```bash
# Verify Node.js
node --version  # Should be v18.x or v20.x

# Verify npm
npm --version   # Should be 9.x+

# Verify Git
git --version   # Should be 2.x+
```

---

## Installation

### Step 1: Clone the Repository

```bash
git clone <repository-url>
cd love2learn-tutoring-app
```

### Step 2: Install Dependencies

```bash
npm install
```

This installs all required packages including:
- Expo SDK and related packages
- React Native
- Supabase client
- Navigation libraries
- UI component dependencies

### Step 3: Fix Expo Versions (if needed)

If you see version warnings, run:

```bash
npx expo install --fix
```

### Step 4: Create Environment File

```bash
# Copy the example file
cp .env.example .env
```

Edit `.env` with your values:

```env
# Required - Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Optional - OpenAI for worksheet generation
EXPO_PUBLIC_OPENAI_API_KEY=sk-...
```

---

## Supabase Setup

### Option A: Supabase Cloud (Recommended for beginners)

1. **Create Account**
   - Go to [supabase.com](https://supabase.com)
   - Sign up for a free account

2. **Create Project**
   - Click "New Project"
   - Choose organization
   - Enter project name: `love2learn`
   - Set a strong database password
   - Select region closest to you
   - Click "Create new project"

3. **Get Credentials**
   - Go to Settings > API
   - Copy "Project URL" → `EXPO_PUBLIC_SUPABASE_URL`
   - Copy "anon public" key → `EXPO_PUBLIC_SUPABASE_ANON_KEY`

4. **Run Database Schema**
   - Go to SQL Editor
   - Click "New query"
   - Paste contents of `supabase/schema.sql`
   - Click "Run"

5. **Enable Auth (Optional)**
   - Go to Authentication > Providers
   - Enable Email provider
   - Configure settings as needed

### Option B: Local Supabase (Advanced)

1. **Install Supabase CLI**

```bash
# macOS
brew install supabase/tap/supabase

# Windows (with Scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# npm (any platform)
npm install -g supabase
```

2. **Initialize and Start**

```bash
# Initialize Supabase in project
supabase init

# Start local services (requires Docker)
supabase start
```

3. **Apply Schema**

```bash
# Copy schema to supabase/migrations
cp supabase/schema.sql supabase/migrations/001_initial_schema.sql

# Reset database with migrations
supabase db reset
```

4. **Get Local Credentials**

After `supabase start`, you'll see:
```
API URL: http://localhost:54321
anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Use these in your `.env` file.

---

## Running the App

### Start Development Server

```bash
npm start
```

This opens Expo DevTools in your terminal with options:
- Press `i` for iOS Simulator
- Press `a` for Android Emulator
- Press `w` for Web browser
- Scan QR code with Expo Go app

### Platform-Specific Commands

```bash
# iOS Simulator (macOS only)
npm run ios

# Android Emulator
npm run android

# Web Browser
npm run web
```

### Running on Physical Device

1. **Install Expo Go**
   - iOS: [App Store](https://apps.apple.com/app/expo-go/id982107779)
   - Android: [Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)

2. **Connect to Same Network**
   - Ensure phone and computer are on same WiFi

3. **Scan QR Code**
   - iOS: Use Camera app
   - Android: Use Expo Go app

---

## Development Tools

### VS Code Extensions (Recommended)

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "dsznajder.es7-react-js-snippets",
    "msjsdiag.vscode-react-native"
  ]
}
```

### TypeScript Configuration

The project uses strict TypeScript. Run type checking:

```bash
npm run typecheck
```

### ESLint

```bash
npm run lint
```

### Debugging

1. **React Native Debugger**
   - Shake device or press `m` in terminal
   - Select "Debug Remote JS"

2. **Expo DevTools**
   - Press `?` in terminal for all options

3. **Console Logs**
   - Logs appear in terminal where `npm start` is running

---

## Platform-Specific Setup

### macOS (iOS Development)

1. **Install Xcode**
```bash
# From App Store or
xcode-select --install
```

2. **Install iOS Simulator**
   - Open Xcode > Preferences > Components
   - Download iOS Simulator

3. **Install Watchman (Recommended)**
```bash
brew install watchman
```

### Windows

1. **Use WSL for Best Experience**
```powershell
# Install WSL
wsl --install

# Install Ubuntu
wsl --install -d Ubuntu
```

2. **Or Use Web/Android**
   - Web version works natively
   - Android Emulator works with Android Studio

3. **Known Issues**
   - Metro bundler may have file watching issues
   - Solution: Use WSL or run on physical device

### Linux

1. **Install Dependencies**
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nodejs npm git

# Install Watchman
git clone https://github.com/facebook/watchman.git
cd watchman
./autogen.sh
./configure
make
sudo make install
```

### Android (All Platforms)

1. **Install Android Studio**
   - Download from [developer.android.com](https://developer.android.com/studio)

2. **Create Virtual Device**
   - Open Android Studio
   - Tools > AVD Manager
   - Create Virtual Device
   - Select Pixel 6 or similar
   - Download system image (API 33+)
   - Finish setup

3. **Configure Environment**

```bash
# Add to ~/.bashrc or ~/.zshrc
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

4. **Start Emulator**
```bash
# List available emulators
emulator -list-avds

# Start emulator
emulator -avd Pixel_6_API_33
```

---

## Verifying Setup

Run this checklist to verify everything is working:

```bash
# 1. Check dependencies
npm ls

# 2. Run type check
npm run typecheck

# 3. Start dev server
npm start

# 4. Open in web browser (press 'w')
# Should see the app running

# 5. Check Supabase connection
# Open app and check console for connection warnings
```

If all steps pass, your development environment is ready!

---

## Next Steps

- Read [README.md](../README.md) for project overview
- Check [ARCHITECTURE.md](./ARCHITECTURE.md) for code structure
- See [COMPONENTS.md](./COMPONENTS.md) for UI component docs
