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
