# Per-Student Custom Rates — Design

**Date:** 2026-06-16
**Status:** Approved, ready for implementation plan

## Problem

Tutors currently set rates at the tutor-wide level: a default rate, optional
per-subject rates (`subject_rates`), and per-subject group/combined-session
rates (`group_subject_rates`). There is no way to give a *specific student* a
special rate. Today the only per-student lever is the ad-hoc `override_amount`
on a single lesson, which must be re-entered for every lesson.

We want a tutor to set a durable special rate for an individual student that
applies automatically to that student's lessons.

## Decisions (from brainstorming)

- **Granularity:** Per-student, per-subject, with full duration-tier support —
  identical shape to the existing tutor-wide `subject_rates`
  (`{ rate, base_duration, duration_prices? }`).
- **Where set:** On the student's profile/detail screen (not the Rate Settings
  modal). Only subjects the student is enrolled in are shown.
- **Group/combined sessions:** The student's special rate **always wins** —
  solo or combined. It takes priority over both `group_subject_rates` and the
  tutor-wide `subject_rates`.
- **Storage:** Re-add a `subject_rates` JSONB column on the `students` table
  (Option A), mirroring the `tutor_settings.subject_rates` shape so existing
  rate-calc logic can consume it with a one-line lookup.

## Lookup hierarchy

Highest priority first:

1. `scheduled_lessons.override_amount` — per-lesson ad-hoc override (unchanged)
2. **`students.subject_rates[subject]`** — NEW; wins over all tutor-wide rates,
   solo or combined
3. `tutor_settings.group_subject_rates[subject]` — combined sessions only
4. `tutor_settings.subject_rates[subject]`
5. `tutor_settings.default_rate` / `default_base_duration`

A student `subject_rates` entry is considered "active" only when
`rate > 0 && base_duration > 0`. Otherwise it is ignored and resolution falls
through to the tutor-wide rate.

## Components

### 1. Database migration

New migration (`npx supabase migration new student_subject_rates`):

```sql
ALTER TABLE students
  ADD COLUMN subject_rates JSONB NOT NULL DEFAULT '{}'::jsonb;
```

- No RLS changes: `students` rows are already scoped by `parent_id`/`tutor_id`,
  and the new column is covered by existing row policies.
- This is the same column dropped on 2026-06-14
  (`20260614000001_drop_vestigial_student_rates.sql`); the difference this time
  is that a UI writes it and billing reads it. The previously-dropped
  `hourly_rate` column is **not** re-added — we only need per-subject configs.

### 2. Types — `src/types/database.ts`

- Add `subject_rates: Json` to the `students` `Row`, `Insert`, and `Update`
  definitions.
- Reuse existing `SubjectRates`, `SubjectRateConfig`, and `DurationPrices`
  types. No new types are introduced.

### 3. Shared rate editor sub-component

Extract the per-subject rate editor currently inline in `RateSettingsModal.tsx`
(base duration + rate + optional duration tiers) into a reusable component so
the student profile screen and the Rate Settings modal stay visually and
behaviorally consistent. Behavior of the existing modal must not change.

### 4. UI — student profile screen

Add a **"Custom Rates"** section to the student detail screen:

- Renders one entry per subject in `students.subjects`.
- Each subject has a "Use custom rate" toggle. When off, the student uses the
  tutor-wide rate; when on, the shared rate editor is revealed.
- The tutor-wide rate for that subject is shown as the placeholder / "default"
  reference so the tutor sees what they are overriding.
- Saving writes the assembled `subject_rates` JSON onto the student record via
  the student update mutation. Subjects with the toggle off are omitted from
  the JSON (so they fall through to tutor-wide rates).

### 5. Billing read — client (`src/hooks/usePayments.ts`)

In the per-lesson rate resolution, after the `override_amount` check and
**before** the tutor-wide subject/group lookup, check
`student.subject_rates[subject]`. If active, apply it using the same
duration-tier-then-linear logic already used for tutor-wide subject rates. The
invoice query already loads the student record; add the `subject_rates` column
to the selection.

### 6. Shared calc helper (`src/hooks/useTutorSettings.ts`)

`calculateLessonRate` gains an optional `studentRates?: SubjectRates`
parameter, checked ahead of the tutor-wide config. This keeps the resolution
hierarchy in one place for any client caller.

### 7. Billing read — server (`supabase/functions/_shared/lessonAmount.ts`)

`calculateLessonAmount` gains a `studentRates?: SubjectRates` parameter,
checked first after the `override_amount` short-circuit. Callers
(`auto-complete-lessons`, `telegram weekly recap`) fetch the student's
`subject_rates` alongside the lesson data and pass it in, so server-computed
amounts match the client exactly.

## Error handling / edge cases

- Missing or empty `subject_rates` (`{}`) → fall through to tutor-wide rates.
- Inactive entry (`rate <= 0` or `base_duration <= 0`) → ignored, falls
  through.
- `override_amount` set on a lesson still beats the student rate.
- A subject removed from `students.subjects` but still present in
  `subject_rates`: harmless — the entry is simply never looked up. The UI only
  edits enrolled subjects.

## Testing

Unit tests for `calculateLessonAmount` (server) and `calculateLessonRate`
(client):

- Student override present, solo session → uses student rate.
- Student override present, combined session → uses student rate (wins over
  group rate).
- Student override absent → falls back to group/subject/default correctly.
- Duration-tier vs. linear calculation within a student override.
- `override_amount` beats an active student rate.

Manual verification: set a custom rate on a student's profile, generate an
invoice for that student, and confirm the billed amount matches the custom
rate (including a combined-session case).

## Out of scope

- A flat (all-subjects) per-student rate — granularity is per-subject by
  decision.
- Separate custom individual vs. custom group rates per student — the single
  per-student rate always wins for both.
- Editing student custom rates from the Rate Settings modal — profile screen
  only.
