/**
 * Stripe Client Configuration
 * Love2Learn Tutoring App
 *
 * Client-side Stripe utilities for subscription management
 */

import { Platform } from 'react-native';
import { supabase } from './supabase';

// Environment variables
const stripePublishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

// Log warning if using placeholder values
if (!stripePublishableKey) {
  console.warn(
    '[Stripe] Missing EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY. ' +
    'Stripe features will not work until configured.'
  );
}

/**
 * Subscription status types
 */
export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'cancelled'
  | 'expired'
  | null;

/**
 * Subscription plan types
 */
export type SubscriptionPlan = 'solo' | 'pro';

/**
 * Subscription info returned from database
 */
export interface SubscriptionInfo {
  status: SubscriptionStatus;
  plan: SubscriptionPlan | null;
  trialEndsAt: Date | null;
  subscriptionEndsAt: Date | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

/**
 * Checkout session response from edge function
 */
export interface CheckoutSessionResponse {
  url: string;
  sessionId: string;
}

/**
 * Portal session response from edge function
 */
export interface PortalSessionResponse {
  url: string;
}

/**
 * Get the appropriate return URL based on platform
 */
function getReturnUrl(): string {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/settings`;
    }
    return 'http://localhost:8081/settings';
  }
  // For native apps, use deep link
  return 'love2learn://settings';
}

/**
 * Create a Stripe Checkout session for subscription
 * Calls the Supabase Edge Function to create a secure server-side session
 *
 * @param plan - The subscription plan to checkout ('solo' or 'pro')
 * @returns CheckoutSessionResponse with URL to redirect user
 */
export async function createCheckoutSession(
  plan: SubscriptionPlan
): Promise<CheckoutSessionResponse> {
  const returnUrl = getReturnUrl();

  const { data, error } = await supabase.functions.invoke('create-checkout', {
    body: {
      plan,
      success_url: `${returnUrl}?checkout=success`,
      cancel_url: `${returnUrl}?checkout=cancelled`,
    },
  });

  if (error) {
    console.error('[Stripe] Checkout session error:', error);
    throw new Error(error.message || 'Failed to create checkout session');
  }

  if (!data?.url) {
    throw new Error('No checkout URL returned');
  }

  return {
    url: data.url,
    sessionId: data.session_id,
  };
}

/**
 * Create a Stripe Billing Portal session
 * Allows customers to manage their subscription
 *
 * @returns PortalSessionResponse with URL to redirect user
 */
export async function createPortalSession(): Promise<PortalSessionResponse> {
  const returnUrl = getReturnUrl();

  const { data, error } = await supabase.functions.invoke('create-portal', {
    body: {
      return_url: returnUrl,
    },
  });

  if (error) {
    console.error('[Stripe] Portal session error:', error);
    throw new Error(error.message || 'Failed to create portal session');
  }

  if (!data?.url) {
    throw new Error('No portal URL returned');
  }

  return {
    url: data.url,
  };
}

/**
 * Open URL for checkout or portal
 * Handles platform-specific URL opening
 *
 * @param url - The URL to open
 */
export async function openStripeUrl(url: string): Promise<void> {
  if (Platform.OS === 'web') {
    // On web, redirect the current window
    if (typeof window !== 'undefined') {
      window.location.href = url;
    }
  } else {
    // On native, use Linking
    const { Linking } = await import('react-native');
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      throw new Error('Cannot open URL on this device');
    }
  }
}

/**
 * Check if subscription is considered active
 * Active includes trialing and active statuses
 *
 * @param status - The subscription status to check
 * @returns boolean indicating if subscription is active
 */
export function isSubscriptionActive(status: SubscriptionStatus): boolean {
  return status === 'trialing' || status === 'active';
}

/**
 * Check if subscription is in trial period
 *
 * @param status - The subscription status to check
 * @returns boolean indicating if in trial
 */
export function isInTrial(status: SubscriptionStatus): boolean {
  return status === 'trialing';
}

/**
 * Calculate days remaining in trial
 *
 * @param trialEndsAt - Trial end date
 * @returns number of days remaining (0 if ended or no trial)
 */
export function getTrialDaysRemaining(trialEndsAt: Date | null): number {
  if (!trialEndsAt) return 0;

  const now = new Date();
  const endDate = new Date(trialEndsAt);
  const diffTime = endDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return Math.max(0, diffDays);
}

/**
 * Check if trial is expiring soon (within specified days)
 *
 * @param trialEndsAt - Trial end date
 * @param thresholdDays - Days threshold for "expiring soon" (default: 3)
 * @returns boolean indicating if trial is expiring soon
 */
export function isTrialExpiringSoon(
  trialEndsAt: Date | null,
  thresholdDays: number = 3
): boolean {
  const daysRemaining = getTrialDaysRemaining(trialEndsAt);
  return daysRemaining > 0 && daysRemaining <= thresholdDays;
}

/**
 * Format subscription status for display
 *
 * @param status - The subscription status
 * @returns Display-friendly status string
 */
export function formatSubscriptionStatus(status: SubscriptionStatus): string {
  switch (status) {
    case 'trialing':
      return 'Trial';
    case 'active':
      return 'Active';
    case 'past_due':
      return 'Past Due';
    case 'cancelled':
      return 'Cancelled';
    case 'expired':
      return 'Expired';
    default:
      return 'No Subscription';
  }
}

/**
 * Get status color for UI display
 *
 * @param status - The subscription status
 * @returns Color code for the status
 */
export function getSubscriptionStatusColor(status: SubscriptionStatus): {
  text: string;
  background: string;
} {
  switch (status) {
    case 'trialing':
      return { text: '#2196F3', background: '#E3F2FD' };
    case 'active':
      return { text: '#7CB342', background: '#F1F8E9' };
    case 'past_due':
      return { text: '#FF9800', background: '#FFF3E0' };
    case 'cancelled':
    case 'expired':
      return { text: '#E53935', background: '#FFEBEE' };
    default:
      return { text: '#9E9E9E', background: '#F5F5F5' };
  }
}

export const stripe = {
  publishableKey: stripePublishableKey,
  createCheckoutSession,
  createPortalSession,
  openStripeUrl,
  isSubscriptionActive,
  isInTrial,
  getTrialDaysRemaining,
  isTrialExpiringSoon,
  formatSubscriptionStatus,
  getSubscriptionStatusColor,
};

export default stripe;
