/**
 * Edge Function: Send Parent Invitation Email
 *
 * Sends an invitation email to a parent using Resend,
 * allowing them to register and access their children's tutoring information.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InviteRequest {
  parentId: string;
}

interface ParentData {
  id: string;
  email: string;
  name: string;
  user_id: string | null;
  invitation_token: string | null;
  children: Array<{ name: string; subjects: string[] }>;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate environment variables
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const appUrl = Deno.env.get('APP_URL') || 'https://love2learn.app';

    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY is not configured');
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase environment variables are not configured');
    }

    // Parse request body
    const { parentId }: InviteRequest = await req.json();

    if (!parentId) {
      return new Response(
        JSON.stringify({ error: 'parentId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role for admin access
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the request is from an authenticated tutor
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the caller is a tutor
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if caller is a tutor
    const { data: callerData, error: callerError } = await supabase
      .from('parents')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (callerError || callerData?.role !== 'tutor') {
      return new Response(
        JSON.stringify({ error: 'Only tutors can send invitations' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get parent data with children
    const { data: parentData, error: parentError } = await supabase
      .from('parents')
      .select(`
        id,
        email,
        name,
        user_id,
        invitation_token,
        students (
          name,
          subjects
        )
      `)
      .eq('id', parentId)
      .single();

    if (parentError || !parentData) {
      return new Response(
        JSON.stringify({ error: 'Parent not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if parent already has an account
    if (parentData.user_id) {
      return new Response(
        JSON.stringify({ error: 'Parent already has an active account' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate invitation token
    const { data: tokenData, error: tokenError } = await supabase
      .rpc('generate_parent_invitation', { parent_id: parentId });

    if (tokenError) {
      console.error('Error generating invitation token:', tokenError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate invitation token' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const invitationToken = tokenData;

    // Build registration URL with token
    const registrationUrl = `${appUrl}/register?token=${invitationToken}&email=${encodeURIComponent(parentData.email)}`;

    // Format children list for email
    const childrenList = parentData.students?.map((child: any) => {
      const subjects = child.subjects?.join(', ') || 'General tutoring';
      return `<li><strong>${child.name}</strong> - ${subjects}</li>`;
    }).join('') || '<li>Your children will be linked after registration</li>';

    // Send email via Resend
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Love2Learn Tutoring <noreply@love2learn.app>',
        to: [parentData.email],
        subject: 'You\'re Invited to Love2Learn Parent Portal!',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome to Love2Learn</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #FF6B6B; margin: 0;">Love2Learn</h1>
              <p style="color: #666; font-size: 14px; margin-top: 5px;">Parent Portal</p>
            </div>

            <div style="background: linear-gradient(135deg, #FF6B6B 0%, #FF8E8E 100%); border-radius: 12px; padding: 30px; margin-bottom: 30px; color: white;">
              <h2 style="margin: 0 0 10px 0;">Welcome, ${parentData.name}!</h2>
              <p style="margin: 0; opacity: 0.9;">You've been invited to join the Love2Learn Parent Portal</p>
            </div>

            <p>Your tutor has set up access for you to:</p>
            <ul style="padding-left: 20px;">
              <li>View your children's lesson schedule</li>
              <li>Track worksheet assignments</li>
              <li>Print practice materials</li>
              <li>Stay connected with their learning progress</li>
            </ul>

            <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 25px 0;">
              <h3 style="margin: 0 0 15px 0; color: #333;">Your Children:</h3>
              <ul style="padding-left: 20px; margin: 0;">
                ${childrenList}
              </ul>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${registrationUrl}" style="display: inline-block; background: #FF6B6B; color: white; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Set Up Your Account
              </a>
            </div>

            <p style="color: #666; font-size: 14px; text-align: center;">
              This invitation expires in 7 days.
            </p>

            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

            <p style="color: #999; font-size: 12px; text-align: center;">
              If you didn't expect this invitation, you can safely ignore this email.<br>
              Questions? Contact your tutor directly.
            </p>

            <p style="color: #999; font-size: 12px; text-align: center; margin-top: 20px;">
              &copy; ${new Date().getFullYear()} Love2Learn Tutoring
            </p>
          </body>
          </html>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      console.error('Resend API error:', errorData);
      return new Response(
        JSON.stringify({ error: 'Failed to send invitation email', details: errorData }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const emailResult = await emailResponse.json();

    return new Response(
      JSON.stringify({
        success: true,
        message: `Invitation sent to ${parentData.email}`,
        emailId: emailResult.id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-parent-invite:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
