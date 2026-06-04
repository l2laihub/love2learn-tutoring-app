// Pure helpers for the send-push-notification edge function.
// No I/O here so this module is unit-testable with `deno test`.

export type NotificationType =
  | 'announcement'
  | 'reschedule_request'
  | 'reschedule_response'
  | 'lesson_reminder'
  | 'worksheet_assigned'
  | 'payment_due'
  | 'general';

export interface NotificationRecord {
  id: string;
  recipient_id: string | null;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  action_url: string | null;
}

export interface NotificationPrefs {
  lesson_reminders?: boolean;
  worksheet_assigned?: boolean;
  payment_due?: boolean;
  lesson_notes?: boolean;
}

// Map a notification type to the matching parent-preference key, or null
// if no preference governs this type (those default to ON).
export function preferenceKeyForType(
  type: NotificationType,
): keyof NotificationPrefs | null {
  switch (type) {
    case 'payment_due':
      return 'payment_due';
    case 'lesson_reminder':
      return 'lesson_reminders';
    case 'worksheet_assigned':
      return 'worksheet_assigned';
    default:
      return null;
  }
}

// Decide whether to send a push, honoring an explicit opt-out only.
export function shouldSendPush(
  type: NotificationType,
  prefs: NotificationPrefs | null | undefined,
): boolean {
  const key = preferenceKeyForType(type);
  if (key === null) return true; // no governing preference
  if (!prefs) return true; // no prefs stored yet
  return prefs[key] !== false; // suppress only on explicit false
}

export interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  data: Record<string, unknown>;
}

// One Expo push message per device token, carrying the deep-link target.
export function buildExpoMessages(
  tokens: string[],
  n: NotificationRecord,
): ExpoMessage[] {
  return tokens.map((to) => ({
    to,
    title: n.title,
    body: n.message,
    sound: 'default',
    data: {
      notification_id: n.id,
      action_url: n.action_url,
      ...(n.data ?? {}),
    },
  }));
}
