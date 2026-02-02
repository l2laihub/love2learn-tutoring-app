/**
 * Edge Function: Create Stripe Checkout Session
 *
 * Creates a Stripe Checkout session for subscription purchases.
 * Validates that the user is a tutor before allowing checkout.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-name',
};

interface CheckoutRequest {
  plan: 'solo' | 'pro';
  success_url: string;
  cancel_url: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate environment variables
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const soloPriceId = Deno.env.get('STRIPE_SOLO_PRICE_ID');
    const proPriceId = Deno.env.get('STRIPE_PRO_PRICE_ID');

    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase environment variables are not configured');
    }

    if (!soloPriceId || !proPriceId) {
      throw new Error('Stripe price IDs are not configured');
    }

    // Initialize Stripe
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's JWT
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Get current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create admin client for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get parent record and verify tutor role
    const { data: parent, error: parentError } = await supabaseAdmin
      .from('parents')
      .select('id, email, name, role, stripe_customer_id')
      .eq('user_id', user.id)
      .single();

    if (parentError || !parent) {
      console.error('Parent fetch error:', parentError);
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (parent.role !== 'tutor') {
      return new Response(
        JSON.stringify({ error: 'Only tutors can subscribe' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const requestData: CheckoutRequest = await req.json();
    const { plan, success_url, cancel_url } = requestData;

    if (!plan || !['solo', 'pro'].includes(plan)) {
      return new Response(
        JSON.stringify({ error: 'Invalid plan. Must be "solo" or "pro"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!success_url || !cancel_url) {
      return new Response(
        JSON.stringify({ error: 'success_url and cancel_url are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get or create Stripe customer
    let customerId = parent.stripe_customer_id;

    if (!customerId) {
      // Check if customer already exists in Stripe by email
      const existingCustomers = await stripe.customers.list({
        email: parent.email,
        limit: 1,
      });

      if (existingCustomers.data.length > 0) {
        customerId = existingCustomers.data[0].id;
      } else {
        // Create new customer
        const customer = await stripe.customers.create({
          email: parent.email,
          name: parent.name,
          metadata: {
            parent_id: parent.id,
            supabase_user_id: user.id,
          },
        });
        customerId = customer.id;
      }

      // Save customer ID to database
      await supabaseAdmin
        .from('parents')
        .update({ stripe_customer_id: customerId })
        .eq('id', parent.id);
    }

    // Determine price ID based on plan
    const priceId = plan === 'solo' ? soloPriceId : proPriceId;

    // Check if customer already has an active subscription
    const existingSubscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1,
    });

    if (existingSubscriptions.data.length > 0) {
      return new Response(
        JSON.stringify({
          error: 'You already have an active subscription. Please manage it from the billing portal.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for trialing subscriptions too
    const trialingSubscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'trialing',
      limit: 1,
    });

    if (trialingSubscriptions.data.length > 0) {
      return new Response(
        JSON.stringify({
          error: 'You already have an active trial. Please manage it from the billing portal.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: !customerId ? parent.email : undefined,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      // 14-day trial for new subscribers
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          parent_id: parent.id,
          plan: plan,
        },
      },
      success_url: success_url,
      cancel_url: cancel_url,
      metadata: {
        parent_id: parent.id,
        plan: plan,
      },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
    });

    console.log('Checkout session created:', session.id);

    return new Response(
      JSON.stringify({
        url: session.url,
        session_id: session.id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in create-checkout:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
