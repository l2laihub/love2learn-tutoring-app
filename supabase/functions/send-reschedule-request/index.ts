/**
 * Edge Function: Send Reschedule Request Email to Tutor
 *
 * Sends an email to the tutor when a parent submits a reschedule or drop-in request.
 * Called via application layer after a lesson_request is created.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-name',
};

interface RescheduleRequestPayload {
  request_id: string;
  parent_id: string;
  parent_name: string;
  student_name: string;
  subject: string;
  preferred_date: string;
  preferred_time: string | null;
  reason: string | null;
  request_type: 'reschedule' | 'dropin';
  original_lesson_date: string | null;
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
    const payload: RescheduleRequestPayload = await req.json();
    const {
      request_id,
      parent_id,
      parent_name,
      student_name,
      subject,
      preferred_date,
      preferred_time,
      reason,
      request_type = 'reschedule',
      original_lesson_date,
    } = payload;

    if (!request_id || !parent_id) {
      return new Response(
        JSON.stringify({ error: 'request_id and parent_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role for admin access
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Look up tutor email from the parents table (tutor_id references parents.id)
    let tutorEmail: string | null = null;
    let tutorName = 'Tutor';

    // 1. Try via parent's tutor_id (parent_id → parents.tutor_id → parents row for tutor)
    const { data: parentRecord } = await supabase
      .from('parents')
      .select('tutor_id')
      .eq('id', parent_id)
      .maybeSingle();

    if (parentRecord?.tutor_id) {
      const { data: tutorRecord } = await supabase
        .from('parents')
        .select('email, name')
        .eq('id', parentRecord.tutor_id)
        .eq('role', 'tutor')
        .maybeSingle();

      if (tutorRecord?.email) {
        tutorEmail = tutorRecord.email;
        tutorName = tutorRecord.name || 'Tutor';
        // Try to get business name from tutor_profiles
        const { data: profile } = await supabase
          .from('tutor_profiles')
          .select('business_name')
          .eq('id', parentRecord.tutor_id)
          .maybeSingle();
        if (profile?.business_name) tutorName = profile.business_name;
      }
    }

    // 2. Fallback: try via student's tutor_id
    if (!tutorEmail) {
      const { data: studentData } = await supabase
        .from('students')
        .select('tutor_id')
        .eq('parent_id', parent_id)
        .not('tutor_id', 'is', null)
        .limit(1)
        .maybeSingle();

      if (studentData?.tutor_id) {
        const { data: tutorRecord } = await supabase
          .from('parents')
          .select('email, name')
          .eq('id', studentData.tutor_id)
          .eq('role', 'tutor')
          .maybeSingle();

        if (tutorRecord?.email) {
          tutorEmail = tutorRecord.email;
          tutorName = tutorRecord.name || 'Tutor';
        }
      }
    }

    // 3. Last fallback: find any tutor from the parents table
    if (!tutorEmail) {
      const { data: fallbackTutor } = await supabase
        .from('parents')
        .select('email, name')
        .eq('role', 'tutor')
        .limit(1)
        .maybeSingle();

      if (fallbackTutor?.email) {
        tutorEmail = fallbackTutor.email;
        tutorName = fallbackTutor.name || 'Tutor';
      }
    }

    if (!tutorEmail) {
      console.log('No tutor email found, skipping email notification');
      return new Response(
        JSON.stringify({ success: true, message: 'No tutor email found, skipped' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format helpers
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

    const formatDate = (dateStr: string): string => {
      const date = new Date(dateStr + 'T00:00:00');
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    };

    const isDropin = request_type === 'dropin';
    const requestTypeText = isDropin ? 'Drop-in Session Request' : 'Reschedule Request';
    const formattedSubject = formatSubject(subject);
    const formattedDate = formatDate(preferred_date);
    const requestsUrl = `${appUrl}/requests`;

    // Build original lesson section for reschedules
    const originalLessonHtml = original_lesson_date
      ? `
        <tr>
          <td style="padding: 8px 0; color: #757575; font-size: 14px;">Original Date:</td>
          <td style="padding: 8px 0; color: #1B3A4B; font-size: 14px; font-weight: 600;">${formatDate(original_lesson_date)}</td>
        </tr>
      `
      : '';

    // Build preferred time section
    const preferredTimeHtml = preferred_time
      ? `
        <tr>
          <td style="padding: 8px 0; color: #757575; font-size: 14px;">Preferred Time:</td>
          <td style="padding: 8px 0; color: #1B3A4B; font-size: 14px; font-weight: 600;">${preferred_time}</td>
        </tr>
      `
      : '';

    // Build reason section
    const reasonHtml = reason
      ? `
        <div style="background: #FFF3E0; border-radius: 10px; padding: 20px; margin: 25px 0; border-left: 4px solid #FF9800;">
          <h3 style="margin: 0 0 10px 0; color: #E65100; font-size: 16px;">Reason:</h3>
          <p style="margin: 0; color: #1B3A4B; font-size: 15px; line-height: 1.6;">${reason}</p>
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
        to: [tutorEmail],
        subject: `New ${requestTypeText} - ${student_name}'s ${formattedSubject} Lesson`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${requestTypeText}</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1B3A4B; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #F8FAFB;">
            <div style="background: #FFFFFF; border-radius: 14px; padding: 30px; box-shadow: 0 4px 8px rgba(27, 58, 75, 0.08);">

              <!-- Header -->
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #3D9CA8; margin: 0; font-size: 28px;">Love to Learn Academy</h1>
                <p style="color: #4A6572; font-size: 14px; margin-top: 5px;">New ${requestTypeText}</p>
              </div>

              <!-- Status Banner -->
              <div style="background: linear-gradient(135deg, #FF9800 0%, #FFB74D 100%); border-radius: 12px; padding: 25px; margin-bottom: 30px; color: white; text-align: center;">
                <div style="font-size: 40px; margin-bottom: 10px;">${isDropin ? '📅' : '🔄'}</div>
                <h2 style="margin: 0 0 5px 0; font-size: 22px;">New ${requestTypeText}</h2>
                <p style="margin: 0; opacity: 0.95; font-size: 14px;">${parent_name} has submitted a request</p>
              </div>

              <!-- Request Details -->
              <div style="background: #E3F2FD; border-radius: 10px; padding: 20px; margin: 20px 0;">
                <h3 style="margin: 0 0 15px 0; color: #1565C0; font-size: 16px;">Request Details:</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #757575; font-size: 14px;">Parent:</td>
                    <td style="padding: 8px 0; color: #1B3A4B; font-size: 14px; font-weight: 600;">${parent_name}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #757575; font-size: 14px;">Student:</td>
                    <td style="padding: 8px 0; color: #1B3A4B; font-size: 14px; font-weight: 600;">${student_name}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #757575; font-size: 14px;">Subject:</td>
                    <td style="padding: 8px 0; color: #1B3A4B; font-size: 14px; font-weight: 600;">${formattedSubject}</td>
                  </tr>
                  ${originalLessonHtml}
                  <tr>
                    <td style="padding: 8px 0; color: #757575; font-size: 14px;">Preferred Date:</td>
                    <td style="padding: 8px 0; color: #1B3A4B; font-size: 14px; font-weight: 600;">${formattedDate}</td>
                  </tr>
                  ${preferredTimeHtml}
                  <tr>
                    <td style="padding: 8px 0; color: #757575; font-size: 14px;">Request Type:</td>
                    <td style="padding: 8px 0; color: #1B3A4B; font-size: 14px; font-weight: 600;">${isDropin ? 'Drop-in Session' : 'Reschedule'}</td>
                  </tr>
                </table>
              </div>

              <!-- Reason -->
              ${reasonHtml}

              <!-- CTA Button -->
              <div style="text-align: center; margin: 35px 0;">
                <a href="${requestsUrl}" style="display: inline-block; background: linear-gradient(135deg, #3D9CA8 0%, #5FB3BC 100%); color: white; text-decoration: none; padding: 16px 45px; border-radius: 10px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(61, 156, 168, 0.3);">
                  Review Request
                </a>
              </div>

              <hr style="border: none; border-top: 1px solid #E0E8EC; margin: 30px 0;">

              <!-- Footer -->
              <p style="color: #8A9BA8; font-size: 12px; text-align: center;">
                This is an automated notification from Love to Learn Academy.<br>
                A parent has submitted a new request that requires your attention.
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
        JSON.stringify({ error: 'Failed to send request email', details: errorData }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const emailResult = await emailResponse.json();
    console.log('Reschedule request email sent successfully:', emailResult.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Request email sent to ${tutorEmail}`,
        emailId: emailResult.id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-reschedule-request:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
