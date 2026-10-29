/**
 * Tutor trial bookkeeping
 * DaLesson Tutoring App
 */

import { supabase } from './supabase';
import type { SubscriptionPlan } from './stripe';

export const TRIAL_LENGTH_DAYS = 14;

/**
 * Record a free trial on the signed-in tutor's auth metadata.
 * Used by the onboarding plan picker (web) and by native onboarding, which
 * skips the plan picker because store builds cannot show pricing.
 */
export async function startTutorTrial(
  plan: SubscriptionPlan = 'solo'
): Promise<{ error: string | null }> {
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_LENGTH_DAYS);

  const { error } = await supabase.auth.updateUser({
    data: {
      subscription_plan: plan,
      subscription_status: 'trialing',
      trial_ends_at: trialEndsAt.toISOString(),
    },
  });

  if (error) {
    console.error('[startTutorTrial] Error saving trial:', error);
    return { error: 'Failed to save your account setup. Please try again.' };
  }
  return { error: null };
}
