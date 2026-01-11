/**
 * Edge Function: Send Reschedule Rejection Email
 *
 * Sends an email to a parent when their reschedule request is rejected.
 * Called via database webhook when a lesson_request status changes to 'rejected'.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-name',
};

interface RejectionRequest {
  parent_id: string;
  student_name: string;
  subject: string;
  preferred_date: string;
  tutor_response: string | null;
  request_group_id: string | null;
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
    const requestData: RejectionRequest = await req.json();
    const { parent_id, student_name, subject, preferred_date, tutor_response, request_group_id } = requestData;

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
    const formattedDate = formatDate(preferred_date);
    const notificationsUrl = `${appUrl}/notifications`;

    // Build rejection reason section
    const rejectionReasonHtml = tutor_response
      ? `
        <div style="background: #FFF3E0; border-radius: 10px; padding: 20px; margin: 25px 0; border-left: 4px solid #FF9800;">
          <h3 style="margin: 0 0 10px 0; color: #E65100; font-size: 16px;">Reason for Decline:</h3>
          <p style="margin: 0; color: #1B3A4B; font-size: 15px; line-height: 1.6;">${tutor_response}</p>
        </div>
      `
      : `
        <div style="background: #F5F5F5; border-radius: 10px; padding: 20px; margin: 25px 0;">
          <p style="margin: 0; color: #757575; font-size: 14px; font-style: italic;">No specific reason was provided. Please contact your tutor for more details.</p>
        </div>
      `;

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
        subject: `Reschedule Request Declined - ${student_name}'s ${formattedSubject} Lesson`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reschedule Request Update</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1B3A4B; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #F8FAFB;">
            <div style="background: #FFFFFF; border-radius: 14px; padding: 30px; box-shadow: 0 4px 8px rgba(27, 58, 75, 0.08);">

              <!-- Header -->
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #3D9CA8; margin: 0; font-size: 28px;">Love to Learn Academy</h1>
                <p style="color: #4A6572; font-size: 14px; margin-top: 5px;">Reschedule Request Update</p>
              </div>

              <!-- Status Banner -->
              <div style="background: linear-gradient(135deg, #E53935 0%, #EF5350 100%); border-radius: 12px; padding: 25px; margin-bottom: 30px; color: white; text-align: center;">
                <div style="font-size: 40px; margin-bottom: 10px;">📅</div>
                <h2 style="margin: 0 0 5px 0; font-size: 22px;">Request Declined</h2>
                <p style="margin: 0; opacity: 0.95; font-size: 14px;">Your reschedule request could not be accommodated</p>
              </div>

              <!-- Greeting -->
              <p style="color: #1B3A4B; font-size: 16px;">Dear ${parentData.name},</p>

              <p style="color: #4A6572; font-size: 15px;">
                We regret to inform you that your reschedule request has been declined.
              </p>

              <!-- Request Details -->
              <div style="background: #FFEBEE; border-radius: 10px; padding: 20px; margin: 20px 0;">
                <h3 style="margin: 0 0 15px 0; color: #C62828; font-size: 16px;">Request Details:</h3>
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
                    <td style="padding: 8px 0; color: #757575; font-size: 14px;">Requested Date:</td>
                    <td style="padding: 8px 0; color: #1B3A4B; font-size: 14px; font-weight: 600;">${formattedDate}</td>
                  </tr>
                </table>
              </div>

              <!-- Rejection Reason -->
              ${rejectionReasonHtml}

              <!-- Next Steps -->
              <div style="background: #E8F5E9; border-radius: 10px; padding: 20px; margin: 25px 0; border-left: 4px solid #7CB342;">
                <h3 style="margin: 0 0 10px 0; color: #5D8A2F; font-size: 16px;">What's Next?</h3>
                <ul style="margin: 0; padding-left: 20px; color: #1B3A4B;">
                  <li style="margin-bottom: 8px;">You can submit a new reschedule request with different dates</li>
                  <li style="margin-bottom: 8px;">Contact your tutor directly to discuss alternative times</li>
                  <li style="margin-bottom: 0;">View more details in the app notifications</li>
                </ul>
              </div>

              <!-- CTA Button -->
              <div style="text-align: center; margin: 35px 0;">
                <a href="${notificationsUrl}" style="display: inline-block; background: linear-gradient(135deg, #3D9CA8 0%, #5FB3BC 100%); color: white; text-decoration: none; padding: 16px 45px; border-radius: 10px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(61, 156, 168, 0.3);">
                  View in App
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
        JSON.stringify({ error: 'Failed to send rejection email', details: errorData }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const emailResult = await emailResponse.json();
    console.log('Rejection email sent successfully:', emailResult.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Rejection email sent to ${parentData.email}`,
        emailId: emailResult.id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-reschedule-rejection:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
