/**
 * Edge Function: Report Content
 *
 * Lets a user report a message (App Store Guideline 1.2). Optionally blocks
 * the sender in the same step.
 *
 * Flow:
 *   1. Verify the caller's JWT and load their parents row.
 *   2. Check the caller can see the message (thread participant or the
 *      tutor who created the thread).
 *   3. Save the report with a snapshot of the message text.
 *   4. If asked, block the sender.
 *   5. Email the report to REPORT_EMAIL (default support@dalesson.app).
 *      An email failure does not fail the report: the row is the record.
 *
 * Request body:
 *   { "message_id": uuid, "reason": "spam"|"harassment"|"inappropriate"|"other",
 *     "details"?: string, "block"?: boolean }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-name',
};

const REASONS: Record<string, string> = {
  spam: 'Spam',
  harassment: 'Harassment or bullying',
  inappropriate: 'Inappropriate content',
  other: 'Something else',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase environment variables are not configured');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Authorization header required' }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const messageId = typeof body?.message_id === 'string' ? body.message_id : null;
    const reason = typeof body?.reason === 'string' ? body.reason : null;
    const details =
      typeof body?.details === 'string' && body.details.trim()
        ? body.details.trim().slice(0, 1000)
        : null;
    const block = body?.block === true;

    if (!messageId || !reason || !(reason in REASONS)) {
      return json({ error: 'message_id and a valid reason are required' }, 400);
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const {
      data: { user },
      error: userError,
    } = await admin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) {
      return json({ error: 'Invalid authentication' }, 401);
    }

    const { data: reporter, error: reporterError } = await admin
      .from('parents')
      .select('id, name, email')
      .eq('user_id', user.id)
      .maybeSingle();
    if (reporterError || !reporter) {
      return json({ error: 'Account not found' }, 404);
    }

    const { data: message, error: messageError } = await admin
      .from('messages')
      .select('id, thread_id, sender_id, content, images, created_at')
      .eq('id', messageId)
      .maybeSingle();
    if (messageError || !message) {
      return json({ error: 'Message not found' }, 404);
    }

    if (message.sender_id === reporter.id) {
      return json({ error: 'You cannot report your own message' }, 400);
    }

    // The reporter must be able to see this thread.
    const [{ data: thread }, { data: participant }] = await Promise.all([
      admin
        .from('message_threads')
        .select('id, subject, created_by')
        .eq('id', message.thread_id)
        .maybeSingle(),
      admin
        .from('message_thread_participants')
        .select('id')
        .eq('thread_id', message.thread_id)
        .eq('parent_id', reporter.id)
        .maybeSingle(),
    ]);
    if (!thread || (!participant && thread.created_by !== reporter.id)) {
      return json({ error: 'Message not found' }, 404);
    }

    const { data: sender } = await admin
      .from('parents')
      .select('id, name, email')
      .eq('id', message.sender_id)
      .maybeSingle();

    const imageCount = Array.isArray(message.images) ? message.images.length : 0;
    const snapshot =
      message.content + (imageCount > 0 ? `\n[${imageCount} image(s) attached]` : '');

    const { data: report, error: insertError } = await admin
      .from('content_reports')
      .insert({
        reporter_id: reporter.id,
        reported_user_id: message.sender_id,
        message_id: message.id,
        thread_id: message.thread_id,
        reason,
        details,
        message_snapshot: snapshot,
      })
      .select('id, created_at')
      .single();
    if (insertError || !report) {
      throw new Error(`Could not save report: ${insertError?.message}`);
    }

    let blocked = false;
    if (block) {
      const { error: blockError } = await admin.from('user_blocks').upsert(
        {
          blocker_id: reporter.id,
          blocked_id: message.sender_id,
          blocked_name: sender?.name ?? null,
        },
        { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true }
      );
      if (blockError) {
        console.error('Block failed:', blockError.message);
      } else {
        blocked = true;
      }
    }

    // Notify the developer. Never fail the request because of email.
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const reportEmail = Deno.env.get('REPORT_EMAIL') || 'support@dalesson.app';
    if (resendApiKey) {
      try {
        const rows: [string, string][] = [
          ['Report ID', report.id],
          ['Reason', REASONS[reason]],
          ['Details', details ?? '(none)'],
          ['Reported by', `${reporter.name ?? ''} <${reporter.email ?? ''}> (${reporter.id})`],
          ['Sender', `${sender?.name ?? ''} <${sender?.email ?? ''}> (${message.sender_id})`],
          ['Thread', `${thread.subject} (${thread.id})`],
          ['Sent at', message.created_at],
          ['Message', snapshot],
          ['Reporter blocked sender', blocked ? 'yes' : 'no'],
        ];
        const html = `<h2>New content report</h2><p>Review within 24 hours.</p><table cellpadding="6">${rows
          .map(
            ([k, v]) =>
              `<tr><td valign="top"><b>${escapeHtml(k)}</b></td><td style="white-space:pre-wrap">${escapeHtml(v)}</td></tr>`
          )
          .join('')}</table>`;

        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'DaLesson Reports <noreply@app.lovetolearn.site>',
            to: [reportEmail],
            subject: `[DaLesson] Content report: ${REASONS[reason]}`,
            html,
          }),
        });
        if (!res.ok) {
          console.error('Report email failed:', res.status, await res.text());
        }
      } catch (emailError) {
        console.error('Report email error:', emailError);
      }
    } else {
      console.warn('RESEND_API_KEY not set; report saved without email');
    }

    return json({ success: true, report_id: report.id, blocked });
  } catch (error) {
    console.error('report-content error:', error);
    return json({ error: error instanceof Error ? error.message : 'Unexpected error' }, 500);
  }
});
