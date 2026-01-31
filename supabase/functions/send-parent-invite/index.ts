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
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-name',
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
  tutor_id: string | null;
  children: Array<{ name: string; subjects: string[] }>;
}

interface TutorData {
  id: string;
  name: string;
  business_name: string | null;
  email: string;
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
    const appUrl = Deno.env.get('APP_URL') || 'https://app.lovetolearn.site';

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
        tutor_id,
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

    // Get tutor info for branding (use the parent's tutor_id or the caller's tutor record)
    let tutorData: TutorData | null = null;
    const tutorId = parentData.tutor_id;

    if (tutorId) {
      const { data: tutor, error: tutorError } = await supabase
        .from('parents')
        .select('id, name, business_name, email')
        .eq('id', tutorId)
        .eq('role', 'tutor')
        .single();

      if (!tutorError && tutor) {
        tutorData = tutor;
      }
    }

    // If no tutor_id on parent, use the caller's tutor info
    if (!tutorData) {
      const { data: callerTutor, error: callerTutorError } = await supabase
        .from('parents')
        .select('id, name, business_name, email')
        .eq('user_id', user.id)
        .eq('role', 'tutor')
        .single();

      if (!callerTutorError && callerTutor) {
        tutorData = callerTutor;

        // Also update the parent's tutor_id if not set
        if (!parentData.tutor_id) {
          await supabase
            .from('parents')
            .update({ tutor_id: callerTutor.id })
            .eq('id', parentId);
        }
      }
    }

    // Get display name for branding
    const businessDisplayName = tutorData?.business_name || tutorData?.name || 'Love to Learn Academy';

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
    console.log('Generated invitation token:', invitationToken);

    // Build registration URL with token
    const registrationUrl = `${appUrl}/register?token=${invitationToken}&email=${encodeURIComponent(parentData.email)}`;
    console.log('Registration URL:', registrationUrl);

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
        from: `${businessDisplayName} <noreply@app.lovetolearn.site>`,
        to: [parentData.email],
        subject: `You're Invited to ${businessDisplayName} Parent Portal!`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome to ${businessDisplayName}</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1B3A4B; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #F8FAFB;">
            <div style="background: #FFFFFF; border-radius: 14px; padding: 30px; box-shadow: 0 4px 8px rgba(27, 58, 75, 0.08);">

              <!-- Header -->
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #3D9CA8; margin: 0; font-size: 28px;">${businessDisplayName}</h1>
                <p style="color: #4A6572; font-size: 14px; margin-top: 5px;">Parent Portal</p>
              </div>

              <!-- Welcome Banner -->
              <div style="background: linear-gradient(135deg, #3D9CA8 0%, #5FB3BC 100%); border-radius: 12px; padding: 30px; margin-bottom: 30px; color: white;">
                <h2 style="margin: 0 0 10px 0; font-size: 24px;">Welcome, ${parentData.name}!</h2>
                <p style="margin: 0; opacity: 0.95;">You've been invited to join the ${businessDisplayName} Parent Portal</p>
              </div>

              <!-- Features List -->
              <p style="color: #1B3A4B; font-size: 16px;">${tutorData?.name || 'Your tutor'} has set up access for you to:</p>
              <ul style="padding-left: 20px; color: #4A6572;">
                <li style="margin-bottom: 8px;">View your children's lesson schedule</li>
                <li style="margin-bottom: 8px;">Track worksheet assignments</li>
                <li style="margin-bottom: 8px;">Print practice materials</li>
                <li style="margin-bottom: 8px;">Stay connected with their learning progress</li>
              </ul>

              <!-- Children Section -->
              <div style="background: #F1F8E9; border-radius: 10px; padding: 20px; margin: 25px 0; border-left: 4px solid #7CB342;">
                <h3 style="margin: 0 0 15px 0; color: #5D8A2F; font-size: 16px;">🌱 Your Children:</h3>
                <ul style="padding-left: 20px; margin: 0; color: #1B3A4B;">
                  ${childrenList}
                </ul>
              </div>

              <!-- CTA Button -->
              <div style="text-align: center; margin: 35px 0;">
                <a href="${registrationUrl}" style="display: inline-block; background: linear-gradient(135deg, #FF6B6B 0%, #FF8E8E 100%); color: white; text-decoration: none; padding: 16px 45px; border-radius: 10px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3);">
                  Set Up Your Account
                </a>
              </div>

              <!-- Fallback Link -->
              <p style="color: #8A9BA8; font-size: 13px; text-align: center;">
                If the button doesn't work, copy and paste this link:<br>
                <a href="${registrationUrl}" style="color: #3D9CA8; word-break: break-all;">${registrationUrl}</a>
              </p>

              <!-- Expiration Notice -->
              <p style="color: #8A9BA8; font-size: 14px; text-align: center; margin-top: 20px;">
                ⏰ This invitation expires in 7 days.
              </p>

              <hr style="border: none; border-top: 1px solid #E0E8EC; margin: 30px 0;">

              <!-- Footer -->
              <p style="color: #8A9BA8; font-size: 12px; text-align: center;">
                If you didn't expect this invitation, you can safely ignore this email.<br>
                Questions? Contact ${tutorData?.name || 'your tutor'} directly.
              </p>

              <p style="color: #8A9BA8; font-size: 12px; text-align: center; margin-top: 20px;">
                &copy; ${new Date().getFullYear()} ${businessDisplayName}
              </p>
            </div>
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
