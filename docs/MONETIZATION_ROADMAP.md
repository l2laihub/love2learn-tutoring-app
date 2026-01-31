# Love2Learn Monetization Roadmap

## Phase 1: Solo Tutor Product MVP

**Goal**: Transform the app from a single-tutor instance to a product that any solo tutor can sign up for and use.

**Target Launch**: 6-8 weeks from start

---

## Current State Summary

| Area | Current | Target |
|------|---------|--------|
| **Auth Model** | Single tutor + invited parents | Any tutor can sign up |
| **Branding** | Hardcoded "Love2Learn" | Configurable per tutor |
| **Subjects** | 5 hardcoded (piano, math, reading, speech, english) | Tutor-defined subjects |
| **Billing** | Manual invoicing only | Stripe subscription for app access |
| **Deployment** | Manual/Expo Go | App Store (iOS + Android) |

---

## Work Streams

### Stream 1: Multi-Tutor Authentication (Priority: Critical)

Currently, the app assumes one tutor exists. We need to allow any tutor to sign up.

#### 1.1 Tutor Registration Flow
**File**: `app/(auth)/register-tutor.tsx` (new)

```
Current Flow:
- Login → Check role → Tutor dashboard OR Parent onboarding

New Flow:
- Landing → "I'm a Tutor" / "I'm a Parent"
  - Tutor: Register → Payment → Onboarding → Dashboard
  - Parent: Enter invite code → Register → Link to tutor
```

**Tasks**:
- [ ] Create tutor registration screen with email/password
- [ ] Create tutor-specific onboarding flow (business name, subjects, rates)
- [ ] Update role assignment - new signups choose tutor/parent path
- [ ] Add tutor profile completion check before accessing dashboard

**Database Changes**:
```sql
-- New migration: 20260201000001_tutor_profiles.sql
ALTER TABLE parents ADD COLUMN business_name TEXT;
ALTER TABLE parents ADD COLUMN timezone TEXT DEFAULT 'America/Los_Angeles';
ALTER TABLE parents ADD COLUMN subscription_status TEXT DEFAULT 'trial';
ALTER TABLE parents ADD COLUMN subscription_ends_at TIMESTAMPTZ;
ALTER TABLE parents ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE parents ADD COLUMN trial_ends_at TIMESTAMPTZ;

-- Index for subscription queries
CREATE INDEX idx_parents_subscription_status ON parents(subscription_status)
  WHERE role = 'tutor';
```

#### 1.2 Update RLS Policies
**Files**: `supabase/migrations/20260201000002_multi_tutor_rls.sql` (new)

Current RLS assumes one tutor. Each tutor must only see their own data.

**Tasks**:
- [ ] Add `tutor_id` column to key tables (students, parents, payments, etc.)
- [ ] Update all RLS policies to filter by tutor_id
- [ ] Create migration to populate tutor_id for existing data
- [ ] Test data isolation thoroughly

**Tables Requiring tutor_id**:
| Table | Change Needed |
|-------|---------------|
| `students` | Add `tutor_id` FK to parents where role='tutor' |
| `parents` (non-tutor) | Add `tutor_id` FK to link parent to their tutor |
| `scheduled_lessons` | Inherits via student.tutor_id |
| `payments` | Inherits via parent.tutor_id |
| `message_threads` | Add `tutor_id` |
| `notifications` | Add `tutor_id` |
| `tutor_settings` | Already has tutor_id (no change) |
| `tutor_availability` | Already has tutor_id (no change) |

---

### Stream 2: Stripe Subscription Integration (Priority: Critical)

Tutors pay monthly to access the app. Parents use it for free (tutor pays).

#### 2.1 Stripe Setup
**Files**:
- `src/lib/stripe.ts` (new)
- `supabase/functions/stripe-webhook/index.ts` (new)
- `supabase/functions/create-checkout/index.ts` (new)

**Tasks**:
- [ ] Create Stripe account and configure products:
  - Solo Plan: $29/month (up to 20 students)
  - Pro Plan: $49/month (unlimited students, priority support)
  - 14-day free trial for all plans
- [ ] Implement Stripe Checkout for subscription creation
- [ ] Create webhook handler for subscription events:
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`
- [ ] Store subscription status in `parents` table
- [ ] Add subscription check middleware

**Environment Variables** (add to `.env`):
```env
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_SOLO_PRICE_ID=price_xxx
STRIPE_PRO_PRICE_ID=price_xxx
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
```

#### 2.2 Subscription UI
**Files**:
- `app/(tabs)/settings/subscription.tsx` (new)
- `src/components/SubscriptionGate.tsx` (new)

**Tasks**:
- [ ] Create subscription management screen (view plan, cancel, upgrade)
- [ ] Create paywall component for expired/no subscription
- [ ] Add trial countdown banner
- [ ] Implement grace period for failed payments (3 days)
- [ ] Add "Subscribe" CTA in tutor onboarding

**User Experience Flow**:
```
New Tutor Signup:
1. Register with email/password
2. Choose plan (Solo $29 or Pro $49)
3. Stripe Checkout → Payment
4. Redirect to onboarding (business setup)
5. Start using app

Trial Expiration:
1. Show banner: "Trial ends in X days"
2. Day 14: Block access to dashboard
3. Show paywall: "Subscribe to continue"
4. After payment: Full access restored
```

---

### Stream 3: Configurable Branding & Settings (Priority: High)

Remove hardcoded Love2Learn branding. Each tutor configures their own business.

#### 3.1 Tutor Profile Configuration
**Files**:
- `app/(tabs)/settings/business.tsx` (new)
- `src/hooks/useTutorProfile.ts` (new)

**Database Changes**:
```sql
-- Add to tutor_settings or create new table
ALTER TABLE tutor_settings ADD COLUMN business_name TEXT;
ALTER TABLE tutor_settings ADD COLUMN business_logo_url TEXT;
ALTER TABLE tutor_settings ADD COLUMN contact_email TEXT;
ALTER TABLE tutor_settings ADD COLUMN contact_phone TEXT;
ALTER TABLE tutor_settings ADD COLUMN timezone TEXT DEFAULT 'America/Los_Angeles';
ALTER TABLE tutor_settings ADD COLUMN custom_subjects JSONB DEFAULT '[]';
-- custom_subjects format: [{"name": "Guitar", "color": "#FF5722"}]
```

**Tasks**:
- [ ] Create business settings screen
- [ ] Add logo upload (use existing Supabase storage)
- [ ] Make timezone configurable (affects calendar display)
- [ ] Allow custom subjects with custom colors
- [ ] Update parent-facing UI to show tutor's business name

#### 3.2 Remove Hardcoded Values
**Files to Update**:

| File | Change |
|------|--------|
| `src/theme/index.ts` | Keep as default, but allow override from tutor_settings |
| `app.config.ts` | Keep Love2Learn as app name (it's the platform) |
| `app/(tabs)/calendar.tsx:236` | Use tutor's timezone instead of hardcoded Pacific |
| Subject colors | Fall back to custom_subjects from tutor_settings |

**Tasks**:
- [ ] Create `useTutorBranding()` hook to fetch tutor's customizations
- [ ] Update calendar to use tutor's timezone
- [ ] Update subject picker to include custom subjects
- [ ] Ensure parent portal shows tutor's business name, not "Love2Learn"

---

### Stream 4: Parent Invitation Flow Update (Priority: High)

Parents must be linked to a specific tutor. Update the invitation system.

#### 4.1 Update Invitation Tokens
**File**: `src/hooks/useParentInvitations.ts`

**Current**: Invitation creates parent linked to hardcoded tutor
**New**: Invitation contains tutor_id, parent linked on registration

**Tasks**:
- [ ] Add `tutor_id` to `parent_invitations` table
- [ ] Update invitation email to include tutor's business name
- [ ] Update parent registration to set `tutor_id` from invitation
- [ ] Validate invitation belongs to active (paid) tutor

#### 4.2 Parent Experience
**Files**:
- `app/(auth)/register.tsx` (update)
- `app/(auth)/onboarding/welcome.tsx` (update)

**Tasks**:
- [ ] Show tutor's business name during parent onboarding
- [ ] Display tutor's logo in parent portal
- [ ] Remove any "Love2Learn" branding in parent-facing screens

---

### Stream 5: App Store Preparation (Priority: High)

Prepare the app for iOS App Store and Google Play Store submission.

#### 5.1 App Store Requirements
**Files**:
- `app.config.ts` (update)
- `eas.json` (new or update)

**iOS App Store Checklist**:
- [ ] App icon (1024x1024, no alpha)
- [ ] Screenshots (6.5" and 5.5" iPhone, iPad if supporting)
- [ ] App description (4000 chars max)
- [ ] Keywords (100 chars max)
- [ ] Privacy policy URL (required)
- [ ] Terms of service URL (required)
- [ ] Support URL
- [ ] Age rating questionnaire
- [ ] App Review information (demo account)

**Google Play Checklist**:
- [ ] Feature graphic (1024x500)
- [ ] App icon (512x512)
- [ ] Screenshots (phone + 7" tablet + 10" tablet)
- [ ] Short description (80 chars)
- [ ] Full description (4000 chars)
- [ ] Privacy policy URL
- [ ] Content rating questionnaire
- [ ] Target audience declaration

#### 5.2 EAS Build Configuration
**File**: `eas.json`

```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false
      }
    },
    "production": {
      "ios": {
        "resourceClass": "m-medium"
      },
      "android": {
        "buildType": "apk"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@email.com",
        "ascAppId": "your-app-store-connect-app-id",
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

**Tasks**:
- [ ] Create Apple Developer account ($99/year)
- [ ] Create Google Play Developer account ($25 one-time)
- [ ] Set up EAS Build
- [ ] Create production build profiles
- [ ] Generate iOS provisioning profiles
- [ ] Generate Android signing key
- [ ] Write app store descriptions
- [ ] Create screenshots for all required sizes
- [ ] Create privacy policy page (host on website)
- [ ] Create terms of service page

#### 5.3 Legal Documents
**New Files**:
- `docs/PRIVACY_POLICY.md` → Host at yoursite.com/privacy
- `docs/TERMS_OF_SERVICE.md` → Host at yoursite.com/terms

**Privacy Policy Must Include**:
- What data is collected (email, phone, student info, lesson data)
- How data is used (tutoring management, billing)
- Third parties (Supabase, Stripe)
- Data retention policy
- User rights (GDPR/CCPA compliance)
- Contact information

---

### Stream 6: Landing Page & Marketing Site (Priority: Medium)

Create a simple landing page for the app.

#### 6.1 Landing Page
**Option A**: Simple Expo web landing (modify `app/index.tsx`)
**Option B**: Separate marketing site (recommended for SEO)

**Tasks**:
- [ ] Create landing page with:
  - Hero section explaining the product
  - Feature highlights
  - Pricing section
  - Testimonials (can use placeholder initially)
  - Download links (App Store, Play Store)
  - Footer (privacy, terms, contact)
- [ ] Set up domain (e.g., love2learn.app or tutorflow.app)
- [ ] Configure DNS for landing page + deep links

---

## Implementation Order (Dependency Graph)

```
Week 1-2: Foundation
├── 1.1 Database migrations (tutor_id columns, subscription fields)
├── 1.2 Update RLS policies
└── 2.1 Stripe account setup

Week 3-4: Core Features
├── 1.1 Tutor registration flow
├── 2.1 Stripe integration (checkout, webhooks)
├── 2.2 Subscription UI
└── 3.1 Tutor profile configuration

Week 5-6: Polish & Parents
├── 3.2 Remove hardcoded values
├── 4.1 Update invitation flow
├── 4.2 Parent experience updates
└── 5.3 Legal documents

Week 7-8: Launch Prep
├── 5.1 App store assets
├── 5.2 EAS build setup
├── 6.1 Landing page
└── Testing & submission
```

---

## Database Migration Plan

Execute migrations in this order:

```sql
-- 1. Add tutor isolation columns
20260201000001_tutor_profiles.sql
  - Add subscription fields to parents
  - Add tutor_id to related tables

-- 2. Populate tutor_id for existing data
20260201000002_backfill_tutor_id.sql
  - Set tutor_id = (SELECT id FROM parents WHERE role = 'tutor' LIMIT 1)
  - This preserves existing data

-- 3. Update RLS policies
20260201000003_multi_tutor_rls.sql
  - Drop old policies
  - Create new policies with tutor_id filtering

-- 4. Add Stripe fields
20260201000004_stripe_integration.sql
  - Add stripe_customer_id, subscription_status, etc.

-- 5. Add custom subjects support
20260201000005_custom_subjects.sql
  - Add custom_subjects JSONB to tutor_settings
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| **Data leakage between tutors** | Extensive RLS testing, automated tests for isolation |
| **Stripe webhook failures** | Idempotency keys, retry logic, alert on failures |
| **App Store rejection** | Follow guidelines strictly, prepare demo account |
| **Existing user disruption** | Maintain backward compatibility, communicate changes |
| **Subscription billing disputes** | Clear trial/cancellation UX, refund policy |

---

## Success Metrics

**Launch Targets (Month 1)**:
- 10 paying tutors
- < 5% churn
- App Store rating > 4.0

**Growth Targets (Month 3)**:
- 50 paying tutors
- $1,500 MRR
- 2 organic signups/week

---

## Cost Estimate

| Item | Monthly Cost |
|------|--------------|
| Apple Developer | $8.25 ($99/year) |
| Google Play | $0 (one-time $25) |
| Supabase (Pro) | $25 |
| Domain | $1.50 |
| Stripe fees | 2.9% + $0.30 per transaction |
| **Total Fixed** | ~$35/month |

**Break-even**: 2 paying customers at $29/month

---

## Next Steps

1. **Review this roadmap** - Confirm priorities and timeline
2. **Set up Stripe account** - Create products and prices
3. **Create developer accounts** - Apple and Google
4. **Begin Stream 1** - Database migrations and RLS updates

Ready to proceed with implementation? I can start with any stream.
