# Telegram Weekly Recap — Bot Setup Runbook

One-time setup to enable the weekly Telegram recap feature.

## 1. Create the bot
1. Open Telegram, message **@BotFather**.
2. Send `/newbot`, follow prompts, choose a name and a username ending in `bot`
   (e.g. `Love2LearnRecapBot`).
3. BotFather returns an **HTTP API token** like `123456:ABC-DEF...`. Keep it secret.

## 2. Configure secrets
```bash
# Edge function secret (server-side; never shipped to the app)
npx supabase secrets set TELEGRAM_BOT_TOKEN="123456:ABC-DEF..."

# Secret token that protects the webhook (any random string)
npx supabase secrets set TELEGRAM_WEBHOOK_SECRET="<random-string>"

# Shared secret that authenticates internal pg_net → edge-function calls.
# MUST equal the Vault `service_role_key` value below (the bearer the dispatcher
# sends). Use your new-style secret key (sb_secret_…), NOT a legacy JWT.
npx supabase secrets set EDGE_DISPATCH_SECRET="sb_secret_..."

# Confirm the Vault secrets used by pg_net are present (already used by push):
#   project_url        = https://<project-ref>.supabase.co
#   service_role_key   = <new-style secret key, sb_secret_…; MUST match EDGE_DISPATCH_SECRET>
# Set/verify in Supabase Studio → Project Settings → Vault, or:
#   select name from vault.secrets where name in ('project_url','service_role_key');
```

> **Why `EDGE_DISPATCH_SECRET` must match Vault `service_role_key`:** the pg_net
> dispatchers send `Authorization: Bearer <vault.service_role_key>`. Edge Functions
> deployed with `--no-verify-jwt` (see below) can't rely on the gateway, so they
> authenticate the call in-code by comparing that bearer to `EDGE_DISPATCH_SECRET`.
> If the two differ, every dispatch is rejected with `401 {"error":"Unauthorized"}`.
> See `docs/edge-functions-deploy.md` for the full runbook.

Add the bot username (WITHOUT the `@`) to the app `.env`:
```env
EXPO_PUBLIC_TELEGRAM_BOT_USERNAME=Love2LearnRecapBot
```

## 3. Register the webhook (after deploying the edge functions)
```bash
npx supabase functions deploy telegram-webhook --no-verify-jwt
npx supabase functions deploy send-telegram-recap --no-verify-jwt

# Point Telegram at the webhook. Use a secret path token to reject forged calls.
BOT=123456:ABC-DEF...
PROJECT_REF=<your-project-ref>
SECRET=<the same value set as TELEGRAM_WEBHOOK_SECRET>
curl "https://api.telegram.org/bot$BOT/setWebhook" \
  -d "url=https://$PROJECT_REF.supabase.co/functions/v1/telegram-webhook" \
  -d "secret_token=$SECRET"
```
> `telegram-webhook` is deployed with `--no-verify-jwt` because Telegram calls it
> directly without a Supabase JWT. It is protected instead by the
> `X-Telegram-Bot-Api-Secret-Token` header (must match `TELEGRAM_WEBHOOK_SECRET`).
>
> `send-telegram-recap` is **also** `--no-verify-jwt`: pg_net dispatches it with a
> non-JWT secret-key bearer that the gateway can't validate. It is protected
> in-code by the `EDGE_DISPATCH_SECRET` check (see section 2). Deploying it WITHOUT
> `--no-verify-jwt` re-breaks it with a gateway `401 "Invalid JWT"`.

## 4. Enable pg_cron / pg_net (if not already)
In Supabase Studio → Database → Extensions, enable `pg_cron` and `pg_net`.

## 5. Verify
- In the app (as a tutor): More → Weekly Telegram Recap → Connect Telegram.
- The bot should reply "✅ Connected".
- Tap "Send preview now" — you should receive a recap message.
