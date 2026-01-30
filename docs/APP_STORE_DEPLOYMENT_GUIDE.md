# App Store & Google Play Deployment Guide

## Love2Learn Tutoring App - Mobile Deployment Documentation

This guide walks you through deploying the Love2Learn app to the Apple App Store and Google Play Store.

---

## Table of Contents

1. [Current App Readiness Status](#current-app-readiness-status)
2. [Prerequisites & Requirements](#prerequisites--requirements)
3. [Phase 1: Account Setup](#phase-1-account-setup)
4. [Phase 2: App Configuration](#phase-2-app-configuration)
5. [Phase 3: Building the Apps](#phase-3-building-the-apps)
6. [Phase 4: App Store Submission (iOS)](#phase-4-app-store-submission-ios)
7. [Phase 5: Google Play Submission (Android)](#phase-5-google-play-submission-android)
8. [Phase 6: Post-Submission](#phase-6-post-submission)
9. [Estimated Costs](#estimated-costs)
10. [Timeline Expectations](#timeline-expectations)
11. [Troubleshooting](#troubleshooting)

---

## Current App Readiness Status

### What's Already Done
- [x] Expo configured with proper bundle IDs (`com.love2learn.app`)
- [x] iOS and Android basic configuration in `app.config.ts`
- [x] App icons and splash screen assets exist
- [x] TypeScript strict mode enabled
- [x] Supabase backend fully integrated
- [x] Web deployment working (Netlify)

### What Needs to Be Done Before Submission
- [ ] Set up Apple Developer Account
- [ ] Set up Google Play Developer Account
- [ ] Configure EAS (Expo Application Services)
- [ ] Create app signing certificates
- [ ] Prepare app store assets (screenshots, descriptions)
- [ ] Create Privacy Policy page
- [ ] Create Terms of Service page
- [ ] Test on physical devices
- [ ] Configure production environment variables

---

## Prerequisites & Requirements

### For iOS (App Store)

| Requirement | Details | Cost |
|-------------|---------|------|
| Apple Developer Account | Required for App Store submission | $99/year |
| Mac Computer | Required for iOS certificate generation (or use Expo EAS) | N/A |
| App Store Connect Access | Comes with Developer Account | Included |
| Physical iPhone/iPad | For testing (recommended) | N/A |

### For Android (Google Play)

| Requirement | Details | Cost |
|-------------|---------|------|
| Google Play Developer Account | Required for Play Store submission | $25 one-time |
| Google Play Console Access | Comes with Developer Account | Included |
| Physical Android Device | For testing (recommended) | N/A |

### Technical Requirements

| Tool | Version | Installation |
|------|---------|--------------|
| Node.js | 18+ | Already installed |
| EAS CLI | Latest | `npm install -g eas-cli` |
| Expo CLI | Latest | Already in project |

---

## Phase 1: Account Setup

### Step 1.1: Apple Developer Account

1. **Visit** [developer.apple.com](https://developer.apple.com)
2. **Click** "Account" and sign in with your Apple ID
3. **Enroll** in the Apple Developer Program
4. **Pay** the $99/year fee
5. **Wait** for approval (usually 24-48 hours)

**What You'll Need:**
- Valid Apple ID
- Credit card for payment
- Government-issued ID (for identity verification)
- D-U-N-S Number (if enrolling as organization)

### Step 1.2: Google Play Developer Account

1. **Visit** [play.google.com/console](https://play.google.com/console)
2. **Sign in** with your Google account
3. **Pay** the $25 one-time registration fee
4. **Complete** your developer profile
5. **Verify** your identity (may take a few days)

**What You'll Need:**
- Google account
- Credit card for payment
- Phone number for verification

---

## Phase 2: App Configuration

### Step 2.1: Install EAS CLI

```bash
npm install -g eas-cli
```

### Step 2.2: Login to Expo

```bash
eas login
```

Create an Expo account at [expo.dev](https://expo.dev) if you don't have one.

### Step 2.3: Configure EAS Project

```bash
eas build:configure
```

This creates an `eas.json` file. Replace it with this production-ready configuration:

```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true
      },
      "android": {
        "buildType": "apk"
      }
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false
      },
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "ios": {
        "resourceClass": "m1-medium"
      },
      "android": {
        "buildType": "app-bundle"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "YOUR_APPLE_ID@email.com",
        "ascAppId": "YOUR_APP_STORE_CONNECT_APP_ID",
        "appleTeamId": "YOUR_TEAM_ID"
      },
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "production"
      }
    }
  }
}
```

### Step 2.4: Update app.config.ts

Update your `app.config.ts` with the EAS project ID:

```typescript
// In app.config.ts, replace "your-eas-project-id" with actual ID
extra: {
  eas: {
    projectId: "YOUR_ACTUAL_EAS_PROJECT_ID" // Get this from expo.dev
  }
}
```

To get your EAS Project ID:
1. Go to [expo.dev](https://expo.dev)
2. Create a new project or link existing
3. Copy the project ID from the project settings

### Step 2.5: Configure Environment Variables for Production

Create production secrets in EAS:

```bash
# Set production environment variables
eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value "your-production-url"
eas secret:create --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value "your-production-key"
```

### Step 2.6: Create Privacy Policy & Terms of Service

Both app stores **require** these. Create them as web pages or in-app screens.

**Options:**
1. Host on your website (e.g., `https://love2learn.com/privacy`)
2. Use a service like Termly, iubenda, or GetTerms
3. Create simple pages in your app

**Privacy Policy Must Include:**
- What data you collect (user accounts, student info, payment data)
- How you use the data
- Third-party services (Supabase, OpenAI, Resend)
- Data retention policies
- User rights (GDPR, CCPA compliance)
- Contact information

---

## Phase 3: Building the Apps

### Step 3.1: Test Locally First

```bash
# Test on iOS simulator (Mac only)
npm run ios

# Test on Android emulator
npm run android

# Or use Expo Go on physical device
npm start
# Scan QR code with Expo Go app
```

### Step 3.2: Build for Internal Testing

```bash
# Build preview version for testing
eas build --profile preview --platform all
```

This creates:
- iOS: `.ipa` file (installable on registered devices)
- Android: `.apk` file (installable directly)

### Step 3.3: Build for Production

```bash
# Build iOS production version
eas build --profile production --platform ios

# Build Android production version
eas build --profile production --platform android

# Or build both at once
eas build --profile production --platform all
```

**Build Time:** 15-30 minutes per platform

### Step 3.4: Download Build Artifacts

After builds complete:
1. Go to [expo.dev](https://expo.dev)
2. Navigate to your project > Builds
3. Download the `.ipa` (iOS) and `.aab` (Android) files

---

## Phase 4: App Store Submission (iOS)

### Step 4.1: Create App in App Store Connect

1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. Click "My Apps" > "+" > "New App"
3. Fill in:
   - **Platform:** iOS
   - **Name:** Love2Learn Tutoring
   - **Primary Language:** English (US)
   - **Bundle ID:** com.love2learn.app
   - **SKU:** love2learn-tutoring-001

### Step 4.2: Prepare App Store Assets

**Required Screenshots (for each device size):**

| Device | Size | Quantity |
|--------|------|----------|
| iPhone 6.7" | 1290 x 2796 px | 3-10 screenshots |
| iPhone 6.5" | 1284 x 2778 px | 3-10 screenshots |
| iPhone 5.5" | 1242 x 2208 px | 3-10 screenshots |
| iPad Pro 12.9" | 2048 x 2732 px | 3-10 screenshots |

**Tips for Screenshots:**
- Use a tool like [screenshots.pro](https://screenshots.pro) or Figma
- Show key features: Dashboard, Sessions, Payments, Student Progress
- Add captions/frames for professional look

**App Icon:**
- 1024 x 1024 px (already have in `assets/images/icon.png`)
- No transparency, no rounded corners (Apple adds them)

### Step 4.3: Fill App Information

**App Information Tab:**
- **Name:** Love2Learn Tutoring (max 30 characters)
- **Subtitle:** Manage Your Tutoring Business (max 30 characters)
- **Category:** Education
- **Secondary Category:** Business

**Description (max 4000 characters):**
```
Love2Learn is the all-in-one tutoring management platform for tutors and parents.

FOR TUTORS:
• Schedule and manage tutoring sessions
• Track student progress with detailed reports
• Generate and send invoices automatically
• Create custom worksheets and lesson plans
• Manage multiple students and families

FOR PARENTS:
• Book sessions with your tutor
• View your child's progress
• Access session notes and materials
• Manage payments and invoices
• Communicate with tutors easily

Features include:
- Prepaid session packages
- Automatic invoice generation
- Session scheduling and reminders
- Progress tracking and reports
- Secure document sharing
- In-app messaging

Start streamlining your tutoring today!
```

**Keywords (max 100 characters):**
```
tutoring,education,lessons,teaching,students,scheduling,invoices,progress
```

**Support URL:** Your website or support page

**Privacy Policy URL:** Your privacy policy page (required)

### Step 4.4: Submit for Review

**Using EAS Submit (Recommended):**
```bash
eas submit --platform ios
```

**Or Manual Upload:**
1. Download Transporter app from Mac App Store
2. Upload your `.ipa` file
3. Wait for processing (5-30 minutes)
4. Select build in App Store Connect
5. Submit for Review

### Step 4.5: App Review Process

**Review Time:** 24-48 hours (can be longer)

**Common Rejection Reasons:**
1. Missing privacy policy
2. Incomplete metadata
3. Bugs or crashes
4. Guideline violations
5. Missing login credentials for review

**Provide Demo Account:**
In App Store Connect, provide test credentials:
- Email: `reviewer@love2learn.com`
- Password: `ReviewTest123!`

Create this account in your Supabase database before submission.

---

## Phase 5: Google Play Submission (Android)

### Step 5.1: Create App in Google Play Console

1. Go to [play.google.com/console](https://play.google.com/console)
2. Click "Create app"
3. Fill in:
   - **App name:** Love2Learn Tutoring
   - **Default language:** English (US)
   - **App or Game:** App
   - **Free or Paid:** Free

### Step 5.2: Set Up App Signing

Google Play manages your app signing. When you upload your first `.aab`:
1. Google Play generates and stores the app signing key
2. You only manage the upload key (created by EAS)

### Step 5.3: Complete Store Listing

**Main Store Listing:**

| Field | Requirement |
|-------|-------------|
| Short description | Max 80 characters |
| Full description | Max 4000 characters |
| App icon | 512 x 512 px PNG |
| Feature graphic | 1024 x 500 px |
| Screenshots | Min 2, max 8 per device type |
| Phone screenshots | 16:9 or 9:16 aspect ratio |
| Tablet screenshots | Required if tablet support enabled |

**Short Description:**
```
All-in-one tutoring management for tutors and parents. Schedule, track, invoice.
```

### Step 5.4: Content Rating Questionnaire

1. Go to "Policy" > "App content" > "Content rating"
2. Answer the questionnaire honestly
3. Your app will likely receive: **Everyone** or **Everyone 10+**

### Step 5.5: Data Safety Form

**Required Information:**

| Data Type | Collected | Shared | Purpose |
|-----------|-----------|--------|---------|
| Name | Yes | No | Account functionality |
| Email | Yes | No | Account functionality |
| Phone | Optional | No | Contact |
| Payment info | Yes | Yes (payment processor) | Purchases |
| App activity | Yes | No | Analytics |

### Step 5.6: Upload and Submit

**Using EAS Submit:**
```bash
# First, create a Google Service Account for automated uploads
# Follow: https://expo.dev/accounts/[your-account]/projects/[project]/credentials

eas submit --platform android
```

**Or Manual Upload:**
1. Go to "Release" > "Production"
2. Click "Create new release"
3. Upload your `.aab` file
4. Add release notes
5. Review and roll out

### Step 5.7: Review Process

**Review Time:** 1-7 days (first submission can take longer)

**Production Access:**
- New accounts start with limited access
- You may need 20 testers for 14 days before full production release

---

## Phase 6: Post-Submission

### Step 6.1: Monitor Reviews

- Check App Store Connect and Google Play Console daily
- Respond to user reviews professionally
- Address reported issues quickly

### Step 6.2: Set Up Analytics

Consider adding:
- Firebase Analytics (free)
- Sentry for crash reporting
- Mixpanel or Amplitude for user analytics

### Step 6.3: Plan Updates

```bash
# For future updates, increment version in app.config.ts
# Then build and submit again

eas build --profile production --platform all
eas submit --platform all
```

### Step 6.4: Over-the-Air Updates (Optional)

Expo allows instant updates without app store review:

```bash
# Enable EAS Update
eas update:configure

# Push an update
eas update --branch production
```

**Note:** OTA updates can only change JavaScript code, not native modules.

---

## Estimated Costs

| Item | Cost | Frequency |
|------|------|-----------|
| Apple Developer Account | $99 | Annual |
| Google Play Developer Account | $25 | One-time |
| EAS Build (free tier) | $0 | 30 builds/month |
| EAS Build (production tier) | $99/month | Optional |
| Privacy Policy Generator | $0-50 | One-time |
| Screenshot Tool | $0-30 | One-time |

**Minimum to Start:** $124 (Apple + Google accounts)

---

## Timeline Expectations

| Phase | Duration |
|-------|----------|
| Account Setup | 1-3 days (waiting for approvals) |
| App Configuration | 1-2 days |
| Asset Preparation | 2-3 days |
| Building & Testing | 1-2 days |
| iOS Submission & Review | 1-7 days |
| Android Submission & Review | 1-7 days |

**Total:** 1-3 weeks from start to apps live in stores

---

## Troubleshooting

### Common Issues

**Build Failures:**
```bash
# Clear cache and rebuild
eas build --clear-cache --platform [ios|android]
```

**iOS Certificate Issues:**
```bash
# Reset credentials
eas credentials --platform ios
```

**Android Signing Issues:**
```bash
# View current credentials
eas credentials --platform android
```

**Submission Rejections:**

| Rejection Reason | Solution |
|------------------|----------|
| Missing privacy policy | Add URL to app store listing |
| Login required | Provide demo credentials |
| Crashes | Fix bugs, test thoroughly |
| Incomplete metadata | Fill all required fields |
| Guideline 4.2 (minimum functionality) | Ensure app provides value |

### Getting Help

- **Expo Documentation:** [docs.expo.dev](https://docs.expo.dev)
- **Expo Discord:** [chat.expo.dev](https://chat.expo.dev)
- **Apple Developer Forums:** [developer.apple.com/forums](https://developer.apple.com/forums)
- **Google Play Help:** [support.google.com/googleplay/android-developer](https://support.google.com/googleplay/android-developer)

---

## Quick Reference Commands

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure EAS for project
eas build:configure

# Build for testing
eas build --profile preview --platform all

# Build for production
eas build --profile production --platform all

# Submit to stores
eas submit --platform ios
eas submit --platform android

# Check build status
eas build:list

# View credentials
eas credentials

# Push OTA update
eas update --branch production
```

---

## Checklist Before Submission

### iOS
- [ ] Apple Developer Account active
- [ ] App created in App Store Connect
- [ ] Screenshots uploaded (all required sizes)
- [ ] App description and keywords filled
- [ ] Privacy policy URL added
- [ ] Support URL added
- [ ] Demo account credentials provided
- [ ] Production build uploaded
- [ ] Content rights declarations completed

### Android
- [ ] Google Play Developer Account active
- [ ] App created in Play Console
- [ ] Screenshots uploaded
- [ ] Store listing completed
- [ ] Content rating questionnaire done
- [ ] Data safety form completed
- [ ] Privacy policy URL added
- [ ] Production build uploaded
- [ ] Target API level compliant

---

*Last Updated: January 2025*
*App Version: 1.0.0*
*Expo SDK: 54*
