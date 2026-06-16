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
