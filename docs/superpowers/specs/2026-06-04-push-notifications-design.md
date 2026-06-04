# Design: Device Push Notifications

**Date:** 2026-06-04
**Status:** Approved — ready for implementation planning
**Author:** Brainstormed with Claude

## Summary

Add real device push notifications to the Love2Learn app as a **generic, reusable
capability**. Push fires automatically whenever any row is inserted into the existing
`notifications` table. **Payment reminders are the first consumer** — because they
already insert a notification row, they gain push delivery with zero changes to the
payment code. Email delivery via Resend is unchanged; push is purely additive.

## Motivation

The original request was to add SMS to payment reminders. While investigating, we found:

- The app is launching on mobile, making push the natural new channel.
- Push is **free** (Expo Push service), whereas SMS costs per message and requires US
  A2P 10DLC registration.
- The onboarding "notifications" screen already promises *"Push notifications coming soon!"*
- An in-app `notifications` table + real-time bell badge already exists, but there is
  **no device push** today (`expo-notifications` not installed, no tokens stored, no
  APNs/FCM credentials).

Building push as a generic layer fulfills the existing promise app-wide (payments,
messages, reschedules, lesson reminders) for the same effort as wiring payments alone.

SMS is explicitly **out of scope** for this work. It may be revisited later as a
high-deliverability channel for severely past-due invoices.

## Goals

- Deliver device push notifications to parents and tutors on iOS and Android.
- Fire push automatically for **any** notification, with payment reminders as the
  first live use case.
- Respect existing per-type notification preferences.
- Never let push failures affect existing email delivery.

## Non-Goals (YAGNI)

- SMS / text messaging.
- Rich media, images, notification categories, or action buttons.
- Changes to reminder scheduling — the existing daily cron is untouched.
- Web push (web tokens are stored but not targeted; Expo push is native-only).

## Architecture & Data Flow

Push is decoupled from any single feature:

```
Any feature creates a row in `notifications`
        │  (payment reminder, message, reschedule, lesson note, …)
        ▼
Supabase Database Webhook on `notifications` INSERT
        ▼
NEW edge function: send-push-notification
        │  • look up recipient's tokens in push_tokens
        │  • check the recipient's per-type notification preference
        │  • build Expo push message from title / message / data
        ▼
Expo Push API  (https://exp.host/--/api/v2/push/send)
        ▼
Device  (tap → deep-link via data.action_url)
```

Because payment reminders already insert a notification row (see
`supabase/functions/send-payment-reminder/index.ts`), no change to the payment path is
required.

## Components

### 1. Database (one new migration)

**`push_tokens` table**

| Column         | Type        | Notes                                      |
|----------------|-------------|--------------------------------------------|
| `id`           | uuid PK     | default `gen_random_uuid()`                |
| `user_id`      | uuid        | FK → `auth.users`, not null                |
| `token`        | text        | unique, the Expo push token                |
| `platform`     | text        | `ios` \| `android` \| `web`                |
| `created_at`   | timestamptz | default `now()`                            |
| `last_seen_at` | timestamptz | default `now()`, refreshed on each launch  |

- One row per device; supports multiple devices per user.
- Unique constraint on `token`; upsert on conflict refreshes `user_id`,
  `platform`, `last_seen_at` (handles a device that switches accounts).
- RLS: a user may `insert` / `update` / `delete` only rows where
  `user_id = auth.uid()`. The edge function reads all tokens via the service role.

### 2. Client (the app)

- Add dependencies: `expo-notifications`, `expo-device`.
- **`src/lib/push.ts`** — `registerForPushNotificationsAsync()`:
  - Skips on non-device / web where unsupported.
  - Checks permission status; returns early if not granted (does **not** prompt here).
  - Gets the Expo push token (using the EAS `projectId`) and upserts into `push_tokens`.
- **`usePushNotifications()` hook**, wired into `AuthProvider`:
  - On login / app launch, **if permission already granted**, silently register/refresh
    the token and update `last_seen_at`.
  - Registers a foreground notification handler (show alert while app is open).
  - Registers a tap-response listener that routes to `data.action_url` via the router.
- **Sign-out**: delete the current device's token row so a shared device stops
  receiving the previous user's pushes.

### 3. Permission UX

- Reuse the existing onboarding **notifications** screen
  (`app/(auth)/onboarding/notifications.tsx`, currently shows the "coming soon" copy):
  - Replace with a friendly pre-prompt explaining value ("Get reminded about payments,
    lessons, and messages"), and an **Enable** button.
  - Tapping **Enable** triggers the real OS permission dialog
    (`requestPermissionsAsync`). On grant → register token. On denial → continue; email
    still works.
- Add a **Push notifications** toggle in settings so users who skipped onboarding, or
  who want to turn it off, have a path. Re-enabling triggers registration; on iOS, if
  the OS permission was previously denied, deep-link the user to system settings.

### 4. Edge function: `send-push-notification`

- Triggered by a **Supabase Database Webhook** on `notifications` INSERT (service-role
  context).
- Steps:
  1. Read the new notification row (`recipient_id`, `type`, `title`, `message`,
     `data`, `action_url`).
  2. Map `type` → existing `ParentNotificationPreferences` key (e.g.
     `payment_due`, `lesson_reminders`, `worksheet_assigned`, `lesson_notes`). If the
     recipient disabled that type, **skip**. Unmapped/new types default to on.
  3. Fetch the recipient's tokens from `push_tokens` (skip `web`).
  4. Build Expo push messages (`to`, `title`, `body`, `data: { action_url, … }`,
     `sound: 'default'`). Batch and POST to the Expo Push API.
  5. Read receipts; on `DeviceNotRegistered`, delete the dead token.
- Never throws to the caller; all failures are logged and isolated from email.

### 5. Configuration & credentials (operational, one-time) ⚠️

- **Push requires a dev/standalone build** via EAS — it does **not** work in Expo Go
  (SDK 53+). An EAS `projectId` already exists, so this is configuration, not new infra.
- Run `eas credentials` to register **APNs** (iOS) and **FCM v1 /
  `google-services.json`** (Android).
- Add the `expo-notifications` plugin and the Android notification icon/color to
  `app.config.ts`.
- These steps are documented for the operator to run; they are prerequisites for
  end-to-end verification but do not block code implementation.

## Error Handling

- Token registration failures are caught and logged; the app continues normally.
- The edge function isolates all push errors from email — a push failure never blocks or
  fails the originating action.
- Dead tokens (`DeviceNotRegistered` receipts) are pruned automatically, so the token
  table self-cleans over time.

## Testing Strategy

- **Unit:** token-registration upsert, sign-out cleanup, `type → preference` mapping,
  dead-token pruning, `web`-token skipping.
- **Integration:** insert a `notifications` row → assert the edge function builds the
  correct Expo payload and respects a disabled preference.
- **Manual (physical device, dev build):** send a payment reminder, confirm push
  arrives and deep-links to the invoice; verify a disabled `payment_due` preference
  suppresses it; verify sign-out stops delivery to that device.

## Open Items / Operator Prerequisites

- EAS credentials setup (APNs + FCM) must be completed before end-to-end manual testing.
- Confirm final permission pre-prompt copy and the settings-toggle label during
  implementation.

## Out of Scope / Future

- SMS via Twilio for past-due escalation, if push adoption proves low.
- Notification action buttons / categories and rich media.
