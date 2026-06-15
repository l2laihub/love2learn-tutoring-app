# Per-Topic Group Lesson Pricing — Design

**Date:** 2026-06-15
**Status:** Approved (design); pending implementation plan

## Problem

Tutors can set per-subject individual rates (with optional per-duration tier prices),
but they cannot charge a different price for the **same subject** when it is taught in a
**group / combined session**. The app has a single, flat `combined_session_rate` field on
`tutor_settings`, but it is **dead**: the billing math ignores `isCombinedSession`, so
combined sessions are billed at the regular per-subject duration rate. Tutors want a
distinct group price *per topic*.

## Goal

Let a tutor optionally set, **per subject**, a group price that mirrors the individual rate
structure (rate + base duration + optional per-duration tiers). When a lesson is part of a
combined session and a group rate exists for its subject, bill at the group rate; otherwise
fall back to the existing individual rate. Remove the unused flat `combined_session_rate`.

## Decisions (from brainstorming)

1. **Price shape:** Group pricing mirrors individual rates — each subject gets its own group
   rate + base duration + optional duration tiers (reuses `SubjectRates`/`SubjectRateConfig`).
2. **When applied:** Whenever a lesson is part of a combined session (`session_id != null`).
   No minimum student count, no manual per-lesson toggle.
3. **Fallback:** If a subject has no group rate configured, a combined session bills at that
   subject's **individual** rate (then default) — i.e. current behavior. Group pricing is
   purely opt-in; nothing changes for tutors who don't set it.
4. **Legacy `combined_session_rate`:** Removed entirely (column, types, UI, helpers).
5. **UI layout:** Group price lives **inside each subject card** behind an optional
   "Set a different group price" toggle — not in a separate repeated section.

## Data Model

Add column to `tutor_settings`:

```sql
ALTER TABLE tutor_settings
  ADD COLUMN group_subject_rates JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE tutor_settings
  DROP COLUMN combined_session_rate;
```

`group_subject_rates` has the identical shape to the existing `subject_rates` column:

```json
{
  "piano": { "rate": 25, "base_duration": 30, "duration_prices": { "30": 25, "45": 35 } },
  "math":  { "rate": 30, "base_duration": 60 }
}
```

Only subjects with a configured group rate appear as keys (same convention as `subject_rates`).

## Billing Logic (canonical rule)

```
resolveRateConfig(settings, subject, isCombinedSession):
    if isCombinedSession:
        groupCfg = settings.group_subject_rates[subject]
        if groupCfg is valid (rate > 0 and base_duration > 0):
            return groupCfg          # use group pricing (tiers + linear, same as individual)
    # not combined, OR no valid group rate → existing path
    individualCfg = settings.subject_rates[subject]
    if individualCfg is valid:
        return individualCfg
    return default (default_rate / default_base_duration)
```

Once a config is resolved, the **existing** tier-then-linear math applies unchanged:
1. Manual `overrideAmount` on the lesson always wins (unchanged).
2. If the resolved config has a `duration_prices[durationMin]` > 0 → use it.
3. Else linear: `(durationMin / base_duration) * rate`.

**Consequence:** A combined session with no group rate for its subject resolves to the
individual config → same amount as today. No silent change for existing tutors.

### Implementation sites (must stay in sync)

These three currently embed the rate-resolution logic and all must implement the rule above:

| File | Function | Notes |
|------|----------|-------|
| `supabase/functions/_shared/lessonAmount.ts` | `calculateLessonAmount` | Stop ignoring the combined flag (rename `_isCombinedSession` → `isCombinedSession`); apply group lookup. Used by edge functions. |
| `src/hooks/usePayments.ts` | `calculateLessonAmountWithDetails` | Apply group lookup; update the human-readable `formula`/`rateSource` to note "(group)" when group config used. |
| `src/hooks/useTutorSettings.ts` | `calculateLessonRate` | Currently returns the removed flat `combined_session_rate`. Update to the new rule. (Exported but has no current call sites; kept for consistency rather than deleted.) |

`lessonAmount.ts` and `calculateLessonAmountWithDetails` are deliberately parallel ports
(the file comment already says "keep in sync"); we keep that arrangement and update both.

### Edge functions that `select` the dropped column (must be updated)

These select `combined_session_rate` and would error against the dropped column:

- `supabase/functions/auto-complete-lessons/index.ts` (select list + `calculateLessonAmount` call)
- `supabase/functions/send-telegram-recap/index.ts` (select list + `calculateLessonAmount` call)

Update their `.select(...)` to drop `combined_session_rate` and add `group_subject_rates`,
and pass the real combined flag through.

## Types

- `src/types/database.ts`: add `group_subject_rates: SubjectRates` to the `tutor_settings`
  Row/Insert/Update and to the `TutorSettings` interface; remove `combined_session_rate`
  from all three plus the `TutorSettings` interface.
- `src/types/supabase.ts`: same Row/Insert/Update edits.
- `supabase/functions/_shared/lessonAmount.ts`: add
  `group_subject_rates?: Record<string, SubjectRateConfig> | null` to `TutorRateSettings`;
  remove `combined_session_rate`.
- `src/hooks/useTutorSettings.ts`: `DEFAULT_SETTINGS` — drop `combined_session_rate`, add
  `group_subject_rates: {}`; update insert/update mutation payloads accordingly.
- `src/hooks/useTutorProfile.ts`: remove `combinedSessionRate` mapping (and from its default
  profile / type).

## UI — RateSettingsModal

Remove the standalone **"Combined Session Rate"** section (lines ~375–393) and its
`combinedRate` state/handlers/validation/save field.

Within each subject card in the **Subject Rates** section, below the individual base-rate row
(and its existing duration-tier toggle), add an optional group block:

- A toggle: **"Set a different group price"** (mirrors the existing "Custom prices per
  duration" checkbox styling).
- When on, reveal the **same controls as the individual rate**: a group rate input + 30m/60m
  base-duration picker + an optional "Custom prices per duration" tier grid for the group price.
- The card badge already shows "Custom"/"Tiers"; optionally extend to indicate a group price
  is set (e.g. show a small "Group" marker) — minor, decide during implementation.

State: add a parallel `groupSubjectRates: Record<string, SubjectRateFormState>` mirroring the
existing `subjectRates` state, initialized from `settings.group_subject_rates`, with parallel
change handlers. On save, build `group_subject_rates` exactly as `subject_rates` is built
(only enabled subjects with rate > 0; include `duration_prices` only when tier mode has values).

**Example Calculations footer:** replace the dead "Combined session (2 students)" row (which
multiplied the removed flat rate) with a group example computed from the new state, e.g.
"30-min Piano (group): $X" using the same `calculateExample`-style helper extended to read the
group form state when a group rate is set for that subject.

## Tests

- `supabase/functions/_shared/lessonAmount.test.ts`: add cases —
  (a) combined session + group rate set → group amount (linear and tier),
  (b) combined session + no group rate → individual amount (regression: unchanged),
  (c) non-combined ignores group rate entirely.
- `supabase/functions/send-telegram-recap/recap.test.ts`: mirror the relevant cases; ensure
  it no longer references `combined_session_rate`.
- Existing pinned values remain valid because no current test asserted combined-flag-driven
  pricing.

## Out of Scope (YAGNI)

- Group discounts/multipliers, per-student-count tiers, or auto-derived group prices.
- A manual per-lesson "group pricing" toggle (binding to `session_id` membership is enough).
- Migrating any existing `combined_session_rate` values into group rates (the field was never
  applied to billing, so there is no live pricing to preserve).
- Custom (non-canonical) subjects in group rates beyond what `subject_rates` already supports.

## Migration / Rollout Notes

- Single new migration: add `group_subject_rates`, drop `combined_session_rate`.
- Deploy edge function updates together with the migration so no function queries the dropped
  column.
- Behavior is backward-compatible: until a tutor sets a group rate, all amounts are identical
  to today.
