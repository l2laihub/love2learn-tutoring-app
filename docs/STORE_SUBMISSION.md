# DaLesson — App Store & Play Store Submission Pack

**Single source of truth for submitting DaLesson to the Apple App Store and Google Play.**
Everything below is copy‑paste ready. Last reviewed **October 29, 2026** against Apple's current requirements and the actual code on `main` (`5929d46`).

- App: **DaLesson** (tutoring management, formerly "Love2Learn")
- Version: **1.1.0** · iOS build **2** · Android versionCode **2** (EAS auto‑increments from here)
- Decisions this pack assumes: brand on the new **`dalesson.app`** domain, and **iOS v1 ships free with no purchases** (native IAP comes in a later release).

> `APP_STORE_ASSETS.md` and `APP_STORE_DEPLOYMENT_GUIDE.md` are **stale** (old "Love2Learn" name, wrong bundle ID `com.love2learn.app`, v1.0.0). Use **this** file.

---

## 🚨 Rejection risks found in the code (fix before you submit)

A code review on Oct 29, 2026 found these. The first three are very likely to get the build rejected.

| # | Issue | Guideline | What to do |
|---|-------|-----------|------------|
| 1 | ✅ **Fixed Oct 29: in‑app account deletion.** Profile screen → **Delete Account** (tutors and parents; reached from More → Profile). The user types DELETE to confirm. The `delete-account` edge function cancels any Stripe subscription, calls `delete_user_account()` (migration `20261029000001`), then deletes the auth user. Tutors: all their business data is deleted. Parents: the login is removed, and the tutor keeps the family's lesson and payment records. | 5.1.1(v) | **Deploy before submitting:** `npx supabase db push` and `npx supabase functions deploy delete-account`. Then test with a throwaway tutor and a throwaway parent account. |
| 2 | ✅ **Fixed Oct 29: no prices, plans, trials or Stripe on native.** `BILLING_UI_ENABLED` (`src/config/subscription.ts`) is true on web only. On iOS and Android: the landing page hides pricing, trial notes, billing FAQs and testimonials. Onboarding skips the plan picker and starts the trial quietly. Registration and the onboarding finish screen hide trial wording. Settings hides the Subscription row, and both subscription screens redirect away. The web app is unchanged. | 3.1.1, 3.1.3 | Nothing left to do. Before you submit, check a native build once: landing, tutor sign up, onboarding, Settings. |
| 3 | **App icon has transparent rounded corners.** `assets/icon.png` is RGBA with alpha 0 in the corners. iOS renders transparent icon pixels as black, and App Store Connect rejects a 1024 icon with alpha. | 2.3 / asset validation | **Done in this pass:** new full‑bleed, no‑alpha `assets/icon-ios.png`. `app.config.ts` now sets `ios.icon` to it. Apple applies the rounded mask itself. Needs a new native build. |
| 4 | ✅ **Fixed Oct 29: no more "AI" claims.** The tab header, More menu, worksheet screen, landing page and plan lists now say "Worksheets", "Printable worksheets" or "Worksheet generator". The worksheet hero icon is no longer sparkles. | 2.3.1 | When real AI generation ships, bring the wording back **and** disclose the AI provider in the privacy policy and App Privacy (Guideline 5.1.2(i) requires consent before sending personal data to a third‑party AI). |
| 5 | ✅ **Fixed Oct 29: links now point to `dalesson.app`.** `ios.associatedDomains` is `applinks:dalesson.app` and the Android intent filter host is `dalesson.app`. `public/.well-known/apple-app-site-association` (copied into `dist/` by `expo export`) opens `/register*` (parent invites), `/calendar*`, `/notifications*`, `/requests*` and `/payments*` in the app. `netlify.toml` serves it as JSON. | 2.1 | **To make links open the app:** (1) serve the web app on `https://dalesson.app` (Netlify custom domain). (2) Set the `APP_URL` edge function secret to `https://dalesson.app`. Today the emails fall back to `https://app.lovetolearn.site`, which the app does not claim. (3) Android, optional: add `public/.well-known/assetlinks.json` with your Play app‑signing SHA‑256, from Play Console → App integrity. Until then, Android shows a "open with" chooser. None of this blocks App Review. |
| 6 | Minor: 1:1 parent threads show a "Group" badge (`src/components/messages/MessageThreadCard.tsx:127` falls back to `'Group'` when `recipient_type === 'parent'`). | — | Show the parent's name instead. Not a rejection risk, just polish. |

---

## ✅ Apple requirements in force as of Oct 2026 (checked)

| Requirement | Since | DaLesson status |
|-------------|-------|-----------------|
| Builds must use **Xcode 26 / iOS 26 SDK** | Apr 28, 2026 | ✅ Expo SDK 54's default EAS image uses Xcode 26. No `image` override needed in `eas.json`. |
| **New age rating questionnaire** (ratings are now 4+, 9+, 13+, 16+, 18+). New questions cover in‑app controls, capabilities, medical/wellness and violence. Unanswered = submissions blocked. | Jan 31, 2026 | ⚠️ Answer it in App Store Connect → App Information → Age Rating (see §1). |
| **Screenshots:** App Store Connect's default required iPhone set is now **"iPhone with Dynamic Island (medium display)"** (6.1"/6.3", e.g. 1206×2622), plus one **13" iPad** set. The 6.9" large‑display set is still accepted under "View All Sizes in Media Manager". | Oct 2026 | ✅ Both iPhone sets and the iPad set are generated (§5). `supportsTablet: true`, so the iPad set is required. |
| **Creative assets** (product page header + search results, Asset Library, preview tool). Optional. They show on iOS/iPadOS 27+. Must suit a 4+ audience. No pricing, URLs or copyright symbols. Keep key content in the centre safe area. | Oct 5, 2026 | ✅ Header, search and universal images generated (§5). |
| **iPhone Duo** screenshots (outer 1398×2034, inner 2007×2853). Uploading them adds an "optimized for iPhone Duo" badge. Required from April 2027 only for apps built with the iOS 27.1 SDK. | Oct 2026 | ⏸ **Skip for v1.1.0.** The build uses the iOS 26 SDK and the app hasn't been tested on Duo. See §5. |
| **Privacy manifest** / required‑reason APIs | May 1, 2024 | ✅ Expo SDK 54 merges the manifests from its modules at build time. If App Store Connect emails an `ITMS-91053` warning after upload, add the listed reasons under `ios.privacyManifests` in `app.config.ts`. |
| **In‑app account deletion** | 2022 | ❌ Missing. See risk #1. |
| **Updated guidelines + Program License Agreement** | Jun 8, 2026 | ⚠️ The Account Holder must accept the latest agreement in App Store Connect before submitting. The update put more weight on minors' safety and apps with chat or uploads. Our review notes (§7) explain that messaging is private, tutor ↔ parent only. |
| **EU trader status** (Digital Services Act) | Feb 17, 2025 | ⚠️ Only if you distribute in the EU. Either declare trader status, or untick EU storefronts in Pricing & Availability for v1. |

---

## ⚠️ DECISION / ACTION — do these first

1. **Deploy the account deletion backend** (`npx supabase db push`, `npx supabase functions deploy delete-account`). Then follow the domain steps in risk #5 and run a new production build. Icon and deep‑link changes are native, so OTA will not cover them.
2. **Serve the web app on `dalesson.app`.** The Privacy, Terms and Support pages are now built into the app as `/privacy`, `/terms` and `/support`. The web build serves them, so once the Netlify `dalesson` site is on the `dalesson.app` domain these URLs are live:
   - Privacy Policy → `https://dalesson.app/privacy` (from `docs/PRIVACY_POLICY.md`)
   - Terms of Service → `https://dalesson.app/terms` (from `docs/TERMS_OF_SERVICE.md`)
   - Support → `https://dalesson.app/support` (contact emails, plus account deletion steps at `#delete-account`)
   - After editing either legal doc, run `npm run legal` to refresh `src/content/legal.ts`.
   - Set up `support@dalesson.app` and `privacy@dalesson.app` as working inboxes.
3. **Confirm `EXPO_PUBLIC_ENABLE_PAYWALL=false`** in the EAS production environment.
4. **Create the reviewer demo accounts** in Supabase with sample data (see §7).
5. **Accept the latest Apple Developer Program License Agreement** (Account Holder).

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
| Price | Free (no in‑app purchases in v1) |
| Encryption | `usesNonExemptEncryption: false` is already set (HTTPS only), so no export compliance prompt |

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

### Promotional Text  *(max 170, editable anytime without review)*
```
Schedule lessons, keep notes for every student, and track who has paid. The all‑in‑one app for independent tutors and the families they teach.
```

### Keywords  *(max 100, comma‑separated, no spaces after commas, don't repeat words already in the name)*
```
tutor,lessons,scheduling,students,private lessons,invoice,progress,lesson planner,music teacher
```
(95 characters)

### Description  *(max 4000)*
> Every feature listed here exists in v1.1.0. The old draft promised "goals and milestones" and "AI worksheets", and neither exists, so they were removed (Guideline 2.3.1).
```
DaLesson is the all‑in‑one tutoring management app built for independent tutors and small tutoring studios.

Whether you teach piano, math, reading, speech, English or any other subject, DaLesson helps you run your tutoring business professionally, without the complexity of enterprise software.

SCHEDULE WITH EASE
• Create one‑time or recurring lessons
• Weekly, bi‑weekly and monthly schedules
• Color‑coded subjects for a quick visual of your week
• Combined sessions with several students at once
• Handle cancellations and reschedule requests from parents
• Set your availability and share open slots

KEEP EVERY STUDENT ORGANIZED
• Student profiles with grade, subjects and custom rates
• Session notes after each lesson
• Full lesson history for every student
• Parent contact details one tap away

TRACK PAYMENTS
• Monthly invoices built from completed lessons
• Prepaid lesson packages with sessions used and remaining
• See paid, partial and unpaid families at a glance
• Send payment reminders by email

A PORTAL FOR EVERY FAMILY
• Parents get their own login to see the lesson schedule
• Payment status and history for their family
• Worksheets and assignments from their tutor
• Request a reschedule or an extra session

MESSAGE PARENTS
• Private messaging between you and each family
• Announcements to all parents at once
• Push notifications so nothing gets missed

SHARE LEARNING MATERIALS
• Create printable piano and math worksheets
• Share PDFs, images and videos with families
• Assign practice and see when it's done

WORKS EVERYWHERE
• iPhone, iPad, Android and the web
• Your data syncs across all your devices

PRIVACY FIRST
• No ads and no tracking
• We never sell your data or your students' data
• You control what each family can see

DaLesson was built for tutors, by someone who works with tutors. Every feature is designed to save you time so you can focus on teaching.

Questions? Contact us at support@dalesson.app
```

### What's New  *(version 1.1.0)*
```
• Welcome to DaLesson, with a fresh new look
• Improved scheduling and recurring lessons
• Parent portal improvements
• Performance and reliability fixes
```
> If 1.1.0 is the **first** App Store release, App Store Connect hides "What's New". Keep this text for the next update.

### URLs
| Field | Value |
|-------|-------|
| Support URL *(required)* | `https://dalesson.app/support` |
| Marketing URL *(optional)* | `https://dalesson.app` |
| Privacy Policy URL *(required)* | `https://dalesson.app/privacy` |

### Categories
- **Primary:** Education
- **Secondary:** Business

### Age Rating (new 2026 questionnaire)
App Store Connect → App Information → Age Rating. Answer honestly. These are the facts to answer from:
- Violence, sexual content, profanity, horror, gambling, contests, alcohol/drugs, medical or wellness content: **None**.
- **Messaging / user‑generated content:** **Yes, private.** Tutor ↔ parent messages and file sharing inside a tutor's own studio only. No public profiles, no discovery of strangers, no public posting.
- **Unrestricted web access:** **No.** The app opens YouTube embeds that tutors share, not a general browser.
- **In‑app controls:** tutors control which families see what. Parents can only message their own tutor.
- **Made for Kids:** **No.** Account holders are adults (tutors and parents). Children don't use the app directly.
- Apple computes the rating from these answers. Because messaging exists it may come out above 4+. That's fine, and there is no reason to override it upward.

---

## 2. Google Play — listing fields (copy‑paste)

### App Title  *(max 30)*
```
DaLesson – Tutoring Manager
```

### Short Description  *(max 80)*
```
All-in-one app for independent tutors: schedule, track lessons, get paid.
```

### Full Description  *(max 4000)*
```
DaLesson is the complete tutoring management app built for independent tutors and small tutoring studios.

Juggling schedules, lesson notes and payments across spreadsheets and notebooks? DaLesson brings everything together in one simple app.

KEY FEATURES

Effortless Scheduling
Create one‑time lessons or recurring schedules (weekly, bi‑weekly or monthly). Color‑coded subjects let you see your week at a glance.

Student Management
Keep every student organized in one place: grade, subjects, rates, parent contacts and lesson history.

Session Notes
Record notes after each lesson and keep a full history for every student.

Payments and Invoicing
Monthly invoices built from completed lessons, prepaid lesson packages, and a clear view of who has paid.

Parent Portal
Give each family their own login to see the schedule, payment status and assignments, and to request reschedules.

Messaging
Private messaging with each family, plus announcements to all parents.

Learning Materials
Create printable piano and math worksheets and share PDFs, images and videos with families.

PERFECT FOR
• Piano and music teachers
• Math and science tutors
• Reading and speech specialists
• Language tutors
• Test‑prep tutors
• Any independent educator

Works on phone, tablet and web, with your data synced across all your devices.

No ads. No tracking. We never sell your data.

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

### Content rating (IARC questionnaire)
Category: **Utility, Productivity, Communication or Other**. No violence, sexual or profane content. Users can communicate privately (tutor ↔ parent). Expected rating: **Everyone**.

### Target audience
- Target age group: **18 and over**. Account holders are adults. The app stores information *about* children but isn't designed for children to use, so it's **not** in "Designed for Families". Answer **No** to "appeals to children."

### Play‑specific note
- `READ_EXTERNAL_STORAGE` / `WRITE_EXTERNAL_STORAGE` in `app.config.ts` are deprecated on Android 13+. Play may ask why you need them. `expo-image-picker` and `expo-document-picker` use the system pickers, so you can likely remove both.

---

## 3. App Privacy — Apple "Nutrition Label" answers

App Store Connect → App Privacy. Based on the actual data flows in v1.1.0: Supabase (database, auth, storage), Resend (email), Expo push, optional Telegram recap. **No OpenAI.** It isn't wired up, so don't declare it. **No Stripe on iOS** once risk #2 is fixed.

| Data type (Apple's category) | Collected? | Linked to user? | Tracking? | Purpose |
|------------------------------|-----------|-----------------|-----------|---------|
| Contact Info → Name | Yes | Yes | No | App Functionality |
| Contact Info → Email Address | Yes | Yes | No | App Functionality |
| Contact Info → Phone Number | Yes (optional) | Yes | No | App Functionality |
| User Content → Photos or Videos | Yes | Yes | No | App Functionality (avatars, shared materials) |
| User Content → Emails or Text Messages | Yes | Yes | No | App Functionality (in‑app messages) |
| User Content → Other User Content | Yes | Yes | No | App Functionality (student names, ages, grades, lesson notes, files) |
| Financial Info → Other Financial Info | Yes | Yes | No | App Functionality (lesson payment records the tutor enters. No card data.) |
| Identifiers → Device ID | Yes | Yes | No | App Functionality (push notification token) |
| User ID | Yes | Yes | No | App Functionality (account ID) |
| Diagnostics / Usage Data | **No** | — | — | — |

- **Tracking:** None. No ad SDKs, no IDFA, no App Tracking Transparency prompt needed.
- If you add Sentry or analytics later, add Crash Data / Performance Data / Product Interaction and update the privacy policy first.

---

## 4. Data Safety — Google Play answers

Play Console → App content → Data safety. Mirror the Apple answers:

| Category | Data | Collected | Shared | Purpose |
|----------|------|-----------|--------|---------|
| Personal info | Name, Email, Phone (optional) | Yes | No | App functionality, Account management |
| Personal info | Other (student names, ages, grades) | Yes | No | App functionality |
| Photos and videos | Photos | Yes | No | App functionality |
| Financial info | Other financial info (lesson payment records) | Yes | No | App functionality |
| Messages | Other in‑app messages | Yes | No | App functionality |
| Files and docs | Uploaded worksheets/PDFs | Yes | No | App functionality |
| Device or other IDs | Push token | Yes | No | App functionality |

**Security practices to declare:**
- Data is encrypted in transit (HTTPS/TLS). ✅
- Users can request deletion: in‑app (More → Profile → Delete Account) **and** a web URL. Play requires the web URL: use `https://dalesson.app/support#delete-account`.
- No data sold. ✅

---

## 5. Assets — generated and ready

All files are in **`store-assets/`** in the repo. Sizes are checked: exact pixels, RGB, no alpha.

### iOS (upload these)
| Asset | File(s) | Size |
|-------|---------|------|
| App Store icon | `store-assets/app-store/AppStore-Icon-1024.png` | 1024×1024, RGB, no alpha, square (Apple rounds it) |
| iPhone 6.3" screenshots (**required**: "iPhone with Dynamic Island (medium display)" tab) | `store-assets/app-store/iphone-6.3/iphone63-01…06.png` | 1206×2622 ×6 |
| iPhone 6.9" screenshots (optional: large display, in Media Manager) | `store-assets/app-store/iphone-6.9/iphone-01…06.png` | 1320×2868 ×6 |
| iPad 13" screenshots | `store-assets/app-store/ipad-13/ipad-01…06.png` | 2064×2752 ×6 |
| In‑app icon (binary) | `assets/icon-ios.png` (wired via `ios.icon`) | 1024×1024, no alpha |

Upload the 6.3" set in the default iPhone tab and the iPad set in "iPad 13" display". The 6.9" set is optional. Apple scales screenshots for every other size.

### Header and Search Results (optional, Oct 2026)
Upload under **Product Page Information → Header and Search Results**, or once in **Asset Library**. Approved assets can then be swapped later without a new app version, and reused on Custom Product Pages and Product Page Optimization tests.

| Placement | File | Size |
|-----------|------|------|
| Header (21:9) | `store-assets/app-store/creative/header-21x9-3840x1646.png` | 3840×1646 PNG, no alpha |
| Search results (3:2) | `store-assets/app-store/creative/search-3x2-3840x2560.png` | 3840×2560 PNG, no alpha |
| Universal (16:9, either slot) | `store-assets/app-store/creative/universal-16x9-5244x2950.png` | 5244×2950 PNG, no alpha |

Use the dedicated header and search files. Keep the universal one as a fallback or as a Product Page Optimization variant. All three use real app screens and short text with no prices, URLs or "free" claims. Key content sits inside the centre area that survives both the 21:9 and 3:2 crops. Check them in the **Preview** button before submitting. Regenerate with `node scripts/store-screenshots/creative.js` after `generate.js`.

### iPhone Duo: not for this release
Duo screenshots must show the app actually running on iPhone Duo, and uploading them puts an "optimized for iPhone Duo" badge on the product page. v1.1.0 is built with the iOS 26 SDK and hasn't been laid out or tested for Duo's two displays. Stretched iPhone screenshots would misrepresent that (Guideline 2.3). Leave the iPhone Duo tab empty. Duo owners still get the app in iPhone compatibility mode.
When you move to Xcode 27.1 / the iOS 27.1 SDK, test on the iPhone Duo simulator, then capture real outer (1398×2034) and inner (2007×2853) screenshots. Duo screenshots become required in April 2027 for apps built with the 27.1 SDK.

### Screenshot order and captions
| # | Screen | Caption |
|---|--------|---------|
| 1 | Tutor home dashboard | Your tutoring business at a glance |
| 2 | Lesson calendar | Schedule lessons in seconds |
| 3 | Students & Parents | Every student, organized |
| 4 | Payments | Know who has paid, and who has not |
| 5 | Messages | Keep parents in the loop |
| 6 | Parent dashboard | A portal for every family |

**How they were made:** the real DaLesson UI (web build in `dist/`) was rendered against a mocked backend filled with fictional demo data ("Harmony Studio", tutor "Sarah Nguyen", families like Park, Tran and Chen). No real student data appears. The app UI was then framed with a caption. To regenerate after UI changes:
```bash
npx expo export --platform web      # refresh dist/
cd scripts/store-screenshots && node server.js &   # serves dist/ on :8090
node generate.js                         # writes out/iphone and out/ipad
```

### Android (still to do)
- [ ] Hi‑res icon 512×512 (scale down `AppStore-Icon-1024.png`)
- [ ] Feature graphic 1024×500
- [ ] Phone screenshots, 2–8 at 1080×1920. You can reuse the iPhone set resized to 9:16.

---

## 6. Build & submit (EAS commands)

```bash
# One-time
npm install -g eas-cli
eas login                       # account: huybuilds

# Keep the paywall off for v1
eas env:create --environment production --name EXPO_PUBLIC_ENABLE_PAYWALL --value false

# Build (Expo SDK 54 => Xcode 26 / iOS 26 SDK by default)
eas build --profile production --platform ios

# Submit (credentials are in eas.json)
eas submit --platform ios --latest
```
Then in App Store Connect: attach the build to version 1.1.0, upload screenshots and icon, fill §1, App Privacy (§3), Age Rating, App Review info (§7), and **Submit for Review**.

> **Android:** add a Google Play service‑account JSON under `submit.production.android.serviceAccountKeyPath`, then `eas submit --platform android --latest`. New personal Play accounts need **12 testers for 14 days** on a closed track before production. Start that early.

---

## 7. Reviewer demo accounts + review notes

### Create them with one command
```bash
npx supabase db push                                   # once (adds delete_user_account, used by --reset)
npx tsx scripts/seed-reviewer-accounts.ts --dry-run    # preview, no writes
npx tsx scripts/seed-reviewer-accounts.ts              # create; prints both passwords once
npx tsx scripts/seed-reviewer-accounts.ts --reset      # wipe and recreate (new passwords)
```
- **Tutor** `reviewer.tutor@dalesson.app`: "Sarah Nguyen, Harmony Studio". It has 7 families, 9 students and about 14 weeks of recurring lessons (some with session notes), with invoice and prepaid payments in mixed states and 3 message threads. Onboarding is done.
- **Parent** `reviewer.parent@dalesson.app`: "Jennifer Park", one of that tutor's families (Emma and Lucas). Onboarding and the agreement are done, and there's one unread message.
- Passwords are generated, printed once and never saved. Store them in your password manager. All other names are fictional, and the other families use `.review@example.com` emails, so no real emails are sent.
- Lessons are generated around the run date. Re-run with `--reset` if review happens weeks later, so the calendar isn't empty. Remember to update the password in App Store Connect afterwards.
- Don't delete these accounts with the in-app Delete Account button before review is finished.

### App Store Connect → App Review Information
Sign‑in: `reviewer.tutor@dalesson.app` / `<password>`

Notes:
```
DaLesson is a tutoring management app for independent tutors and the parents of their students.

Tutor demo: reviewer.tutor@dalesson.app / <password>
Shows scheduling, students, session notes, payments tracking and messaging.

Parent demo: reviewer.parent@dalesson.app / <password>
Shows the parent portal for one family.

• This version has no in-app purchases and no paid features.
• Messaging is private and only between a tutor and the families in their own studio. There are no public profiles or discovery.
• Account deletion: More > Profile > Delete Account (scroll to the bottom).
• Children do not use the app. Accounts are for adult tutors and parents.

Support: support@dalesson.app
```

---

## 8. Subscriptions / paywall — status & later setup

**v1 ships with no purchases on iOS.** After risk #2 is fixed:
- No IAP products in App Store Connect for this release.
- iOS shows no prices, plans, trials or Stripe links.
- The web app keeps Stripe Checkout. That's outside the App Store and allowed.

**When you add native subscriptions** (full blueprint in `docs/PAYWALL_SETUP.md`):

| Plan | Price/mo | Limit | Product ID | Entitlement |
|------|----------|-------|------------|-------------|
| Solo | $29 | 25 students | `dalesson_solo_monthly` | `pro_access` |
| Pro | $49 | Unlimited | `dalesson_pro_monthly` | `pro_access` |

- 14‑day free trial as an Introductory Offer.
- Digital subscriptions sold inside the iOS app must use Apple IAP (3.1.1) via RevenueCat. Only the US storefront may also link out to the web.
- Needed when IAP is live: Restore Purchases, manage/cancel link, and price, term and auto‑renew text on the paywall plus links to Terms and Privacy (3.1.2).

---

## 9. Final pre‑submission checklist (iOS)

### Code / build
- [x] In‑app **Delete Account** built (risk #1)
- [ ] Migration pushed + `delete-account` function deployed, then tested with throwaway tutor and parent accounts
- [x] No prices, plans, trials or Stripe links on iOS (risk #2)
- [x] Full‑bleed no‑alpha icon wired via `ios.icon` (risk #3)
- [x] "AI" wording removed from worksheet screens (risk #4)
- [x] Associated domain → `dalesson.app` + AASA file (risk #5)
- [ ] Web app live on `dalesson.app`, `APP_URL` secret set to `https://dalesson.app`
- [ ] `EXPO_PUBLIC_ENABLE_PAYWALL=false` in production env
- [ ] New production build uploaded (Xcode 26 via EAS default image)
- [ ] Tested on a real iPhone **and** an iPad or iPad simulator (iPad is required because `supportsTablet: true`)

### Web / accounts
- [x] Privacy, Terms and Support pages built (`/privacy`, `/terms`, `/support`)
- [ ] `dalesson.app` serves the web build, so those URLs open
- [ ] Confirm the governing law (Delaware) and the legal entity name in both legal docs
- [ ] `legal@dalesson.app` inbox working (listed in the Terms)
- [ ] `support@` and `privacy@dalesson.app` inboxes working
- [ ] Reviewer tutor and parent accounts seeded, onboarding already done
- [ ] Latest Program License Agreement accepted

### App Store Connect
- [ ] Icon + 6 iPhone 6.3" (medium display tab) + 6 iPad 13" screenshots uploaded (6.9" optional)
- [ ] Optional: header + search results assets uploaded and checked in Preview
- [ ] Promotional text replaced with the §1 version (App Store Connect still shows the old "track every student's progress… Free to start" text)
- [ ] Name, subtitle, promo text, keywords, description (§1)
- [ ] Support + Privacy URLs
- [ ] Category: Education / Business
- [ ] Age Rating questionnaire (2026 version) completed
- [ ] App Privacy (§3) completed: **no tracking**
- [ ] Pricing: Free. Availability: decide on EU (trader status)
- [ ] Review sign‑in + notes (§7)
- [ ] Submit for Review

---

*DaLesson v1.1.0 · Expo SDK 54 · reviewed Oct 29, 2026. Supersedes the stale APP_STORE_*.md docs.*
