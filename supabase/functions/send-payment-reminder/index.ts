/**
 * Edge Function: Send Payment Reminder Email
 *
 * Sends an email reminder to a parent about an unpaid/partial invoice.
 * Called via application layer when tutor clicks "Send Reminder" or by scheduled job.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-name',
};

type ReminderType = 'friendly' | 'due_date' | 'past_due_3' | 'past_due_7' | 'past_due_14' | 'manual';

interface PaymentReminderRequest {
  payment_id: string;
  reminder_type: ReminderType;
  custom_message?: string;
  lesson_ids?: string[]; // Optional: specific payment_lesson IDs to include
}

interface ReminderConfig {
  subject: string;
  greeting: string;
  mainMessage: string;
  urgencyLevel: 'low' | 'medium' | 'high';
  accentColor: string;
  bannerGradient: string;
  icon: string;
}

type LessonSubject = 'piano' | 'math' | 'reading' | 'speech' | 'english';

interface PaymentLessonWithDetails {
  id: string;
  amount: number;
  paid: boolean;
  lesson: {
    id: string;
    subject: LessonSubject;
    scheduled_at: string;
    duration_min: number;
    student: { id: string; name: string };
  };
}

// Subject colors and emojis for the email template
const getSubjectInfo = (subject: LessonSubject) => {
  switch (subject) {
    case 'piano':
      return { emoji: '🎹', color: '#3D9CA8', label: 'Piano' };
    case 'math':
      return { emoji: '📐', color: '#7CB342', label: 'Math' };
    case 'reading':
      return { emoji: '📖', color: '#9C27B0', label: 'Reading' };
    case 'speech':
      return { emoji: '🗣️', color: '#FF9800', label: 'Speech' };
    case 'english':
      return { emoji: '📝', color: '#2196F3', label: 'English' };
    default:
      return { emoji: '📚', color: '#757575', label: subject };
  }
};

const getReminderConfig = (reminderType: ReminderType, monthDisplay: string, balanceDue: number): ReminderConfig => {
  const balanceFormatted = `$${balanceDue.toFixed(2)}`;

  switch (reminderType) {
    case 'friendly':
      return {
        subject: `Friendly Reminder: Invoice for ${monthDisplay}`,
        greeting: 'Just a friendly reminder',
        mainMessage: `Your invoice for ${monthDisplay} is past due. The current balance is ${balanceFormatted}.`,
        urgencyLevel: 'low',
        accentColor: '#7CB342',
        bannerGradient: 'linear-gradient(135deg, #7CB342 0%, #9CCC65 100%)',
        icon: '📋',
      };
    case 'due_date':
      return {
        subject: `Invoice Due Today - ${monthDisplay}`,
        greeting: 'Your invoice is due today',
        mainMessage: `This is a reminder that your invoice for ${monthDisplay} is due today. The balance due is ${balanceFormatted}.`,
        urgencyLevel: 'medium',
        accentColor: '#FF9800',
        bannerGradient: 'linear-gradient(135deg, #FF9800 0%, #FFB74D 100%)',
        icon: '📅',
      };
    case 'past_due_3':
      return {
        subject: `Payment Overdue: ${monthDisplay} Invoice`,
        greeting: 'Your payment is 3 days overdue',
        mainMessage: `Your invoice for ${monthDisplay} is now 3 days past due. Please remit payment of ${balanceFormatted} at your earliest convenience.`,
        urgencyLevel: 'medium',
        accentColor: '#F57C00',
        bannerGradient: 'linear-gradient(135deg, #F57C00 0%, #FF9800 100%)',
        icon: '⚠️',
      };
    case 'past_due_7':
      return {
        subject: `Payment Overdue: ${monthDisplay} Invoice - 7 Days`,
        greeting: 'Your payment is 7 days overdue',
        mainMessage: `Your invoice for ${monthDisplay} is now 7 days past due. The outstanding balance is ${balanceFormatted}. Please arrange payment as soon as possible.`,
        urgencyLevel: 'high',
        accentColor: '#E53935',
        bannerGradient: 'linear-gradient(135deg, #E53935 0%, #EF5350 100%)',
        icon: '🔴',
      };
    case 'past_due_14':
      return {
        subject: `Urgent: ${monthDisplay} Invoice - 14 Days Overdue`,
        greeting: 'Your payment is 14 days overdue',
        mainMessage: `Your invoice for ${monthDisplay} is now 14 days past due. The outstanding balance is ${balanceFormatted}. Please contact us immediately to arrange payment.`,
        urgencyLevel: 'high',
        accentColor: '#C62828',
        bannerGradient: 'linear-gradient(135deg, #C62828 0%, #E53935 100%)',
        icon: '🚨',
      };
    case 'manual':
    default:
      return {
        subject: `Payment Reminder: ${monthDisplay} Invoice`,
        greeting: 'Payment reminder',
        mainMessage: `This is a reminder about your invoice for ${monthDisplay}. The current balance is ${balanceFormatted}.`,
        urgencyLevel: 'medium',
        accentColor: '#3D9CA8',
        bannerGradient: 'linear-gradient(135deg, #3D9CA8 0%, #5FB3BC 100%)',
        icon: '💳',
      };
  }
};

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
    const requestData: PaymentReminderRequest = await req.json();
    const { payment_id, reminder_type, custom_message, lesson_ids } = requestData;

    if (!payment_id) {
      return new Response(
        JSON.stringify({ error: 'payment_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!reminder_type) {
      return new Response(
        JSON.stringify({ error: 'reminder_type is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role for admin access
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get payment data with parent info
    const { data: paymentData, error: paymentError } = await supabase
      .from('payments')
      .select(`
        id,
        parent_id,
        month,
        amount_due,
        amount_paid,
        status,
        notes,
        parent:parents!inner(
          id,
          email,
          name,
          preferences,
          students!parent_id(id, name)
        )
      `)
      .eq('id', payment_id)
      .single();

    if (paymentError || !paymentData) {
      console.error('Error fetching payment:', paymentError);
      return new Response(
        JSON.stringify({ error: 'Payment not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const parent = paymentData.parent as {
      id: string;
      email: string | null;
      name: string;
      preferences: { notifications?: { payment_due?: boolean } } | null;
      students: { id: string; name: string }[];
    };

    // Check parent notification preferences
    const paymentNotificationsEnabled = parent.preferences?.notifications?.payment_due !== false;
    if (!paymentNotificationsEnabled) {
      console.log('Parent has disabled payment notifications, skipping');
      return new Response(
        JSON.stringify({ success: true, message: 'Parent has disabled payment notifications, skipped' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!parent.email) {
      console.log('Parent has no email address, skipping email notification');
      return new Response(
        JSON.stringify({ success: true, message: 'Parent has no email, skipped' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for duplicate reminder (same type, same day)
    const today = new Date().toISOString().split('T')[0];
    const { data: existingReminder } = await supabase
      .from('payment_reminders')
      .select('id')
      .eq('payment_id', payment_id)
      .eq('reminder_type', reminder_type)
      .gte('sent_at', `${today}T00:00:00`)
      .lt('sent_at', `${today}T23:59:59`)
      .maybeSingle();

    if (existingReminder) {
      return new Response(
        JSON.stringify({ error: 'Reminder of this type already sent today', duplicate: true }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch UNPAID lessons linked to this payment (for partial payments)
    let lessonsQuery = supabase
      .from('payment_lessons')
      .select(`
        id,
        amount,
        paid,
        lesson:scheduled_lessons!inner(
          id,
          subject,
          scheduled_at,
          duration_min,
          student:students!inner(id, name)
        )
      `)
      .eq('payment_id', payment_id)
      .eq('paid', false);

    // If specific lesson IDs provided, filter to only those
    if (lesson_ids && lesson_ids.length > 0) {
      lessonsQuery = lessonsQuery.in('id', lesson_ids);
    }

    const { data: paymentLessons } = await lessonsQuery;

    // Sort lessons by date
    const sortedLessons = (paymentLessons as PaymentLessonWithDetails[] || [])
      .sort((a, b) => new Date(a.lesson.scheduled_at).getTime() - new Date(b.lesson.scheduled_at).getTime());

    // Format month for display
    const monthDate = new Date(paymentData.month);
    const monthDisplay = monthDate.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });

    // Calculate balance due
    const balanceDue = paymentData.amount_due - paymentData.amount_paid;

    // Get reminder configuration
    const config = getReminderConfig(reminder_type, monthDisplay, balanceDue);

    // Format student names
    const studentNames = parent.students?.map(s => s.name).join(', ') || 'your students';

    // Build custom message section
    const customMessageHtml = custom_message
      ? `
        <div style="background: #E3F2FD; border-radius: 10px; padding: 20px; margin: 25px 0; border-left: 4px solid #2196F3;">
          <h3 style="margin: 0 0 10px 0; color: #1565C0; font-size: 16px;">Message from Tutor:</h3>
          <p style="margin: 0; color: #1B3A4B; font-size: 15px; line-height: 1.6;">${custom_message}</p>
        </div>
      `
      : '';

    // Build lessons summary section
    const lessonsHtml = sortedLessons.length > 0
      ? `
        <div style="background: #F5F7FA; border-radius: 10px; padding: 20px; margin: 20px 0;">
          <h3 style="margin: 0 0 15px 0; color: #3D9CA8; font-size: 16px;">Unpaid Lessons (${sortedLessons.length}):</h3>
          <table style="width: 100%; border-collapse: collapse;">
            ${sortedLessons.map((pl) => {
              const subjectInfo = getSubjectInfo(pl.lesson.subject);
              const lessonDate = new Date(pl.lesson.scheduled_at);
              const dateStr = lessonDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              return `
                <tr style="border-bottom: 1px solid #E0E8EC;">
                  <td style="padding: 10px 0; color: #757575; font-size: 13px; width: 70px;">${dateStr}</td>
                  <td style="padding: 10px 0; font-size: 13px;">
                    <span style="color: ${subjectInfo.color}; font-weight: 600;">${subjectInfo.emoji} ${subjectInfo.label}</span>
                  </td>
                  <td style="padding: 10px 0; color: #4A6572; font-size: 13px;">${pl.lesson.student.name}</td>
                  <td style="padding: 10px 0; color: #1B3A4B; font-size: 13px; font-weight: 600; text-align: right;">$${pl.amount.toFixed(2)}</td>
                </tr>
              `;
            }).join('')}
          </table>
        </div>
      `
      : '';

    const paymentsUrl = `${appUrl}/payments`;

    // Send email via Resend
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Love to Learn Academy <noreply@app.lovetolearn.site>',
        to: [parent.email],
        subject: `${config.subject} - Love to Learn Academy`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Payment Reminder</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1B3A4B; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #F8FAFB;">
            <div style="background: #FFFFFF; border-radius: 14px; padding: 30px; box-shadow: 0 4px 8px rgba(27, 58, 75, 0.08);">

              <!-- Header -->
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #3D9CA8; margin: 0; font-size: 28px;">Love to Learn Academy</h1>
                <p style="color: #4A6572; font-size: 14px; margin-top: 5px;">Payment Reminder</p>
              </div>

              <!-- Status Banner -->
              <div style="background: ${config.bannerGradient}; border-radius: 12px; padding: 25px; margin-bottom: 30px; color: white; text-align: center;">
                <div style="font-size: 40px; margin-bottom: 10px;">${config.icon}</div>
                <h2 style="margin: 0 0 5px 0; font-size: 22px;">${config.greeting}</h2>
                <p style="margin: 0; opacity: 0.95; font-size: 14px;">for ${studentNames}</p>
              </div>

              <!-- Greeting -->
              <p style="color: #1B3A4B; font-size: 16px;">Dear ${parent.name},</p>

              <p style="color: #4A6572; font-size: 15px;">
                ${config.mainMessage}
              </p>

              <!-- Invoice Details -->
              <div style="background: #F5F7FA; border-radius: 10px; padding: 20px; margin: 20px 0;">
                <h3 style="margin: 0 0 15px 0; color: ${config.accentColor}; font-size: 16px;">Invoice Details:</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #757575; font-size: 14px;">Invoice Period:</td>
                    <td style="padding: 8px 0; color: #1B3A4B; font-size: 14px; font-weight: 600; text-align: right;">${monthDisplay}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #757575; font-size: 14px;">Student(s):</td>
                    <td style="padding: 8px 0; color: #1B3A4B; font-size: 14px; font-weight: 600; text-align: right;">${studentNames}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #757575; font-size: 14px;">Total Amount:</td>
                    <td style="padding: 8px 0; color: #1B3A4B; font-size: 14px; font-weight: 600; text-align: right;">$${paymentData.amount_due.toFixed(2)}</td>
                  </tr>
                  ${paymentData.amount_paid > 0 ? `
                  <tr>
                    <td style="padding: 8px 0; color: #757575; font-size: 14px;">Amount Paid:</td>
                    <td style="padding: 8px 0; color: #7CB342; font-size: 14px; font-weight: 600; text-align: right;">$${paymentData.amount_paid.toFixed(2)}</td>
                  </tr>
                  ` : ''}
                  <tr style="border-top: 2px solid ${config.accentColor};">
                    <td style="padding: 12px 0 8px 0; color: #1B3A4B; font-size: 16px; font-weight: 600;">Balance Due:</td>
                    <td style="padding: 12px 0 8px 0; color: ${config.accentColor}; font-size: 18px; font-weight: 700; text-align: right;">$${balanceDue.toFixed(2)}</td>
                  </tr>
                </table>
              </div>

              <!-- Lessons Summary -->
              ${lessonsHtml}

              <!-- Custom Message -->
              ${customMessageHtml}

              <!-- Payment Instructions -->
              <div style="background: #FFF3E0; border-radius: 10px; padding: 20px; margin: 25px 0; border-left: 4px solid #FF9800;">
                <h3 style="margin: 0 0 10px 0; color: #E65100; font-size: 16px;">Payment Options:</h3>
                <ul style="margin: 0; padding-left: 20px; color: #1B3A4B;">
                  <li style="margin-bottom: 8px;">Zelle or bank transfer</li>
                  <li style="margin-bottom: 8px;">Cash or check at your next lesson</li>
                  <li style="margin-bottom: 0;">Contact your tutor for other arrangements</li>
                </ul>
              </div>

              <!-- CTA Button -->
              <div style="text-align: center; margin: 35px 0;">
                <a href="${paymentsUrl}" style="display: inline-block; background: ${config.bannerGradient}; color: white; text-decoration: none; padding: 16px 45px; border-radius: 10px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(61, 156, 168, 0.3);">
                  View Invoice
                </a>
              </div>

              <hr style="border: none; border-top: 1px solid #E0E8EC; margin: 30px 0;">

              <!-- Footer -->
              <p style="color: #8A9BA8; font-size: 12px; text-align: center;">
                This is an automated payment reminder from Love to Learn Academy.<br>
                If you have questions about this invoice, please contact your tutor directly.
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

    let emailId: string | null = null;
    let emailSent = false;

    if (emailResponse.ok) {
      const emailResult = await emailResponse.json();
      emailId = emailResult.id;
      emailSent = true;
      console.log('Payment reminder email sent successfully:', emailId);
    } else {
      const errorData = await emailResponse.json();
      console.error('Resend API error:', errorData);
      // Continue to log the reminder even if email fails
    }

    // Create in-app notification
    let notificationId: string | null = null;
    try {
      const { data: notification, error: notificationError } = await supabase
        .from('notifications')
        .insert({
          recipient_id: parent.id,
          type: 'payment_reminder',
          title: config.greeting.charAt(0).toUpperCase() + config.greeting.slice(1),
          message: `Your invoice for ${monthDisplay} has a balance of $${balanceDue.toFixed(2)}.`,
          priority: config.urgencyLevel === 'high' ? 'high' : 'normal',
          data: {
            payment_id: payment_id,
            amount_due: paymentData.amount_due,
            amount_paid: paymentData.amount_paid,
            balance_due: balanceDue,
            month: paymentData.month,
            reminder_type: reminder_type,
          },
          action_url: '/payments',
        })
        .select('id')
        .single();

      if (!notificationError && notification) {
        notificationId = notification.id;
      }
    } catch (notifError) {
      console.error('Error creating notification:', notifError);
      // Continue even if notification fails
    }

    // Log reminder to payment_reminders table
    const { data: reminderRecord, error: reminderError } = await supabase
      .from('payment_reminders')
      .insert({
        payment_id: payment_id,
        parent_id: parent.id,
        reminder_type: reminder_type,
        email_sent: emailSent,
        email_id: emailId,
        notification_id: notificationId,
        message: custom_message || null,
      })
      .select('id')
      .single();

    if (reminderError) {
      console.error('Error logging reminder:', reminderError);
      // Don't fail the whole request if logging fails
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: emailSent
          ? `Reminder email sent to ${parent.email}`
          : 'Reminder logged but email failed to send',
        emailId: emailId,
        emailSent: emailSent,
        notificationId: notificationId,
        reminderId: reminderRecord?.id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-payment-reminder:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
