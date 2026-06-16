# Per-Topic Group Lesson Pricing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let tutors set an optional per-subject group price (rate + base duration + optional per-duration tiers) that is applied when a lesson is part of a combined session, falling back to the individual rate when no group price is set; and remove the unused flat `combined_session_rate`.

**Architecture:** A new `group_subject_rates` JSONB column on `tutor_settings` mirrors the existing `subject_rates` shape. Rate resolution gains one rule: combined session + valid group config for the subject → use the group config; otherwise use the existing individual/default path. The rule is implemented in the three places rate math lives today (`lessonAmount.ts` for edge functions, `calculateLessonAmountWithDetails` in `usePayments.ts` for the app, `calculateLessonRate` in `useTutorSettings.ts`). The Rate Settings modal grows an optional group block inside each subject card.

**Tech Stack:** React Native + Expo, Supabase (Postgres + Deno edge functions), TypeScript. Edge math is unit-tested with Deno; the app has no JS test runner, so app-side math mirrors the Deno-verified logic and is checked via the typecheck baseline.

**Spec:** `docs/superpowers/specs/2026-06-15-group-lesson-pricing-design.md`

---

## Verification baseline (read before starting)

There is **no `npm test`** and no jest in this repo. Verification commands used throughout:

- Edge math tests: `deno test supabase/functions/_shared/lessonAmount.test.ts` and
  `deno test supabase/functions/send-telegram-recap/recap.test.ts`
- Type check: `npm run typecheck` — **this has ~361 pre-existing errors repo-wide.** Do NOT
  expect zero. Capture a baseline before changes and compare:
  ```bash
  npm run typecheck 2>&1 | grep -c "error TS" > /tmp/ts_baseline.txt
  cat /tmp/ts_baseline.txt
  ```
  After each app-code change, re-run and confirm the count did not increase:
  ```bash
  npm run typecheck 2>&1 | grep -c "error TS"
  ```
- Lint a changed file: `npx eslint <path>`

- [ ] **Step 0: Capture the typecheck baseline**

Run:
```bash
npm run typecheck 2>&1 | grep -c "error TS" | tee /tmp/ts_baseline.txt
```
Expected: a number around 361. Record it; later tasks must not exceed it.

---

## File Structure

- Create: `supabase/migrations/20260615000001_group_subject_rates.sql` — add `group_subject_rates`, drop `combined_session_rate`.
- Modify: `supabase/functions/_shared/lessonAmount.ts` — group-aware rate resolution; type swap.
- Modify: `supabase/functions/_shared/lessonAmount.test.ts` — group cases (TDD).
- Modify: `supabase/functions/auto-complete-lessons/index.ts` — select list (already passes real combined flag).
- Modify: `supabase/functions/send-telegram-recap/index.ts` — select list + pass real combined flag.
- Modify: `supabase/functions/send-telegram-recap/recap.test.ts` — drop removed field; add group case.
- Modify: `src/types/database.ts` — `tutor_settings` Row/Insert/Update, `TutorSettings`, `UpdateTutorSettingsInput`.
- Modify: `src/types/supabase.ts` — `tutor_settings` Row/Insert/Update.
- Modify: `src/hooks/usePayments.ts` — `calculateLessonAmountWithDetails` group resolution.
- Modify: `src/hooks/useTutorSettings.ts` — `DEFAULT_SETTINGS`, mutation payloads, `calculateLessonRate`.
- Modify: `src/hooks/useTutorProfile.ts` — remove `combinedSessionRate`.
- Modify: `src/components/RateSettingsModal.tsx` — remove combined-rate section; per-card group block.

---

## Task 1: Database migration

**Files:**
- Create: `supabase/migrations/20260615000001_group_subject_rates.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260615000001_group_subject_rates.sql`:

```sql
-- Migration: per-topic group lesson pricing
-- Adds group_subject_rates (mirrors subject_rates shape) and removes the unused
-- flat combined_session_rate column (it was never applied to billing).

ALTER TABLE tutor_settings
    ADD COLUMN IF NOT EXISTS group_subject_rates JSONB NOT NULL DEFAULT '{}';

COMMENT ON COLUMN tutor_settings.group_subject_rates IS
    'Per-subject group/combined-session rates, same shape as subject_rates: {"piano": {"rate": 25, "base_duration": 30, "duration_prices": {"30": 25}}}';

ALTER TABLE tutor_settings
    DROP COLUMN IF EXISTS combined_session_rate;
```

- [ ] **Step 2: Apply the migration to the remote DB**

Run: `npx supabase db push`
Expected: migration `20260615000001_group_subject_rates` applies with no error.

(If a local stack is preferred instead: `npx supabase db reset` — but `db push` is the
documented path in CLAUDE.md.)

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260615000001_group_subject_rates.sql
git commit -m "feat(db): add group_subject_rates, drop unused combined_session_rate"
```

---

## Task 2: Group-aware edge math (`lessonAmount.ts`)

This is the canonical math. TDD here, then mirror into the app in Task 5.

**Files:**
- Modify: `supabase/functions/_shared/lessonAmount.ts`
- Test: `supabase/functions/_shared/lessonAmount.test.ts`

- [ ] **Step 1: Update the existing "flag ignored" test and add group cases (failing)**

In `supabase/functions/_shared/lessonAmount.test.ts`, **replace** the test named
`'combined session uses same amount as single (flag ignored)'` (lines 22–28) with the
following block:

```typescript
Deno.test('combined session falls back to individual rate when no group rate set', () => {
  const settings = { subject_rates: { math: { rate: 60, base_duration: 60 } } };
  assertEquals(
    calculateLessonAmount(settings, 'math', 60, true, null),
    calculateLessonAmount(settings, 'math', 60, false, null),
  );
});

Deno.test('combined session uses group rate when set (linear)', () => {
  const settings = {
    subject_rates: { piano: { rate: 60, base_duration: 60 } },
    group_subject_rates: { piano: { rate: 30, base_duration: 60 } },
  };
  assertEquals(calculateLessonAmount(settings, 'piano', 60, true, null), 30);
  // non-combined still uses the individual rate
  assertEquals(calculateLessonAmount(settings, 'piano', 60, false, null), 60);
});

Deno.test('combined session uses group duration tier when set', () => {
  const settings = {
    subject_rates: { piano: { rate: 60, base_duration: 60 } },
    group_subject_rates: { piano: { rate: 30, base_duration: 60, duration_prices: { '45': 25 } } },
  };
  assertEquals(calculateLessonAmount(settings, 'piano', 45, true, null), 25);
});

Deno.test('group rate ignored for non-combined lessons', () => {
  const settings = {
    subject_rates: { piano: { rate: 60, base_duration: 60 } },
    group_subject_rates: { piano: { rate: 30, base_duration: 60 } },
  };
  assertEquals(calculateLessonAmount(settings, 'piano', 60, false, null), 60);
});

Deno.test('override wins even for combined session with group rate', () => {
  const settings = { group_subject_rates: { piano: { rate: 30, base_duration: 60 } } };
  assertEquals(calculateLessonAmount(settings, 'piano', 60, true, 12.5), 12.5);
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `deno test supabase/functions/_shared/lessonAmount.test.ts`
Expected: FAIL — `combined session uses group rate when set (linear)` returns 60 not 30
(group rates are not yet consulted).

- [ ] **Step 3: Implement group-aware resolution**

Replace the entire contents of `supabase/functions/_shared/lessonAmount.ts` with:

```typescript
// Pure, dependency-free lesson-amount math shared by Edge Functions.
// Faithful port of calculateLessonAmountWithDetails in src/hooks/usePayments.ts —
// keep in sync (lessonAmount.test.ts pins the values). For combined sessions, a
// per-subject group rate (group_subject_rates) is used when set; otherwise the
// individual subject rate applies (then the default rate).

export interface SubjectRateConfig {
  rate: number;
  base_duration: number;
  duration_prices?: Record<string, number>;
}
export interface TutorRateSettings {
  default_rate?: number | null;
  default_base_duration?: number | null;
  subject_rates?: Record<string, SubjectRateConfig> | null;
  group_subject_rates?: Record<string, SubjectRateConfig> | null;
}

function isValidConfig(c: SubjectRateConfig | undefined): c is SubjectRateConfig {
  return !!c && c.rate > 0 && c.base_duration > 0;
}

export function calculateLessonAmount(
  settings: TutorRateSettings | null,
  subject: string,
  durationMin: number,
  isCombinedSession: boolean,
  overrideAmount?: number | null,
): number {
  const defaultRate = 45;
  const defaultBaseDuration = 60;

  if (overrideAmount !== undefined && overrideAmount !== null) {
    return overrideAmount;
  }

  // Resolve the applicable rate config: combined sessions prefer the group rate
  // for the subject, then fall back to the individual subject rate.
  let rateConfig: SubjectRateConfig | undefined;
  if (isCombinedSession) {
    const groupRates = settings?.group_subject_rates ?? undefined;
    const groupCfg = groupRates ? groupRates[subject] : undefined;
    if (isValidConfig(groupCfg)) {
      rateConfig = groupCfg;
    }
  }
  if (!rateConfig) {
    const subjectRates = settings?.subject_rates ?? undefined;
    const subjectCfg = subjectRates ? subjectRates[subject] : undefined;
    if (isValidConfig(subjectCfg)) {
      rateConfig = subjectCfg;
    }
  }

  let rate: number;
  let baseDuration: number;

  if (rateConfig) {
    const durationPrices = rateConfig.duration_prices;
    if (durationPrices && typeof durationPrices === 'object') {
      const explicit = durationPrices[String(durationMin)];
      if (typeof explicit === 'number' && explicit > 0) {
        return explicit;
      }
    }
    rate = rateConfig.rate;
    baseDuration = rateConfig.base_duration;
  } else {
    rate = settings?.default_rate ?? defaultRate;
    baseDuration = settings?.default_base_duration ?? defaultBaseDuration;
  }

  return (durationMin / baseDuration) * rate;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `deno test supabase/functions/_shared/lessonAmount.test.ts`
Expected: PASS (all tests, including the unchanged default/override/subject/tier cases).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/lessonAmount.ts supabase/functions/_shared/lessonAmount.test.ts
git commit -m "feat(billing): group-aware lesson amount in shared edge math"
```

---

## Task 3: Update edge functions that read the column

`auto-complete-lessons` already passes the real combined flag (`l.session_id !== null`) and
only needs its select list updated. `send-telegram-recap` needs both the select list and the
combined flag. `recap.test.ts` references the removed field and needs a group case.

**Files:**
- Modify: `supabase/functions/auto-complete-lessons/index.ts:103`
- Modify: `supabase/functions/send-telegram-recap/index.ts:132` and `:189`
- Test: `supabase/functions/send-telegram-recap/recap.test.ts`

- [ ] **Step 1: Update auto-complete-lessons select list**

In `supabase/functions/auto-complete-lessons/index.ts`, change line 103 from:

```typescript
    .select('default_rate, default_base_duration, subject_rates, combined_session_rate')
```

to:

```typescript
    .select('default_rate, default_base_duration, subject_rates, group_subject_rates')
```

(No change to the `calculateLessonAmount` call at line 317 — it already passes
`l.session_id !== null`.)

- [ ] **Step 2: Update send-telegram-recap select list and combined flag**

In `supabase/functions/send-telegram-recap/index.ts`, change line 132 from:

```typescript
      .select('default_rate, default_base_duration, subject_rates, combined_session_rate')
```

to:

```typescript
      .select('default_rate, default_base_duration, subject_rates, group_subject_rates')
```

Then change the `calculateLessonAmount` call (lines 185–191), specifically the `false`
argument on line 189, so the recap's expected total matches real billing:

```typescript
          calculateLessonAmount(
            settings ?? null,
            l.subject,
            Number(l.duration_min) || 0,
            l.session_id !== null,
            l.override_amount == null ? null : Number(l.override_amount),
          ),
```

(Confirm the `l` objects in this `reduce` carry `session_id`. If the query selecting
`lessonRows` does not already select `session_id`, add `session_id` to that `.select(...)`
list — search upward in the same function for `.from('scheduled_lessons')` and ensure
`session_id` is included.)

- [ ] **Step 3: Update recap.test.ts — remove dead field, add group case**

In `supabase/functions/send-telegram-recap/recap.test.ts`, remove the line:

```typescript
  combined_session_rate: 0,
```

(line 16, inside the shared `settings` fixture). Then add this test at the end of the file:

```typescript
Deno.test('recap: combined session uses group rate when set', () => {
  const settings = {
    subject_rates: { piano: { rate: 60, base_duration: 60 } },
    group_subject_rates: { piano: { rate: 30, base_duration: 60 } },
  };
  assertEquals(calculateLessonAmount(settings, 'piano', 60, true, null), 30);
});
```

(If `assertEquals` is not already imported in this file, add
`import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';` at the top.)

- [ ] **Step 4: Run recap tests**

Run: `deno test supabase/functions/send-telegram-recap/recap.test.ts`
Expected: PASS.

- [ ] **Step 5: Deploy the updated edge functions**

Run:
```bash
npx supabase functions deploy auto-complete-lessons
npx supabase functions deploy send-telegram-recap
```
Expected: both deploy successfully. (Deploy together with Task 1's migration so no deployed
function queries the dropped column.)

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/auto-complete-lessons/index.ts supabase/functions/send-telegram-recap/index.ts supabase/functions/send-telegram-recap/recap.test.ts
git commit -m "feat(edge): read group_subject_rates and apply group pricing in recap/auto-complete"
```

---

## Task 4: App type definitions

**Files:**
- Modify: `src/types/database.ts:752-785`, `:1462-1481`
- Modify: `src/types/supabase.ts:753-784`

- [ ] **Step 1: Update `database.ts` generated `tutor_settings` block**

In `src/types/database.ts`, in the `tutor_settings` Row/Insert/Update (lines 753–785),
replace each `combined_session_rate` line with `group_subject_rates`:

- In `Row` (line 759): replace `combined_session_rate: number;` with `group_subject_rates: Json;`
- In `Insert` (line 770): replace `combined_session_rate?: number;` with `group_subject_rates?: Json;`
- In `Update` (line 781): replace `combined_session_rate?: number;` with `group_subject_rates?: Json;`

- [ ] **Step 2: Update the `TutorSettings` and input interfaces**

In `src/types/database.ts`, change the `TutorSettings` interface (line 1469) from:

```typescript
  combined_session_rate: number;  // Flat rate per student for combined sessions
```

to:

```typescript
  group_subject_rates: SubjectRates; // Per-subject group/combined-session rate overrides
```

And in `UpdateTutorSettingsInput` (line 1480), change:

```typescript
  combined_session_rate?: number;
```

to:

```typescript
  group_subject_rates?: SubjectRates;
```

- [ ] **Step 3: Update `supabase.ts` generated `tutor_settings` block**

In `src/types/supabase.ts`, in the `tutor_settings` Row/Insert/Update (lines 754–783),
replace each `combined_session_rate` line with `group_subject_rates`:

- In `Row` (line 755): replace `combined_session_rate: number` with `group_subject_rates: Json`
- In `Insert` (line 765): replace `combined_session_rate?: number` with `group_subject_rates?: Json`
- In `Update` (line 775): replace `combined_session_rate?: number` with `group_subject_rates?: Json`

- [ ] **Step 4: Type check (expect baseline, not zero)**

Run: `npm run typecheck 2>&1 | grep -c "error TS"`
Expected: count is **≥** baseline (other tasks still pending may reference old field). Note it;
the goal is that after Task 8 the count returns to baseline. Do not block here.

- [ ] **Step 5: Commit**

```bash
git add src/types/database.ts src/types/supabase.ts
git commit -m "feat(types): add group_subject_rates, remove combined_session_rate"
```

---

## Task 5: Group-aware app billing math (`usePayments.ts`)

Mirror Task 2's logic into `calculateLessonAmountWithDetails`. No JS test runner exists; the
Deno test in Task 2 is the source of truth — keep the branching identical.

**Files:**
- Modify: `src/hooks/usePayments.ts:1329-1415`

- [ ] **Step 1: Replace the rate-resolution body of `calculateLessonAmountWithDetails`**

In `src/hooks/usePayments.ts`, replace the body **from line 1350** (the comment
`// Use duration-based subject rates for ALL lessons (including combined sessions)`) **through
line 1401** (the closing `}` of the outer `else` that sets `rateSource = 'default rate';`)
with the following. Leave the `overrideAmount` early-return above (lines 1339–1348) and the
final amount/formula block below (lines 1403–1414) unchanged.

```typescript
  // Resolve the applicable rate config. Combined sessions prefer the per-subject
  // group rate (group_subject_rates); otherwise the individual subject rate applies,
  // then the tutor default.
  let rate: number;
  let baseDuration: number;
  let rateSource: string;

  const subjectRates = tutorSettings?.subject_rates as SubjectRates | null | undefined;
  const groupRates = (tutorSettings as TutorSettings | null)?.group_subject_rates as
    | SubjectRates
    | null
    | undefined;

  const pickConfig = (rates: SubjectRates | null | undefined): SubjectRateConfig | undefined => {
    if (!rates || !(subject in rates)) return undefined;
    const cfg = rates[subject as keyof SubjectRates] as SubjectRateConfig | undefined;
    return cfg && cfg.rate > 0 && cfg.base_duration > 0 ? cfg : undefined;
  };

  const groupConfig = isCombinedSession ? pickConfig(groupRates) : undefined;
  const rateConfig = groupConfig ?? pickConfig(subjectRates);

  if (rateConfig) {
    // Check for explicit duration price tier first (string keys from JSON).
    const durationPricesRaw = rateConfig.duration_prices;
    if (durationPricesRaw && typeof durationPricesRaw === 'object') {
      const durationKey = String(durationMin);
      const explicitPrice = (durationPricesRaw as Record<string, number>)[durationKey];
      if (typeof explicitPrice === 'number' && explicitPrice > 0) {
        const rateDisplay = `$${explicitPrice}/${durationMin}min`;
        const tierKind = groupConfig ? 'group tier' : 'tier';
        const formula = `${durationMin}min = $${explicitPrice.toFixed(2)} (${subject} ${tierKind})`;
        return {
          amount: explicitPrice,
          rate: explicitPrice,
          baseDuration: durationMin,
          rateDisplay,
          formula,
        };
      }
    }
    rate = rateConfig.rate;
    baseDuration = rateConfig.base_duration;
    rateSource = groupConfig ? `${subject} group rate` : `${subject} rate`;
  } else {
    rate = tutorSettings?.default_rate ?? defaultRate;
    baseDuration = tutorSettings?.default_base_duration ?? defaultBaseDuration;
    rateSource = 'default rate';
  }
```

- [ ] **Step 2: Confirm `SubjectRateConfig` is imported in `usePayments.ts`**

Run: `grep -n "SubjectRateConfig\|SubjectRates\|TutorSettings" src/hooks/usePayments.ts | head`
Expected: an import line already brings in `SubjectRates` and `SubjectRateConfig` and
`TutorSettings`. If `SubjectRateConfig` is missing from the import, add it to the existing
`from '../types/database'` import.

- [ ] **Step 3: Type check (must not exceed baseline + Task 4 residue)**

Run: `npm run typecheck 2>&1 | grep -c "error TS"`
Expected: not higher than after Task 4. Investigate any new error mentioning `usePayments.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/usePayments.ts
git commit -m "feat(billing): apply per-subject group rate in app invoice math"
```

---

## Task 6: `useTutorSettings` — defaults, mutations, helper

**Files:**
- Modify: `src/hooks/useTutorSettings.ts:18-23`, `:128-155`, `:200-250`

- [ ] **Step 1: Update `DEFAULT_SETTINGS`**

In `src/hooks/useTutorSettings.ts`, change the `DEFAULT_SETTINGS` block (lines 18–23) from:

```typescript
const DEFAULT_SETTINGS: Omit<TutorSettings, 'id' | 'tutor_id' | 'created_at' | 'updated_at'> = {
  default_rate: 45,           // $45 default
  default_base_duration: 60,  // per 60 minutes
  subject_rates: {},
  combined_session_rate: 40,
};
```

to:

```typescript
const DEFAULT_SETTINGS: Omit<TutorSettings, 'id' | 'tutor_id' | 'created_at' | 'updated_at'> = {
  default_rate: 45,           // $45 default
  default_base_duration: 60,  // per 60 minutes
  subject_rates: {},
  group_subject_rates: {},
};
```

> Note: `DEFAULT_SETTINGS` is spread into the data object alongside `reminder_settings`
> elsewhere; this Omit already excludes `reminder_settings` handling that exists today — do not
> add `reminder_settings` here. Only swap `combined_session_rate` → `group_subject_rates`.

- [ ] **Step 2: Update the fetch parse to coerce `group_subject_rates`**

In `useTutorSettings`'s `fetchSettings`, where existing settings are set (around lines 65–70),
change:

```typescript
        setData({
          ...settings,
          subject_rates: (settings.subject_rates as SubjectRates) || {},
        });
```

to:

```typescript
        setData({
          ...settings,
          subject_rates: (settings.subject_rates as SubjectRates) || {},
          group_subject_rates: (settings.group_subject_rates as SubjectRates) || {},
        });
```

- [ ] **Step 3: Update the update + insert mutation payloads**

In `useUpdateTutorSettings`, in the `update(...)` payload (lines 130–135), replace:

```typescript
            subject_rates: (input.subject_rates || {}) as unknown as Json,
            combined_session_rate: input.combined_session_rate,
```

with:

```typescript
            subject_rates: (input.subject_rates || {}) as unknown as Json,
            group_subject_rates: (input.group_subject_rates || {}) as unknown as Json,
```

In the `insert(...)` payload (lines 148–152), replace:

```typescript
            subject_rates: (input.subject_rates || {}) as unknown as Json,
            combined_session_rate: input.combined_session_rate ?? DEFAULT_SETTINGS.combined_session_rate,
```

with:

```typescript
            subject_rates: (input.subject_rates || {}) as unknown as Json,
            group_subject_rates: (input.group_subject_rates || {}) as unknown as Json,
```

Then update the result mapping (around lines 160–163) from:

```typescript
      const settings: TutorSettings = {
        ...result,
        subject_rates: (result.subject_rates as SubjectRates) || {},
      };
```

to:

```typescript
      const settings: TutorSettings = {
        ...result,
        subject_rates: (result.subject_rates as SubjectRates) || {},
        group_subject_rates: (result.group_subject_rates as SubjectRates) || {},
      };
```

- [ ] **Step 4: Rewrite `calculateLessonRate` to the new rule**

In `src/hooks/useTutorSettings.ts`, replace the entire `calculateLessonRate` function
(lines 221–250) with:

```typescript
export function calculateLessonRate(
  settings: TutorSettings | null,
  subject: string,
  durationMin: number,
  isCombinedSession: boolean
): number {
  // Combined sessions prefer the per-subject group rate when set; otherwise fall
  // back to the individual subject rate (then the tutor default).
  let rateConfig: SubjectRateConfig | undefined;
  if (isCombinedSession) {
    const groupRates = settings?.group_subject_rates as
      | Record<string, SubjectRateConfig>
      | null
      | undefined;
    const groupCfg = groupRates?.[subject];
    if (groupCfg && groupCfg.rate > 0 && groupCfg.base_duration > 0) {
      rateConfig = groupCfg;
    }
  }
  if (!rateConfig) {
    rateConfig = getSubjectRateConfig(settings, subject);
  }

  // Check for explicit duration price first (string keys from JSON).
  const durationPricesRaw = rateConfig.duration_prices;
  if (durationPricesRaw && typeof durationPricesRaw === 'object') {
    const durationKey = String(durationMin);
    const explicitPrice = (durationPricesRaw as Record<string, number>)[durationKey];
    if (typeof explicitPrice === 'number' && explicitPrice > 0) {
      return explicitPrice;
    }
  }

  // Fall back to linear calculation: (lesson duration / base duration) * rate
  return (durationMin / rateConfig.base_duration) * rateConfig.rate;
}
```

> `getSubjectRateConfig` already returns a valid default config when the subject has no
> individual rate, so the `!rateConfig` fallback always yields a usable config.

- [ ] **Step 5: Confirm `SubjectRateConfig` import**

Run: `grep -n "SubjectRateConfig" src/hooks/useTutorSettings.ts | head -1`
Expected: it is already imported (line ~12). If not, add it to the `from '../types/database'` import.

- [ ] **Step 6: Type check**

Run: `npm run typecheck 2>&1 | grep -c "error TS"`
Expected: not higher than the previous task's count.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useTutorSettings.ts
git commit -m "feat(settings): persist group_subject_rates and group-aware calculateLessonRate"
```

---

## Task 7: `useTutorProfile` — drop `combinedSessionRate`

`combinedSessionRate` is exposed on `TutorProfile` but not consumed anywhere; remove it.

**Files:**
- Modify: `src/hooks/useTutorProfile.ts:96`, `:125`, `:201`

- [ ] **Step 1: Remove the three references**

In `src/hooks/useTutorProfile.ts`:
- Delete line 96 (`combinedSessionRate: number;` in the `TutorProfile` interface).
- Delete line 125 (`combinedSessionRate: 40,` in `DEFAULT_PROFILE`).
- Delete line 201 (`combinedSessionRate: settings?.combined_session_rate ?? DEFAULT_PROFILE.combinedSessionRate,` in the profile object).

- [ ] **Step 2: Verify no remaining references**

Run: `grep -rn "combinedSessionRate\|combined_session_rate" src/ app/ --include="*.ts" --include="*.tsx" | grep -v node_modules`
Expected: **no output**.

- [ ] **Step 3: Type check**

Run: `npm run typecheck 2>&1 | grep -c "error TS"`
Expected: not higher than the previous task's count.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useTutorProfile.ts
git commit -m "refactor(profile): remove unused combinedSessionRate"
```

---

## Task 8: Rate Settings modal UI

Remove the standalone "Combined Session Rate" section and add an optional group block inside
each subject card. Group state mirrors the existing individual `subjectRates` form state.

**Files:**
- Modify: `src/components/RateSettingsModal.tsx`

- [ ] **Step 1: Add group form state and remove combined-rate state**

In `src/components/RateSettingsModal.tsx`, in the component body (around lines 60–64):
- Remove: `const [combinedRate, setCombinedRate] = useState('40');`
- Add after the `subjectRates` state:
  ```typescript
  const [groupRates, setGroupRates] = useState<Record<string, SubjectRateFormState>>({});
  ```

- [ ] **Step 2: Initialize group state from settings; remove combined init**

In the `useEffect` that runs on `settings` load (lines 67–109):
- Remove the line `setCombinedRate(settings.combined_session_rate.toString());` (line 71).
- After the existing `SUBJECTS.forEach(...)` block that builds `rates`, add a parallel block
  that builds group state, then set it. Insert before `setSubjectRates(rates);`:

  ```typescript
      const gRates: Record<string, SubjectRateFormState> = {};
      SUBJECTS.forEach(subject => {
        const rateConfig = settings.group_subject_rates?.[subject.key];
        if (rateConfig && rateConfig.rate > 0) {
          const hasTiers = rateConfig.duration_prices && Object.keys(rateConfig.duration_prices).length > 0;
          const tierPrices: Record<number, string> = {};
          if (hasTiers && rateConfig.duration_prices) {
            DURATION_TIERS.forEach(dur => {
              const price = rateConfig.duration_prices?.[dur as keyof DurationPrices];
              tierPrices[dur] = price !== undefined && price !== null ? price.toString() : '';
            });
          }
          gRates[subject.key] = {
            rate: rateConfig.rate.toString(),
            duration: rateConfig.base_duration,
            enabled: true,
            useTiers: hasTiers || false,
            tierPrices,
          };
        } else {
          gRates[subject.key] = {
            rate: '',
            duration: subject.defaultDuration,
            enabled: false,
            useTiers: false,
            tierPrices: {},
          };
        }
      });
  ```
- After `setSubjectRates(rates);` add: `setGroupRates(gRates);`

- [ ] **Step 3: Add group change handlers**

After the existing `handleTierPriceChange` function (line 168), add a parallel set of
handlers for the group state:

```typescript
  const handleGroupRateChange = (subject: string, value: string) => {
    setGroupRates(prev => ({
      ...prev,
      [subject]: { ...prev[subject], rate: value, enabled: value.trim() !== '' },
    }));
    setHasChanges(true);
  };

  const handleGroupDurationChange = (subject: string, duration: number) => {
    setGroupRates(prev => ({
      ...prev,
      [subject]: { ...prev[subject], duration },
    }));
    setHasChanges(true);
  };

  const handleToggleGroupEnabled = (subject: string) => {
    setGroupRates(prev => {
      const current = prev[subject] || { rate: '', duration: 30, enabled: false, useTiers: false, tierPrices: {} };
      return { ...prev, [subject]: { ...current, enabled: !current.enabled } };
    });
    setHasChanges(true);
  };

  const handleToggleGroupTiers = (subject: string) => {
    setGroupRates(prev => ({
      ...prev,
      [subject]: {
        ...prev[subject],
        useTiers: !prev[subject]?.useTiers,
        tierPrices: prev[subject]?.tierPrices || {},
      },
    }));
    setHasChanges(true);
  };

  const handleGroupTierPriceChange = (subject: string, duration: number, value: string) => {
    setGroupRates(prev => ({
      ...prev,
      [subject]: {
        ...prev[subject],
        tierPrices: { ...prev[subject]?.tierPrices, [duration]: value },
        enabled: true,
      },
    }));
    setHasChanges(true);
  };
```

- [ ] **Step 4: Build and save `group_subject_rates`; drop combined validation/field**

In `handleSave` (lines 170–245):
- Remove the combined validation block (lines 173 and 180–183): delete
  `const parsedCombined = parseFloat(combinedRate);` and the
  `if (isNaN(parsedCombined) || parsedCombined <= 0) { ... }` block.
- After the existing `for (const subject of SUBJECTS) { ... }` loop that builds
  `parsedSubjectRates`, add a parallel loop that builds `parsedGroupRates` from `groupRates`.
  Insert before the `console.log(...)` at line 228:

  ```typescript
    const parsedGroupRates: SubjectRates = {};
    for (const subject of SUBJECTS) {
      const formState = groupRates[subject.key];
      if (formState?.enabled && formState.rate.trim() !== '') {
        const parsed = parseFloat(formState.rate);
        if (!isNaN(parsed) && parsed > 0) {
          const rateConfig: SubjectRateConfig = {
            rate: parsed,
            base_duration: formState.duration,
          };
          if (formState.useTiers && formState.tierPrices) {
            const durationPrices: Record<string, number> = {};
            let hasTierPrices = false;
            DURATION_TIERS.forEach(dur => {
              const tierPricesObj = formState.tierPrices as Record<string | number, string>;
              const priceStr = tierPricesObj[dur] || tierPricesObj[String(dur)];
              if (priceStr && priceStr.trim() !== '') {
                const priceVal = parseFloat(priceStr);
                if (!isNaN(priceVal) && priceVal > 0) {
                  durationPrices[String(dur)] = priceVal;
                  hasTierPrices = true;
                }
              }
            });
            if (hasTierPrices) {
              rateConfig.duration_prices = durationPrices as DurationPrices;
            }
          }
          parsedGroupRates[subject.key] = rateConfig;
        }
      }
    }
  ```
- In the `updateSettings.mutate({...})` call (lines 230–235), replace
  `combined_session_rate: parsedCombined,` with `group_subject_rates: parsedGroupRates,`.

- [ ] **Step 5: Remove the "Combined Session Rate" section from the JSX**

Delete the entire `{/* Combined Session Rate */}` section (lines 375–393), i.e. the
`<View style={styles.section}>...</View>` containing the `combinedRate` input.

- [ ] **Step 6: Add the group block inside each subject card**

In the `SUBJECTS.map(subject => ...)` render (within the `subjectRateCard`), the individual
duration-tier section ends at its closing `)}` (line 508, the `{formState.enabled && (...)}`
block). Immediately after that closing `)}` and before the card's closing `</View>` (line 509),
insert the group block:

```tsx
                      {/* Group / combined-session price */}
                      <View style={styles.tiersSection}>
                        <Pressable
                          style={styles.tiersToggle}
                          onPress={() => handleToggleGroupEnabled(subject.key)}
                        >
                          <Ionicons
                            name={groupState.enabled ? 'checkbox' : 'square-outline'}
                            size={20}
                            color={groupState.enabled ? colors.piano.primary : colors.neutral.textMuted}
                          />
                          <Text style={styles.tiersToggleText}>Set a different group price</Text>
                        </Pressable>

                        {groupState.enabled && (
                          <View style={styles.tiersInputsContainer}>
                            <View style={styles.subjectRateRow}>
                              <View style={styles.subjectInputGroup}>
                                <View style={styles.subjectRateInputContainer}>
                                  <Text style={styles.currencySymbolSmall}>$</Text>
                                  <TextInput
                                    style={styles.subjectRateInput}
                                    value={groupState.rate}
                                    onChangeText={(value) => handleGroupRateChange(subject.key, value)}
                                    keyboardType="decimal-pad"
                                    placeholder=""
                                    placeholderTextColor={colors.neutral.textMuted}
                                  />
                                </View>
                                <Text style={styles.perTextSmall}>per</Text>
                                <Pressable
                                  style={[
                                    styles.durationOptionSmall,
                                    groupState.duration === 30 && styles.durationOptionSmallSelected,
                                  ]}
                                  onPress={() => handleGroupDurationChange(subject.key, 30)}
                                >
                                  <Text
                                    style={[
                                      styles.durationOptionTextSmall,
                                      groupState.duration === 30 && styles.durationOptionTextSmallSelected,
                                    ]}
                                  >
                                    30m
                                  </Text>
                                </Pressable>
                                <Pressable
                                  style={[
                                    styles.durationOptionSmall,
                                    groupState.duration === 60 && styles.durationOptionSmallSelected,
                                  ]}
                                  onPress={() => handleGroupDurationChange(subject.key, 60)}
                                >
                                  <Text
                                    style={[
                                      styles.durationOptionTextSmall,
                                      groupState.duration === 60 && styles.durationOptionTextSmallSelected,
                                    ]}
                                  >
                                    60m
                                  </Text>
                                </Pressable>
                              </View>
                            </View>

                            <Pressable
                              style={styles.tiersToggle}
                              onPress={() => handleToggleGroupTiers(subject.key)}
                            >
                              <Ionicons
                                name={groupState.useTiers ? 'checkbox' : 'square-outline'}
                                size={20}
                                color={groupState.useTiers ? colors.piano.primary : colors.neutral.textMuted}
                              />
                              <Text style={styles.tiersToggleText}>Custom group prices per duration</Text>
                            </Pressable>

                            {groupState.useTiers && (
                              <View style={styles.tiersGrid}>
                                {DURATION_TIERS.map(dur => (
                                  <View key={dur} style={styles.tierInputRow}>
                                    <View style={styles.tierInputContainer}>
                                      <Text style={styles.currencySymbolTiny}>$</Text>
                                      <TextInput
                                        style={styles.tierInput}
                                        value={groupState.tierPrices?.[dur] || ''}
                                        onChangeText={(value) => handleGroupTierPriceChange(subject.key, dur, value)}
                                        keyboardType="decimal-pad"
                                        placeholder="—"
                                        placeholderTextColor={colors.neutral.textMuted}
                                      />
                                    </View>
                                    <Text style={styles.tierLabel}>/{dur}m</Text>
                                  </View>
                                ))}
                              </View>
                            )}
                          </View>
                        )}
                      </View>
```

Then, at the top of the `SUBJECTS.map` callback where `formState` is derived (line 404),
add a sibling line deriving `groupState`:

```typescript
                  const groupState = groupRates[subject.key] || { rate: '', duration: subject.defaultDuration, enabled: false, useTiers: false, tierPrices: {} };
```

- [ ] **Step 7: Replace the dead "Combined session" example row**

In the Example Calculations footer, replace the combined-session example row (lines 560–565)
that uses `combinedRate` with a Piano group example. Replace:

```tsx
                      <View style={styles.exampleRow}>
                        <Text style={styles.exampleLabel}>Combined session (2 students):</Text>
                        <Text style={styles.exampleValue}>
                          ${(parseFloat(combinedRate || '40') * 2).toFixed(2)}
                        </Text>
                      </View>
```

with:

```tsx
                      {groupRates['piano']?.enabled && (
                        <View style={styles.exampleRow}>
                          <Text style={styles.exampleLabel}>30-min Piano (group):</Text>
                          <Text style={styles.exampleValue}>
                            ${(() => {
                              const g = groupRates['piano'];
                              const tier = g.useTiers ? g.tierPrices?.[30] : undefined;
                              if (tier && tier.trim() !== '' && parseFloat(tier) > 0) return parseFloat(tier).toFixed(2);
                              const r = parseFloat(g.rate) || 0;
                              return ((30 / (g.duration || 30)) * r).toFixed(2);
                            })()}
                          </Text>
                        </View>
                      )}
```

- [ ] **Step 8: Type check and lint the file**

Run:
```bash
npm run typecheck 2>&1 | grep -c "error TS"
npx eslint src/components/RateSettingsModal.tsx
```
Expected: typecheck count back at the **baseline** from Step 0 (all `combined_session_rate`
references removed app-wide); eslint reports no new errors for the file.

- [ ] **Step 9: Commit**

```bash
git add src/components/RateSettingsModal.tsx
git commit -m "feat(ui): per-subject group price in Rate Settings modal"
```

---

## Task 9: Final verification & manual smoke test

- [ ] **Step 1: Confirm no lingering references to the removed field**

Run: `grep -rn "combined_session_rate\|combinedRate\|combinedSessionRate" src/ app/ supabase/ --include="*.ts" --include="*.tsx" --include="*.sql" | grep -v node_modules | grep -v "20260102000012\|20260103000001"`
Expected: **no output** (the two historical migrations may still mention it in comments — those are excluded and must not be edited).

- [ ] **Step 2: Confirm typecheck is at baseline**

Run: `npm run typecheck 2>&1 | grep -c "error TS"`
Expected: equals `/tmp/ts_baseline.txt` from Step 0.

- [ ] **Step 3: Run all edge math tests**

Run:
```bash
deno test supabase/functions/_shared/lessonAmount.test.ts
deno test supabase/functions/send-telegram-recap/recap.test.ts
```
Expected: all PASS.

- [ ] **Step 4: Manual smoke test (web)**

Run: `npm run web`, log in as a tutor, open Payments → Rate Settings. Verify:
1. The old "Combined Session Rate" section is gone.
2. Each subject card shows a "Set a different group price" toggle; enabling it reveals a rate +
   30m/60m picker + optional "Custom group prices per duration".
3. Set Piano individual = $60/60m and Piano group = $30/60m, Save → reopen → values persist.
4. Create/complete a combined session (2 students) including Piano and generate an invoice;
   confirm the Piano line bills at the $30 group rate, while an individual Piano lesson bills
   at $60.

- [ ] **Step 5: Final commit (if smoke test required tweaks)**

Only if Step 4 surfaced fixes:
```bash
git add -A
git commit -m "fix: address group pricing smoke-test findings"
```

---

## Self-review notes (author)

- **Spec coverage:** data model (T1), billing rule in all three sites (T2/T5/T6), edge function
  reads + flag (T3), types (T4), `combined_session_rate` removal across DB/types/UI/profile
  (T1/T4/T6/T7/T8), UI per-card group block (T8), tests (T2/T3). All spec sections mapped.
- **Backward compatibility:** combined session with no group rate resolves to the individual
  config in every site (T2 regression test asserts this).
- **Naming consistency:** column/field `group_subject_rates` used uniformly; form state
  `groupRates` / `groupState`; handlers `handleGroup*`. The Deno `TutorRateSettings` uses
  `group_subject_rates` matching the DB column.
