/**
 * Edge Function: submit-inquiry
 *
 * Public (unauthenticated) endpoint for prospective-parent inquiries.
 * Validates input, confirms the tutor exists, then inserts a waiting_list row
 * with the service role. The waiting_list table is never exposed to anon.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { validateInquiry } from './validate.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-app-name',
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase env vars not configured');
      return json({ error: 'Server not configured' }, 500);
    }

    let payload: Record<string, unknown>;
    try {
      payload = await req.json();
    } catch {
      return json({ error: 'Invalid JSON' }, 400);
    }

    const result = validateInquiry(payload);
    // Honeypot / spam rejections return a neutral 200 so bots get no signal.
    if (!result.ok) {
      if (result.error === 'rejected') {
        return json({ success: true }, 200);
      }
      return json({ error: result.error }, 400);
    }

    const inquiry = result.value;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Confirm the tutor_id is a real tutor before inserting.
    const { data: tutor, error: tutorErr } = await supabase
      .from('parents')
      .select('id')
      .eq('id', inquiry.tutor_id)
      .eq('role', 'tutor')
      .maybeSingle();

    if (tutorErr) {
      console.error('Tutor lookup failed:', tutorErr);
      return json({ error: 'Lookup failed' }, 500);
    }
    if (!tutor) {
      return json({ error: 'Unknown tutor' }, 404);
    }

    const { error: insertErr } = await supabase.from('waiting_list').insert({
      tutor_id: inquiry.tutor_id,
      parent_name: inquiry.parent_name,
      parent_email: inquiry.parent_email,
      parent_phone: inquiry.parent_phone,
      student_name: inquiry.student_name,
      student_age: inquiry.student_age,
      student_grade: inquiry.student_grade,
      subjects: inquiry.subjects,
      preferred_availability: inquiry.preferred_availability,
      message: inquiry.message,
      referral_source: inquiry.referral_source,
      status: 'new',
    });

    if (insertErr) {
      console.error('Insert failed:', insertErr);
      return json({ error: 'Could not save inquiry' }, 500);
    }

    return json({ success: true }, 200);
  } catch (error) {
    console.error('submit-inquiry error:', error);
    return json({ error: 'Internal server error' }, 500);
  }
});
