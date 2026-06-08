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
[Preview button] --> RPC/edge invoke ------------------------------------------> [send-telegram-recap fn]
                                                                                          |
                                                              get_tutor_weekly_recap() (SQL, shared logic)
                                                                                          |
                                                              Telegram Bot API sendMessage --> tutor's chat
```

**Core principle:** a single SQL function (`get_tutor_weekly_recap`) is the
source of truth for recap contents, used identically by the scheduled send and
the preview button. Edge functions only format and send.

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

**`get_tutor_weekly_recap(p_tutor_id, p_week_start, p_week_end)` — SQL function:**
- `SECURITY DEFINER`, returns JSON.
- Classes scheduled in `[p_week_start, p_week_end]` (grouped, each with status).
- Payments **received** in the window (paid_at in range).
- **Outstanding/overdue** running total across the tutor's parents.
- **Expected** amount from this week's classes (from rates).
- Reuses the app's existing lesson-amount / rate computation
  (`tutor_settings.default_rate`, `subject_rates`, `combined_session_rate`,
  `scheduled_lessons.override_amount`). Exact existing logic to be traced during
  planning so figures match the rest of the app.

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
- Calls `get_tutor_weekly_recap`, formats the message (Telegram HTML/Markdown),
  calls Bot API `sendMessage`.
- On a scheduled send: writes `telegram_recap_log` on success.
- On a **preview** send: skips the log so testing never suppresses the real
  Saturday send.

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

## Open items to resolve during planning

- Trace and reuse the exact existing lesson-amount computation so recap figures
  match the rest of the app.
- Confirm the precise settings screen for the Telegram section.
- Decide short-token format vs. raw UUID for the deep-link (Telegram `/start`
  payload length limit is 64 chars — UUID fits).
