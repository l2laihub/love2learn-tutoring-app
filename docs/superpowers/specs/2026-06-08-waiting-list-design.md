# Waiting List — Design

**Date:** 2026-06-08
**Status:** Approved, ready for implementation planning

## Summary

A waiting list lets a tutor track inquiries from **new (prospective) parents** who are
not yet customers. Inquiries arrive two ways:

1. A **public intake form**, reached through a per-tutor share link, that prospective
   parents fill out themselves.
2. (Implicitly) the same table can be written to by the tutor later if desired, but v1
   ships only the public form as the intake path.

Each inquiry is tracked through a simple status lifecycle. "Converting" a family is a
status label only — it does **not** auto-create a parent/student account. The tutor
onboards the family through the existing normal flow separately.

This is a new concept in the codebase: today every `parents` row is a registered user,
and there is no "lead/prospect" entity. `lesson_requests` is related but different — it
handles reschedule/drop-in requests from *existing* parents, not new-parent intake.

## Goals

- Give tutors a private, structured place to track new-parent inquiries.
- Let prospective parents submit inquiries without creating an account.
- Route each public submission to the correct tutor in this multi-tutor app.
- Keep the `waiting_list` table private — never exposed to the anonymous role.

## Non-Goals (YAGNI guardrails)

- No automatic parent/student account creation on "convert" — status label only.
- One student per inquiry, not a list of students.
- No in-app email/SMS reply composer — "contact" opens the device mail/phone app.
- No custom slug/handle — the public link uses the raw `tutorId`.
- No public directory of tutors — routing is via share link only.

## Decisions (from brainstorming)

| Question | Decision |
|---|---|
| Intake source | Public form (prospective parents submit themselves) |
| Tutor routing | Per-tutor share link: `/inquire/<tutorId>` |
| Workflow | Status tracking only (no auto account creation) |
| Form fields | Parent contact + student details + subject & availability + free-text |
| Public write mechanism | **Edge Function** (Option A) — table not exposed to `anon` |

## Architecture

### 1. Data model

New migration adds a `waiting_list` table (one row per inquiry):

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK default gen | |
| `tutor_id` | uuid NOT NULL → `parents.id` | from the share link; the owning tutor |
| `parent_name` | text NOT NULL | contact |
| `parent_email` | text | contact |
| `parent_phone` | text | contact |
| `student_name` | text | student details |
| `student_age` | int | nullable |
| `student_grade` | text | nullable |
| `subjects` | text[] | subject(s) of interest |
| `preferred_availability` | text | rough days/times, free text |
| `message` | text | "tell us about your needs" |
| `referral_source` | text | "how did you hear about us" |
| `status` | text NOT NULL default `'new'` | CHECK in (`new`,`contacted`,`waitlisted`,`converted`,`declined`) |
| `tutor_notes` | text | private notes the tutor adds |
| `created_at` | timestamptz default now() | |
| `updated_at` | timestamptz default now() | maintained by existing `updated_at` trigger |

- At least one of `parent_email` / `parent_phone` should be present — enforced with a
  CHECK constraint so the tutor always has a way to follow up.
- `status` enforced with a CHECK constraint, matching how `lesson_requests` does statuses.
- Index on `(tutor_id, status)` for the filtered list queries.

### 2. Public intake path

- **Route:** `app/inquire/[tutorId].tsx` — a web-facing form.
  - Must be exempt from the auth redirect in `app/_layout.tsx`. Add `/inquire` to the
    set of routes allowed for unauthenticated users (alongside `/landing`), so a logged-out
    prospective parent can reach it.
  - Form collects: parent name/email/phone, student name/age/grade, subjects,
    preferred availability, free-text message, referral source.
  - Includes a hidden **honeypot** field (bots fill it; humans don't).
  - On submit, POSTs to the edge function; shows a success confirmation state and an
    error state. Does not require or create a session.

- **Edge function:** `supabase/functions/submit-inquiry/`
  - Accepts the form POST (JSON).
  - Verifies `tutorId` is a real `parents` row with `role = 'tutor'`. Rejects otherwise.
  - Validates required fields (parent_name + at least one contact method) and sanitizes
    input lengths.
  - Spam mitigation: rejects if the honeypot field is non-empty; applies a simple
    rate check (e.g. per-IP / minimum-time-between-submissions). Keep it lightweight.
  - Inserts the row using the **service role** (table is never exposed to `anon`).
  - Returns a JSON success/failure. Does not leak whether an email already exists, etc.

- **Share link:** surfaced in tutor settings (More tab / business settings area) as a
  copyable URL: `https://<app-host>/inquire/<tutorId>`.

### 3. Tutor-facing screen

- **Route:** `app/waiting-list.tsx`, reached from the **More** tab.
  - New `tutorOnly` menu item in `app/(tabs)/more.tsx`:
    `{ key: 'waiting-list', label: 'Waiting List', icon: 'hourglass', href: '/waiting-list', tutorOnly: true }`,
    placed near the `requests` item for logical grouping.
- **UI:** follows the `app/requests.tsx` pattern:
  - Status tabs grouping: **New** (`new`), **Active** (`contacted` + `waitlisted`),
    **Closed** (`converted` + `declined`).
  - Card list rendered with a new `WaitingListCard` component; `EmptyState` for empty
    tabs; `ScrollView` + `RefreshControl`.
  - The New tab badges a count of `new` inquiries.
- **Card actions:**
  - Advance status: New → Contacted → Waitlisted → Converted / Declined.
  - Edit `tutor_notes`.
  - Tap-to-call (`tel:`) and tap-to-email (`mailto:`) using the parent's contact info.

### 4. Hooks (match existing shapes)

- `useWaitingList({ status? })` → `ListQueryState<WaitingListEntry>`
  (`{ data, loading, error, refetch }`), filtered query modeled on `useLessonRequests`.
- `useUpdateWaitingListEntry` → `{ mutate, loading, error }` for status + notes updates.
- `useDeleteWaitingListEntry` → `{ mutate, loading, error }` for archive/remove.
- Add a `WaitingListEntry` type (and `WaitingListStatus` union) to `src/types/database.ts`.

### 5. RLS & notifications

- **RLS** (new migration, mirroring `multi_tutor_rls` patterns):
  - SELECT / UPDATE / DELETE allowed only where `tutor_id = get_current_tutor_id()`
    and `is_tutor()`.
  - No `anon` policies — the public path goes exclusively through the edge function's
    service-role insert.
- **Notification trigger:** on INSERT into `waiting_list`, create a `notification` for
  the owning tutor ("New inquiry from {parent_name}"), following the existing
  lesson-request notification trigger pattern.

### 6. Error handling

- Public form: clear inline validation; on edge-function failure show a retryable error
  state without losing entered data; honeypot/rate-limit rejections return a generic
  success-looking or neutral response so bots get no signal (final wording TBD during
  implementation, but must not reveal the spam check).
- Tutor screen: standard hook `error` surfaced with the existing error/empty patterns;
  status updates are optimistic-safe via `refetch`.

## Testing

- **Edge function:**
  - Valid submission inserts a row scoped to the correct tutor.
  - Nonexistent / non-tutor `tutorId` is rejected.
  - Non-empty honeypot is rejected; rate-limit blocks rapid repeats.
  - Missing required fields (no name, or no contact method) rejected.
- **RLS:** tutor A cannot SELECT/UPDATE/DELETE tutor B's entries.
- **Hooks / status transitions:** seeded entry moves new → contacted → waitlisted →
  converted/declined; list filtering by tab returns the right rows.
- **Navigation:** waiting-list menu item visible only to tutors; `/inquire/[tutorId]`
  reachable while logged out.

## Open items for implementation planning

- Exact rate-limit strategy in the edge function (in-memory vs. a small table) — keep
  minimal for v1.
- App host/base URL used to build the share link (env-driven).
