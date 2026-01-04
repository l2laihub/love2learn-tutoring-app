# Love to Learn Academy - Email Templates

Custom email templates for Supabase Auth that match the Love to Learn Academy branding.

## Templates Included

| Template | File | Description |
|----------|------|-------------|
| **Confirm Signup** | `confirm-signup.html` | Sent when a user signs up to verify their email |
| **Reset Password** | `reset-password.html` | Sent when a user requests a password reset |
| **Magic Link** | `magic-link.html` | Sent for passwordless login |

## Theme Colors Used

| Color | Hex | Purpose |
|-------|-----|---------|
| Primary (Teal) | `#3D9CA8` | Headers, brand identity |
| Secondary (Green) | `#7CB342` | Success, growth |
| Accent (Coral) | `#FF6B6B` | CTA buttons |
| Warning (Amber) | `#FFC107` | Security notices |
| Text (Navy) | `#1B3A4B` | Body text |
| Background | `#F8FAFB` | Page background |

## How to Configure in Supabase

### Option 1: Via Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Email Templates**
3. For each template type:
   - Copy the HTML content from the corresponding file
   - Paste it into the template editor
   - Update the **Subject** line (see below)
   - Click **Save**

### Recommended Subject Lines

| Template | Subject |
|----------|---------|
| Confirm Signup | `Welcome to Love to Learn Academy - Please Confirm Your Email` |
| Reset Password | `Reset Your Love to Learn Academy Password` |
| Magic Link | `Your Love to Learn Academy Sign-In Link` |

### Option 2: Via Supabase CLI (config.toml)

Add these settings to your `supabase/config.toml`:

```toml
[auth.email]
enable_signup = true
double_confirm_changes = true
enable_confirmations = true

[auth.email.template.confirmation]
subject = "Welcome to Love to Learn Academy - Please Confirm Your Email"
content_path = "./templates/confirm-signup.html"

[auth.email.template.recovery]
subject = "Reset Your Love to Learn Academy Password"
content_path = "./templates/reset-password.html"

[auth.email.template.magic_link]
subject = "Your Love to Learn Academy Sign-In Link"
content_path = "./templates/magic-link.html"
```

Then run:
```bash
npx supabase db push
```

## Template Variables

Supabase provides these variables for use in templates:

| Variable | Description |
|----------|-------------|
| `{{ .ConfirmationURL }}` | The link user clicks to confirm/reset/login |
| `{{ .Token }}` | The OTP token (if using OTP instead of link) |
| `{{ .TokenHash }}` | Hashed version of the token |
| `{{ .SiteURL }}` | Your site URL configured in Supabase |
| `{{ .RedirectTo }}` | Redirect URL after confirmation |
| `{{ .CurrentYear }}` | Current year (for copyright) |

## Testing Templates

1. Use Supabase's **Preview** feature in the dashboard to see how templates render
2. Send a test email using the auth flow:
   - Sign up with a new email to test confirmation
   - Use "Forgot Password" to test reset
   - Use "Magic Link" sign-in to test magic link

## Customization Notes

- All templates use inline CSS for maximum email client compatibility
- Background colors are applied to both body and wrapper div for Gmail support
- Button uses gradient background with fallback color
- Links have `word-break: break-all` to prevent overflow on mobile
- Uses system fonts for consistent rendering across platforms

## Email Client Compatibility

These templates have been designed to work with:
- Gmail (Web & Mobile)
- Apple Mail
- Outlook (2016+)
- Yahoo Mail
- Mobile email clients

---

*Last updated: January 2026*
