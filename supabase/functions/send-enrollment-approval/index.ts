/**
 * Edge Function: Send Enrollment Approval Email
 *
 * Sends an email to a parent when their group session enrollment request is approved.
 * Called via application layer when a session_enrollment status changes to 'approved'.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-name',
};

interface EnrollmentApprovalRequest {
  parent_id: string;
  student_name: string;
  subject: string;
  session_date: string;
  session_time: string;
  tutor_response: string | null;
  duration_min: number;
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
    const requestData: EnrollmentApprovalRequest = await req.json();
    const { parent_id, student_name, subject, session_date, session_time, tutor_response, duration_min } = requestData;

    if (!parent_id) {
      return new Response(
        JSON.stringify({ error: 'parent_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role for admin access
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get parent data
    const { data: parentData, error: parentError } = await supabase
      .from('parents')
      .select('id, email, name')
      .eq('id', parent_id)
      .single();

    if (parentError || !parentData) {
      console.error('Error fetching parent:', parentError);
      return new Response(
        JSON.stringify({ error: 'Parent not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!parentData.email) {
      console.log('Parent has no email address, skipping email notification');
      return new Response(
        JSON.stringify({ success: true, message: 'Parent has no email, skipped' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format subject name nicely
    const formatSubject = (subj: string): string => {
      const subjectMap: Record<string, string> = {
        piano: 'Piano',
        math: 'Math',
        reading: 'Reading',
        speech: 'Speech',
        english: 'English',
      };
      return subjectMap[subj.toLowerCase()] || subj;
    };

    // Format date nicely
    const formatDate = (dateStr: string): string => {
      const date = new Date(dateStr + 'T00:00:00');
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    };

    const formattedSubject = formatSubject(subject);
    const formattedDate = formatDate(session_date);
    const calendarUrl = `${appUrl}/calendar`;

    // Build tutor message section
    const tutorMessageHtml = tutor_response
      ? `
        <div style="background: #E3F2FD; border-radius: 10px; padding: 20px; margin: 25px 0; border-left: 4px solid #2196F3;">
          <h3 style="margin: 0 0 10px 0; color: #1565C0; font-size: 16px;">Message from Tutor:</h3>
          <p style="margin: 0; color: #1B3A4B; font-size: 15px; line-height: 1.6;">${tutor_response}</p>
        </div>
      `
      : '';

    // Send email via Resend
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Love to Learn Academy <noreply@app.lovetolearn.site>',
        to: [parentData.email],
        subject: `Group Session Enrollment Approved - ${student_name}'s ${formattedSubject} Lesson`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Enrollment Approved</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1B3A4B; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #F8FAFB;">
            <div style="background: #FFFFFF; border-radius: 14px; padding: 30px; box-shadow: 0 4px 8px rgba(27, 58, 75, 0.08);">

              <!-- Header -->
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #3D9CA8; margin: 0; font-size: 28px;">Love to Learn Academy</h1>
                <p style="color: #4A6572; font-size: 14px; margin-top: 5px;">Group Session Enrollment</p>
              </div>

              <!-- Status Banner -->
              <div style="background: linear-gradient(135deg, #43A047 0%, #66BB6A 100%); border-radius: 12px; padding: 25px; margin-bottom: 30px; color: white; text-align: center;">
                <div style="font-size: 40px; margin-bottom: 10px;">✓</div>
                <h2 style="margin: 0 0 5px 0; font-size: 22px;">Enrollment Approved!</h2>
                <p style="margin: 0; opacity: 0.95; font-size: 14px;">${student_name} has been added to the group session</p>
              </div>

              <!-- Greeting -->
              <p style="color: #1B3A4B; font-size: 16px;">Dear ${parentData.name},</p>

              <p style="color: #4A6572; font-size: 15px;">
                Great news! Your enrollment request for ${student_name} to join a group ${formattedSubject.toLowerCase()} session has been approved.
              </p>

              <!-- Session Details -->
              <div style="background: #E8F5E9; border-radius: 10px; padding: 20px; margin: 20px 0;">
                <h3 style="margin: 0 0 15px 0; color: #2E7D32; font-size: 16px;">Session Details:</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #757575; font-size: 14px;">Student:</td>
                    <td style="padding: 8px 0; color: #1B3A4B; font-size: 14px; font-weight: 600;">${student_name}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #757575; font-size: 14px;">Subject:</td>
                    <td style="padding: 8px 0; color: #1B3A4B; font-size: 14px; font-weight: 600;">${formattedSubject}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #757575; font-size: 14px;">Date:</td>
                    <td style="padding: 8px 0; color: #1B3A4B; font-size: 14px; font-weight: 600;">${formattedDate}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #757575; font-size: 14px;">Time:</td>
                    <td style="padding: 8px 0; color: #1B3A4B; font-size: 14px; font-weight: 600;">${session_time}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #757575; font-size: 14px;">Duration:</td>
                    <td style="padding: 8px 0; color: #1B3A4B; font-size: 14px; font-weight: 600;">${duration_min} minutes</td>
                  </tr>
                </table>
              </div>

              <!-- Tutor Message -->
              ${tutorMessageHtml}

              <!-- What's Next -->
              <div style="background: #FFF3E0; border-radius: 10px; padding: 20px; margin: 25px 0; border-left: 4px solid #FF9800;">
                <h3 style="margin: 0 0 10px 0; color: #E65100; font-size: 16px;">What's Next?</h3>
                <ul style="margin: 0; padding-left: 20px; color: #1B3A4B;">
                  <li style="margin-bottom: 8px;">The lesson has been added to your calendar</li>
                  <li style="margin-bottom: 8px;">You'll receive a reminder before the session</li>
                  <li style="margin-bottom: 0;">The lesson fee will be added to your monthly invoice</li>
                </ul>
              </div>

              <!-- CTA Button -->
              <div style="text-align: center; margin: 35px 0;">
                <a href="${calendarUrl}" style="display: inline-block; background: linear-gradient(135deg, #3D9CA8 0%, #5FB3BC 100%); color: white; text-decoration: none; padding: 16px 45px; border-radius: 10px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(61, 156, 168, 0.3);">
                  View Calendar
                </a>
              </div>

              <hr style="border: none; border-top: 1px solid #E0E8EC; margin: 30px 0;">

              <!-- Footer -->
              <p style="color: #8A9BA8; font-size: 12px; text-align: center;">
                This is an automated notification from Love to Learn Academy.<br>
                If you have questions, please contact your tutor directly.
              </p>

              <p style="color: #8A9BA8; font-size: 12px; text-align: center; margin-top: 20px;">
                &copy; ${new Date().getFullYear()} Love to Learn Academy
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
        JSON.stringify({ error: 'Failed to send enrollment approval email', details: errorData }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const emailResult = await emailResponse.json();
    console.log('Enrollment approval email sent successfully:', emailResult.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Enrollment approval email sent to ${parentData.email}`,
        emailId: emailResult.id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-enrollment-approval:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
