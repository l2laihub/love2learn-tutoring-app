# Weekly Telegram Recap for Tutors — Design

**Date:** 2026-06-07
**Status:** Approved (pending implementation plan)

## Summary

Add a feature that sends tutors a weekly recap of their classes and payments
via Telegram. The recap covers the week just ended (Sunday–Friday) and is
delivered every **Saturday morning** in **each tutor's own timezone**. Tutors
opt in by linking their Telegram account through a "Connect Telegram" deep link
that opens the app's bot; a webhook captures their chat ID automatically. A
"Send preview now" button lets tutors trigger the recap on demand for testing or
ad-hoc checks.

## Goals

- Give tutors a concise, automatic weekly summary of their tutoring activity.
- Zero-friction account linking via a Telegram deep link (no manual chat-ID copying).
- Identical output whether sent on schedule or via the preview button.
- Safe scheduling: never double-send, even if the cron job runs repeatedly.

## Non-goals

- Sending recaps to parents (tutors only).
- Two-way Telegram interaction beyond linking/unlinking (no querying the bot for data).
- Configurable schedule/day per tutor (fixed: Saturday morning, Sun–Fri window). Future enhancement.

## Decisions (from brainstorming)

| Question | Decision |
|----------|----------|
| Time window | Past-week recap |
| Recap days | This week **Sunday–Friday** (6 days before the Saturday send) |
| Class status included | **All** lessons scheduled in the window (status shown per lesson) |
| Payments content | Received this week **+** Outstanding/overdue **+** Expected from this week's classes |
| Send time | **Saturday morning** (~8 AM) |
| Timezone | **Each tutor's** timezone (`parents.timezone`) |
| Quiet week | Still send a brief "quiet week" note |
| Manual send | **Yes** — "Send preview now" button in settings |
| Linking flow | **Deep-link via bot `/start <token>`** |
| Bot status | None yet — plan includes @BotFather creation steps |

## Architecture & data flow

```
[App settings] --Connect--> t.me/Bot?start=TOKEN --> [telegram-webhook fn] --links chat_id--> parents
[pg_cron hourly] --> send_weekly_tutor_recaps() --per-tutor local Sat 8am, not-yet-sent--> pg_net
                                                                                          |
[Preview button] --> functions.invoke --------------------------------------> [send-telegram-recap fn]
                                                                                          |
                                            gathers lessons + payments (supabase-js) + computes amounts (ported TS)
                                                                                          |
                                                              Telegram Bot API sendMessage --> tutor's chat
```

**Core principle:** a single edge function (`send-telegram-recap`) is the source
of truth for recap contents, invoked identically by the scheduled send (via
`pg_net`) and the preview button (via `functions.invoke`). It gathers data with
supabase-js and computes the "expected" amount using the app's lesson-amount
logic ported to TypeScript (see note in Component 2). SQL is limited to schema,
scheduling, and idempotency.

## Components

### 1. Database changes (new migration)

**`parents` — new columns:**
- `telegram_chat_id TEXT` — the linked Telegram chat ID (nullable).
- `telegram_username TEXT` — display handle captured at link time (nullable).
- `telegram_linked_at TIMESTAMPTZ` — when linking completed (nullable).
- `telegram_recap_enabled BOOLEAN DEFAULT true` — connecting implies enabled; toggle to pause without disconnecting.

**`telegram_link_tokens` — new table:**
- `token` (uuid or short random), `tutor_id` (FK), `expires_at` (~15 min after mint), `used_at` (nullable).
- One-time codes for the deep-link flow. Expired/used tokens are rejected by the webhook.

**`telegram_recap_log` — new table:**
- `tutor_id` (FK), `week_start` DATE (the Sunday of the window), `sent_at`, `status`, `error`.
- **UNIQUE `(tutor_id, week_start)`** → idempotency. The hourly cron can run repeatedly without double-sending.

**`create_telegram_link_token()` — RPC (SECURITY DEFINER):**
- Resolves the calling tutor from `auth.uid()`, inserts a `telegram_link_tokens`
  row (expires in ~15 min), and returns the token for the deep link.

**`send_weekly_tutor_recaps()` — SQL function (pg_cron-invoked):**
- For each linked + enabled tutor, compute current local time from `parents.timezone`.
- Where local day = Saturday and local hour ≈ 8 AM, and no `telegram_recap_log`
  row exists for this week's Sunday, call `send-telegram-recap` via `pg_net`
  using Vault secrets `project_url` / `service_role_key` (same pattern as the
  existing push-notification trigger).
- `pg_cron` schedule: hourly.

### 2. Edge functions (Deno, modeled on existing `supabase/functions/send-*`)

**`telegram-webhook`** — public endpoint registered with Telegram via `setWebhook`.
- `/start <token>`: validate token (exists, not expired, not used) → set
  `telegram_chat_id` / `telegram_username` / `telegram_linked_at` on the tutor,
  mark token used → reply "✅ Connected".
- `/stop`: clear the chat ID (disconnect) → reply confirmation.
- Secret: `TELEGRAM_BOT_TOKEN`.

**`send-telegram-recap`** — input `{ tutor_id, week_start?, preview? }`.
- Gathers data with supabase-js (service role): the tutor's `telegram_chat_id` /
  `telegram_recap_enabled`, `scheduled_lessons` (joined to students) in the
  window, `tutor_settings` rates, and `payments` (received-in-window +
  outstanding total).
- Computes the **expected** amount from this week's classes using
  `calculateLessonAmount`, a TypeScript port of
  `calculateLessonAmountWithDetails` from `src/hooks/usePayments.ts` (subject
  rates → duration tiers → base-duration scaling → override). Duplicating this
  small calc into the Deno function mirrors how `getSubjectInfo` is already
  duplicated in `send-payment-reminder` — the app and edge functions don't share
  a module. A unit test pins the port's output to the app's values to guard drift.
- Formats the message (Telegram HTML) and calls Bot API `sendMessage`.
- On a scheduled send: upserts `telegram_recap_log` on success.
- On a **preview** send: skips the log so testing never suppresses the real
  Saturday send.
- Skips silently if the tutor is unlinked or `telegram_recap_enabled = false`.

### 3. Telegram bot setup (documented in plan; user performs)

1. Create bot via **@BotFather** → obtain token.
2. Add token as Supabase secret `TELEGRAM_BOT_TOKEN`.
3. Register webhook (`setWebhook`) pointing at the deployed `telegram-webhook` function.
4. Note the bot username for the app's deep-link URL.

The implementation plan will include the exact commands.

### 4. Frontend

A "Telegram Recap" section in tutor settings (exact screen in the More/settings
area confirmed during planning):
- **Not linked:** "Connect Telegram" button → RPC mints a token → opens
  `t.me/<bot>?start=<token>` via React Native `Linking`.
- **Linked:** shows `@username`, an enable/disable toggle
  (`telegram_recap_enabled`), **"Send preview now"**, and "Disconnect."
- New hook `useTutorTelegram` (status, mint-token, send-preview, disconnect)
  following the existing hook pattern (`{ data, loading, error, refetch }` /
  mutation shape).

### 5. Recap message content

- Header: `📚 Your week, MMM D–D`
- **Classes:** total count + per-day list (student · subject · status), with
  completed/cancelled noted.
- **Payments:**
  - 💰 Received this week
  - ⏳ Outstanding / overdue total
  - 📈 Expected from this week's classes
- **Quiet week** (no classes, no payment activity): short
  "No classes scheduled this week 🌿" note, still sent.

## Error handling

- Token validation failures (expired/used/unknown) → friendly bot reply, no linking.
- `sendMessage` failure on scheduled send → record `status='error'` + `error`
  in `telegram_recap_log` (still consumes the week slot to avoid retry storms;
  revisit if retries are desired).
- Missing `TELEGRAM_BOT_TOKEN` / Vault secrets → function errors logged; cron
  no-ops gracefully (mirrors existing push-trigger behavior where unset Vault
  secrets silently no-op).
- Disconnected/unlinked tutor → skipped by `send_weekly_tutor_recaps()`.

## Testing

- **SQL `get_tutor_weekly_recap`:** seed-data tests for window boundaries
  (Sun/Fri edges), mixed lesson statuses, amount/rate computation, and the quiet-week case.
- **Edge functions:** preview button against a real test bot; webhook `/start`
  with valid/expired/used tokens; `/stop` disconnect.
- **Idempotency:** run `send_weekly_tutor_recaps()` twice; verify exactly one
  send per tutor per week.
- **Timezone:** verify a tutor in a non-default timezone receives at local Saturday ~8 AM.

## Resolved during planning

- **Lesson-amount computation:** lives in TypeScript
  (`calculateLessonAmountWithDetails` in `src/hooks/usePayments.ts`), not SQL.
  Decision: gather data and compute amounts inside the `send-telegram-recap`
  edge function (TS port `calculateLessonAmount`), with a unit test pinning it to
  the app's values. No heavy SQL recap function.
- **Settings screen:** a new top-level route `app/telegram-recap.tsx` (tutor-only),
  reached from the More menu — mirrors `app/notification-settings.tsx`.
- **Token format:** raw UUID (fits Telegram's 64-char `/start` payload limit).
