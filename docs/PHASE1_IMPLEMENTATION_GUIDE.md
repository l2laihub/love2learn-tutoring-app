# Phase 1 Monetization Implementation Guide

This document explains the Phase 1 monetization implementation for Love2Learn, transforming it from a single-tutor app into a multi-tenant SaaS product for solo tutors.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Changes](#architecture-changes)
3. [Setup Instructions](#setup-instructions)
4. [Database Migrations](#database-migrations)
5. [Feature Guide](#feature-guide)
6. [Testing Guide](#testing-guide)
7. [Deployment Checklist](#deployment-checklist)
8. [Troubleshooting](#troubleshooting)

---

## Overview

### What Changed

| Before | After |
|--------|-------|
| Single tutor hardcoded | Any tutor can sign up |
| Manual billing (Venmo/Zelle) | Stripe subscription for app access |
| Hardcoded "Love2Learn" branding | Configurable per-tutor branding |
| 5 fixed subjects | Custom subjects with custom colors |
| Pacific timezone only | Configurable timezone |
| No landing page | Marketing landing page with pricing |

### New User Flows

```
NEW TUTOR JOURNEY:
Landing Page → Register as Tutor → Choose Plan → Stripe Checkout
→ Tutor Onboarding (4 steps) → Dashboard

NEW PARENT JOURNEY (unchanged):
Receive Invitation → Click Link → Register → Parent Onboarding → Dashboard

EXISTING TUTOR (subscription expired):
Login → Subscription Gate (paywall) → Subscribe → Dashboard
```

### Pricing Tiers

| Plan | Price | Features |
|------|-------|----------|
| **Solo** | $29/month | Up to 20 students, core features |
| **Pro** | $49/month | Unlimited students, priority support, AI worksheets |
| **Trial** | Free 14 days | Full Pro features during trial |

---

## Architecture Changes

### Database Schema Updates

```
┌─────────────────────────────────────────────────────────────┐
│                    MULTI-TENANT MODEL                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  parents (role='tutor')                                      │
│  ├── id (tutor_id for other tables)                         │
│  ├── subscription_status: trial|active|past_due|canceled    │
│  ├── subscription_tier: solo|pro                            │
│  ├── stripe_customer_id                                      │
│  ├── stripe_subscription_id                                  │
│  ├── trial_ends_at                                          │
│  └── subscription_ends_at                                    │
│       │                                                      │
│       ├── tutor_settings (1:1)                              │
│       │   ├── business_name, logo_url, timezone             │
│       │   ├── custom_subjects (JSONB)                       │
│       │   └── rates (default, per-subject, combined)        │
│       │                                                      │
│       ├── parents (role='parent') [N per tutor]             │
│       │   └── tutor_id → links to their tutor               │
│       │                                                      │
│       ├── students [N per tutor]                            │
│       │   └── tutor_id → data isolation                     │
│       │                                                      │
│       └── All other data tables have tutor_id               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### New Files Structure

```
app/
├── landing.tsx                          # Marketing landing page
├── (auth)/
│   ├── register-tutor.tsx               # Tutor registration
│   └── onboarding/tutor/
│       ├── _layout.tsx                  # Onboarding flow layout
│       ├── business.tsx                 # Step 1: Business setup
│       ├── subjects.tsx                 # Step 2: Subjects & rates
│       ├── subscription.tsx             # Step 3: Choose plan
│       └── complete.tsx                 # Step 4: Welcome
├── settings/                            # Settings screens (tutor only)
│   ├── _layout.tsx
│   ├── index.tsx                        # Settings menu
│   ├── business.tsx                     # Business profile
│   ├── subjects.tsx                     # Subject management
│   └── subscription.tsx                 # Subscription management

src/
├── components/
│   ├── SubscriptionGate.tsx             # Paywall for expired subscriptions
│   └── TrialBanner.tsx                  # Trial countdown banner
├── hooks/
│   ├── useSubscription.ts               # Subscription state & actions
│   ├── useTutorBranding.ts              # Per-tutor branding
│   └── useTutorProfile.ts               # Profile CRUD operations
├── lib/
│   └── stripe.ts                        # Stripe client helpers

supabase/
├── functions/
│   ├── create-checkout/index.ts         # Creates Stripe Checkout session
│   ├── stripe-webhook/index.ts          # Handles Stripe events
│   └── create-portal/index.ts           # Creates billing portal session
├── migrations/
│   ├── 20260201000001_tutor_profiles.sql
│   ├── 20260201000002_tutor_id_columns.sql
│   ├── 20260201000003_backfill_tutor_id.sql
│   ├── 20260201000004_custom_subjects.sql
│   ├── 20260201000005_multi_tutor_rls.sql
│   └── 20260201000006_invitation_tutor_link.sql

docs/
├── PHASE1_IMPLEMENTATION_GUIDE.md       # This file
├── MONETIZATION_ROADMAP.md              # Planning document
├── PRIVACY_POLICY.md                    # Legal: Privacy policy
├── TERMS_OF_SERVICE.md                  # Legal: Terms of service
└── APP_STORE_ASSETS.md                  # App store submission guide
```

### Row-Level Security (RLS)

All tables now filter by `tutor_id`:

```sql
-- Example: Students table policy
CREATE POLICY "Tutors see own students"
ON students FOR ALL
USING (tutor_id = auth.uid());

CREATE POLICY "Parents see own children"
ON students FOR SELECT
USING (parent_id IN (
  SELECT id FROM parents WHERE user_id = auth.uid()
));
```

---

## Setup Instructions

### 1. Environment Variables

Add these to your `.env` file:

```env
# Existing Supabase config
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJxxxx

# NEW: Stripe configuration
STRIPE_SECRET_KEY=sk_test_xxxx              # From Stripe Dashboard
STRIPE_WEBHOOK_SECRET=whsec_xxxx            # From Stripe Webhooks
STRIPE_SOLO_PRICE_ID=price_xxxx             # Solo plan price ID
STRIPE_PRO_PRICE_ID=price_xxxx              # Pro plan price ID
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxx
```

### 2. Stripe Setup

#### Create Stripe Account
1. Go to https://dashboard.stripe.com/register
2. Complete account setup and verification

#### Create Products & Prices
1. Go to **Products** → **Add Product**
2. Create "Love2Learn Solo":
   - Price: $29/month, recurring
   - Copy the `price_xxxx` ID → `STRIPE_SOLO_PRICE_ID`
3. Create "Love2Learn Pro":
   - Price: $49/month, recurring
   - Copy the `price_xxxx` ID → `STRIPE_PRO_PRICE_ID`

#### Configure Webhook
1. Go to **Developers** → **Webhooks** → **Add endpoint**
2. URL: `https://YOUR_SUPABASE_PROJECT.supabase.co/functions/v1/stripe-webhook`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy the signing secret → `STRIPE_WEBHOOK_SECRET`

#### Enable Customer Portal
1. Go to **Settings** → **Billing** → **Customer portal**
2. Enable the portal and configure allowed actions

### 3. Database Migrations

Run migrations in order:

```bash
# Push all migrations to your Supabase project
npx supabase db push

# OR run individually for more control:
npx supabase migration up 20260201000001_tutor_profiles
npx supabase migration up 20260201000002_tutor_id_columns
npx supabase migration up 20260201000003_backfill_tutor_id
npx supabase migration up 20260201000004_custom_subjects
npx supabase migration up 20260201000005_multi_tutor_rls
npx supabase migration up 20260201000006_invitation_tutor_link
```

### 4. Deploy Edge Functions

```bash
# Deploy all Stripe-related functions
npx supabase functions deploy create-checkout --no-verify-jwt
npx supabase functions deploy stripe-webhook --no-verify-jwt
npx supabase functions deploy create-portal --no-verify-jwt

# Set secrets for the functions
npx supabase secrets set STRIPE_SECRET_KEY=sk_test_xxxx
npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxxx
npx supabase secrets set STRIPE_SOLO_PRICE_ID=price_xxxx
npx supabase secrets set STRIPE_PRO_PRICE_ID=price_xxxx
```

### 5. Update Supabase Storage

Ensure the `avatars` bucket exists and allows logo uploads:

```sql
-- Run in Supabase SQL Editor if bucket doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;
```

---

## Feature Guide

### Landing Page (`/landing`)

**Purpose**: Marketing page for unauthenticated users

**Features**:
- Hero section with value proposition
- Feature highlights with icons
- Pricing cards (Solo vs Pro)
- FAQ accordion
- Call-to-action buttons

**Navigation**:
- "Get Started Free" → `/register-tutor`
- "Sign In" → `/login`

---

### Tutor Registration (`/register-tutor`)

**Purpose**: New tutor account creation

**Fields**:
- Email (required, validated)
- Password (required, min 8 chars)
- Business Name (required)
- Terms acceptance checkbox

**Flow**:
1. User fills form and submits
2. Supabase Auth creates account with `role: 'tutor'` in metadata
3. Trigger creates `parents` record with `role='tutor'`
4. User redirected to tutor onboarding

---

### Tutor Onboarding (`/onboarding/tutor/*`)

**4-Step Flow**:

| Step | Screen | Purpose |
|------|--------|---------|
| 1 | `/business` | Business name, contact info, timezone, logo |
| 2 | `/subjects` | Enable subjects, set rates, add custom subjects |
| 3 | `/subscription` | Choose Solo or Pro plan |
| 4 | `/complete` | Welcome message, quick start tips |

**Data Saved**:
- Step 1 → `tutor_settings` table (business info)
- Step 2 → `tutor_settings` table (rates, custom_subjects)
- Step 3 → User metadata (selected_plan)
- Step 4 → `parents` table (tutor_onboarding_completed_at)

---

### Subscription Gate (`SubscriptionGate` component)

**Purpose**: Block access when subscription expired

**Usage**:
```tsx
<SubscriptionGate>
  <YourProtectedContent />
</SubscriptionGate>
```

**Behavior**:
- Active/Trial subscription → Shows children
- Expired/Canceled → Shows paywall with subscribe button
- Past due → Shows warning + grace period

---

### Trial Banner (`TrialBanner` component)

**Purpose**: Show trial countdown to tutors

**Usage**:
```tsx
<TrialBanner />
```

**Behavior**:
- Shows "X days left in trial" during trial
- Shows "Subscribe now" when trial ending soon (<3 days)
- Hidden for active paid subscriptions

---

### Settings Screens (`/settings/*`)

**Business Settings** (`/settings/business`):
- Edit business name, contact email, phone
- Upload/change logo
- Set timezone (affects calendar display)

**Subject Settings** (`/settings/subjects`):
- Toggle default subjects on/off
- Set per-subject hourly rates
- Add custom subjects with name + color
- Set combined session rate

**Subscription Settings** (`/settings/subscription`):
- View current plan and status
- See trial/renewal dates
- "Manage Subscription" → Opens Stripe Customer Portal
- "Update Payment Method" → Stripe Portal
- "View Billing History" → Stripe Portal

---

### Parent Invitation Updates

**Changes**:
- Invitations now include `tutor_id`
- Parent registration validates tutor has active subscription
- Parent sees tutor's business name throughout onboarding
- Parent data linked to tutor via `tutor_id`

---

## Testing Guide

### Prerequisites

1. Complete [Setup Instructions](#setup-instructions)
2. Use Stripe test mode (keys starting with `sk_test_` and `pk_test_`)
3. Have Stripe test card numbers ready:
   - Success: `4242 4242 4242 4242`
   - Decline: `4000 0000 0000 0002`
   - Requires auth: `4000 0025 0000 3155`

### Test Scenarios

#### Scenario 1: New Tutor Registration

```
1. Open app (should redirect to /landing)
2. Click "Get Started Free"
3. Fill registration form:
   - Email: test-tutor@example.com
   - Password: TestPassword123
   - Business Name: Test Tutoring
   - Accept terms
4. Click "Create Account"
5. Verify redirect to /onboarding/tutor/business

Expected: Account created, tutor_settings record created
```

#### Scenario 2: Tutor Onboarding Flow

```
1. Complete registration (Scenario 1)
2. Business Setup:
   - Verify business name pre-filled
   - Add phone: (555) 123-4567
   - Select timezone: America/New_York
   - Upload logo (optional)
   - Click "Continue"
3. Subjects Setup:
   - Enable Piano and Math
   - Set Piano rate: $50
   - Set Math rate: $45
   - Add custom subject: "Guitar" with orange color, $55
   - Click "Continue"
4. Subscription:
   - Select "Pro" plan
   - Click "Start Free Trial"
5. Complete:
   - Verify welcome message shows business name
   - Click "Go to Dashboard"

Expected: Redirected to main app, all settings saved
```

#### Scenario 3: Stripe Checkout (After Trial)

```
1. Manually expire trial in database:
   UPDATE parents
   SET trial_ends_at = NOW() - INTERVAL '1 day',
       subscription_status = 'trial_expired'
   WHERE email = 'test-tutor@example.com';

2. Login as tutor
3. Should see SubscriptionGate (paywall)
4. Click "Subscribe Now"
5. Complete Stripe Checkout with test card
6. Verify redirect back to app
7. Verify full access restored

Expected: subscription_status = 'active', dashboard accessible
```

#### Scenario 4: Subscription Management

```
1. Login as tutor with active subscription
2. Go to Settings → Subscription
3. Click "Manage Subscription"
4. Verify Stripe Customer Portal opens
5. Test: Update payment method
6. Test: View invoices
7. Test: Cancel subscription

Expected: All portal actions work, status synced via webhook
```

#### Scenario 5: Parent Invitation with Tutor Linking

```
1. Login as tutor
2. Go to Admin → Parents → Invite Parent
3. Send invitation to test-parent@example.com
4. Check invitation includes tutor_id
5. Open invitation link (logout first)
6. Complete parent registration
7. Verify parent sees tutor's business name
8. Login as tutor, verify parent appears in list

Expected: Parent linked to tutor via tutor_id
```

#### Scenario 6: Data Isolation (Multi-Tenant)

```
1. Create two tutor accounts:
   - tutor1@example.com (Business: "Tutor One")
   - tutor2@example.com (Business: "Tutor Two")
2. As Tutor 1: Add student "Alice"
3. As Tutor 2: Add student "Bob"
4. As Tutor 1: Verify can see Alice, cannot see Bob
5. As Tutor 2: Verify can see Bob, cannot see Alice
6. Check database: students have different tutor_id values

Expected: Complete data isolation between tutors
```

#### Scenario 7: Custom Subjects

```
1. Login as tutor
2. Settings → Subjects
3. Add custom subject:
   - Name: "Violin"
   - Color: Purple (#9C27B0)
   - Rate: $60/30min
4. Go to Calendar → Add Lesson
5. Verify "Violin" appears in subject dropdown
6. Create lesson with Violin subject
7. Verify lesson shows with purple color

Expected: Custom subject usable throughout app
```

#### Scenario 8: Timezone Configuration

```
1. Login as tutor (default: America/Los_Angeles)
2. Note current time displayed in calendar
3. Settings → Business → Change timezone to America/New_York
4. Save changes
5. Return to calendar
6. Verify times adjusted (+3 hours from Pacific)

Expected: All times display in tutor's configured timezone
```

### Webhook Testing

Use Stripe CLI for local webhook testing:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local function
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook

# Trigger test events
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger invoice.payment_failed
```

### Database Verification Queries

```sql
-- Check tutor has subscription fields
SELECT id, email, role, subscription_status, subscription_tier,
       stripe_customer_id, trial_ends_at
FROM parents WHERE role = 'tutor';

-- Check tutor_settings
SELECT ts.*, p.email
FROM tutor_settings ts
JOIN parents p ON p.user_id = ts.tutor_id
WHERE p.role = 'tutor';

-- Check data isolation
SELECT s.name, s.tutor_id, p.email as tutor_email
FROM students s
JOIN parents p ON p.id = s.tutor_id
ORDER BY s.tutor_id;

-- Check parent-tutor linking
SELECT
  child.email as parent_email,
  tutor.email as tutor_email,
  child.tutor_id
FROM parents child
JOIN parents tutor ON tutor.id = child.tutor_id
WHERE child.role = 'parent';
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] All environment variables set in production
- [ ] Stripe account switched to live mode
- [ ] Live Stripe keys configured (`sk_live_`, `pk_live_`)
- [ ] Webhook endpoint updated to production URL
- [ ] Edge functions deployed to production
- [ ] Database migrations applied to production
- [ ] Privacy policy hosted at public URL
- [ ] Terms of service hosted at public URL

### App Store Submission

- [ ] Apple Developer account ($99/year)
- [ ] Google Play Developer account ($25)
- [ ] EAS credentials configured (`eas.json`)
- [ ] App icons created (all sizes)
- [ ] Screenshots captured (all device sizes)
- [ ] App descriptions written
- [ ] Demo account credentials for app review

### Post-Deployment

- [ ] Test tutor registration in production
- [ ] Test Stripe checkout in production
- [ ] Test webhook receives events
- [ ] Monitor error logs
- [ ] Set up alerting for failed payments

---

## Troubleshooting

### Common Issues

#### "Subscription check failed" error

**Cause**: Edge function can't verify subscription
**Solution**:
1. Check `STRIPE_SECRET_KEY` is set in Supabase secrets
2. Verify webhook is receiving events
3. Check `subscription_status` in database

#### Tutor can't see their data after registration

**Cause**: `tutor_id` not set correctly
**Solution**:
1. Check `tutor_settings` record exists
2. Verify RLS policies are applied
3. Run backfill migration if needed

#### Parent invitation not linking to tutor

**Cause**: `tutor_id` not included in invitation
**Solution**:
1. Check `parent_invitations.tutor_id` column exists
2. Verify invitation creation includes tutor_id
3. Check RLS allows tutor to create invitations

#### Stripe webhook not updating subscription

**Cause**: Webhook signature verification failing
**Solution**:
1. Verify `STRIPE_WEBHOOK_SECRET` matches Stripe dashboard
2. Check function logs: `npx supabase functions logs stripe-webhook`
3. Ensure webhook URL is correct

#### Calendar showing wrong timezone

**Cause**: Timezone not loaded from tutor_settings
**Solution**:
1. Check `useTutorBranding` hook is used
2. Verify `timezone` column has value
3. Clear app cache and reload

### Debug Commands

```bash
# View Edge Function logs
npx supabase functions logs create-checkout
npx supabase functions logs stripe-webhook

# Test database connection
npx supabase db ping

# Reset local database (development only!)
npx supabase db reset

# Check migration status
npx supabase migration list
```

### Support Resources

- Stripe Documentation: https://stripe.com/docs
- Supabase Documentation: https://supabase.com/docs
- Expo Documentation: https://docs.expo.dev
- EAS Build: https://docs.expo.dev/build/introduction/

---

## Next Steps (Phase 2)

After Phase 1 is stable, consider:

1. **Team Support**: Allow tutoring centers with multiple tutors
2. **Advanced Analytics**: Revenue dashboards, student progress tracking
3. **Payment Processing**: Stripe Connect for parent payments to tutors
4. **White-Label**: Full branding customization for enterprise
5. **API Access**: REST API for third-party integrations

See `docs/MONETIZATION_ROADMAP.md` for the complete roadmap.
