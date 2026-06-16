# Per-Student Custom Rates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a tutor set a durable special rate for an individual student, per-subject with duration tiers, that automatically applies to that student's lessons (solo or combined) ahead of all tutor-wide rates.

**Architecture:** Re-add a `subject_rates` JSONB column on `students` (same shape as `tutor_settings.subject_rates`). Rate-resolution functions on both client (`calculateLessonRate`, `useUninvoicedLessons`) and server (`calculateLessonAmount`) check the student's rates first (after the per-lesson `override_amount`), then fall back to the existing group → subject → default hierarchy. The tutor edits these on the student detail screen via a new modal that reuses a shared single-subject rate editor extracted from `RateSettingsModal`.

**Tech Stack:** React Native 0.81 + Expo, TypeScript, Supabase (Postgres + Deno Edge Functions). Pure-logic unit tests run with `deno test` (matching `src/lib/*.test.ts` and `supabase/functions/_shared/lessonAmount.test.ts`).

**Lookup hierarchy (highest first):** `override_amount` → **`students.subject_rates[subject]`** (NEW) → `group_subject_rates[subject]` (combined only) → `subject_rates[subject]` → `default_rate`. A student entry is active only when `rate > 0 && base_duration > 0`.

---

## File Structure

- **Create** `supabase/migrations/20260616000001_student_subject_rates.sql` — adds the column.
- **Modify** `src/types/database.ts` — add `subject_rates` to the `students` table types and to `UpdateStudentInput`.
- **Modify** `supabase/functions/_shared/lessonAmount.ts` — add `studentRates` param, checked first.
- **Modify** `supabase/functions/_shared/lessonAmount.test.ts` — add student-rate cases.
- **Modify** `supabase/functions/auto-complete-lessons/index.ts` — fetch & pass per-student rates.
- **Modify** `supabase/functions/send-telegram-recap/index.ts` — fetch & pass per-student rates.
- **Modify** `src/hooks/useTutorSettings.ts` — add optional `studentRates` to `calculateLessonRate`.
- **Modify** `src/hooks/usePayments.ts` — `useUninvoicedLessons` checks student rates first.
- **Create** `src/lib/subjectRateForm.ts` — pure form-state ↔ `SubjectRateConfig` helpers + shared constants/types.
- **Create** `src/lib/subjectRateForm.test.ts` — Deno tests for the helpers.
- **Create** `src/components/SubjectRateEditor.tsx` — presentational single-subject rate editor.
- **Create** `src/components/StudentRateSettingsModal.tsx` — modal for editing one student's per-subject rates.
- **Modify** `app/student/[id].tsx` — add a "Custom Rates" section + modal trigger.
- **Modify** `src/components/RateSettingsModal.tsx` — reuse the shared editor & helpers (consistency rewire).

---

## Task 1: Database migration — add `students.subject_rates`

**Files:**
- Create: `supabase/migrations/20260616000001_student_subject_rates.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Per-student, per-subject rate overrides.
--
-- Re-introduces students.subject_rates (dropped in
-- 20260614000001_drop_vestigial_student_rates.sql as vestigial). This time it
-- is written by the student detail screen and read by billing. Shape mirrors
-- tutor_settings.subject_rates: { "<subject>": { rate, base_duration,
-- duration_prices? } }. An empty object means "use the tutor-wide rate".
--
-- A student rate, when present and valid (rate > 0 && base_duration > 0), wins
-- over group_subject_rates and subject_rates for that student's lessons
-- (solo or combined). The per-lesson override_amount still takes precedence.
--
-- hourly_rate is intentionally NOT re-added; only per-subject configs are used.

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS subject_rates JSONB NOT NULL DEFAULT '{}'::jsonb;
```

- [ ] **Step 2: Apply the migration locally**

Run: `npx supabase db push`
Expected: migration applies with no error; `students` now has a `subject_rates jsonb` column defaulting to `{}`.

(If a local DB is in use instead, `npx supabase db reset` also works. Use whichever matches the project's current workflow.)

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260616000001_student_subject_rates.sql
git commit -m "feat(db): add students.subject_rates for per-student rate overrides"
```

---

## Task 2: Types — add `subject_rates` to student types

**Files:**
- Modify: `src/types/database.ts` (students `Row`/`Insert`/`Update` at lines ~196-231; `UpdateStudentInput` at lines ~1650-1657)

- [ ] **Step 1: Add `subject_rates` to the `students` Row**

In `src/types/database.ts`, in the `students` table `Row` (after `subjects: string[];`), add:

```typescript
          subjects: string[];
          subject_rates: Json;
          avatar_url: string | null;
```

- [ ] **Step 2: Add `subject_rates` to the `students` Insert**

In the `students` `Insert` block (after `subjects?: string[];`), add:

```typescript
          subjects?: string[];
          subject_rates?: Json;
          avatar_url?: string | null;
```

- [ ] **Step 3: Add `subject_rates` to the `students` Update**

In the `students` `Update` block (after `subjects?: string[];`), add:

```typescript
          subjects?: string[];
          subject_rates?: Json;
          avatar_url?: string | null;
```

- [ ] **Step 4: Add `subject_rates` to `UpdateStudentInput`**

Replace the `UpdateStudentInput` interface (lines ~1650-1657) with:

```typescript
export interface UpdateStudentInput {
  parent_id?: string;
  name?: string;
  age?: number;
  grade_level?: string;
  subjects?: string[];
  subject_rates?: SubjectRates;
  avatar_url?: string | null;
}
```

(`SubjectRates` is already defined in this file at line ~1612 and `Json` is already imported/defined; no new imports needed. The `Student` type at line 1016 is `Tables<'students'>`, so it picks up `subject_rates: Json` automatically.)

- [ ] **Step 5: Verify no new type errors are introduced**

Run: `npm run typecheck 2>&1 | grep -c "error TS"`
Expected: the count is **not higher** than the pre-existing baseline (the repo has ~361 pre-existing errors per project memory; compare against `git stash && npm run typecheck` baseline if unsure). The edited lines themselves must not introduce new errors.

- [ ] **Step 6: Commit**

```bash
git add src/types/database.ts
git commit -m "feat(types): add subject_rates to student types"
```

---

## Task 3: Server calc — `calculateLessonAmount` checks student rates first

**Files:**
- Modify: `supabase/functions/_shared/lessonAmount.ts`
- Test: `supabase/functions/_shared/lessonAmount.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `supabase/functions/_shared/lessonAmount.test.ts`:

```typescript
Deno.test('student rate wins over subject rate (solo)', () => {
  const settings = { subject_rates: { piano: { rate: 60, base_duration: 60 } } };
  const studentRates = { piano: { rate: 40, base_duration: 60 } };
  assertEquals(calculateLessonAmount(settings, 'piano', 60, false, null, studentRates), 40);
});

Deno.test('student rate wins over group rate (combined)', () => {
  const settings = {
    subject_rates: { piano: { rate: 60, base_duration: 60 } },
    group_subject_rates: { piano: { rate: 30, base_duration: 60 } },
  };
  const studentRates = { piano: { rate: 40, base_duration: 60 } };
  assertEquals(calculateLessonAmount(settings, 'piano', 60, true, null, studentRates), 40);
});

Deno.test('student rate duration tier applies', () => {
  const studentRates = { piano: { rate: 40, base_duration: 60, duration_prices: { '45': 35 } } };
  assertEquals(calculateLessonAmount(null, 'piano', 45, false, null, studentRates), 35);
});

Deno.test('student rate pro-rated by duration', () => {
  const studentRates = { piano: { rate: 40, base_duration: 60 } };
  assertEquals(calculateLessonAmount(null, 'piano', 30, false, null, studentRates), 20);
});

Deno.test('inactive student rate falls through to subject rate', () => {
  const settings = { subject_rates: { piano: { rate: 60, base_duration: 60 } } };
  const studentRates = { piano: { rate: 0, base_duration: 60 } };
  assertEquals(calculateLessonAmount(settings, 'piano', 60, false, null, studentRates), 60);
});

Deno.test('no student rate for subject falls through', () => {
  const settings = { subject_rates: { piano: { rate: 60, base_duration: 60 } } };
  const studentRates = { math: { rate: 40, base_duration: 60 } };
  assertEquals(calculateLessonAmount(settings, 'piano', 60, false, null, studentRates), 60);
});

Deno.test('override_amount beats an active student rate', () => {
  const studentRates = { piano: { rate: 40, base_duration: 60 } };
  assertEquals(calculateLessonAmount(null, 'piano', 60, false, 12.5, studentRates), 12.5);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `deno test supabase/functions/_shared/lessonAmount.test.ts`
Expected: FAIL — `calculateLessonAmount` takes 5 args; the new `studentRates` argument is ignored, so the student-rate assertions fail (e.g. expected 40, got 60).

- [ ] **Step 3: Implement the `studentRates` parameter**

In `supabase/functions/_shared/lessonAmount.ts`, replace the function signature and the rate-config resolution block. Change the signature (line ~23-29) to add the param:

```typescript
export function calculateLessonAmount(
  settings: TutorRateSettings | null,
  subject: string,
  durationMin: number,
  isCombinedSession: boolean,
  overrideAmount?: number | null,
  studentRates?: Record<string, SubjectRateConfig> | null,
): number {
  const defaultRate = 45;
  const defaultBaseDuration = 60;

  if (overrideAmount !== undefined && overrideAmount !== null) {
    return overrideAmount;
  }

  // Resolve the applicable rate config. A valid per-student rate wins over all
  // tutor-wide rates (solo or combined). Otherwise: combined sessions prefer the
  // group rate, then the individual subject rate, then the default.
  let rateConfig: SubjectRateConfig | undefined;
  const studentCfg = studentRates ? studentRates[subject] : undefined;
  if (isValidConfig(studentCfg)) {
    rateConfig = studentCfg;
  }
  if (!rateConfig && isCombinedSession) {
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
```

Leave the rest of the function (the `if (rateConfig) { ... } else { ... }` tier/linear block and `return`) unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `deno test supabase/functions/_shared/lessonAmount.test.ts`
Expected: PASS — all original cases plus the 7 new ones.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/lessonAmount.ts supabase/functions/_shared/lessonAmount.test.ts
git commit -m "feat(edge): calculateLessonAmount honors per-student rates"
```

---

## Task 4: Wire edge functions to pass per-student rates

**Files:**
- Modify: `supabase/functions/auto-complete-lessons/index.ts` (students fetch ~line 288; calc call ~line 313-324)
- Modify: `supabase/functions/send-telegram-recap/index.ts` (lessons select ~line 152; calc call ~line 185-191)

- [ ] **Step 1: auto-complete — fetch student rates and build a map**

In `supabase/functions/auto-complete-lessons/index.ts`, replace the students fetch (line ~288) and the `studentIds` line:

```typescript
  const { data: students } = await supabase
    .from('students')
    .select('id, subject_rates')
    .eq('parent_id', parentId);
  if (!students || students.length === 0) return null;
  const studentIds = students.map((s: { id: string }) => s.id);
  const studentRatesById = new Map<string, Record<string, any> | null>(
    students.map((s: { id: string; subject_rates: Record<string, any> | null }) => [s.id, s.subject_rates ?? null]),
  );
```

- [ ] **Step 2: auto-complete — pass the student's rates into the calc**

In the same file, replace the `calculateLessonAmount(...)` call inside the `lessonAmounts` map (line ~317-323) with:

```typescript
    amount: calculateLessonAmount(
      (settings as any) ?? null,
      l.subject,
      Number(l.duration_min) || 0,
      l.session_id !== null,
      l.override_amount == null ? null : Number(l.override_amount),
      (studentRatesById.get(l.student_id) as any) ?? null,
    ),
```

(`l.student_id` is already selected at line ~294: `'id, student_id, subject, duration_min, session_id, override_amount'`.)

- [ ] **Step 3: telegram-recap — select student subject_rates in the join**

In `supabase/functions/send-telegram-recap/index.ts`, change the lessons select (line ~152) so the student join also returns `subject_rates`:

```typescript
      .select('id, subject, scheduled_at, duration_min, status, session_id, override_amount, auto_completed_at, payment_lessons(paid), student:students!inner(name, subject_rates)')
```

- [ ] **Step 4: telegram-recap — pass the student's rates into the calc**

In the same file, replace the `calculateLessonAmount(...)` call inside the `expected` reduce (line ~185-191) with:

```typescript
          calculateLessonAmount(
            settings ?? null,
            l.subject,
            Number(l.duration_min) || 0,
            l.session_id !== null,
            l.override_amount == null ? null : Number(l.override_amount),
            (l.student?.subject_rates as any) ?? null,
          ),
```

- [ ] **Step 5: Type-check the edge functions compile (best-effort)**

Run: `deno check supabase/functions/auto-complete-lessons/index.ts supabase/functions/send-telegram-recap/index.ts`
Expected: no new errors attributable to these edits. (If `deno check` surfaces unrelated pre-existing import errors, confirm the changed lines are not among them.)

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/auto-complete-lessons/index.ts supabase/functions/send-telegram-recap/index.ts
git commit -m "feat(edge): pass per-student rates into lesson amount calc"
```

---

## Task 5: Client shared calc — `calculateLessonRate` accepts `studentRates`

**Files:**
- Modify: `src/hooks/useTutorSettings.ts` (`calculateLessonRate` at lines ~223-258)

- [ ] **Step 1: Add the `studentRates` parameter and check it first**

In `src/hooks/useTutorSettings.ts`, replace the `calculateLessonRate` function (lines ~223-258) with:

```typescript
export function calculateLessonRate(
  settings: TutorSettings | null,
  subject: string,
  durationMin: number,
  isCombinedSession: boolean,
  studentRates?: SubjectRates | null
): number {
  // A valid per-student rate wins over all tutor-wide rates (solo or combined).
  // Otherwise combined sessions prefer the per-subject group rate, then fall
  // back to the individual subject rate (then the tutor default).
  let rateConfig: SubjectRateConfig | undefined;
  const studentCfg = studentRates?.[subject as keyof SubjectRates];
  if (studentCfg && studentCfg.rate > 0 && studentCfg.base_duration > 0) {
    rateConfig = studentCfg;
  }
  if (!rateConfig && isCombinedSession) {
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

(`studentRates` is optional, so existing callers are unaffected.)

- [ ] **Step 2: Verify no new type errors**

Run: `npm run typecheck 2>&1 | grep "useTutorSettings"`
Expected: no errors referencing `useTutorSettings.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useTutorSettings.ts
git commit -m "feat(rates): calculateLessonRate accepts per-student rates"
```

---

## Task 6: Client invoice read — `useUninvoicedLessons` checks student rates

**Files:**
- Modify: `src/hooks/usePayments.ts` (students fetch ~line 731-734; rate config selection ~line 834-835)

- [ ] **Step 1: Select `subject_rates` when fetching students**

In `src/hooks/usePayments.ts`, change the students query (line ~731-734) to include `subject_rates`:

```typescript
      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select('id, name, subject_rates')
        .eq('parent_id', parentId);
```

The existing `studentMap` (line ~747, `new Map(students.map(s => [s.id, s]))`) now carries `subject_rates` per student — no change needed there.

- [ ] **Step 2: Prefer the student's rate config over the tutor-wide one**

In the lesson `.map(...)` (after `const student = studentMap.get(lesson.student_id);` at line ~806, and before the `override_amount` early-return), the existing tutor-wide lookup is:

```typescript
          const subjectRateConfig = tutorSubjectRates[lesson.subject as keyof SubjectRates];
```

Replace that single line (line ~834) with a student-first resolution:

```typescript
          const studentSubjectRates = (student?.subject_rates as SubjectRates | undefined) || {};
          const studentRateConfig = studentSubjectRates[lesson.subject as keyof SubjectRates];
          const subjectRateConfig =
            studentRateConfig && studentRateConfig.rate > 0 && studentRateConfig.base_duration > 0
              ? studentRateConfig
              : tutorSubjectRates[lesson.subject as keyof SubjectRates];
```

The downstream block (lines ~835-868) already handles `subjectRateConfig` (tier-then-linear, with default fallback) and is unchanged. Because the student rate is now assigned into `subjectRateConfig`, it automatically wins for both solo and combined lessons, matching the server.

- [ ] **Step 3: Verify no new type errors**

Run: `npm run typecheck 2>&1 | grep "usePayments"`
Expected: no errors referencing `usePayments.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/usePayments.ts
git commit -m "feat(payments): apply per-student rates in invoice calculation"
```

---

## Task 7: Shared form helpers — `src/lib/subjectRateForm.ts`

This extracts the pure form-state ↔ `SubjectRateConfig` conversion (currently inline in `RateSettingsModal`) so the student modal and the settings modal share one implementation. Pure module (no React/RN imports) so it is Deno-testable like the other `src/lib/*.test.ts`.

**Files:**
- Create: `src/lib/subjectRateForm.ts`
- Test: `src/lib/subjectRateForm.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/subjectRateForm.test.ts`:

```typescript
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  DURATION_TIERS,
  emptyFormState,
  formStateFromConfig,
  buildSubjectRateConfig,
} from './subjectRateForm.ts';

Deno.test('emptyFormState is disabled with given default duration', () => {
  assertEquals(emptyFormState(30), { rate: '', duration: 30, enabled: false, useTiers: false, tierPrices: {} });
});

Deno.test('formStateFromConfig: no config -> empty disabled state', () => {
  assertEquals(formStateFromConfig(undefined, 60).enabled, false);
});

Deno.test('formStateFromConfig: linear config -> enabled, no tiers', () => {
  const fs = formStateFromConfig({ rate: 40, base_duration: 60 }, 60);
  assertEquals(fs.rate, '40');
  assertEquals(fs.duration, 60);
  assertEquals(fs.enabled, true);
  assertEquals(fs.useTiers, false);
});

Deno.test('formStateFromConfig: tier config -> useTiers true with string prices', () => {
  const fs = formStateFromConfig({ rate: 40, base_duration: 60, duration_prices: { 45: 35 } }, 60);
  assertEquals(fs.useTiers, true);
  assertEquals(fs.tierPrices[45], '35');
});

Deno.test('buildSubjectRateConfig: disabled/empty -> undefined', () => {
  assertEquals(buildSubjectRateConfig({ rate: '', duration: 60, enabled: false, useTiers: false, tierPrices: {} }), undefined);
});

Deno.test('buildSubjectRateConfig: linear', () => {
  assertEquals(
    buildSubjectRateConfig({ rate: '40', duration: 60, enabled: true, useTiers: false, tierPrices: {} }),
    { rate: 40, base_duration: 60 },
  );
});

Deno.test('buildSubjectRateConfig: tiers with string keys', () => {
  const cfg = buildSubjectRateConfig({
    rate: '40', duration: 60, enabled: true, useTiers: true, tierPrices: { 45: '35', 60: '' },
  });
  assertEquals(cfg, { rate: 40, base_duration: 60, duration_prices: { '45': 35 } });
});

Deno.test('buildSubjectRateConfig: invalid rate -> undefined', () => {
  assertEquals(buildSubjectRateConfig({ rate: 'abc', duration: 60, enabled: true, useTiers: false, tierPrices: {} }), undefined);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `deno test src/lib/subjectRateForm.test.ts`
Expected: FAIL — module `./subjectRateForm.ts` does not exist.

- [ ] **Step 3: Implement the helpers**

Create `src/lib/subjectRateForm.ts`:

```typescript
/**
 * Pure helpers for converting between the per-subject rate editor's form state
 * and the persisted SubjectRateConfig shape. Shared by RateSettingsModal and
 * StudentRateSettingsModal so the two stay consistent. No React/RN imports —
 * unit-testable with `deno test`.
 */
import type { SubjectRateConfig, DurationPrices } from '../types/database';

// Common duration tiers offered for explicit per-duration pricing.
export const DURATION_TIERS = [30, 45, 60, 90] as const;

export interface SubjectRateFormState {
  rate: string;
  duration: number;
  enabled: boolean;
  useTiers: boolean;
  tierPrices: Record<number, string>;
}

export function emptyFormState(defaultDuration: number): SubjectRateFormState {
  return { rate: '', duration: defaultDuration, enabled: false, useTiers: false, tierPrices: {} };
}

/** Build editor form state from a persisted config (or empty state if none/invalid). */
export function formStateFromConfig(
  config: SubjectRateConfig | undefined | null,
  defaultDuration: number,
): SubjectRateFormState {
  if (!config || !(config.rate > 0)) {
    return emptyFormState(defaultDuration);
  }
  const hasTiers = !!config.duration_prices && Object.keys(config.duration_prices).length > 0;
  const tierPrices: Record<number, string> = {};
  if (hasTiers && config.duration_prices) {
    DURATION_TIERS.forEach((dur) => {
      const price = config.duration_prices?.[dur as keyof DurationPrices];
      tierPrices[dur] = price !== undefined && price !== null ? price.toString() : '';
    });
  }
  return {
    rate: config.rate.toString(),
    duration: config.base_duration,
    enabled: true,
    useTiers: hasTiers,
    tierPrices,
  };
}

/** Convert editor form state to a persisted config, or undefined when not set/invalid. */
export function buildSubjectRateConfig(
  formState: SubjectRateFormState | undefined,
): SubjectRateConfig | undefined {
  if (!formState?.enabled || formState.rate.trim() === '') return undefined;
  const parsed = parseFloat(formState.rate);
  if (isNaN(parsed) || parsed <= 0) return undefined;

  const config: SubjectRateConfig = { rate: parsed, base_duration: formState.duration };

  if (formState.useTiers && formState.tierPrices) {
    const durationPrices: Record<string, number> = {};
    let hasTierPrices = false;
    const tierPricesObj = formState.tierPrices as Record<string | number, string>;
    DURATION_TIERS.forEach((dur) => {
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
      config.duration_prices = durationPrices as DurationPrices;
    }
  }
  return config;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `deno test src/lib/subjectRateForm.test.ts`
Expected: PASS — all 8 cases.

- [ ] **Step 5: Commit**

```bash
git add src/lib/subjectRateForm.ts src/lib/subjectRateForm.test.ts
git commit -m "feat(rates): shared subject-rate form helpers"
```

---

## Task 8: Presentational `SubjectRateEditor` component

A single-subject rate editor (header + base rate row + duration tiers). No group section — students' rates always win for both solo and combined, so there is no separate student group rate. Fully controlled via props.

**Files:**
- Create: `src/components/SubjectRateEditor.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/SubjectRateEditor.tsx`:

```typescript
/**
 * SubjectRateEditor
 * Presentational, fully-controlled editor for ONE subject's rate: a base rate
 * row (amount + 30m/60m base duration) plus optional explicit per-duration
 * tier prices. Shared by RateSettingsModal and StudentRateSettingsModal.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '../theme';
import { DURATION_TIERS, SubjectRateFormState } from '../lib/subjectRateForm';

interface SubjectRateEditorProps {
  label: string;
  emoji: string;
  formState: SubjectRateFormState;
  /** Placeholder for the rate input — e.g. the tutor-wide rate being overridden. */
  ratePlaceholder?: string;
  onRateChange: (value: string) => void;
  onDurationChange: (duration: number) => void;
  onToggleTiers: () => void;
  onTierPriceChange: (duration: number, value: string) => void;
}

export function SubjectRateEditor({
  label,
  emoji,
  formState,
  ratePlaceholder,
  onRateChange,
  onDurationChange,
  onToggleTiers,
  onTierPriceChange,
}: SubjectRateEditorProps) {
  return (
    <View style={styles.subjectRateCard}>
      <View style={styles.subjectHeader}>
        <Text style={styles.subjectEmoji}>{emoji}</Text>
        <Text style={styles.subjectName}>{label}</Text>
        {formState.enabled && (
          <View style={styles.customBadge}>
            <Text style={styles.customBadgeText}>{formState.useTiers ? 'Tiers' : 'Custom'}</Text>
          </View>
        )}
      </View>

      {/* Base rate row */}
      <View style={styles.subjectRateRow}>
        <View style={styles.subjectInputGroup}>
          <View style={styles.subjectRateInputContainer}>
            <Text style={styles.currencySymbolSmall}>$</Text>
            <TextInput
              style={styles.subjectRateInput}
              value={formState.rate}
              onChangeText={onRateChange}
              keyboardType="decimal-pad"
              placeholder={ratePlaceholder ?? ''}
              placeholderTextColor={colors.neutral.textMuted}
            />
          </View>
          <Text style={styles.perTextSmall}>per</Text>
          {[30, 60].map((dur) => (
            <Pressable
              key={dur}
              style={[styles.durationOptionSmall, formState.duration === dur && styles.durationOptionSmallSelected]}
              onPress={() => onDurationChange(dur)}
            >
              <Text
                style={[
                  styles.durationOptionTextSmall,
                  formState.duration === dur && styles.durationOptionTextSmallSelected,
                ]}
              >
                {dur}m
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Duration tiers */}
      {formState.enabled && (
        <View style={styles.tiersSection}>
          <Pressable style={styles.tiersToggle} onPress={onToggleTiers}>
            <Ionicons
              name={formState.useTiers ? 'checkbox' : 'square-outline'}
              size={20}
              color={formState.useTiers ? colors.piano.primary : colors.neutral.textMuted}
            />
            <Text style={styles.tiersToggleText}>Custom prices per duration</Text>
          </Pressable>

          {formState.useTiers && (
            <View style={styles.tiersInputsContainer}>
              <View style={styles.tiersGrid}>
                {DURATION_TIERS.map((dur) => (
                  <View key={dur} style={styles.tierInputRow}>
                    <View style={styles.tierInputContainer}>
                      <Text style={styles.currencySymbolTiny}>$</Text>
                      <TextInput
                        style={styles.tierInput}
                        value={formState.tierPrices?.[dur] || ''}
                        onChangeText={(value) => onTierPriceChange(dur, value)}
                        keyboardType="decimal-pad"
                        placeholder="—"
                        placeholderTextColor={colors.neutral.textMuted}
                      />
                    </View>
                    <Text style={styles.tierLabel}>/{dur}m</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.tiersHint}>Leave empty to use base rate calculation</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
```

- [ ] **Step 2: Add the StyleSheet by copying the exact style entries**

Append a `const styles = StyleSheet.create({ ... })` to `src/components/SubjectRateEditor.tsx`. Copy the bodies of these style keys **verbatim** from the `StyleSheet.create` in `src/components/RateSettingsModal.tsx` (lines ~769-end) — they already exist there with the exact look used today:

`subjectRateCard`, `subjectHeader`, `subjectEmoji`, `subjectName`, `customBadge`, `customBadgeText`, `subjectRateRow`, `subjectInputGroup`, `subjectRateInputContainer`, `currencySymbolSmall`, `subjectRateInput`, `perTextSmall`, `durationOptionSmall`, `durationOptionSmallSelected`, `durationOptionTextSmall`, `durationOptionTextSmallSelected`, `tiersSection`, `tiersToggle`, `tiersToggleText`, `tiersInputsContainer`, `tiersGrid`, `tierInputRow`, `tierInputContainer`, `currencySymbolTiny`, `tierInput`, `tierLabel`, `tiersHint`.

To list the exact current definitions to copy, run:

```bash
sed -n '769,$p' src/components/RateSettingsModal.tsx
```

Copy each listed key's `{ ... },` block into the new StyleSheet. Do not alter values.

- [ ] **Step 3: Verify it imports/renders without type errors**

Run: `npm run typecheck 2>&1 | grep "SubjectRateEditor"`
Expected: no errors referencing `SubjectRateEditor.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/components/SubjectRateEditor.tsx
git commit -m "feat(ui): shared SubjectRateEditor component"
```

---

## Task 9: `StudentRateSettingsModal` component

A modal that edits one student's per-subject custom rates, showing only the subjects the student is enrolled in, each with the shared editor. Saves the assembled `subject_rates` JSON via `useUpdateStudent`.

**Files:**
- Create: `src/components/StudentRateSettingsModal.tsx`

- [ ] **Step 1: Create the modal**

Create `src/components/StudentRateSettingsModal.tsx`:

```typescript
/**
 * StudentRateSettingsModal
 * Lets a tutor set per-subject custom rates for a single student. Only the
 * student's enrolled subjects are shown. A set rate overrides the tutor-wide
 * rate for that student (solo or combined). Clearing a subject (toggle off /
 * empty) falls back to the tutor-wide rate.
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable, ScrollView, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '../theme';
import { SubjectRates, TutoringSubject, StudentWithParent } from '../types/database';
import {
  SubjectRateFormState, emptyFormState, formStateFromConfig, buildSubjectRateConfig,
} from '../lib/subjectRateForm';
import { useTutorSettings, formatRateDisplay, getSubjectRateConfig } from '../hooks/useTutorSettings';
import { SubjectRateEditor } from './SubjectRateEditor';

// Display metadata + default base duration per subject (mirrors RateSettingsModal).
const SUBJECT_META: Record<string, { label: string; emoji: string; defaultDuration: number }> = {
  piano: { label: 'Piano', emoji: '🎹', defaultDuration: 30 },
  math: { label: 'Math', emoji: '➗', defaultDuration: 60 },
  reading: { label: 'Reading', emoji: '📖', defaultDuration: 60 },
  speech: { label: 'Speech', emoji: '🗣️', defaultDuration: 60 },
  english: { label: 'English', emoji: '📝', defaultDuration: 60 },
};

function metaFor(subject: string) {
  return SUBJECT_META[subject] ?? {
    label: subject.charAt(0).toUpperCase() + subject.slice(1),
    emoji: '📚',
    defaultDuration: 60,
  };
}

interface StudentRateSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  student: StudentWithParent;
  /** Persist the new rates; return true on success. */
  onSave: (subjectRates: SubjectRates) => Promise<boolean>;
  saving?: boolean;
}

export function StudentRateSettingsModal({
  visible, onClose, student, onSave, saving,
}: StudentRateSettingsModalProps) {
  const { data: settings } = useTutorSettings();
  const enrolledSubjects = student.subjects || [];
  const [forms, setForms] = useState<Record<string, SubjectRateFormState>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize form state from the student's saved rates whenever the modal opens.
  useEffect(() => {
    if (!visible) return;
    const saved = (student.subject_rates as SubjectRates | undefined) || {};
    const next: Record<string, SubjectRateFormState> = {};
    enrolledSubjects.forEach((subject) => {
      next[subject] = formStateFromConfig(
        saved[subject as keyof SubjectRates],
        metaFor(subject).defaultDuration,
      );
    });
    setForms(next);
    setHasChanges(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, student.id]);

  const update = (subject: string, patch: Partial<SubjectRateFormState>) => {
    setForms((prev) => ({
      ...prev,
      [subject]: { ...(prev[subject] ?? emptyFormState(metaFor(subject).defaultDuration)), ...patch },
    }));
    setHasChanges(true);
  };

  const handleToggleEnabled = (subject: string) => {
    const current = forms[subject] ?? emptyFormState(metaFor(subject).defaultDuration);
    update(subject, { enabled: !current.enabled });
  };

  const handleSave = async () => {
    const result: SubjectRates = {};
    for (const subject of enrolledSubjects) {
      const cfg = buildSubjectRateConfig(forms[subject]);
      if (cfg) result[subject as keyof SubjectRates] = cfg;
    }
    const ok = await onSave(result);
    if (ok) {
      setHasChanges(false);
      onClose();
    } else {
      Alert.alert('Error', 'Failed to save custom rates. Please try again.');
    }
  };

  const handleClose = () => {
    if (hasChanges) {
      Alert.alert('Unsaved Changes', 'Discard your changes?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: onClose },
      ]);
    } else {
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable style={styles.closeButton} onPress={handleClose}>
            <Ionicons name="close" size={24} color={colors.neutral.text} />
          </Pressable>
          <Text style={styles.title}>Custom Rates</Text>
          <Pressable
            style={[styles.saveButton, !hasChanges && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!hasChanges || saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.neutral.white} />
            ) : (
              <Text style={[styles.saveButtonText, !hasChanges && styles.saveButtonTextDisabled]}>Save</Text>
            )}
          </Pressable>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.intro}>
            Set a special rate for {student.name}. A custom rate overrides the
            usual rate for this student. Leave a subject off to use your normal rate.
          </Text>

          {enrolledSubjects.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="pricetags-outline" size={32} color="#CCC" />
              <Text style={styles.emptyText}>No subjects enrolled</Text>
              <Text style={styles.emptySubtext}>Add a subject to this student to set custom rates.</Text>
            </View>
          ) : (
            enrolledSubjects.map((subject) => {
              const meta = metaFor(subject);
              const formState = forms[subject] ?? emptyFormState(meta.defaultDuration);
              const tutorCfg = getSubjectRateConfig(settings, subject);
              const tutorRateLabel = formatRateDisplay(tutorCfg.rate, tutorCfg.base_duration);
              return (
                <View key={subject} style={styles.subjectBlock}>
                  <Pressable style={styles.enableToggle} onPress={() => handleToggleEnabled(subject)}>
                    <Ionicons
                      name={formState.enabled ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={formState.enabled ? colors.piano.primary : colors.neutral.textMuted}
                    />
                    <Text style={styles.enableToggleText}>
                      {meta.emoji} {meta.label} — use custom rate
                    </Text>
                  </Pressable>
                  <Text style={styles.defaultHint}>Your usual rate: {tutorRateLabel}</Text>

                  {formState.enabled && (
                    <SubjectRateEditor
                      label={meta.label}
                      emoji={meta.emoji}
                      formState={formState}
                      ratePlaceholder={String(tutorCfg.rate)}
                      onRateChange={(value) =>
                        update(subject, { rate: value, enabled: true })
                      }
                      onDurationChange={(duration) => update(subject, { duration })}
                      onToggleTiers={() => update(subject, { useTiers: !formState.useTiers })}
                      onTierPriceChange={(duration, value) =>
                        update(subject, {
                          tierPrices: { ...formState.tierPrices, [duration]: value },
                          enabled: true,
                        })
                      }
                    />
                  )}
                </View>
              );
            })
          )}
          <View style={{ height: spacing['2xl'] }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.neutral.border, backgroundColor: colors.neutral.white,
  },
  closeButton: { padding: spacing.xs },
  title: { fontSize: typography.sizes.lg, fontWeight: typography.weights.semibold, color: colors.neutral.text },
  saveButton: {
    backgroundColor: colors.piano.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: borderRadius.md, minWidth: 70, alignItems: 'center',
  },
  saveButtonDisabled: { backgroundColor: colors.neutral.border },
  saveButtonText: { color: colors.neutral.white, fontWeight: typography.weights.semibold, fontSize: typography.sizes.base },
  saveButtonTextDisabled: { color: colors.neutral.textMuted },
  content: { flex: 1, padding: spacing.base },
  intro: { fontSize: typography.sizes.sm, color: colors.neutral.textSecondary, marginBottom: spacing.lg },
  subjectBlock: { marginBottom: spacing.lg },
  enableToggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  enableToggleText: { fontSize: typography.sizes.base, fontWeight: typography.weights.medium, color: colors.neutral.text },
  defaultHint: { fontSize: typography.sizes.xs, color: colors.neutral.textMuted, marginLeft: 28, marginTop: 2, marginBottom: spacing.sm },
  emptyState: { backgroundColor: colors.neutral.surface, borderRadius: borderRadius.lg, padding: spacing.xl, alignItems: 'center' },
  emptyText: { fontSize: typography.sizes.sm, color: colors.neutral.textMuted, marginTop: spacing.sm },
  emptySubtext: { fontSize: typography.sizes.xs, color: colors.neutral.border, marginTop: spacing.xs, textAlign: 'center' },
});
```

- [ ] **Step 2: Verify no new type errors**

Run: `npm run typecheck 2>&1 | grep "StudentRateSettingsModal"`
Expected: no errors referencing `StudentRateSettingsModal.tsx`. (If `getSubjectRateConfig` is not exported from `useTutorSettings.ts`, it already is — confirmed at line ~193.)

- [ ] **Step 3: Commit**

```bash
git add src/components/StudentRateSettingsModal.tsx
git commit -m "feat(ui): StudentRateSettingsModal for per-student rates"
```

---

## Task 10: Wire "Custom Rates" into the student detail screen

**Files:**
- Modify: `app/student/[id].tsx`

- [ ] **Step 1: Import the modal and `SubjectRates`/`UpdateStudentInput`**

In `app/student/[id].tsx`, update the imports. The line (line ~16) currently:

```typescript
import { UpdateStudentInput, ScheduledLessonWithStudent } from '../../src/types/database';
```

Replace with:

```typescript
import { UpdateStudentInput, ScheduledLessonWithStudent, SubjectRates } from '../../src/types/database';
import { StudentRateSettingsModal } from '../../src/components/StudentRateSettingsModal';
```

- [ ] **Step 2: Add modal visibility state**

After the existing `const [editModalVisible, setEditModalVisible] = useState(false);` (line ~77), add:

```typescript
  const [rateModalVisible, setRateModalVisible] = useState(false);
```

- [ ] **Step 3: Add a save handler for custom rates**

After `handleSaveStudent` (ends ~line 142), add:

```typescript
  const handleSaveRates = async (subjectRates: SubjectRates): Promise<boolean> => {
    if (!id) return false;
    const result = await updateStudent(id, { subject_rates: subjectRates });
    if (result) {
      await refetch();
      return true;
    }
    return false;
  };
```

- [ ] **Step 4: Add a "Custom Rates" section to the UI**

Insert this section in the `ScrollView`, immediately after the closing `</View>` of the "Lesson Schedule Section" and before the "Recent Progress Section" (around line 508). Use this exact block:

```tsx
        {/* Custom Rates Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Custom Rates</Text>
            <TouchableOpacity onPress={() => setRateModalVisible(true)}>
              <Text style={styles.manageRatesLink}>Manage</Text>
            </TouchableOpacity>
          </View>
          {(() => {
            const customRates = (student.subject_rates as SubjectRates | undefined) || {};
            const entries = Object.entries(customRates).filter(
              ([, cfg]) => cfg && cfg.rate > 0 && cfg.base_duration > 0
            );
            if (entries.length === 0) {
              return (
                <TouchableOpacity style={styles.emptyState} onPress={() => setRateModalVisible(true)}>
                  <Ionicons name="pricetags-outline" size={32} color="#CCC" />
                  <Text style={styles.emptyText}>No custom rates set</Text>
                  <Text style={styles.emptySubtext}>Tap to set a special rate for this student</Text>
                </TouchableOpacity>
              );
            }
            return (
              <View style={styles.customRatesList}>
                {entries.map(([subject, cfg]) => {
                  const subjectConfig = SUBJECT_CONFIG[subject] || {
                    icon: 'school',
                    color: colors.neutral.textSecondary,
                    label: subject.charAt(0).toUpperCase() + subject.slice(1),
                  };
                  const label =
                    cfg!.base_duration === 60
                      ? `$${cfg!.rate}/hr`
                      : `$${cfg!.rate}/${cfg!.base_duration}min`;
                  return (
                    <View key={subject} style={styles.customRateRow}>
                      <View style={styles.lessonSubjectBadge}>
                        <Ionicons name={subjectConfig.icon as any} size={14} color={subjectConfig.color} />
                        <Text style={[styles.lessonSubjectText, { color: subjectConfig.color }]}>
                          {subjectConfig.label}
                        </Text>
                      </View>
                      <Text style={styles.customRateValue}>
                        {label}{cfg!.duration_prices ? ' + tiers' : ''}
                      </Text>
                    </View>
                  );
                })}
              </View>
            );
          })()}
        </View>
```

- [ ] **Step 5: Render the modal**

Immediately before the closing `</SafeAreaView>` (after the `<StudentFormModal ... />` block, ~line 583), add:

```tsx
      <StudentRateSettingsModal
        visible={rateModalVisible}
        onClose={() => setRateModalVisible(false)}
        student={student}
        onSave={handleSaveRates}
        saving={updating}
      />
```

- [ ] **Step 6: Add the new styles**

In the `StyleSheet.create` for this screen, add these keys (place near `sectionHeader`):

```typescript
  manageRatesLink: {
    fontSize: typography.sizes.sm,
    color: colors.piano.primary,
    fontWeight: typography.weights.semibold,
  },
  customRatesList: {
    backgroundColor: colors.neutral.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  customRateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  customRateValue: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
```

(`SUBJECT_CONFIG`, `styles.emptyState`, `styles.emptyText`, `styles.emptySubtext`, `styles.sectionHeader`, `styles.lessonSubjectBadge`, and `styles.lessonSubjectText` already exist in this file.)

- [ ] **Step 7: Verify no new type errors**

Run: `npm run typecheck 2>&1 | grep "student/\[id\]"`
Expected: no errors referencing `app/student/[id].tsx`.

- [ ] **Step 8: Manual smoke test (web)**

Run: `npm run web`
Then: log in as a tutor → open a student with ≥1 subject → "Custom Rates" → Manage → toggle a subject on → enter a rate → Save. Confirm the section now lists the custom rate. Reopen the modal to confirm it round-trips.
Expected: rate persists and displays.

- [ ] **Step 9: Commit**

```bash
git add app/student/[id].tsx
git commit -m "feat(ui): per-student custom rates section on student detail"
```

---

## Task 11: Consistency rewire — RateSettingsModal uses the shared pieces

Make `RateSettingsModal` consume the shared `SubjectRateFormState`/helpers and the `SubjectRateEditor` for its **individual** per-subject rates, so both screens share one implementation. Behavior must be unchanged. The group sub-section and example calculations stay inline.

**Files:**
- Modify: `src/components/RateSettingsModal.tsx`

- [ ] **Step 1: Import shared type/helpers/constants and drop local duplicates**

In `src/components/RateSettingsModal.tsx`:

- Add import:

```typescript
import {
  SubjectRateFormState, DURATION_TIERS, formStateFromConfig, buildSubjectRateConfig,
} from '../lib/subjectRateForm';
import { SubjectRateEditor } from './SubjectRateEditor';
```

- Delete the local `const DURATION_TIERS = [30, 45, 60, 90] as const;` (line ~45).
- Delete the local `interface SubjectRateFormState { ... }` (lines ~47-53).

- [ ] **Step 2: Use `formStateFromConfig` in the init effect**

In the `useEffect` that initializes `rates` (lines ~72-104), replace the per-subject body with the shared helper. The loop becomes:

```typescript
      const rates: Record<string, SubjectRateFormState> = {};
      SUBJECTS.forEach(subject => {
        rates[subject.key] = formStateFromConfig(
          settings.subject_rates?.[subject.key],
          subject.defaultDuration,
        );
      });
```

(Leave the `gRates` group-rate initialization loop as-is for now — it can be migrated later; this task only de-dupes the individual-rate path.)

- [ ] **Step 3: Use `buildSubjectRateConfig` in `handleSave`**

In `handleSave`, replace the `parsedSubjectRates` construction loop (lines ~252-291) with:

```typescript
    const parsedSubjectRates: SubjectRates = {};
    for (const subject of SUBJECTS) {
      const cfg = buildSubjectRateConfig(subjectRates[subject.key]);
      if (cfg) parsedSubjectRates[subject.key] = cfg;
    }
```

(Leave the `parsedGroupRates` loop unchanged.)

- [ ] **Step 4: Render the individual rate editor via `SubjectRateEditor`**

In the `SUBJECTS.map(...)` render block, replace the individual-rate JSX — the subject header (lines ~487-495), the base rate row (lines ~497-545), and the duration-tiers section (lines ~547-588) — with a single `SubjectRateEditor`. The `formState`/`groupState` consts at the top of the map stay. The replacement for those three blocks:

```tsx
                    <SubjectRateEditor
                      label={subject.label}
                      emoji={subject.emoji}
                      formState={formState}
                      onRateChange={(value) => handleSubjectRateChange(subject.key, value)}
                      onDurationChange={(duration) => handleSubjectDurationChange(subject.key, duration)}
                      onToggleTiers={() => handleToggleTiers(subject.key)}
                      onTierPriceChange={(dur, value) => handleTierPriceChange(subject.key, dur, value)}
                    />
```

Keep the surrounding `<View key={subject.key} style={styles.subjectRateCard}>`? No — `SubjectRateEditor` already renders its own `subjectRateCard` wrapper. So restructure the map's return to:

```tsx
                  return (
                    <View key={subject.key}>
                      <SubjectRateEditor
                        label={subject.label}
                        emoji={subject.emoji}
                        formState={formState}
                        onRateChange={(value) => handleSubjectRateChange(subject.key, value)}
                        onDurationChange={(duration) => handleSubjectDurationChange(subject.key, duration)}
                        onToggleTiers={() => handleToggleTiers(subject.key)}
                        onTierPriceChange={(dur, value) => handleTierPriceChange(subject.key, dur, value)}
                      />
                      {/* Group / combined-session price */}
                      <View style={styles.tiersSection}>
                        {/* ...unchanged group section JSX (original lines ~591-689)... */}
                      </View>
                    </View>
                  );
```

Move the existing group `<View style={styles.tiersSection}>...</View>` block (original lines ~591-689) inside this new wrapper unchanged. The now-unused individual-rate styles remain defined in this file (also copied into `SubjectRateEditor`); leaving them is harmless, but you may delete the individual-only keys from this file's StyleSheet if they are no longer referenced here (verify with a grep before deleting).

- [ ] **Step 5: Verify no new type errors and the modal still behaves**

Run: `npm run typecheck 2>&1 | grep "RateSettingsModal"`
Expected: no errors referencing `RateSettingsModal.tsx`.

Then `npm run web` → open Rate Settings → confirm subject rates, duration toggles, tier prices, the group price sub-section, and Save all still work exactly as before, and the example calculations still update.

- [ ] **Step 6: Commit**

```bash
git add src/components/RateSettingsModal.tsx
git commit -m "refactor(ui): RateSettingsModal reuses shared SubjectRateEditor & helpers"
```

---

## Final verification

- [ ] Run `deno test supabase/functions/_shared/lessonAmount.test.ts src/lib/subjectRateForm.test.ts` → all PASS.
- [ ] Run `npm run typecheck 2>&1 | grep -c "error TS"` → not above the pre-existing baseline.
- [ ] Manual end-to-end: set a custom student rate (with a duration tier), generate an invoice for that student for a month containing one solo and one combined lesson in that subject, and confirm both line items use the custom rate. Confirm a per-lesson `override_amount` still wins.
