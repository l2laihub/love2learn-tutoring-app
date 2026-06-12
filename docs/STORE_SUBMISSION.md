# DaLesson — App Store & Play Store Submission Pack

**Single source of truth for submitting DaLesson to the Apple App Store and Google Play.**
Everything below is copy‑paste ready. Sections marked **⚠️ DECISION / ACTION** need a one‑time setup before you submit.

- App: **DaLesson** (tutoring management, formerly "Love2Learn")
- Version: **1.1.0** · iOS build **2** · Android versionCode **2** (EAS auto‑increments from here)
- This pack reflects two decisions: **brand on the new `dalesson.app` domain**, and **iOS ships free with the paywall OFF for v1** (native IAP comes in a later release).

> Older docs `APP_STORE_ASSETS.md` and `APP_STORE_DEPLOYMENT_GUIDE.md` are **stale** (old "Love2Learn" name, wrong bundle ID `com.love2learn.app`, v1.0.0). Use **this** file.

---

## 0. App identity — quick reference (copy‑paste)

| Field | Value |
|-------|-------|
| App display name | `DaLesson` |
| Expo slug | `love2learn` |
| Expo owner / account | `huybuilds` |
| EAS project ID | `80057121-e849-408e-bd31-10d40bb4934f` |
| iOS Bundle ID | `app.huybuilds.dalesson` |
| Android package | `app.huybuilds.dalesson` |
| App Store Connect App ID (ascAppId) | `6760299534` |
| Apple Team ID | `X6P6XG7GPP` |
| Apple ID (submitter) | `dqh978@gmail.com` |
| Version (user‑facing) | `1.1.0` |
| iOS buildNumber / Android versionCode | `2` / `2` (auto‑increment on) |
| Primary category | Education |
| Secondary category (iOS) | Business |
| Price | Free (with optional web/Android subscription — see §8) |

---

## ⚠️ DECISION / ACTION — do these first

These are prerequisites; the listing references them.

1. **Register & host `dalesson.app`** with three live pages (stores reject dead links):
   - Privacy Policy → `https://dalesson.app/privacy`  (content already drafted in `docs/PRIVACY_POLICY.md`)
   - Terms of Service → `https://dalesson.app/terms`  (content in `docs/TERMS_OF_SERVICE.md`)
   - Support page → `https://dalesson.app/support`  (or just a support email, see below)
   - Set up `support@dalesson.app` as a working inbox.
2. **Update legal docs branding**: `docs/PRIVACY_POLICY.md` and `docs/TERMS_OF_SERVICE.md` still say "Love2Learn". Find/replace → "DaLesson" and update the contact email before publishing.
3. **Update deep‑link config** in `app.config.ts` to the new domain, then rebuild (native change, not OTA):
   - `ios.associatedDomains`: `applinks:love2learn.app` → `applinks:dalesson.app`
   - `android.intentFilters[].data.host`: `love2learn.app` → `dalesson.app`
4. **Confirm `EXPO_PUBLIC_ENABLE_PAYWALL=false`** in the production build env (iOS v1 ships with no purchases — see §8).
5. **Create the reviewer demo accounts** in Supabase (see §7).

---

## 1. iOS App Store — listing fields (copy‑paste)

### App Name  *(max 30)*
```
DaLesson – Tutoring Manager
```

### Subtitle  *(max 30)*
```
Run your tutoring business
```

### Promotional Text  *(max 170 — editable anytime without review)*
```
Schedule lessons, track every student's progress, and invoice in seconds. The all‑in‑one app built for independent tutors. Free to start.
```

### Keywords  *(max 100, comma‑separated, NO spaces after commas; don't repeat words already in the title)*
```
tutor,lessons,scheduling,students,private lessons,invoice,progress,lesson planner,music teacher
```

### Description  *(max 4000)*
```
DaLesson is the all‑in‑one tutoring management app built specifically for independent tutors and small tutoring practices.

DESIGNED FOR SOLO TUTORS
Whether you teach piano, math, reading, speech, or any subject, DaLesson helps you run your tutoring business professionally — without the complexity of enterprise software.

SCHEDULE WITH EASE
• Create one‑time or recurring lessons
• Weekly, bi‑weekly, and monthly schedules
• Color‑coded subjects for quick visual reference
• Combined sessions with multiple students
• Handle cancellations and reschedules effortlessly

TRACK STUDENT PROGRESS
• Record detailed session notes after each lesson
• Track goals and milestones for every student
• Monitor progress across subjects and over time
• Share progress updates with parents automatically

SIMPLIFY PAYMENTS
• Generate professional invoices in seconds
• Track paid and unpaid sessions
• Support for prepaid lesson packages
• Send payment reminders with one tap
• Clear payment history for your records

KEEP PARENTS INFORMED
• A dedicated parent portal for each family
• Parents view schedules and progress
• Easy in‑app communication
• Session notes shared automatically
• Transparent booking and payment tracking

SHARE LEARNING MATERIALS
• Upload worksheets, PDFs, and resources
• Organize materials by student or subject
• Parents can access shared materials anytime
• Keep all teaching resources in one place

WORKS EVERYWHERE
• iPhone, iPad, Android, and web browser
• Your data syncs across all devices instantly
• Access your schedule from anywhere

PRIVACY FOCUSED
• Your data is encrypted and secure
• Student information is protected
• You control what parents can see
• No ads, no data selling

DaLesson was built by a tutor, for tutors. Every feature is designed to save you time so you can focus on what matters most: teaching.

Download now and transform how you manage your tutoring business.

Questions? Contact us at support@dalesson.app
```

### What's New  *(version 1.1.0)*
```
• Rebranded to DaLesson with a fresh new look
• Improved scheduling and recurring lesson handling
• Parent portal enhancements
• Performance and reliability fixes
```

### URLs
| Field | Value |
|-------|-------|
| Support URL *(required)* | `https://dalesson.app/support` |
| Marketing URL *(optional)* | `https://dalesson.app` |
| Privacy Policy URL *(required)* | `https://dalesson.app/privacy` |

### Categories
- **Primary:** Education
- **Secondary:** Business

### Age Rating
Answer the questionnaire honestly → expected rating **4+** (no objectionable content, no user‑generated public content, no gambling). The app has private tutor↔parent messaging only (not public social), so it stays 4+.

---

## 2. Google Play — listing fields (copy‑paste)

### App Title  *(max 30)*
```
DaLesson – Tutoring Manager
```

### Short Description  *(max 80)*
```
All-in-one app for independent tutors: schedule, track progress, invoice.
```

### Full Description  *(max 4000)*
```
DaLesson is the complete tutoring management solution built for independent tutors and small tutoring practices.

Juggling schedules, student progress, and payments across spreadsheets and notebooks? DaLesson brings everything together in one simple app.

KEY FEATURES

Effortless Scheduling
Create one‑time lessons or recurring schedules — weekly, bi‑weekly, or monthly. Color‑coded subjects let you see your week at a glance.

Student Management
Keep all student information organized in one place: contact details, subjects, rates, and notes. Never lose track of a student again.

Progress Tracking
Record session notes and track milestones. See progress over time with clear visualizations and help students reach their goals.

Professional Invoicing
Generate invoices automatically from completed sessions. Track payments, send reminders, and support prepaid lesson packages.

Parent Communication
Give parents their own portal to view schedules and progress. Share session notes automatically and build trust through transparency.

Resource Sharing
Upload and share worksheets, PDFs, and learning materials. Organize by student or subject. Parents can access materials anytime.

PERFECT FOR
• Piano and music teachers
• Math and science tutors
• Reading and speech specialists
• Language tutors
• Test‑prep tutors
• Any independent educator

WHY DALESSON?
Built by a tutor who understands your needs — no complex enterprise features you'll never use. Just the tools to run your tutoring business professionally.

Works on phone, tablet, and web, with instant sync across all your devices.

Download DaLesson today and spend less time on admin, more time teaching.

Support: support@dalesson.app
Website: https://dalesson.app
```

### Store settings
| Field | Value |
|-------|-------|
| App category | Education |
| Tags | Education, Productivity, Tutoring |
| Email *(required)* | `support@dalesson.app` |
| Website | `https://dalesson.app` |
| Privacy Policy URL *(required)* | `https://dalesson.app/privacy` |
| Phone | optional |

### Content rating (IARC questionnaire)
Category: **Utility, Productivity, Communication or Other**. No violence/sexual/profane content. Expected rating: **Everyone**.

### Target audience
- Target age group: **18 and over** (the *account holder* — tutors/parents — is an adult). The app stores info *about* children but is not designed for children to use directly, so it is **not** in the "Designed for Families" program and you answer **No** to "appeals to children."

---

## 3. App Privacy — Apple "Nutrition Label" answers

App Store Connect → App Privacy. Declare the following (based on the actual data flows: Supabase, OpenAI worksheet generation, Stripe web payments, Resend email).

| Data type | Collected? | Linked to user? | Used for tracking? | Purpose |
|-----------|-----------|-----------------|--------------------|---------|
| Name | Yes | Yes | No | App Functionality |
| Email Address | Yes | Yes | No | App Functionality |
| Phone Number | Yes (optional) | Yes | No | App Functionality |
| Photos | Yes | Yes | No | App Functionality (profile/material uploads) |
| Sensitive Info (student learning notes) | Yes | Yes | No | App Functionality |
| Payment Info | Yes | Yes | No | Purchases (handled by processor; card data not stored by us) |
| Customer Support content | Yes | Yes | No | App Functionality |
| User Content (messages, notes, files) | Yes | Yes | No | App Functionality |
| Crash/Performance data | No* | — | — | — |

\* Only declare crash/diagnostics if you add Sentry/analytics later.

- **Tracking:** None. The app does **not** track users across other companies' apps/sites. (No ad SDKs, no IDFA.)
- **Third‑party data sharing:** Data is processed by Supabase (hosting/database), Stripe (payments, web), and OpenAI (only the prompt text you submit for AI worksheet generation). None of these is used for advertising.

---

## 4. Data Safety — Google Play answers

Play Console → App content → Data safety. Mirror the Apple answers:

**Data collected and linked to the user:**
| Category | Data | Collected | Shared | Purpose |
|----------|------|-----------|--------|---------|
| Personal info | Name, Email, Phone (optional) | Yes | No | App functionality, Account management |
| Personal info | Other (student names/ages) | Yes | No | App functionality |
| Photos and videos | Photos | Yes | No | App functionality |
| Financial info | Purchase history | Yes | No | App functionality |
| Messages | In‑app messages | Yes | No | App functionality |
| Files and docs | Uploaded worksheets/PDFs | Yes | No | App functionality |
| App activity | In‑app actions | Yes | No | App functionality |

**Security practices to declare:**
- Data is encrypted in transit (HTTPS / TLS). ✅
- Users can request data deletion → provide `support@dalesson.app` (and/or in‑app account deletion if available).
- No data sold to third parties. ✅
- Committed to Play **Families Policy**: N/A (not a Families app).

> **Account deletion (required by both stores):** Apple Guideline 5.1.1(v) and Google both require an in‑app or web path to delete the account. Provide either an in‑app "Delete account" action or a documented request flow at `https://dalesson.app/support`. Confirm this exists before submitting.

---

## 5. Assets checklist (sizes)

Current source assets live in `/assets/` (`icon.png`, `adaptive-icon-foreground.png`, `adaptive-icon-monochrome.png`, `splash.png`, `favicon.png`).

### iOS
- [ ] **App Store icon** 1024×1024 PNG, **no alpha/transparency**, no rounded corners
- [ ] **iPhone 6.9"** screenshots 1320×2868 — **min 3, max 10** (required)
- [ ] **iPhone 6.7"** screenshots 1290×2796 (can auto‑fill 6.5"/5.5")
- [ ] **iPad 13"/12.9"** screenshots 2048×2732 (required — `supportsTablet: true`)
- [ ] App Preview video (optional) 1080×1920, 15–30s

### Android
- [ ] **Hi‑res icon** 512×512 PNG (32‑bit, alpha allowed)
- [ ] **Feature graphic** 1024×500 PNG/JPEG (required)
- [ ] **Phone screenshots** min 2, max 8 — 1080×1920 recommended (9:16)
- [ ] **Tablet screenshots** (recommended if listing as tablet‑supported)
- [ ] Promo video (optional, YouTube link)

### Screenshot content order + captions (both stores)
| # | Screen | Caption |
|---|--------|---------|
| 1 | Dashboard | Your tutoring business at a glance |
| 2 | Calendar / sessions | Schedule lessons in seconds |
| 3 | Student progress | Track every student's progress |
| 4 | Invoicing / payments | Get paid faster with simple invoicing |
| 5 | Parent portal | Keep parents in the loop |
| 6 | Materials | Share resources effortlessly |

---

## 6. Build & submit (EAS commands)

Pre‑built config is in `eas.json` (production = app‑bundle for Android, autoIncrement on; iOS submit credentials already filled).

```bash
# One‑time
npm install -g eas-cli
eas login                       # account: huybuilds

# Set production env (ensure paywall stays OFF for iOS v1)
eas env:create --environment production --name EXPO_PUBLIC_ENABLE_PAYWALL --value false
# (Supabase URL/key should already be set as production env or secrets)

# Build
eas build --profile production --platform ios
eas build --profile production --platform android
# or both:
eas build --profile production --platform all

# Submit (iOS creds are in eas.json: appleId / ascAppId / appleTeamId)
eas submit --platform ios --latest

# Android: requires a Google Play service-account JSON the first time.
# Add it under submit.production.android.serviceAccountKeyPath in eas.json, then:
eas submit --platform android --latest
```

> **Android service account:** create one in Google Cloud, grant Play Console access, download the JSON, and reference it in `eas.json` (`submit.production.android`). EAS will guide you on first run.

> **First Google Play submission gotcha:** brand‑new personal Play accounts may require **20 testers for 14 days on a closed track** before you can promote to production. Plan for this — start a closed test early.

---

## 7. Reviewer demo accounts + review notes

Both stores test behind the login wall, so you must provide working credentials.

### Create in Supabase before submitting
- **Tutor account** (primary — reviewers should land here): seed it with sample students, a few scheduled lessons, and one invoice so the app isn't empty.
  - Email: `reviewer.tutor@dalesson.app`
  - Password: `<set a strong password>`
- **Parent account** (optional, to show the parent portal):
  - Email: `reviewer.parent@dalesson.app`
  - Password: `<set a strong password>`

### App Store Connect → App Review Information → Sign‑In Information
```
Username: reviewer.tutor@dalesson.app
Password: <the password you set>
```
Notes field:
```
DaLesson is a tutoring management app. Sign in with the tutor account above to see scheduling, student management, progress notes, and invoicing. This version does not include in‑app purchases. A parent demo account is available on request. Support: support@dalesson.app
```

### Google Play → App content → App access
Provide the same tutor credentials and a one‑line instruction ("Sign in with the provided tutor account to access all features; no purchase required").

---

## 8. Subscriptions / paywall — status & later setup

**For v1 you are NOT enabling in‑app purchases on the stores.** `EXPO_PUBLIC_ENABLE_PAYWALL=false`, so:
- The app ships **free**; no IAP products are declared in App Store Connect / Play for this release.
- Do **not** check the "in‑app purchases" boxes or attach subscription products on the store listing for v1.
- The web app keeps Stripe Checkout for tutors who subscribe on the web — that's outside the mobile stores and allowed.

**When you add native subscriptions later** (full blueprint in `docs/PAYWALL_SETUP.md`):

| Plan | Price/mo | Limit | iOS/Android product ID | Entitlement |
|------|----------|-------|------------------------|-------------|
| Solo | $29 | 25 students | `dalesson_solo_monthly` | `pro_access` |
| Pro | $49 | Unlimited | `dalesson_pro_monthly` | `pro_access` |

- 14‑day free trial as an **Introductory Offer** (iOS) / **free‑trial offer** (Android).
- iOS digital subscriptions **must** use Apple IAP (Guideline 3.1.1) via RevenueCat — Stripe web checkout will be **rejected** inside the iOS app. RevenueCat wiring (`revenuecat-webhook` edge fn + native purchase flow) is **not yet built**; finish Parts D–E of `PAYWALL_SETUP.md` first.
- Required when IAP is live: a **Restore Purchases** action and links to manage/cancel.

---

## 9. Final pre‑submission checklist

### Shared
- [ ] `dalesson.app` registered; `/privacy`, `/terms`, `/support` pages live
- [ ] `support@dalesson.app` inbox working
- [ ] Legal docs re‑branded (Love2Learn → DaLesson) and published
- [ ] `app.config.ts` deep‑link domain updated to `dalesson.app`; rebuilt
- [ ] Account‑deletion path exists (in‑app or documented)
- [ ] Reviewer demo accounts seeded with sample data
- [ ] `EXPO_PUBLIC_ENABLE_PAYWALL=false` in production build

### iOS
- [ ] Apple Developer account active; app `6760299534` exists in App Store Connect
- [ ] Icon 1024² (no alpha); iPhone 6.9" + iPad 13" screenshots uploaded
- [ ] Name / subtitle / promo / keywords / description filled (§1)
- [ ] Support + Privacy URLs set
- [ ] App Privacy questionnaire completed (§3) — **No tracking**
- [ ] Sign‑in info + review notes provided (§7)
- [ ] Production build uploaded via `eas submit`

### Android
- [ ] Google Play Developer account active; app created (package `app.huybuilds.dalesson`)
- [ ] 512² icon + 1024×500 feature graphic + ≥2 phone screenshots
- [ ] Title / short / full description filled (§2)
- [ ] Content rating (IARC) completed
- [ ] Data safety form completed (§4)
- [ ] App access (test credentials) provided
- [ ] Target audience set (18+; not a Families app)
- [ ] Service‑account JSON wired for `eas submit`; `.aab` uploaded

---

*Generated for DaLesson v1.1.0 · Expo SDK 54 · supersedes the stale APP_STORE_*.md docs.*
