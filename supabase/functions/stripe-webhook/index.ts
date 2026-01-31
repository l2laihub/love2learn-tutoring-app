/**
 * Edge Function: Stripe Webhook Handler
 *
 * Handles Stripe webhook events to sync subscription status with the database.
 * Events handled:
 * - checkout.session.completed: New subscription created
 * - customer.subscription.updated: Subscription status changed
 * - customer.subscription.deleted: Subscription cancelled
 * - invoice.payment_failed: Payment failed, mark as past_due
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-name, stripe-signature',
};

// Map Stripe subscription status to our status
function mapStripeStatus(stripeStatus: string): string {
  switch (stripeStatus) {
    case 'trialing':
      return 'trialing';
    case 'active':
      return 'active';
    case 'past_due':
      return 'past_due';
    case 'canceled':
    case 'cancelled':
      return 'cancelled';
    case 'unpaid':
    case 'incomplete':
    case 'incomplete_expired':
      return 'expired';
    default:
      return 'expired';
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate environment variables
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }

    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase environment variables are not configured');
    }

    // Initialize Stripe
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Get raw body for signature verification
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      console.error('Missing stripe-signature header');
      return new Response(
        JSON.stringify({ error: 'Missing stripe-signature header' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Received webhook event:', event.type);

    // Create Supabase admin client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('Checkout session completed:', session.id);

        // Only handle subscription checkouts
        if (session.mode !== 'subscription') {
          console.log('Not a subscription checkout, skipping');
          break;
        }

        const parentId = session.metadata?.parent_id;
        const plan = session.metadata?.plan;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        if (!parentId) {
          console.error('Missing parent_id in checkout session metadata');
          break;
        }

        // Get subscription details
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);

        // Calculate trial end date if applicable
        const trialEndsAt = subscription.trial_end
          ? new Date(subscription.trial_end * 1000).toISOString()
          : null;

        // Calculate subscription end date
        const subscriptionEndsAt = subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null;

        // Update parent record
        const { error: updateError } = await supabase
          .from('parents')
          .update({
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            subscription_status: mapStripeStatus(subscription.status),
            subscription_plan: plan || 'solo',
            trial_ends_at: trialEndsAt,
            subscription_ends_at: subscriptionEndsAt,
            updated_at: new Date().toISOString(),
          })
          .eq('id', parentId);

        if (updateError) {
          console.error('Error updating parent after checkout:', updateError);
        } else {
          console.log('Parent subscription updated:', parentId);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log('Subscription updated:', subscription.id, 'Status:', subscription.status);

        const customerId = subscription.customer as string;

        // Find parent by stripe_customer_id
        const { data: parent, error: findError } = await supabase
          .from('parents')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (findError || !parent) {
          // Try to find by subscription ID
          const { data: parentBySub, error: findSubError } = await supabase
            .from('parents')
            .select('id')
            .eq('stripe_subscription_id', subscription.id)
            .single();

          if (findSubError || !parentBySub) {
            console.error('Could not find parent for subscription:', subscription.id);
            break;
          }
        }

        const parentId = parent?.id;
        if (!parentId) break;

        // Calculate dates
        const trialEndsAt = subscription.trial_end
          ? new Date(subscription.trial_end * 1000).toISOString()
          : null;

        const subscriptionEndsAt = subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null;

        // Get plan from metadata or existing record
        let plan = subscription.metadata?.plan;
        if (!plan) {
          const { data: existingParent } = await supabase
            .from('parents')
            .select('subscription_plan')
            .eq('id', parentId)
            .single();
          plan = existingParent?.subscription_plan || 'solo';
        }

        // Update parent record
        const { error: updateError } = await supabase
          .from('parents')
          .update({
            stripe_subscription_id: subscription.id,
            subscription_status: mapStripeStatus(subscription.status),
            subscription_plan: plan,
            trial_ends_at: trialEndsAt,
            subscription_ends_at: subscriptionEndsAt,
            updated_at: new Date().toISOString(),
          })
          .eq('id', parentId);

        if (updateError) {
          console.error('Error updating subscription status:', updateError);
        } else {
          console.log('Subscription status updated for parent:', parentId);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log('Subscription deleted:', subscription.id);

        const customerId = subscription.customer as string;

        // Find parent by customer ID or subscription ID
        const { data: parent, error: findError } = await supabase
          .from('parents')
          .select('id')
          .or(`stripe_customer_id.eq.${customerId},stripe_subscription_id.eq.${subscription.id}`)
          .single();

        if (findError || !parent) {
          console.error('Could not find parent for deleted subscription:', subscription.id);
          break;
        }

        // Update to cancelled status
        const { error: updateError } = await supabase
          .from('parents')
          .update({
            subscription_status: 'cancelled',
            subscription_ends_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', parent.id);

        if (updateError) {
          console.error('Error marking subscription as cancelled:', updateError);
        } else {
          console.log('Subscription marked as cancelled for parent:', parent.id);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('Invoice payment failed:', invoice.id);

        const customerId = invoice.customer as string;
        const subscriptionId = invoice.subscription as string;

        if (!subscriptionId) {
          console.log('Not a subscription invoice, skipping');
          break;
        }

        // Find parent by customer ID
        const { data: parent, error: findError } = await supabase
          .from('parents')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (findError || !parent) {
          console.error('Could not find parent for failed invoice:', invoice.id);
          break;
        }

        // Update to past_due status
        const { error: updateError } = await supabase
          .from('parents')
          .update({
            subscription_status: 'past_due',
            updated_at: new Date().toISOString(),
          })
          .eq('id', parent.id);

        if (updateError) {
          console.error('Error marking subscription as past_due:', updateError);
        } else {
          console.log('Subscription marked as past_due for parent:', parent.id);
        }
        break;
      }

      case 'invoice.paid': {
        // Handle successful payment - restore active status if it was past_due
        const invoice = event.data.object as Stripe.Invoice;
        console.log('Invoice paid:', invoice.id);

        const customerId = invoice.customer as string;
        const subscriptionId = invoice.subscription as string;

        if (!subscriptionId) {
          break;
        }

        // Find parent by customer ID
        const { data: parent, error: findError } = await supabase
          .from('parents')
          .select('id, subscription_status')
          .eq('stripe_customer_id', customerId)
          .single();

        if (findError || !parent) {
          break;
        }

        // If status was past_due, restore to active
        if (parent.subscription_status === 'past_due') {
          const { error: updateError } = await supabase
            .from('parents')
            .update({
              subscription_status: 'active',
              updated_at: new Date().toISOString(),
            })
            .eq('id', parent.id);

          if (updateError) {
            console.error('Error restoring subscription to active:', updateError);
          } else {
            console.log('Subscription restored to active for parent:', parent.id);
          }
        }
        break;
      }

      default:
        console.log('Unhandled event type:', event.type);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in stripe-webhook:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
