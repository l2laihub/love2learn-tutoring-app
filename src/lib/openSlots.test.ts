import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  parseClockToMinutes,
  formatMinutesToClock,
  generateSlotsForWindow,
  computeOpenSlots,
} from './openSlots.ts';

Deno.test('parseClockToMinutes handles HH:MM and HH:MM:SS', () => {
  assertEquals(parseClockToMinutes('09:00'), 540);
  assertEquals(parseClockToMinutes('09:30:00'), 570);
  assertEquals(parseClockToMinutes('00:00'), 0);
});

Deno.test('formatMinutesToClock zero-pads', () => {
  assertEquals(formatMinutesToClock(540), '09:00');
  assertEquals(formatMinutesToClock(570), '09:30');
  assertEquals(formatMinutesToClock(0), '00:00');
});

Deno.test('generateSlotsForWindow: full window free, 30-min steps', () => {
  const slots = generateSlotsForWindow({
    window: { start: '09:00', end: '11:00' },
    blocked: [],
  });
  assertEquals(slots, [
    { time: '09:00', isBusy: false },
    { time: '09:30', isBusy: false },
    { time: '10:00', isBusy: false },
    { time: '10:30', isBusy: false },
  ]);
});

Deno.test('generateSlotsForWindow: a 30-min start is busy when it overlaps a blocked interval', () => {
  const slots = generateSlotsForWindow({
    window: { start: '09:00', end: '11:00' },
    blocked: [{ start: '09:30', end: '10:00' }],
  });
  assertEquals(slots, [
    { time: '09:00', isBusy: false },
    { time: '09:30', isBusy: true },
    { time: '10:00', isBusy: false },
    { time: '10:30', isBusy: false },
  ]);
});

Deno.test('generateSlotsForWindow: slotDurationMin longer than step blocks earlier starts', () => {
  const slots = generateSlotsForWindow({
    window: { start: '09:00', end: '11:00' },
    blocked: [{ start: '10:00', end: '10:30' }],
    slotDurationMin: 60,
    granularityMin: 30,
  });
  assertEquals(slots, [
    { time: '09:00', isBusy: false },
    { time: '09:30', isBusy: true },
    { time: '10:00', isBusy: true },
    { time: '10:30', isBusy: false },
  ]);
});

Deno.test('computeOpenSlots: availability minus busy minus breaks, deduped and sorted', () => {
  const open = computeOpenSlots({
    availabilityWindows: [{ start: '09:00', end: '12:00' }],
    busyIntervals: [{ start: '09:00', end: '10:00' }],
    breaks: [{ start: '11:00', end: '11:30' }],
  });
  assertEquals(open, ['10:00', '10:30', '11:30']);
});

Deno.test('computeOpenSlots: fully booked returns empty', () => {
  const open = computeOpenSlots({
    availabilityWindows: [{ start: '09:00', end: '10:00' }],
    busyIntervals: [{ start: '09:00', end: '10:00' }],
    breaks: [],
  });
  assertEquals(open, []);
});

Deno.test('computeOpenSlots: no availability returns empty', () => {
  const open = computeOpenSlots({
    availabilityWindows: [],
    busyIntervals: [],
    breaks: [],
  });
  assertEquals(open, []);
});

Deno.test('computeOpenSlots: overlapping availability windows do not duplicate starts', () => {
  const open = computeOpenSlots({
    availabilityWindows: [
      { start: '09:00', end: '10:30' },
      { start: '10:00', end: '11:00' },
    ],
    busyIntervals: [],
    breaks: [],
  });
  assertEquals(open, ['09:00', '09:30', '10:00', '10:30']);
});

Deno.test('computeOpenSlots: minStartMinutes hides earlier starts (today filter)', () => {
  const open = computeOpenSlots({
    availabilityWindows: [{ start: '09:00', end: '11:00' }],
    busyIntervals: [],
    breaks: [],
    minStartMinutes: 600,
  });
  assertEquals(open, ['10:00', '10:30']);
});

Deno.test('computeOpenSlots: window not divisible by granularity drops the partial tail', () => {
  const open = computeOpenSlots({
    availabilityWindows: [{ start: '09:00', end: '09:45' }],
    busyIntervals: [],
    breaks: [],
  });
  assertEquals(open, ['09:00']);
});

Deno.test('regression: reschedule modal slot list (busy slots kept as disabled)', () => {
  // Mirrors the modal: a 09:00-12:00 availability window, a 60-min lesson,
  // busy 10:00-11:00 from the busy-slots RPC. The modal renders all six
  // 30-min starts (granularity=30 bounds emission), marking those that
  // conflict with the 60-min lesson busy.
  const slots = generateSlotsForWindow({
    window: { start: '09:00:00', end: '12:00:00' },
    blocked: [{ start: '10:00:00', end: '11:00:00' }],
    slotDurationMin: 60,
    granularityMin: 30,
  });
  assertEquals(slots, [
    { time: '09:00', isBusy: false },
    { time: '09:30', isBusy: true },  // 09:30-10:30 overlaps 10:00-11:00
    { time: '10:00', isBusy: true },
    { time: '10:30', isBusy: true },  // 10:30-11:30 overlaps 10:00-11:00
    { time: '11:00', isBusy: false },
    { time: '11:30', isBusy: false }, // 11:30-12:30 does not overlap 10:00-11:00
  ]);
});
