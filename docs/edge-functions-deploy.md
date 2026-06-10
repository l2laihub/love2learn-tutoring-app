# Edge Functions: pg_net-dispatched functions deploy runbook

Some edge functions are invoked **server-to-server** from Postgres via `pg_net`
(a cron job or a table trigger), not from the app. These need special handling
because of how Supabase API keys and the Edge Functions gateway interact.

## The functions

| Function | Dispatched by | Trigger |
|---|---|---|
| `auto-complete-lessons` | `auto_complete_due_lessons()` (pg_cron, hourly) | 23:00 tutor-local — completes finished lessons + invoices |
| `send-telegram-recap` | `send_weekly_tutor_recaps()` (pg_cron, weekly) | weekly recap message |
| `send-push-notification` | `notify_push_on_notification()` trigger on `notifications` | per inserted notification |

All three POST with `Authorization: Bearer <vault.service_role_key>`.

## The rule: deploy with `--no-verify-jwt`

This project uses the **new-style API keys** (`sb_publishable_…` / `sb_secret_…`).
The Edge Functions gateway's built-in `verify_jwt` only understands **legacy
JWT** keys (`eyJ…`). A `sb_secret_…` bearer is **not** a JWT, so a function
deployed with `verify_jwt` ON rejects every dispatch with
`401 {"code":"UNAUTHORIZED_INVALID_JWT_FORMAT","message":"Invalid JWT"}`
**before the function code runs**. The cron/trigger is fire-and-forget, so this
fails *silently* — `cron.job_run_details` still shows "succeeded".

Therefore each of these functions:

1. Is marked `verify_jwt = false` in `supabase/config.toml`.
2. **Must be deployed with `--no-verify-jwt`** (the flag is what actually applies
   it on the remote; config.toml alone only covers local `functions serve`).
3. Authenticates the internal call **in code** by comparing the bearer to the
   `EDGE_DISPATCH_SECRET` function secret (falling back to the legacy
   service-role JWT during migration).

```bash
npx supabase functions deploy auto-complete-lessons  --no-verify-jwt
npx supabase functions deploy send-telegram-recap    --no-verify-jwt
npx supabase functions deploy send-push-notification --no-verify-jwt
```

> ⚠️ Deploying any of these **without** `--no-verify-jwt` re-introduces the
> silent 401 and the feature stops working with no error surfaced.

## Required secrets (and the matching invariant)

```bash
# Shared secret the functions check in-code. MUST equal Vault `service_role_key`.
npx supabase secrets set EDGE_DISPATCH_SECRET="sb_secret_..."
```

- **`EDGE_DISPATCH_SECRET`** (function secret) and **`vault.service_role_key`**
  (the bearer the dispatcher sends) **must be byte-for-byte identical**, and both
  should be your current `sb_secret_…` key.
- `vault.service_role_key` can drift if the key was rotated — the Vault copy may
  be an older `sb_secret_…` than your dashboard/.env one. If dispatches return
  the *function's* `401 {"error":"Unauthorized"}` (as opposed to the gateway's
  `"Invalid JWT"`), they're mismatched.

Verify the match without printing either secret (the digest is from
`npx supabase secrets list`):

```sql
select encode(digest(decrypted_secret,'sha256'),'hex')
         = '<EDGE_DISPATCH_SECRET digest from `supabase secrets list`>'
from vault.decrypted_secrets where name = 'service_role_key';
```

## Verifying a deploy (no side effects)

Send a dispatch with a deliberately bogus, non-JWT bearer and read the response:

```sql
select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name='project_url')
         || '/functions/v1/auto-complete-lessons',
  headers := jsonb_build_object('Content-Type','application/json',
                                'Authorization','Bearer bogus'),
  body := '{}'::jsonb
);
-- then, a moment later:
select status_code, content from net._http_response order by id desc limit 1;
```

- `401 {"error":"Unauthorized"}` → ✅ `verify_jwt` is off and the in-code gate works.
- `401 {... "Invalid JWT"}` → ❌ still `verify_jwt` ON — redeploy with `--no-verify-jwt`.

For a positive end-to-end check, dispatch `auto-complete-lessons` for a tutor with
**0 due lessons** (expect `200 {"success":true,"completed":0,…}`) — it exercises
the full auth + DB path without changing any data.

> Note: `net._http_response` rows are purged after ~6h, so check soon after dispatch.
```
