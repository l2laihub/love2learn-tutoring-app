import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { preferenceKeyForType, shouldSendPush, buildExpoMessages } from './push.ts';

Deno.test('payment_due maps to the payment_due preference', () => {
  assertEquals(preferenceKeyForType('payment_due'), 'payment_due');
});

Deno.test('lesson_reminder maps to lesson_reminders preference', () => {
  assertEquals(preferenceKeyForType('lesson_reminder'), 'lesson_reminders');
});

Deno.test('unmapped type (general) returns null', () => {
  assertEquals(preferenceKeyForType('general'), null);
});

Deno.test('suppresses push when the mapped preference is explicitly false', () => {
  assertEquals(shouldSendPush('payment_due', { payment_due: false }), false);
});

Deno.test('sends push when preferences are missing', () => {
  assertEquals(shouldSendPush('payment_due', null), true);
});

Deno.test('sends push for an unmapped type even if other prefs are off', () => {
  assertEquals(shouldSendPush('reschedule_request', { payment_due: false }), true);
});

Deno.test('builds one Expo message per token with deep-link data', () => {
  const msgs = buildExpoMessages(['tok1', 'tok2'], {
    id: 'n1',
    recipient_id: 'p1',
    type: 'payment_due',
    title: 'Payment due',
    message: 'Your invoice is due',
    data: { payment_id: 'pay1' },
    action_url: '/payments',
  });
  assertEquals(msgs.length, 2);
  assertEquals(msgs[0].to, 'tok1');
  assertEquals(msgs[0].title, 'Payment due');
  assertEquals(msgs[0].data.action_url, '/payments');
  assertEquals(msgs[0].data.payment_id, 'pay1');
  assertEquals(msgs[0].data.notification_id, 'n1');
});
