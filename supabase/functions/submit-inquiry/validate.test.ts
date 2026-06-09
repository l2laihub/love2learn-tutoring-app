import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { validateInquiry } from './validate.ts';

Deno.test('rejects when honeypot is filled', () => {
  const r = validateInquiry({
    tutor_id: '11111111-1111-1111-1111-111111111111',
    parent_name: 'Jane',
    parent_email: 'jane@example.com',
    company: 'i-am-a-bot', // honeypot
  });
  assertEquals(r.ok, false);
});

Deno.test('rejects when parent_name is missing', () => {
  const r = validateInquiry({
    tutor_id: '11111111-1111-1111-1111-111111111111',
    parent_email: 'jane@example.com',
  });
  assertEquals(r.ok, false);
});

Deno.test('rejects when no contact method is provided', () => {
  const r = validateInquiry({
    tutor_id: '11111111-1111-1111-1111-111111111111',
    parent_name: 'Jane',
  });
  assertEquals(r.ok, false);
});

Deno.test('rejects when tutor_id is not a uuid', () => {
  const r = validateInquiry({
    tutor_id: 'not-a-uuid',
    parent_name: 'Jane',
    parent_email: 'jane@example.com',
  });
  assertEquals(r.ok, false);
});

Deno.test('accepts a valid submission and trims/sanitizes fields', () => {
  const r = validateInquiry({
    tutor_id: '11111111-1111-1111-1111-111111111111',
    parent_name: '  Jane  ',
    parent_email: 'jane@example.com',
    subjects: ['math', 'piano'],
    student_age: '7',
    message: 'x'.repeat(5000),
  });
  assertEquals(r.ok, true);
  if (r.ok) {
    assertEquals(r.value.parent_name, 'Jane');
    assertEquals(r.value.student_age, 7);
    assertEquals(r.value.subjects, ['math', 'piano']);
    // message clamped to 2000 chars
    assertEquals(r.value.message?.length, 2000);
  }
});
