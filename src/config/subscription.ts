/**
 * Subscription configuration & feature gating for DaLesson tutors.
 *
 * Single source of truth for: whether the paywall is enforced, and what each
 * plan tier allows. See docs/PAYWALL_SETUP.md for the full setup guide.
 */

import { Platform } from 'react-native';
import type { SubscriptionPlan } from '../lib/stripe';

/**
 * Whether subscription/billing UI (plan selection, Stripe checkout, billing
 * portal) may be shown at all. Web only: exposing a non-IAP purchase path for
 * digital subscriptions inside the iOS binary violates App Store Guideline
 * 3.1.1 even when the paywall itself is disabled. Flip to include native once
 * the RevenueCat IAP flow ships (docs/PAYWALL_SETUP.md Part E).
 */
export const SHOW_SUBSCRIPTION_UI = Platform.OS === 'web';

/**
 * Master switch for paywall enforcement.
 *
 * When `false` (the default) the subscription system is fully wired but does
 * NOT block access or cap usage. This is the safe state to ship in while:
 *   - Stripe / RevenueCat products are still being configured, and
 *   - existing tutors' `trial_ends_at` values are backfilled.
 *
 * Flip `EXPO_PUBLIC_ENABLE_PAYWALL=true` once billing is live and verified.
 *
 * IMPORTANT (iOS): selling these subscriptions through Stripe web checkout
 * violates App Store Review Guideline 3.1.1 (digital goods must use In-App
 * Purchase). Switch the mobile apps to RevenueCat IAP before enabling the
 * paywall on an App Store build — see docs/PAYWALL_SETUP.md.
 */
export const PAYWALL_ENABLED = process.env.EXPO_PUBLIC_ENABLE_PAYWALL === 'true';

/**
 * Maximum students per plan. Solo is capped; Pro is unlimited.
 * Keep in sync with the marketing copy in:
 *   - app/(auth)/onboarding/tutor/subscription.tsx
 *   - app/landing.tsx
 *   - src/components/SubscriptionGate.tsx
 */
export const PLAN_STUDENT_LIMITS: Record<SubscriptionPlan, number> = {
  solo: 25,
  pro: Infinity,
};

/**
 * Resolve the student limit for a plan. Unknown / null plans fall back to the
 * Solo cap for display; enforcement should fail open when the plan can't be
 * positively determined (see useCreateStudent).
 */
export function getStudentLimit(plan: SubscriptionPlan | null | undefined): number {
  return plan === 'pro' ? PLAN_STUDENT_LIMITS.pro : PLAN_STUDENT_LIMITS.solo;
}
