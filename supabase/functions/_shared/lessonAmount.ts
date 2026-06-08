// Pure, dependency-free lesson-amount math shared by Edge Functions.
// Faithful port of calculateLessonAmountWithDetails in src/hooks/usePayments.ts —
// keep in sync (lessonAmount.test.ts pins the values). Combined-session pricing
// intentionally uses the same duration-based rate as single sessions (the source
// function ignores isCombinedSession for the amount).

export interface SubjectRateConfig {
  rate: number;
  base_duration: number;
  duration_prices?: Record<string, number>;
}
export interface TutorRateSettings {
  default_rate?: number | null;
  default_base_duration?: number | null;
  subject_rates?: Record<string, SubjectRateConfig> | null;
  combined_session_rate?: number | null;
}

export function calculateLessonAmount(
  settings: TutorRateSettings | null,
  subject: string,
  durationMin: number,
  _isCombinedSession: boolean,
  overrideAmount?: number | null,
): number {
  const defaultRate = 45;
  const defaultBaseDuration = 60;

  if (overrideAmount !== undefined && overrideAmount !== null) {
    return overrideAmount;
  }

  const subjectRates = settings?.subject_rates ?? undefined;
  let rate: number;
  let baseDuration: number;

  const rateConfig = subjectRates ? subjectRates[subject] : undefined;
  if (rateConfig && rateConfig.rate > 0 && rateConfig.base_duration > 0) {
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
