# Paywall & Subscriptions — Setup Guide

How DaLesson's tutor subscription paywall works, and how to configure it end‑to‑end
across **Stripe** (web), **App Store Connect** + **Google Play**, and **RevenueCat**
(native iOS/Android in‑app purchases).

> **TL;DR**
> - The paywall is **built and now wired**, but **disabled by default** behind
>   `EXPO_PUBLIC_ENABLE_PAYWALL`.
> - **Web** subscriptions run through **Stripe Checkout** (already implemented).
> - **iOS/Android** subscriptions **must** run through **RevenueCat IAP** — Apple
>   rejects Stripe web checkout for digital goods (Guideline 3.1.1). RevenueCat
>   integration is **not yet implemented**; this guide is the blueprint.
> - Don't flip the flag on an App Store build until RevenueCat is live.

---

## 1. Architecture overview

DaLesson charges **tutors** (not parents) a monthly subscription with a 14‑day free
trial. Two tiers:

| Plan | Price (monthly) | Students | Notable extras |
|------|-----------------|----------|----------------|
| **Solo** | **$29** | up to **25** | scheduling, payments, worksheets, parent portal |
| **Pro**  | **$49** | **unlimited** | + analytics, priority support, white‑label, group sessions |

The subscription state lives on the `parents` table and is the **single source of
truth** the app reads, regardless of which store processed the payment:

| Column | Meaning |
|--------|---------|
| `subscription_status` | `trialing` \| `active` \| `past_due` \| `cancelled` \| `expired` |
| `subscription_plan` | `solo` \| `pro` |
| `trial_ends_at` | trial expiry (default `NOW() + 14 days`) |
| `subscription_ends_at` | current paid period end |
| `stripe_customer_id`, `stripe_subscription_id` | Stripe linkage (web) |

### The hybrid model

```
                       ┌──────────────────────────────┐
   Web browser ─────▶  │  Stripe Checkout / Portal     │ ──┐
                       └──────────────────────────────┘   │   stripe-webhook
                                                           ├─▶ (edge fn) writes
   iOS / Android ───▶  ┌──────────────────────────────┐   │   parents.subscription_*
   (native IAP)        │  RevenueCat  (StoreKit /      │ ──┘   revenuecat-webhook
                       │  Google Play Billing)         │ ──────▶ (edge fn, to build)
                       └──────────────────────────────┘

   App reads parents.subscription_status/plan  ──▶  useSubscription()  ──▶  SubscriptionGate
```

Both billing systems converge on the same `parents` columns via webhooks, so the
client (`useSubscription`, `SubscriptionGate`) never needs to know which store the
tutor paid through.

### Code map

| File | Role |
|------|------|
| `src/lib/stripe.ts` | Stripe checkout/portal client + status helpers |
| `src/hooks/useSubscription.ts` | reads subscription state, exposes `isActive`, `isTrial`, actions |
| `src/components/SubscriptionGate.tsx` | the paywall UI + access gate |
| `src/config/subscription.ts` | `PAYWALL_ENABLED` flag + plan limits |
| `app/(tabs)/_layout.tsx` | mounts the gate around the tutor experience |
| `app/(auth)/onboarding/tutor/subscription.tsx` | plan selection during onboarding |
| `app/settings/subscription.tsx` | manage subscription / billing portal |
| `supabase/functions/create-checkout` | creates Stripe Checkout session |
| `supabase/functions/create-portal` | creates Stripe Billing Portal session |
| `supabase/functions/stripe-webhook` | syncs Stripe → `parents` |
| `supabase/migrations/20260610000001_fix_subscription_schema.sql` | schema fixes (below) |

### Schema fixes shipped with this work

Three mismatches previously made it impossible for any tutor to be recognized as
subscribed. Migration `20260610000001_fix_subscription_schema.sql` fixes them:

1. Added the missing **`subscription_plan`** column (the hook SELECTed it and the
   webhook wrote it, but it never existed → both failed silently).
2. Normalized **`subscription_status`** from `trial` → `trialing` and updated the
   `CHECK` constraint to match the values Stripe/the app use (the webhook's writes
   were violating the old constraint).
3. Updated `is_subscription_active()` to check `trialing`.

Apply it: `npx supabase db push`.

---

## 2. Enabling enforcement (the feature flag)

The gate is **off by default**. With `EXPO_PUBLIC_ENABLE_PAYWALL=false`:
- the subscription UI still renders (onboarding, settings), but
- no tutor is blocked, and the Solo student cap is **not** enforced.

Set `EXPO_PUBLIC_ENABLE_PAYWALL=true` to turn on enforcement:
- Tutors whose `subscription_status` is not `trialing`/`active` see the paywall
  instead of the app (`app/(tabs)/_layout.tsx`).
- `past_due` tutors get an "update payment" screen → Stripe Billing Portal.
- Creating a 26th student on Solo is blocked (`useCreateStudent`).

> ⚠️ **Do not enable on iOS** until RevenueCat is integrated — the paywall's
> "Subscribe" button calls Stripe web checkout, which Apple prohibits for digital
> subscriptions. Web and Android (internally distributed) are fine first.

**Rollout checklist before flipping the flag in production:**
1. `npx supabase db push` (apply the schema fix migration).
2. Configure Stripe products + webhook (Part A) and verify a test subscription
   round‑trips into `parents`.
3. **Backfill trials**: existing tutors may have a stale `trial_ends_at`. Decide a
   grace window and run e.g.
   `UPDATE parents SET trial_ends_at = NOW() + INTERVAL '14 days'
    WHERE role = 'tutor' AND subscription_status = 'trialing' AND trial_ends_at < NOW();`
4. For mobile: complete Parts B–E (RevenueCat) and ship a native build.
5. Flip `EXPO_PUBLIC_ENABLE_PAYWALL=true` and rebuild/redeploy.

---

## Part A — Stripe (web subscriptions)

### A1. Create products & prices
1. Stripe Dashboard → **Product catalog** → **Add product**.
2. Create **DaLesson Solo**: recurring, **$29 / month**, currency USD. Copy the
   **Price ID** (`price_...`).
3. Create **DaLesson Pro**: recurring, **$49 / month**. Copy its Price ID.
   - (Optional) add yearly prices ($290 / $490) if you want the annual toggle on
     the landing page to charge correctly.

### A2. API keys
- **Publishable key** (`pk_...`) → `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` in `.env`.
- **Secret key** (`sk_...`) → edge function secret (never in the client).

### A3. Edge function secrets
The three edge functions read these from Supabase secrets (not the app `.env`):

```bash
npx supabase secrets set \
  STRIPE_SECRET_KEY=sk_live_xxx \
  STRIPE_WEBHOOK_SECRET=whsec_xxx \
  STRIPE_SOLO_PRICE_ID=price_xxx \
  STRIPE_PRO_PRICE_ID=price_xxx
# SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are provided by the platform.
```

Deploy them:
```bash
npx supabase functions deploy create-checkout
npx supabase functions deploy create-portal
npx supabase functions deploy stripe-webhook --no-verify-jwt
```
`stripe-webhook` is called by Stripe (no user JWT) and verifies authenticity via
the Stripe signature, so deploy it with `--no-verify-jwt`.

### A4. Webhook endpoint
1. Dashboard → **Developers → Webhooks → Add endpoint**.
2. URL: `https://<PROJECT_REF>.supabase.co/functions/v1/stripe-webhook`
3. Subscribe to these events (handled in `stripe-webhook/index.ts`):
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
   - `invoice.paid`
4. Copy the endpoint's **Signing secret** (`whsec_...`) → `STRIPE_WEBHOOK_SECRET`.

### A5. Customer Portal
Dashboard → **Settings → Billing → Customer portal**: enable plan switching,
cancellation, and payment‑method updates. `create-portal` links tutors here from
Settings → Subscription.

### A6. Test
Use test mode + card `4242 4242 4242 4242` (any future expiry/CVC). After
checkout, confirm the `parents` row gets `stripe_subscription_id`,
`subscription_status = 'trialing'`, and `subscription_plan` set. Stripe CLI is
handy: `stripe listen --forward-to <webhook-url>`.

---

## Part B — App Store Connect (iOS in‑app purchases)

App identity (from `app.config.ts` / `eas.json`):
- **Bundle ID:** `app.huybuilds.dalesson`
- **App Store app ID (ascAppId):** `6760299534`
- **Apple Team ID:** `X6P6XG7GPP`

### B1. Prerequisites
1. **Paid Apps agreement** signed in App Store Connect → **Business** (Agreements,
   Tax, and Banking). IAPs won't work until this is **Active**.
2. App record exists for `app.huybuilds.dalesson`.

### B2. Create an auto‑renewable subscription group
1. App Store Connect → your app → **Subscriptions** → **Create** a group, e.g.
   `DaLesson Membership`. Solo and Pro live in the **same group** so users upgrade
   /downgrade between them.

### B3. Create the subscription products
Create two auto‑renewable subscriptions in that group. Use clear product IDs —
**these exact IDs get mapped in RevenueCat**:

| Product | Suggested Product ID | Price |
|---------|----------------------|-------|
| Solo (monthly) | `dalesson_solo_monthly` | $29.99 tier |
| Pro (monthly)  | `dalesson_pro_monthly`  | $49.99 tier |

For each: set price, duration (1 month), **14‑day free trial** as an
*Introductory Offer*, localized display name/description, and a review screenshot.

### B4. App‑specific shared secret / In‑App Purchase key
RevenueCat needs to validate receipts. Either:
- **App Store Connect → App → App Information → App‑Specific Shared Secret** — this
  is **per‑app**; use DaLesson's own, it can't be shared with another app. Or
- **Users and Access → Integrations → In‑App Purchase** key (recommended; download
  the `.p8`, note the Key ID and Issuer ID).

> **Reusing an existing `.p8`?** The In‑App Purchase key is **account/team‑level,
> not app‑specific** — RevenueCat supports the **same key across multiple apps**,
> so you can reuse the one from another app for DaLesson. Two things to confirm:
> (1) it's from the **In‑App Purchase** tab, *not* the "App Store Connect API" tab
> (different key, wrong purpose); and (2) you still have the actual `.p8` file —
> Apple only lets you download it **once** at creation, so if it's lost, generate a
> new key (the old one keeps working for the other app). Trade‑off of sharing:
> revoking the key breaks IAP for **both** apps at once.

You'll paste this into RevenueCat in Part D.

### B5. Sandbox testers
**Users and Access → Sandbox → Testers** → add a test Apple ID for purchase
testing without real charges.

---

## Part C — Google Play (Android in‑app purchases)

App package: `app.huybuilds.dalesson`.

1. **Play Console → Monetize → Products → Subscriptions → Create subscription.**
   Create `dalesson_solo_monthly` and `dalesson_pro_monthly`, each with a **base
   plan** (auto‑renewing, monthly) and a **free‑trial offer** (14 days).
2. **Activate** the subscriptions.
3. Create a **Google Cloud service account** with Play access and grant it
   "View financial data / Manage orders" so RevenueCat can validate purchases.
   Download the service‑account **JSON** (used in Part D).
4. Add **license testers** (Play Console → Setup → License testing) for test
   purchases.

> Android note: Google now allows alternative billing in some regions, but the
> default and simplest compliant path is Play Billing via RevenueCat.

---

## Part D — RevenueCat (mobile billing brain)

RevenueCat wraps StoreKit + Play Billing behind one SDK + dashboard and emits
webhooks you can sync to Supabase.

### D1. Project & apps
1. Create a RevenueCat project (e.g. **DaLesson**).
2. **Add an App → App Store**: bundle ID `app.huybuilds.dalesson`; paste the
   App‑Specific Shared Secret **or** upload the In‑App Purchase `.p8` key (Key ID +
   Issuer ID from Part B4).
3. **Add an App → Play Store**: package `app.huybuilds.dalesson`; upload the
   service‑account JSON from Part C3.

### D2. Entitlement
Create a single **Entitlement** that represents "has paid access", e.g.
`pro_access`. Both Solo and Pro products **unlock this entitlement** (the tiers
differ by *plan*, not by access — access is gated by entitlement, the plan name is
stored separately).

### D3. Products & Offerings
1. **Products**: register the four store products
   (`dalesson_solo_monthly`, `dalesson_pro_monthly` for each store) and attach each
   to the `pro_access` entitlement.
2. **Offerings**: create a `default` offering with two **packages**:
   - `solo` → the Solo monthly products
   - `pro` → the Pro monthly products
   The app reads the offering to render the paywall and to know which package maps
   to which `subscription_plan`.

### D4. API keys
**Project → API Keys** → copy the **public SDK keys** (one per platform):
- iOS (`appl_...`) → `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
- Android (`goog_...`) → `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`

### D5. Webhook → Supabase
1. **Project → Integrations → Webhooks** → add a webhook to a new edge function:
   `https://<PROJECT_REF>.supabase.co/functions/v1/revenuecat-webhook`
2. Set an **Authorization header** value and store it as the
   `REVENUECAT_WEBHOOK_AUTH_HEADER` edge secret; the function should reject calls
   whose header doesn't match.
3. The function maps RevenueCat events → `parents` columns:

| RevenueCat event | `subscription_status` |
|------------------|-----------------------|
| `INITIAL_PURCHASE`, `RENEWAL`, `UNCANCELLATION` | `active` (or `trialing` if in trial) |
| `TRIAL_STARTED` / period_type = trial | `trialing` |
| `BILLING_ISSUE` | `past_due` |
| `CANCELLATION` (expiration in future) | `active` until `expiration_at_ms` |
| `EXPIRATION` | `expired` |

Identify the tutor by `app_user_id` (set to `parents.id` in D6) and set
`subscription_plan` from the product/package. This mirrors what `stripe-webhook`
already does for the web side.

### D6. App identity
When configuring the SDK, **log in with the tutor's `parents.id`** as the
RevenueCat `appUserID`. That makes the webhook's `app_user_id` directly match the
row to update and prevents anonymous/duplicate customers.

---

## Part E — RevenueCat code integration (to build)

RevenueCat needs native modules, so this requires a **custom dev client / EAS
build** — it does **not** run in Expo Go.

### E1. Install
```bash
npx expo install react-native-purchases react-native-purchases-ui
```
Add the config plugin if required by your SDK version, then rebuild the dev client:
```bash
eas build --profile development --platform ios     # and android
```

### E2. Configure on startup (sketch)
```ts
// src/lib/revenuecat.ts  (to create)
import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';

const apiKey = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
})!;

export async function initRevenueCat(parentId: string) {
  Purchases.configure({ apiKey, appUserID: parentId }); // appUserID = parents.id
}
```
Call `initRevenueCat(parent.id)` once the authenticated tutor's `parent` record is
available (e.g. from `AuthContext`).

### E3. Purchase flow
Replace the Stripe path **on native only** inside the paywall. Keep Stripe for web:
```ts
import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';

async function subscribe(plan: 'solo' | 'pro') {
  if (Platform.OS === 'web') {
    return redirectToCheckout(plan);            // existing Stripe path
  }
  const offerings = await Purchases.getOfferings();
  const pkg = offerings.current?.availablePackages
    .find(p => p.identifier === plan);
  if (pkg) await Purchases.purchasePackage(pkg); // StoreKit / Play Billing UI
}
```
After a successful purchase, RevenueCat fires the webhook → `parents` updates →
`useSubscription().refresh()` reflects active access. (You can also read
`customerInfo.entitlements.active['pro_access']` directly for an instant UI update
while the webhook lands.)

### E4. Restore purchases
Add a **Restore Purchases** action (App Store requirement) in Settings →
Subscription that calls `Purchases.restorePurchases()`.

### E5. "Manage subscription"
On native, link to the OS‑managed subscription page rather than the Stripe portal:
- iOS: `https://apps.apple.com/account/subscriptions`
- Android: `https://play.google.com/store/account/subscriptions`

---

## Part F — Reference

### Environment variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` | app `.env` | Stripe client key (web) |
| `STRIPE_SECRET_KEY` | edge secret | Stripe server key |
| `STRIPE_WEBHOOK_SECRET` | edge secret | verify Stripe webhook signatures |
| `STRIPE_SOLO_PRICE_ID` / `STRIPE_PRO_PRICE_ID` | edge secret | which price to charge |
| `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` | app `.env` | RevenueCat iOS SDK key |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` | app `.env` | RevenueCat Android SDK key |
| `REVENUECAT_WEBHOOK_AUTH_HEADER` | edge secret | auth the RevenueCat webhook |
| `EXPO_PUBLIC_ENABLE_PAYWALL` | app `.env` | turn enforcement on/off |

### Compliance notes
- **Apple 3.1.1**: in‑app digital subscriptions must use IAP. Don't show Stripe
  checkout (or external "buy" links) inside the iOS app. RevenueCat handles IAP.
- **Apple 3.1.3(b) "reader" exceptions do not apply** to DaLesson — it's not a
  reader app, so IAP is mandatory for the iOS subscription.
- Web (and your own website) can keep using Stripe freely.
- Provide **Restore Purchases** and links to manage/cancel.

### Known follow‑ups
- `revenuecat-webhook` edge function is **not yet written** (Part D5/E).
- Native purchase flow (Part E) is **not yet implemented**; the paywall currently
  calls Stripe on all platforms.
- Plan‑limit enforcement (`useCreateStudent`) is a **client‑side soft cap**. For
  hard enforcement add a Postgres trigger/RLS check on `students` insert.
- Pricing is now consistent at **Solo $29 / Pro $49** across onboarding, landing,
  and the paywall — keep `src/config/subscription.ts` and these screens in sync.
