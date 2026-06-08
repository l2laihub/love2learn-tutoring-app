# Waiting List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let tutors track inquiries from prospective parents, captured through a per-tutor public share link and managed through a simple status lifecycle.

**Architecture:** A new `waiting_list` table holds one row per inquiry, scoped by `tutor_id`. Prospective parents submit a public form at `/inquire/[tutorId]`; the form POSTs to a `submit-inquiry` Edge Function that validates the tutor and inserts the row with the service role (the table is never exposed to the `anon` role). A DB trigger notifies the tutor. Tutors manage entries on a `/waiting-list` screen that mirrors the existing `requests.tsx` pattern (status tabs + card list), backed by `useWaitingList` hooks shaped like the existing `useLessonRequests` hooks.

**Tech Stack:** React Native 0.81 + Expo Router 6, Supabase (Postgres + RLS + Edge Functions/Deno), TypeScript strict mode.

**Testing note:** This repo has **no JS unit-test runner** (no jest/vitest) — verification for hooks/UI is `npm run typecheck` + `npm run lint` + manual run. The one established automated-test precedent is **Deno tests** for edge-function logic (`supabase/functions/_shared/lessonAmount.test.ts`). We follow that precedent: the edge function's pure validation logic is extracted into `validate.ts` and covered by a real `validate.test.ts` (TDD). Everything else is verified by typecheck/lint/SQL/manual steps with explicit expected output.

**Conventions to honor:**
- Never edit existing migrations — always create a new one (`npx supabase migration new <name>`).
- Migration filenames use a `YYYYMMDDHHMMSS_` timestamp prefix. The example filenames below use `20260608120000_` / `20260608120001_`; **if a migration with that timestamp already exists, bump to the next free timestamp** and keep the same suffix name.
- Reuse helpers `is_tutor()` and `get_current_tutor_id()` for RLS.
- Reuse the existing `notification_type` enum value `'general'` (do NOT add a new enum value — `ALTER TYPE ADD VALUE` is avoided).

---

## File Structure

**Create:**
- `supabase/migrations/20260608120000_waiting_list.sql` — table, indexes, RLS, `updated_at` trigger.
- `supabase/migrations/20260608120001_waiting_list_notification.sql` — insert-notification trigger.
- `supabase/functions/submit-inquiry/validate.ts` — pure validation/sanitization (Deno).
- `supabase/functions/submit-inquiry/validate.test.ts` — Deno tests for `validate.ts`.
- `supabase/functions/submit-inquiry/index.ts` — the Edge Function handler.
- `src/hooks/useWaitingList.ts` — query + mutation hooks + status helper + public submit helper.
- `src/components/waiting-list/WaitingListCard.tsx` — one inquiry card.
- `app/waiting-list.tsx` — tutor-facing management screen.
- `app/inquire/[tutorId].tsx` — public intake form.

**Modify:**
- `src/types/database.ts` — add `WaitingListStatus`, `WaitingListEntry`, `CreateWaitingListInput`, `UpdateWaitingListInput`.
- `supabase/config.toml` — add `[functions.submit-inquiry] verify_jwt = false`.
- `app/_layout.tsx` — exempt `/inquire` from the unauthenticated redirect; register `inquire/[tutorId]` and `waiting-list` Stack screens.
- `app/(tabs)/more.tsx` — add a `Waiting List` tutor-only menu item.

---

## Task 1: Database table, indexes, RLS, updated_at trigger

**Files:**
- Create: `supabase/migrations/20260608120000_waiting_list.sql`

- [ ] **Step 1: Create the migration file with the full schema**

Create `supabase/migrations/20260608120000_waiting_list.sql` with exactly this content:

```sql
-- Migration: Waiting List
-- Version: 20260608120000
-- Description: Tracks inquiries from prospective (new) parents per tutor.
--   Public form submissions are inserted by the submit-inquiry edge function
--   (service role). The table is never exposed to the anon role.

-- ============================================================================
-- STATUS ENUM (CHECK constraint, matching lesson_requests convention)
-- ============================================================================
-- Lifecycle: new -> contacted -> waitlisted -> converted | declined

-- ============================================================================
-- TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS waiting_list (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tutor_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,

    -- Prospective parent contact
    parent_name TEXT NOT NULL,
    parent_email TEXT,
    parent_phone TEXT,

    -- Student details (single student per inquiry)
    student_name TEXT,
    student_age INTEGER,
    student_grade TEXT,

    -- Interest
    subjects TEXT[] NOT NULL DEFAULT '{}',
    preferred_availability TEXT,
    message TEXT,
    referral_source TEXT,

    -- Tutor-managed
    status TEXT NOT NULL DEFAULT 'new'
        CHECK (status IN ('new', 'contacted', 'waitlisted', 'converted', 'declined')),
    tutor_notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- At least one way to follow up
    CONSTRAINT waiting_list_contact_present
        CHECK (parent_email IS NOT NULL OR parent_phone IS NOT NULL)
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_waiting_list_tutor_status
    ON waiting_list(tutor_id, status);
CREATE INDEX IF NOT EXISTS idx_waiting_list_created_at
    ON waiting_list(created_at DESC);

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE waiting_list IS 'Inquiries from prospective new parents, per tutor';
COMMENT ON COLUMN waiting_list.status IS 'new | contacted | waitlisted | converted | declined';
COMMENT ON COLUMN waiting_list.tutor_notes IS 'Private notes the tutor adds about the inquiry';

-- ============================================================================
-- RLS
-- ============================================================================
ALTER TABLE waiting_list ENABLE ROW LEVEL SECURITY;

-- Tutors may read only their own inquiries.
CREATE POLICY "Tutors can view own waiting list"
    ON waiting_list
    FOR SELECT
    USING (is_tutor() AND tutor_id = get_current_tutor_id());

-- Tutors may update only their own inquiries (status + notes).
CREATE POLICY "Tutors can update own waiting list"
    ON waiting_list
    FOR UPDATE
    USING (is_tutor() AND tutor_id = get_current_tutor_id())
    WITH CHECK (is_tutor() AND tutor_id = get_current_tutor_id());

-- Tutors may delete only their own inquiries.
CREATE POLICY "Tutors can delete own waiting list"
    ON waiting_list
    FOR DELETE
    USING (is_tutor() AND tutor_id = get_current_tutor_id());

-- NOTE: No INSERT policy and no anon policies. Public submissions are inserted
-- exclusively by the submit-inquiry edge function using the service role, which
-- bypasses RLS.

-- ============================================================================
-- TRIGGER: keep updated_at fresh
-- ============================================================================
CREATE OR REPLACE FUNCTION update_waiting_list_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS waiting_list_updated_at ON waiting_list;
CREATE TRIGGER waiting_list_updated_at
    BEFORE UPDATE ON waiting_list
    FOR EACH ROW
    EXECUTE FUNCTION update_waiting_list_updated_at();
```

- [ ] **Step 2: Apply migrations locally and verify the table exists**

Run: `npx supabase db reset`
Expected: reset completes without error and the output lists `20260608120000_waiting_list.sql` among applied migrations. (If `supabase db reset` is not viable in this environment, instead run `npx supabase db push` against a dev project. Either way the migration must apply cleanly with no SQL error.)

- [ ] **Step 3: Verify RLS isolation with a SQL check**

Run this against the local DB (psql or the Supabase SQL editor):

```sql
-- Should return the three policies created above and nothing for anon/insert.
SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'waiting_list'
ORDER BY policyname;
```

Expected: exactly three rows — `Tutors can delete own waiting list` (DELETE), `Tutors can update own waiting list` (UPDATE), `Tutors can view own waiting list` (SELECT). No INSERT policy present.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260608120000_waiting_list.sql
git commit -m "feat(waiting-list): add waiting_list table, indexes, and RLS"
```

---

## Task 2: Notification trigger on new inquiry

**Files:**
- Create: `supabase/migrations/20260608120001_waiting_list_notification.sql`

Context: the `notifications` table has columns `recipient_id`, `sender_id`, `type` (enum `notification_type`), `title`, `message`, `data` (jsonb), `priority`, `action_url`, and `tutor_id`. We reuse the existing enum value `'general'`. Pattern mirrors `notify_on_reschedule_request` (SECURITY DEFINER).

**Spam protection scope (v1):** Per the spec's "Open items", explicit per-IP rate-limiting is **intentionally deferred** for v1 — it needs a store (table or KV) and adds complexity disproportionate to early inquiry volume. v1 ships the **honeypot** field only (Task 4/5), which stops the common bot case. When volume warrants it, add a rate check in the edge function backed by a small `inquiry_throttle` table keyed by IP + timestamp. This is a known, accepted limitation, not an oversight.

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/20260608120001_waiting_list_notification.sql` with exactly this content:

```sql
-- Migration: Waiting List notification trigger
-- Version: 20260608120001
-- Description: On a new waiting_list row, notify the owning tutor.
--   Reuses the existing 'general' notification_type (no enum change).

CREATE OR REPLACE FUNCTION notify_on_waiting_list_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO notifications (
        recipient_id,
        sender_id,
        type,
        title,
        message,
        data,
        priority,
        action_url,
        tutor_id
    ) VALUES (
        NEW.tutor_id,
        NULL,
        'general'::notification_type,
        'New Waiting List Inquiry',
        COALESCE(NEW.parent_name, 'Someone') || ' submitted an inquiry',
        jsonb_build_object(
            'waiting_list_id', NEW.id,
            'parent_name', NEW.parent_name,
            'student_name', NEW.student_name,
            'subjects', NEW.subjects
        ),
        'normal',
        '/waiting-list',
        NEW.tutor_id
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS waiting_list_notify_insert ON waiting_list;
CREATE TRIGGER waiting_list_notify_insert
    AFTER INSERT ON waiting_list
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_waiting_list_insert();
```

- [ ] **Step 2: Apply and verify the trigger fires**

Run: `npx supabase db reset` (or `db push`).
Then run this SQL to simulate a service-role insert and confirm a notification is created:

```sql
-- Pick any existing tutor id for the test.
WITH t AS (SELECT id FROM parents WHERE role = 'tutor' LIMIT 1)
INSERT INTO waiting_list (tutor_id, parent_name, parent_email, subjects)
SELECT id, 'Test Parent', 'test@example.com', ARRAY['math'] FROM t
RETURNING id, tutor_id;

-- Expect one matching notification with title 'New Waiting List Inquiry'.
SELECT title, message, action_url, tutor_id
FROM notifications
WHERE title = 'New Waiting List Inquiry'
ORDER BY created_at DESC
LIMIT 1;
```

Expected: the SELECT returns a row whose `action_url` is `/waiting-list` and `tutor_id` equals the inserted `tutor_id`. (Clean up the test rows afterward if using a shared dev DB: `DELETE FROM waiting_list WHERE parent_name = 'Test Parent';`)

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260608120001_waiting_list_notification.sql
git commit -m "feat(waiting-list): notify tutor on new inquiry insert"
```

---

## Task 3: TypeScript types

**Files:**
- Modify: `src/types/database.ts` (add near the other domain types, e.g. just after the `UpdateLessonRequestInput` block)

- [ ] **Step 1: Add the waiting-list types**

In `src/types/database.ts`, add the following block (place it after the `UpdateLessonRequestInput` interface):

```typescript
// ============================================================================
// Waiting List (prospective-parent inquiries)
// ============================================================================
export type WaitingListStatus =
  | 'new'
  | 'contacted'
  | 'waitlisted'
  | 'converted'
  | 'declined';

export interface WaitingListEntry {
  id: string;
  tutor_id: string;
  parent_name: string;
  parent_email: string | null;
  parent_phone: string | null;
  student_name: string | null;
  student_age: number | null;
  student_grade: string | null;
  subjects: string[];
  preferred_availability: string | null;
  message: string | null;
  referral_source: string | null;
  status: WaitingListStatus;
  tutor_notes: string | null;
  created_at: string;
  updated_at: string;
}

// Public form submission payload (sent to the submit-inquiry edge function).
export interface CreateWaitingListInput {
  tutor_id: string;
  parent_name: string;
  parent_email?: string | null;
  parent_phone?: string | null;
  student_name?: string | null;
  student_age?: number | null;
  student_grade?: string | null;
  subjects?: string[];
  preferred_availability?: string | null;
  message?: string | null;
  referral_source?: string | null;
}

// Tutor-side update (status and/or notes).
export interface UpdateWaitingListInput {
  status?: WaitingListStatus;
  tutor_notes?: string | null;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no new errors).

- [ ] **Step 3: Commit**

```bash
git add src/types/database.ts
git commit -m "feat(waiting-list): add WaitingListEntry types"
```

---

## Task 4: Edge function validation logic (TDD with Deno tests)

**Files:**
- Create: `supabase/functions/submit-inquiry/validate.ts`
- Test: `supabase/functions/submit-inquiry/validate.test.ts`

This is the riskiest logic (public input), so it gets real tests following the `_shared/lessonAmount.test.ts` precedent.

- [ ] **Step 1: Write the failing test**

Create `supabase/functions/submit-inquiry/validate.test.ts`:

```typescript
import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { validateInquiry } from './validate.ts';

Deno.test('rejects when honeypot is filled', () => {
  const r = validateInquiry({
    tutor_id: '11111111-1111-1111-1111-111111111111',
    parent_name: 'Jane',
    parent_email: 'jane@example.com',
    company: 'i-am-a-bot', // honeypot
  });
  assertEquals(r.ok, false);
});

Deno.test('rejects when parent_name is missing', () => {
  const r = validateInquiry({
    tutor_id: '11111111-1111-1111-1111-111111111111',
    parent_email: 'jane@example.com',
  });
  assertEquals(r.ok, false);
});

Deno.test('rejects when no contact method is provided', () => {
  const r = validateInquiry({
    tutor_id: '11111111-1111-1111-1111-111111111111',
    parent_name: 'Jane',
  });
  assertEquals(r.ok, false);
});

Deno.test('rejects when tutor_id is not a uuid', () => {
  const r = validateInquiry({
    tutor_id: 'not-a-uuid',
    parent_name: 'Jane',
    parent_email: 'jane@example.com',
  });
  assertEquals(r.ok, false);
});

Deno.test('accepts a valid submission and trims/sanitizes fields', () => {
  const r = validateInquiry({
    tutor_id: '11111111-1111-1111-1111-111111111111',
    parent_name: '  Jane  ',
    parent_email: 'jane@example.com',
    subjects: ['math', 'piano'],
    student_age: '7',
    message: 'x'.repeat(5000),
  });
  assertEquals(r.ok, true);
  if (r.ok) {
    assertEquals(r.value.parent_name, 'Jane');
    assertEquals(r.value.student_age, 7);
    assertEquals(r.value.subjects, ['math', 'piano']);
    // message clamped to 2000 chars
    assertEquals(r.value.message?.length, 2000);
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `deno test supabase/functions/submit-inquiry/validate.test.ts --allow-none`
Expected: FAIL — `Module not found "validate.ts"` (file does not exist yet).

- [ ] **Step 3: Implement `validate.ts`**

Create `supabase/functions/submit-inquiry/validate.ts`:

```typescript
// Pure validation + sanitization for the public inquiry form.
// No I/O — easy to unit-test under Deno.

export interface SanitizedInquiry {
  tutor_id: string;
  parent_name: string;
  parent_email: string | null;
  parent_phone: string | null;
  student_name: string | null;
  student_age: number | null;
  student_grade: string | null;
  subjects: string[];
  preferred_availability: string | null;
  message: string | null;
  referral_source: string | null;
}

export type ValidationResult =
  | { ok: true; value: SanitizedInquiry }
  | { ok: false; error: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function str(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

function intOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}

export function validateInquiry(input: Record<string, unknown>): ValidationResult {
  // Honeypot: a hidden "company" field. Bots fill it; humans never see it.
  const honeypot = input.company;
  if (typeof honeypot === 'string' && honeypot.trim() !== '') {
    return { ok: false, error: 'rejected' };
  }

  const tutor_id = typeof input.tutor_id === 'string' ? input.tutor_id.trim() : '';
  if (!UUID_RE.test(tutor_id)) {
    return { ok: false, error: 'invalid tutor' };
  }

  const parent_name = str(input.parent_name, 200);
  if (!parent_name) {
    return { ok: false, error: 'parent_name is required' };
  }

  const parent_email = str(input.parent_email, 320);
  const parent_phone = str(input.parent_phone, 50);
  if (!parent_email && !parent_phone) {
    return { ok: false, error: 'an email or phone is required' };
  }

  const rawSubjects = Array.isArray(input.subjects) ? input.subjects : [];
  const subjects = rawSubjects
    .filter((s): s is string => typeof s === 'string')
    .map((s) => s.trim().slice(0, 50))
    .filter(Boolean)
    .slice(0, 20);

  return {
    ok: true,
    value: {
      tutor_id,
      parent_name,
      parent_email,
      parent_phone,
      student_name: str(input.student_name, 200),
      student_age: intOrNull(input.student_age),
      student_grade: str(input.student_grade, 50),
      subjects,
      preferred_availability: str(input.preferred_availability, 500),
      message: str(input.message, 2000),
      referral_source: str(input.referral_source, 200),
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `deno test supabase/functions/submit-inquiry/validate.test.ts --allow-none`
Expected: PASS (5 tests pass).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/submit-inquiry/validate.ts supabase/functions/submit-inquiry/validate.test.ts
git commit -m "feat(waiting-list): add submit-inquiry validation with Deno tests"
```

---

## Task 5: Edge function handler

**Files:**
- Create: `supabase/functions/submit-inquiry/index.ts`
- Modify: `supabase/config.toml`

- [ ] **Step 1: Write the handler**

Create `supabase/functions/submit-inquiry/index.ts`:

```typescript
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
```

- [ ] **Step 2: Allow unauthenticated invocation in config.toml**

In `supabase/config.toml`, add this block (anywhere among top-level tables; group it with other `[functions.*]` entries if any exist):

```toml
[functions.submit-inquiry]
verify_jwt = false
```

- [ ] **Step 3: Typecheck the function compiles (Deno check)**

Run: `deno check supabase/functions/submit-inquiry/index.ts`
Expected: no type errors. (If `deno` resolves remote imports slowly the first time, allow it to complete.)

- [ ] **Step 4: Deploy (only when targeting a live project)**

Run (when ready to deploy): `npx supabase functions deploy submit-inquiry --no-verify-jwt`
Expected: deploy succeeds. (Skip in a purely local run; the `verify_jwt = false` in config.toml covers `supabase functions serve` locally.)

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/submit-inquiry/index.ts supabase/config.toml
git commit -m "feat(waiting-list): add submit-inquiry edge function (public intake)"
```

---

## Task 6: Hooks (`useWaitingList`)

**Files:**
- Create: `src/hooks/useWaitingList.ts`

Shapes mirror `src/hooks/useLessonRequests.ts` exactly (query hook returns `ListQueryState`; mutation hooks return `{ mutate-style fn, loading, error }`).

- [ ] **Step 1: Write the hooks file**

Create `src/hooks/useWaitingList.ts`:

```typescript
/**
 * useWaitingList Hook
 * Data hooks for the tutor waiting list (prospective-parent inquiries),
 * plus a public submit helper that calls the submit-inquiry edge function.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  WaitingListEntry,
  WaitingListStatus,
  CreateWaitingListInput,
  UpdateWaitingListInput,
  ListQueryState,
} from '../types/database';

export interface WaitingListFilterOptions {
  status?: WaitingListStatus;
  statuses?: WaitingListStatus[];
}

/**
 * Fetch waiting-list entries for the current tutor (RLS scopes to own rows).
 */
export function useWaitingList(
  options: WaitingListFilterOptions = {}
): ListQueryState<WaitingListEntry> {
  const [data, setData] = useState<WaitingListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { status } = options;
  // Serialize the array so the callback dependency is stable.
  const statusesKey = options.statuses ? options.statuses.join(',') : '';

  const fetchEntries = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('waiting_list')
        .select('*')
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      } else if (statusesKey) {
        query = query.in('status', statusesKey.split(','));
      }

      const { data: rows, error: fetchError } = await query;
      if (fetchError) {
        throw new Error(fetchError.message);
      }
      setData((rows as WaitingListEntry[]) || []);
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Failed to fetch waiting list');
      setError(e);
      console.error('useWaitingList error:', e);
    } finally {
      setLoading(false);
    }
  }, [status, statusesKey]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  return { data, loading, error, refetch: fetchEntries };
}

/**
 * Count of 'new' (unreviewed) inquiries — for the tab badge.
 */
export function useNewInquiriesCount(): {
  count: number;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
} {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCount = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { count: c, error: countError } = await supabase
        .from('waiting_list')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'new');
      if (countError) {
        throw new Error(countError.message);
      }
      setCount(c || 0);
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Failed to count inquiries');
      setError(e);
      console.error('useNewInquiriesCount error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  return { count, loading, error, refetch: fetchCount };
}

/**
 * Update an entry's status and/or notes (tutor only; RLS-enforced).
 */
export function useUpdateWaitingListEntry(): {
  updateEntry: (
    id: string,
    input: UpdateWaitingListInput
  ) => Promise<WaitingListEntry | null>;
  loading: boolean;
  error: Error | null;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const updateEntry = useCallback(
    async (id: string, input: UpdateWaitingListInput): Promise<WaitingListEntry | null> => {
      try {
        setLoading(true);
        setError(null);
        const { data, error: updateError } = await supabase
          .from('waiting_list')
          .update(input)
          .eq('id', id)
          .select()
          .single();
        if (updateError) {
          throw new Error(updateError.message);
        }
        return data as WaitingListEntry;
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Failed to update inquiry');
        setError(e);
        console.error('useUpdateWaitingListEntry error:', e);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { updateEntry, loading, error };
}

/**
 * Delete (archive) an entry (tutor only; RLS-enforced).
 */
export function useDeleteWaitingListEntry(): {
  deleteEntry: (id: string) => Promise<boolean>;
  loading: boolean;
  error: Error | null;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const deleteEntry = useCallback(async (id: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      const { error: deleteError } = await supabase
        .from('waiting_list')
        .delete()
        .eq('id', id);
      if (deleteError) {
        throw new Error(deleteError.message);
      }
      return true;
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Failed to delete inquiry');
      setError(e);
      console.error('useDeleteWaitingListEntry error:', e);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { deleteEntry, loading, error };
}

/**
 * Public submit — called from the unauthenticated inquiry form.
 * Invokes the submit-inquiry edge function (anon-callable, verify_jwt=false).
 */
export async function submitInquiry(
  // `company` is the honeypot field — not persisted, only inspected by the edge function.
  input: CreateWaitingListInput & { company?: string }
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke('submit-inquiry', {
    body: input,
  });
  if (error) {
    return { success: false, error: error.message };
  }
  if (data && typeof data === 'object' && 'error' in data) {
    return { success: false, error: String((data as { error: unknown }).error) };
  }
  return { success: true };
}

/**
 * Status display info for badges/cards.
 */
export function getWaitingListStatusInfo(status: WaitingListStatus): {
  label: string;
  color: string;
  bgColor: string;
  icon: string;
} {
  switch (status) {
    case 'new':
      return { label: 'New', color: '#3D9CA8', bgColor: '#E8F5F7', icon: 'sparkles-outline' };
    case 'contacted':
      return { label: 'Contacted', color: '#FFC107', bgColor: '#FFF8E1', icon: 'call-outline' };
    case 'waitlisted':
      return { label: 'Waitlisted', color: '#FF9800', bgColor: '#FFF3E0', icon: 'hourglass-outline' };
    case 'converted':
      return { label: 'Converted', color: '#7CB342', bgColor: '#F1F8E9', icon: 'checkmark-circle-outline' };
    case 'declined':
      return { label: 'Declined', color: '#E53935', bgColor: '#FFEBEE', icon: 'close-circle-outline' };
    default:
      return { label: 'Unknown', color: '#9E9E9E', bgColor: '#F5F5F5', icon: 'help-circle-outline' };
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no new errors).

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useWaitingList.ts
git commit -m "feat(waiting-list): add useWaitingList hooks and submit helper"
```

---

## Task 7: `WaitingListCard` component

**Files:**
- Create: `src/components/waiting-list/WaitingListCard.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/waiting-list/WaitingListCard.tsx`:

```typescript
import React from 'react';
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WaitingListEntry, WaitingListStatus } from '../../types/database';
import { getWaitingListStatusInfo } from '../../hooks/useWaitingList';
import { colors, spacing, typography, borderRadius, shadows } from '../../theme';

type IoniconsName = keyof typeof Ionicons.glyphMap;

interface WaitingListCardProps {
  entry: WaitingListEntry;
  onAdvance: (entry: WaitingListEntry, next: WaitingListStatus) => void;
  onEditNotes: (entry: WaitingListEntry) => void;
  onDelete: (entry: WaitingListEntry) => void;
}

// Linear primary path; converted/declined are terminal.
function nextStatus(status: WaitingListStatus): WaitingListStatus | null {
  switch (status) {
    case 'new':
      return 'contacted';
    case 'contacted':
      return 'waitlisted';
    case 'waitlisted':
      return 'converted';
    default:
      return null;
  }
}

export function WaitingListCard({
  entry,
  onAdvance,
  onEditNotes,
  onDelete,
}: WaitingListCardProps) {
  const statusInfo = getWaitingListStatusInfo(entry.status);
  const next = nextStatus(entry.status);
  const isClosed = entry.status === 'converted' || entry.status === 'declined';

  const call = () => {
    if (entry.parent_phone) Linking.openURL(`tel:${entry.parent_phone}`);
  };
  const email = () => {
    if (entry.parent_email) Linking.openURL(`mailto:${entry.parent_email}`);
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.name}>{entry.parent_name}</Text>
        <View style={[styles.badge, { backgroundColor: statusInfo.bgColor }]}>
          <Ionicons
            name={statusInfo.icon as IoniconsName}
            size={14}
            color={statusInfo.color}
          />
          <Text style={[styles.badgeText, { color: statusInfo.color }]}>
            {statusInfo.label}
          </Text>
        </View>
      </View>

      {entry.student_name ? (
        <Text style={styles.detail}>
          Student: {entry.student_name}
          {entry.student_grade ? ` · ${entry.student_grade}` : ''}
          {entry.student_age != null ? ` · age ${entry.student_age}` : ''}
        </Text>
      ) : null}

      {entry.subjects?.length ? (
        <Text style={styles.detail}>Subjects: {entry.subjects.join(', ')}</Text>
      ) : null}

      {entry.preferred_availability ? (
        <Text style={styles.detail}>Availability: {entry.preferred_availability}</Text>
      ) : null}

      {entry.message ? <Text style={styles.message}>“{entry.message}”</Text> : null}

      {entry.referral_source ? (
        <Text style={styles.detailMuted}>Heard via: {entry.referral_source}</Text>
      ) : null}

      {entry.tutor_notes ? (
        <Text style={styles.notes}>Notes: {entry.tutor_notes}</Text>
      ) : null}

      <View style={styles.actions}>
        {entry.parent_phone ? (
          <Pressable style={styles.actionBtn} onPress={call}>
            <Ionicons name="call-outline" size={18} color={colors.primary.main} />
            <Text style={styles.actionText}>Call</Text>
          </Pressable>
        ) : null}
        {entry.parent_email ? (
          <Pressable style={styles.actionBtn} onPress={email}>
            <Ionicons name="mail-outline" size={18} color={colors.primary.main} />
            <Text style={styles.actionText}>Email</Text>
          </Pressable>
        ) : null}
        <Pressable style={styles.actionBtn} onPress={() => onEditNotes(entry)}>
          <Ionicons name="create-outline" size={18} color={colors.primary.main} />
          <Text style={styles.actionText}>Notes</Text>
        </Pressable>
      </View>

      <View style={styles.statusRow}>
        {next ? (
          <Pressable
            style={[styles.statusBtn, styles.advanceBtn]}
            onPress={() => onAdvance(entry, next)}
          >
            <Text style={styles.advanceText}>
              Mark {getWaitingListStatusInfo(next).label}
            </Text>
          </Pressable>
        ) : null}
        {!isClosed ? (
          <Pressable
            style={[styles.statusBtn, styles.declineBtn]}
            onPress={() => onAdvance(entry, 'declined')}
          >
            <Text style={styles.declineText}>Decline</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.statusBtn, styles.deleteBtn]}
            onPress={() => onDelete(entry)}
          >
            <Ionicons name="trash-outline" size={16} color="#E53935" />
            <Text style={styles.declineText}>Remove</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  name: { ...typography.subtitle, color: colors.neutral.text, flexShrink: 1 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  badgeText: { fontSize: 12, fontWeight: '600' },
  detail: { ...typography.body, color: colors.neutral.text, marginTop: 2 },
  detailMuted: { ...typography.caption, color: colors.neutral.textSecondary, marginTop: 2 },
  message: {
    ...typography.body,
    color: colors.neutral.textSecondary,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  notes: { ...typography.caption, color: colors.neutral.text, marginTop: spacing.xs },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
    flexWrap: 'wrap',
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { ...typography.caption, color: colors.primary.main, fontWeight: '600' },
  statusRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  statusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
  },
  advanceBtn: { backgroundColor: colors.primary.main, flex: 1 },
  advanceText: { color: colors.neutral.white, fontWeight: '600', fontSize: 14 },
  declineBtn: { backgroundColor: '#FFEBEE' },
  deleteBtn: { backgroundColor: '#FFEBEE' },
  declineText: { color: '#E53935', fontWeight: '600', fontSize: 14 },
});
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS. If any of `typography.subtitle`, `shadows.sm`, `borderRadius.full`, `colors.neutral.textSecondary` do not exist in `src/theme`, open `src/theme/index.ts`, find the nearest existing token (e.g. `typography.body`, `shadows.small`, `borderRadius.lg`, `colors.neutral.text`) and substitute it. Re-run typecheck until PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/waiting-list/WaitingListCard.tsx
git commit -m "feat(waiting-list): add WaitingListCard component"
```

---

## Task 8: Tutor management screen

**Files:**
- Create: `app/waiting-list.tsx`

Pattern follows `app/requests.tsx`: `SafeAreaView` + `Stack.Screen` options, status tabs, `ScrollView` + `RefreshControl`, `EmptyState`, a notes `Modal`, and a top "Share inquiry link" button (this is where the per-tutor link is surfaced, per the spec).

- [ ] **Step 1: Write the screen**

Create `app/waiting-list.tsx`:

```typescript
/**
 * Waiting List Screen (tutor)
 * Manage inquiries from prospective parents. Surfaces the public share link.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '../src/contexts/AuthContext';
import {
  useWaitingList,
  useUpdateWaitingListEntry,
  useDeleteWaitingListEntry,
} from '../src/hooks/useWaitingList';
import { WaitingListCard } from '../src/components/waiting-list/WaitingListCard';
import { WaitingListEntry, WaitingListStatus } from '../src/types/database';
import { colors, spacing, typography, borderRadius } from '../src/theme';

type TabKey = 'new' | 'active' | 'closed';

const TAB_STATUSES: Record<TabKey, WaitingListStatus[]> = {
  new: ['new'],
  active: ['contacted', 'waitlisted'],
  closed: ['converted', 'declined'],
};

// Public app host used to build the share link. Falls back to the known prod host.
const APP_HOST =
  process.env.EXPO_PUBLIC_APP_URL || 'https://app.lovetolearn.site';

export default function WaitingListScreen() {
  const { parent } = useAuthContext();
  const [tab, setTab] = useState<TabKey>('new');
  const { data, loading, error, refetch } = useWaitingList({
    statuses: TAB_STATUSES[tab],
  });
  const { updateEntry } = useUpdateWaitingListEntry();
  const { deleteEntry } = useDeleteWaitingListEntry();

  const [notesEntry, setNotesEntry] = useState<WaitingListEntry | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const shareUrl = parent?.id ? `${APP_HOST}/inquire/${parent.id}` : '';

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const copyLink = useCallback(async () => {
    if (!shareUrl) return;
    await Clipboard.setStringAsync(shareUrl);
    if (Platform.OS === 'web') {
      // Alert on web is unreliable; rely on the toast-free confirmation.
      console.log('Inquiry link copied');
    }
    Alert.alert('Copied', 'Your inquiry link was copied to the clipboard.');
  }, [shareUrl]);

  const advance = useCallback(
    async (entry: WaitingListEntry, next: WaitingListStatus) => {
      const ok = await updateEntry(entry.id, { status: next });
      if (ok) refetch();
    },
    [updateEntry, refetch]
  );

  const openNotes = useCallback((entry: WaitingListEntry) => {
    setNotesEntry(entry);
    setNotesDraft(entry.tutor_notes || '');
  }, []);

  const saveNotes = useCallback(async () => {
    if (!notesEntry) return;
    const ok = await updateEntry(notesEntry.id, { tutor_notes: notesDraft.trim() || null });
    setNotesEntry(null);
    if (ok) refetch();
  }, [notesEntry, notesDraft, updateEntry, refetch]);

  const remove = useCallback(
    (entry: WaitingListEntry) => {
      Alert.alert('Remove inquiry', `Remove ${entry.parent_name} from the list?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const ok = await deleteEntry(entry.id);
            if (ok) refetch();
          },
        },
      ]);
    },
    [deleteEntry, refetch]
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen options={{ headerShown: true, headerTitle: 'Waiting List' }} />

      {/* Share link */}
      <View style={styles.shareCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.shareTitle}>Your inquiry link</Text>
          <Text style={styles.shareUrl} numberOfLines={1}>
            {shareUrl || '—'}
          </Text>
        </View>
        <Pressable style={styles.copyBtn} onPress={copyLink} disabled={!shareUrl}>
          <Ionicons name="copy-outline" size={18} color={colors.neutral.white} />
          <Text style={styles.copyText}>Copy</Text>
        </Pressable>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(Object.keys(TAB_STATUSES) as TabKey[]).map((key) => (
          <Pressable
            key={key}
            style={[styles.tab, tab === key && styles.tabActive]}
            onPress={() => setTab(key)}
          >
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>
              {key === 'new' ? 'New' : key === 'active' ? 'Active' : 'Closed'}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading && !refreshing ? (
          <ActivityIndicator
            style={{ marginTop: spacing.xl }}
            color={colors.primary.main}
          />
        ) : error ? (
          <View style={styles.empty}>
            <Ionicons name="alert-circle-outline" size={48} color="#E53935" />
            <Text style={styles.emptyText}>{error.message}</Text>
          </View>
        ) : data.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="hourglass-outline" size={48} color={colors.neutral.textSecondary} />
            <Text style={styles.emptyTitle}>No inquiries here</Text>
            <Text style={styles.emptyText}>
              Share your inquiry link so new parents can reach you.
            </Text>
          </View>
        ) : (
          data.map((entry) => (
            <WaitingListCard
              key={entry.id}
              entry={entry}
              onAdvance={advance}
              onEditNotes={openNotes}
              onDelete={remove}
            />
          ))
        )}
      </ScrollView>

      {/* Notes modal */}
      <Modal visible={!!notesEntry} transparent animationType="fade" onRequestClose={() => setNotesEntry(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Notes</Text>
            <TextInput
              style={styles.notesInput}
              value={notesDraft}
              onChangeText={setNotesDraft}
              placeholder="Private notes about this inquiry"
              multiline
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={() => setNotesEntry(null)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalSave} onPress={saveNotes}>
                <Text style={styles.modalSaveText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral.background },
  shareCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.neutral.white,
    margin: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
  },
  shareTitle: { ...typography.caption, color: colors.neutral.textSecondary },
  shareUrl: { ...typography.body, color: colors.neutral.text, marginTop: 2 },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary.main,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
  },
  copyText: { color: colors.neutral.white, fontWeight: '600' },
  tabs: { flexDirection: 'row', paddingHorizontal: spacing.md, gap: spacing.sm },
  tab: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral.white,
  },
  tabActive: { backgroundColor: colors.primary.main },
  tabText: { ...typography.body, color: colors.neutral.text },
  tabTextActive: { color: colors.neutral.white, fontWeight: '600' },
  list: { padding: spacing.md, flexGrow: 1 },
  empty: { alignItems: 'center', marginTop: spacing.xl, gap: spacing.sm },
  emptyTitle: { ...typography.subtitle, color: colors.neutral.text },
  emptyText: {
    ...typography.body,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: { backgroundColor: colors.neutral.white, borderRadius: borderRadius.lg, padding: spacing.lg },
  modalTitle: { ...typography.subtitle, color: colors.neutral.text, marginBottom: spacing.md },
  notesInput: {
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    minHeight: 100,
    textAlignVertical: 'top',
    color: colors.neutral.text,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md, marginTop: spacing.md },
  modalCancel: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  modalCancelText: { color: colors.neutral.textSecondary, fontWeight: '600' },
  modalSave: {
    backgroundColor: colors.primary.main,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
  },
  modalSaveText: { color: colors.neutral.white, fontWeight: '600' },
});
```

- [ ] **Step 2: Verify `expo-clipboard` is installed**

Run: `node -e "require.resolve('expo-clipboard')"`
Expected: prints a resolved path. If it errors, run `npx expo install expo-clipboard` and commit the resulting `package.json`/lockfile change with this task.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS. Fix any theme-token mismatches as in Task 7 Step 2 (substitute nearest existing token from `src/theme/index.ts`).

- [ ] **Step 4: Commit**

```bash
git add app/waiting-list.tsx package.json
git commit -m "feat(waiting-list): add tutor management screen with share link"
```

---

## Task 9: Public inquiry form

**Files:**
- Create: `app/inquire/[tutorId].tsx`

- [ ] **Step 1: Write the form screen**

Create `app/inquire/[tutorId].tsx`:

```typescript
/**
 * Public Inquiry Form (unauthenticated)
 * Prospective parents submit here via a tutor's share link: /inquire/<tutorId>.
 * Posts to the submit-inquiry edge function. No session required.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { submitInquiry } from '../../src/hooks/useWaitingList';
import { colors, spacing, typography, borderRadius } from '../../src/theme';

const SUBJECT_OPTIONS = ['Piano', 'Math', 'Reading', 'Speech', 'English'];

export default function InquireScreen() {
  const { tutorId } = useLocalSearchParams<{ tutorId: string }>();

  const [parentName, setParentName] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentAge, setStudentAge] = useState('');
  const [studentGrade, setStudentGrade] = useState('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [availability, setAvailability] = useState('');
  const [message, setMessage] = useState('');
  const [referral, setReferral] = useState('');
  // Honeypot — hidden from humans; bots tend to fill it.
  const [company, setCompany] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const toggleSubject = (s: string) =>
    setSubjects((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const canSubmit =
    parentName.trim().length > 0 &&
    (parentEmail.trim().length > 0 || parentPhone.trim().length > 0) &&
    !submitting;

  const onSubmit = async () => {
    setErrorMsg(null);
    if (!tutorId) {
      setErrorMsg('This link is invalid.');
      return;
    }
    setSubmitting(true);
    const res = await submitInquiry({
      tutor_id: String(tutorId),
      parent_name: parentName,
      parent_email: parentEmail || null,
      parent_phone: parentPhone || null,
      student_name: studentName || null,
      student_age: studentAge ? parseInt(studentAge, 10) : null,
      student_grade: studentGrade || null,
      subjects,
      preferred_availability: availability || null,
      message: message || null,
      referral_source: referral || null,
      // Honeypot travels in the body; the edge function validates it.
      ...(company ? { company } : {}),
    });
    setSubmitting(false);
    if (res.success) {
      setDone(true);
    } else {
      setErrorMsg("Sorry, we couldn't submit your inquiry. Please try again.");
    }
  };

  if (done) {
    return (
      <View style={styles.centered}>
        <Ionicons name="checkmark-circle" size={64} color={colors.secondary.main} />
        <Text style={styles.thanksTitle}>Thank you!</Text>
        <Text style={styles.thanksBody}>
          Your inquiry has been sent. The tutor will reach out to you soon.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Tutoring Inquiry</Text>
      <Text style={styles.subtitle}>
        Tell us a little about your needs and we’ll be in touch.
      </Text>

      <Field label="Your name *">
        <TextInput style={styles.input} value={parentName} onChangeText={setParentName} placeholder="Parent/guardian name" />
      </Field>
      <Field label="Email">
        <TextInput style={styles.input} value={parentEmail} onChangeText={setParentEmail} placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" />
      </Field>
      <Field label="Phone">
        <TextInput style={styles.input} value={parentPhone} onChangeText={setParentPhone} placeholder="(555) 123-4567" keyboardType="phone-pad" />
      </Field>
      <Text style={styles.hint}>Provide at least an email or a phone number.</Text>

      <Field label="Student name">
        <TextInput style={styles.input} value={studentName} onChangeText={setStudentName} placeholder="Child's name" />
      </Field>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Field label="Age">
            <TextInput style={styles.input} value={studentAge} onChangeText={setStudentAge} placeholder="Age" keyboardType="number-pad" />
          </Field>
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Grade">
            <TextInput style={styles.input} value={studentGrade} onChangeText={setStudentGrade} placeholder="Grade" />
          </Field>
        </View>
      </View>

      <Field label="Subjects of interest">
        <View style={styles.chips}>
          {SUBJECT_OPTIONS.map((s) => {
            const active = subjects.includes(s);
            return (
              <Pressable key={s} style={[styles.chip, active && styles.chipActive]} onPress={() => toggleSubject(s)}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{s}</Text>
              </Pressable>
            );
          })}
        </View>
      </Field>

      <Field label="Preferred days/times">
        <TextInput style={styles.input} value={availability} onChangeText={setAvailability} placeholder="e.g. weekday afternoons" />
      </Field>
      <Field label="Tell us about your needs">
        <TextInput style={[styles.input, styles.multiline]} value={message} onChangeText={setMessage} placeholder="Goals, level, anything else" multiline />
      </Field>
      <Field label="How did you hear about us?">
        <TextInput style={styles.input} value={referral} onChangeText={setReferral} placeholder="Referral, search, social…" />
      </Field>

      {/* Honeypot field: visually hidden, off-screen. Real users won't fill it. */}
      <TextInput
        value={company}
        onChangeText={setCompany}
        style={styles.honeypot}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
      />

      {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

      <Pressable style={[styles.submit, !canSubmit && styles.submitDisabled]} onPress={onSubmit} disabled={!canSubmit}>
        {submitting ? (
          <ActivityIndicator color={colors.neutral.white} />
        ) : (
          <Text style={styles.submitText}>Send inquiry</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl, maxWidth: 640, width: '100%', alignSelf: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md, backgroundColor: colors.neutral.background },
  title: { ...typography.h2, color: colors.neutral.text },
  subtitle: { ...typography.body, color: colors.neutral.textSecondary, marginBottom: spacing.lg },
  field: { marginBottom: spacing.md },
  label: { ...typography.caption, color: colors.neutral.textSecondary, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    backgroundColor: colors.neutral.white,
    color: colors.neutral.text,
  },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  hint: { ...typography.caption, color: colors.neutral.textSecondary, marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    backgroundColor: colors.neutral.white,
  },
  chipActive: { backgroundColor: colors.primary.main, borderColor: colors.primary.main },
  chipText: { color: colors.neutral.text },
  chipTextActive: { color: colors.neutral.white, fontWeight: '600' },
  honeypot: { position: 'absolute', left: -9999, width: 1, height: 1, opacity: 0 },
  error: { color: '#E53935', marginBottom: spacing.md },
  submit: {
    backgroundColor: colors.primary.main,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: colors.neutral.white, fontWeight: '700', fontSize: 16 },
});
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS. Fix theme-token mismatches as before (e.g. if `typography.h2` doesn't exist, use the nearest heading token in `src/theme/index.ts`).

- [ ] **Step 3: Commit**

```bash
git add app/inquire/[tutorId].tsx
git commit -m "feat(waiting-list): add public inquiry form screen"
```

---

## Task 10: Wire navigation & auth exemption

**Files:**
- Modify: `app/_layout.tsx`
- Modify: `app/(tabs)/more.tsx`

- [ ] **Step 1: Exempt `/inquire` from the unauthenticated redirect**

In `app/_layout.tsx`, inside the `useEffect` that handles redirects, find this line:

```typescript
    const inLanding = segments[0] === 'landing';
```

Add immediately after it:

```typescript
    const inInquire = segments[0] === 'inquire';
```

Then find this block:

```typescript
    if (!isAuthenticated && !inAuthGroup && !inLanding) {
      // Redirect to landing page if not authenticated and not already on auth/landing screens
      router.replace('/landing');
    } else if (isAuthenticated && inAuthGroup && !inOnboarding) {
```

Change the first condition to also allow `/inquire`:

```typescript
    if (!isAuthenticated && !inAuthGroup && !inLanding && !inInquire) {
      // Redirect to landing page if not authenticated and not already on auth/landing/inquire screens
      router.replace('/landing');
    } else if (isAuthenticated && inAuthGroup && !inOnboarding) {
```

- [ ] **Step 2: Register the new Stack screens**

In `app/_layout.tsx`, inside the `<Stack ...>` element, add these two screens (place near the other `Stack.Screen` entries, e.g. right after the `requests` screen):

```tsx
      <Stack.Screen
        name="waiting-list"
        options={{
          headerShown: true,
          headerTitle: 'Waiting List',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="inquire/[tutorId]"
        options={{
          headerShown: true,
          headerTitle: 'Tutoring Inquiry',
        }}
      />
```

- [ ] **Step 3: Add the More-tab menu item**

In `app/(tabs)/more.tsx`, in the `menuItems` array, add this entry immediately after the `requests` item:

```typescript
  {
    key: 'waiting-list',
    label: 'Waiting List',
    icon: 'hourglass',
    href: '/waiting-list',
    description: 'Track inquiries from new parents',
    tutorOnly: true,
  },
```

- [ ] **Step 4: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: both PASS (no new errors/warnings introduced by these files).

- [ ] **Step 5: Commit**

```bash
git add app/_layout.tsx app/\(tabs\)/more.tsx
git commit -m "feat(waiting-list): wire navigation and public route auth exemption"
```

---

## Task 11: End-to-end manual verification

**Files:** none (verification only)

- [ ] **Step 1: Start the app on web**

Run: `npm run web`
Expected: app builds and loads with no red-box errors in the console.

- [ ] **Step 2: Verify the tutor entry point and share link**

As a logged-in **tutor**: open More → **Waiting List**. Confirm the screen renders with the three tabs (New / Active / Closed), an empty state, and a "Your inquiry link" card showing `…/inquire/<your-tutor-id>`. Click **Copy** and confirm the copied URL.

- [ ] **Step 3: Submit a public inquiry**

In a private/incognito window (logged out), open the copied `…/inquire/<tutorId>` URL. Confirm you are NOT redirected to `/landing`. Fill the form (name + email, pick subjects, message) and submit. Confirm the "Thank you!" success screen appears. Try submitting with only a name (no email/phone) — the Send button stays disabled.

- [ ] **Step 4: Verify it lands in the tutor's list and notifies**

Back in the tutor window, pull-to-refresh (or reopen) the Waiting List **New** tab. Confirm the new inquiry card appears with the submitted details. Open the tutor Notifications screen and confirm a "New Waiting List Inquiry" notification is present.

- [ ] **Step 5: Exercise the status lifecycle**

On the inquiry card: tap **Mark Contacted** → it moves to the **Active** tab. Tap **Mark Waitlisted**, then **Mark Converted** → it moves to the **Closed** tab. Add notes via the **Notes** action and confirm they persist after refresh. On a closed entry, use **Remove** and confirm it disappears.

- [ ] **Step 6: Verify multi-tutor isolation (if a second tutor is available)**

Log in as a different tutor and confirm their Waiting List does NOT show the first tutor's inquiry. (If only one tutor account exists, instead confirm via SQL that `SELECT count(*) FROM waiting_list` rows all carry the correct `tutor_id`.)

- [ ] **Step 7: Final full typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: both PASS.

---

## Done criteria

- Prospective parents can submit an inquiry at `/inquire/<tutorId>` while logged out.
- Submissions are validated/sanitized server-side, spam-honeypot-protected, and inserted only for a real tutor via the service role (table never exposed to anon).
- Tutors see their own inquiries on `/waiting-list`, grouped New/Active/Closed, and can advance status, edit notes, and remove entries.
- A notification is created for the tutor on each new inquiry.
- RLS isolates inquiries per tutor.
- `npm run typecheck` and `npm run lint` pass; the edge-function validation Deno tests pass.
```
