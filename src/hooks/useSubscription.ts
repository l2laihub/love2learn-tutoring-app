/**
 * useSubscription Hook
 * Subscription management for Love2Learn tutors
 *
 * Provides subscription status, trial info, and actions for managing subscriptions
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  SubscriptionStatus,
  SubscriptionPlan,
  SubscriptionInfo,
  createCheckoutSession,
  createPortalSession,
  openStripeUrl,
  isSubscriptionActive,
  isInTrial,
  getTrialDaysRemaining,
  isTrialExpiringSoon,
  formatSubscriptionStatus,
  getSubscriptionStatusColor,
} from '../lib/stripe';

/**
 * Subscription hook state
 */
export interface UseSubscriptionState {
  /** Current subscription info */
  subscription: SubscriptionInfo | null;
  /** Whether data is loading */
  loading: boolean;
  /** Error if any */
  error: Error | null;
  /** Whether subscription is active (trialing or active) */
  isActive: boolean;
  /** Whether currently in trial period */
  isTrial: boolean;
  /** Days remaining in trial */
  trialDaysRemaining: number;
  /** Whether trial is expiring within 3 days */
  isTrialExpiringSoon: boolean;
  /** Formatted status for display */
  statusDisplay: string;
  /** Status colors for UI */
  statusColors: { text: string; background: string };
  /** Redirect to checkout for new subscription */
  redirectToCheckout: (plan: SubscriptionPlan) => Promise<void>;
  /** Redirect to billing portal for managing subscription */
  redirectToPortal: () => Promise<void>;
  /** Refresh subscription data */
  refresh: () => Promise<void>;
}

/**
 * Hook for managing tutor subscriptions
 *
 * @param tutorId - The tutor's parent ID (optional, uses current user if not provided)
 * @returns Subscription state and actions
 *
 * @example
 * ```tsx
 * function SettingsScreen() {
 *   const { isActive, isTrial, trialDaysRemaining, redirectToCheckout } = useSubscription();
 *
 *   if (!isActive) {
 *     return <SubscriptionRequired onSubscribe={() => redirectToCheckout('solo')} />;
 *   }
 *
 *   return <Settings />;
 * }
 * ```
 */
export function useSubscription(tutorId?: string): UseSubscriptionState {
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  /**
   * Fetch subscription data from database
   */
  const fetchSubscription = useCallback(async () => {
    try {
      setError(null);

      // If tutorId provided, use it; otherwise get current user's parent record
      let query = supabase
        .from('parents')
        .select(`
          id,
          subscription_status,
          subscription_plan,
          trial_ends_at,
          subscription_ends_at,
          stripe_customer_id,
          stripe_subscription_id
        `)
        .eq('role', 'tutor');

      if (tutorId) {
        query = query.eq('id', tutorId);
      } else {
        // Use RPC to get current user's parent record (bypasses RLS)
        const { data: parentData, error: parentError } = await supabase.rpc(
          'get_current_user_parent'
        );

        if (parentError) {
          console.error('[useSubscription] Error getting parent:', parentError);
          throw new Error('Failed to get user information');
        }

        const parent = Array.isArray(parentData) && parentData.length > 0
          ? parentData[0]
          : null;

        if (!parent || parent.role !== 'tutor') {
          // Not a tutor - no subscription needed
          setSubscription(null);
          setLoading(false);
          return;
        }

        query = query.eq('id', parent.id);
      }

      const { data, error: fetchError } = await query.single();

      if (fetchError) {
        // Handle case where subscription columns might not exist yet
        if (fetchError.message?.includes('column') && fetchError.message?.includes('does not exist')) {
          console.warn('[useSubscription] Subscription columns not in database yet');
          setSubscription({
            status: null,
            plan: null,
            trialEndsAt: null,
            subscriptionEndsAt: null,
            stripeCustomerId: null,
            stripeSubscriptionId: null,
          });
          return;
        }
        throw new Error(fetchError.message);
      }

      if (!data) {
        setSubscription(null);
        return;
      }

      setSubscription({
        status: data.subscription_status as SubscriptionStatus,
        plan: data.subscription_plan as SubscriptionPlan | null,
        trialEndsAt: data.trial_ends_at ? new Date(data.trial_ends_at) : null,
        subscriptionEndsAt: data.subscription_ends_at
          ? new Date(data.subscription_ends_at)
          : null,
        stripeCustomerId: data.stripe_customer_id,
        stripeSubscriptionId: data.stripe_subscription_id,
      });
    } catch (err) {
      console.error('[useSubscription] Fetch error:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch subscription'));
    } finally {
      setLoading(false);
    }
  }, [tutorId]);

  /**
   * Redirect to Stripe Checkout for new subscription
   */
  const redirectToCheckout = useCallback(async (plan: SubscriptionPlan) => {
    try {
      setActionLoading(true);
      setError(null);

      const { url } = await createCheckoutSession(plan);
      await openStripeUrl(url);
    } catch (err) {
      console.error('[useSubscription] Checkout error:', err);
      setError(err instanceof Error ? err : new Error('Failed to start checkout'));
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, []);

  /**
   * Redirect to Stripe Billing Portal
   */
  const redirectToPortal = useCallback(async () => {
    try {
      setActionLoading(true);
      setError(null);

      const { url } = await createPortalSession();
      await openStripeUrl(url);
    } catch (err) {
      console.error('[useSubscription] Portal error:', err);
      setError(err instanceof Error ? err : new Error('Failed to open billing portal'));
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // Derived state
  const isActive = useMemo(
    () => isSubscriptionActive(subscription?.status ?? null),
    [subscription?.status]
  );

  const isTrial = useMemo(
    () => isInTrial(subscription?.status ?? null),
    [subscription?.status]
  );

  const trialDaysRemaining = useMemo(
    () => getTrialDaysRemaining(subscription?.trialEndsAt ?? null),
    [subscription?.trialEndsAt]
  );

  const trialExpiringSoon = useMemo(
    () => isTrialExpiringSoon(subscription?.trialEndsAt ?? null),
    [subscription?.trialEndsAt]
  );

  const statusDisplay = useMemo(
    () => formatSubscriptionStatus(subscription?.status ?? null),
    [subscription?.status]
  );

  const statusColors = useMemo(
    () => getSubscriptionStatusColor(subscription?.status ?? null),
    [subscription?.status]
  );

  return {
    subscription,
    loading: loading || actionLoading,
    error,
    isActive,
    isTrial,
    trialDaysRemaining,
    isTrialExpiringSoon: trialExpiringSoon,
    statusDisplay,
    statusColors,
    redirectToCheckout,
    redirectToPortal,
    refresh: fetchSubscription,
  };
}

/**
 * Hook to check if current user needs a subscription
 * Returns true if user is a tutor without an active subscription
 */
export function useRequiresSubscription(): {
  requiresSubscription: boolean;
  loading: boolean;
} {
  const { isActive, loading, subscription } = useSubscription();

  // If still loading or subscription data exists but is active, don't require
  if (loading) {
    return { requiresSubscription: false, loading: true };
  }

  // If no subscription data at all (columns might not exist), don't require
  // This allows graceful degradation during migration
  if (subscription === null) {
    return { requiresSubscription: false, loading: false };
  }

  // Tutor without active subscription requires one
  return { requiresSubscription: !isActive, loading: false };
}

export default useSubscription;
