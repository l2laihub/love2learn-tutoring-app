/**
 * Pure helpers for converting between the per-subject rate editor's form state
 * and the persisted SubjectRateConfig shape. Shared by RateSettingsModal and
 * StudentRateSettingsModal so the two stay consistent. No React/RN imports —
 * unit-testable with `deno test`.
 */
import type { SubjectRateConfig, DurationPrices } from '../types/database.ts';

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
