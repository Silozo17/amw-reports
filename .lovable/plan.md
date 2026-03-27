

# Complete Email Template System — AMW Reports

## Overview

Build a centralized, white-labeled email system with 26 templates across 7 categories. All emails sent via Resend (already configured). Auth emails intercepted via Supabase Auth webhook. Templates only — automated triggers (open tracking, token expiry monitoring, digest crons, etc.) deferred to a follow-up.

---

## Architecture

```text
┌─────────────────────────────────────────────────────┐
│                  Email System                        │
├──────────────┬──────────────────────────────────────┤
│ Auth Hook    │ send-branded-email (Edge Function)    │
│ (intercepts  │ ┌──────────────────────────────────┐ │
│  Supabase    │ │ Template Registry (26 templates) │ │
│  Auth events)│ │ + Org branding fetch             │ │
│              │ │ + Resend API dispatch             │ │
│  → renders   │ │ + email_logs insert               │ │
│    auth      │ └──────────────────────────────────┘ │
│    templates  │                                      │
│    via Resend │ Invoked from frontend or other       │
│              │ edge functions with templateName      │
└──────────────┴──────────────────────────────────────┘
```

---

## Phase 1 — Database

**Migration**: Add `email_type` column to `email_logs` to categorise all sent emails.

```sql
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS email_type text DEFAULT 'report_delivery';
```

No other table changes needed — all template data is passed at send time.

---

## Phase 2 — Centralized Send Function

**New edge function**: `supabase/functions/send-branded-email/index.ts`

Accepts:
- `template_name` — which template to render
- `recipient_email` / `recipient_name`
- `data` — template-specific payload (client name, month, KPIs, etc.)
- `org_id` — used to fetch branding

Logic:
1. Fetch org row (logo_url, primary_color, secondary_color, accent_color, name, heading_font, body_font)
2. Convert HSL colours to hex for inline CSS
3. Call the matching template builder function → returns `{ subject, html }`
4. Send via Resend API (`from` uses org name + `reports@amwmedia.co.uk`)
5. Insert into `email_logs` with `email_type`
6. Return success/failure

**Shared template helpers** (inside the same file or a `_shared/email-helpers.ts`):
- `buildHeader(org)` — org logo + name, branded dark header bar
- `buildFooter(org)` — org name, website, "Confidential" line
- `buildButton(text, url, org)` — CTA button in org primary colour
- `hslToHex(hsl)` — colour conversion for inline styles

All 26 templates are pure functions: `(data, org, helpers) → { subject, html }`

---

## Phase 3 — Auth Email Hook

**New edge function**: `supabase/functions/auth-email-hook/index.ts`

- Registered as Supabase Auth Send Email Hook
- Receives auth events (signup, magiclink, recovery, email_change, reauthentication)
- Maps event type → template (1–5 from the spec)
- Renders branded HTML using org branding
- Sends via Resend
- Logs to `email_logs`

Templates covered:
1. Magic Link / OTP → `auth_magic_link`
2. Welcome → `auth_welcome`
3. Email Change → `auth_email_change`
4. Password Reset → `auth_recovery`
5. Account Deletion → `auth_deletion` (triggered from app code, not auth hook)

---

## Phase 4 — All 26 Template Builders

Each template is a function returning `{ subject: string, html: string }`. All use the shared header/footer/button helpers and org branding for white-labelling.

### Category 1 — Authentication (5)
| # | Template Key | Subject Line Pattern |
|---|---|---|
| 1 | `auth_magic_link` | "Your login link for {orgName}" |
| 2 | `auth_welcome` | "Welcome to {orgName}" |
| 3 | `auth_email_change` | "Email address change — {orgName}" |
| 4 | `auth_recovery` | "Reset your password — {orgName}" |
| 5 | `auth_deletion` | "Account deleted — {orgName}" |

### Category 2 — Organisation & Team (5)
| # | Template Key | Subject Line Pattern |
|---|---|---|
| 6 | `team_invitation` | "{inviterName} invited you to {orgName}" |
| 7 | `invitation_accepted` | "{memberName} joined {orgName}" |
| 8 | `invitation_expiring` | "Pending invite for {email} expires tomorrow" |
| 9 | `role_changed` | "Your role in {orgName} has changed" |
| 10 | `member_removed` | "You've been removed from {orgName}" |

### Category 3 — Client Reports (3) — Fully white-labelled
| # | Template Key | Subject Line Pattern |
|---|---|---|
| 11 | `report_delivery` | "{companyName} — {month} {year} Marketing Report" |
| 12 | `report_link_only` | "{companyName} — {month} {year} Marketing Report" |
| 13 | `report_reminder` | "Your {month} report is waiting — {companyName}" |

Template 11 replaces the current hardcoded `send-report-email` HTML.

### Category 4 — Platform Alerts (4)
| # | Template Key | Subject Line Pattern |
|---|---|---|
| 14 | `token_expiring` | "{platform} connection expiring for {clientName}" |
| 15 | `token_expired` | "Action required: {platform} disconnected — {clientName}" |
| 16 | `sync_failed` | "{platform} sync failed for {clientName}" |
| 17 | `report_generation_failed` | "Report failed for {clientName}" |

### Category 5 — Subscription & Billing (6)
| # | Template Key | Subject Line Pattern |
|---|---|---|
| 18 | `subscription_activated` | "Welcome to {planName}" |
| 19 | `subscription_upgraded` | "Plan upgraded to {planName}" |
| 20 | `subscription_downgraded` | "Plan changed to {planName}" |
| 21 | `payment_failed` | "Payment failed — action required" |
| 22 | `trial_ending` | "Your trial ends in 3 days" |
| 23 | `trial_expired` | "Your trial has ended" |

### Category 6 — Monthly Digest (1)
| # | Template Key | Subject Line Pattern |
|---|---|---|
| 24 | `monthly_digest` | "{orgName} — {month} Platform Summary" |

### Category 7 — Security (2)
| # | Template Key | Subject Line Pattern |
|---|---|---|
| 25 | `new_device_login` | "New sign-in detected — {orgName}" |
| 26 | `failed_login_attempts` | "Unusual login activity — {orgName}" |

---

## Phase 5 — Refactor Existing send-report-email

Update `send-report-email/index.ts` to:
1. Fetch org branding (it currently doesn't)
2. Call `send-branded-email` internally (or use the shared template builder for `report_delivery`)
3. Remove all hardcoded AMW branding from the HTML
4. Use org logo, org name, org colours in header/footer/button
5. Set `email_type = 'report_delivery'` on log inserts

This ensures backward compatibility — existing "Send Report" buttons continue working.

---

## Phase 6 — Frontend Integration Points

Wire up the templates that have existing UI triggers (no new trigger infrastructure needed):

| Template | Frontend trigger location |
|---|---|
| `team_invitation` (#6) | Org settings → invite member flow |
| `report_delivery` (#11) | Reports page → Send button |
| `report_generation_failed` (#17) | Reports page → after generate-report fails |

All other templates are callable via `supabase.functions.invoke('send-branded-email', { body: { template_name, ... } })` — triggers built later.

---

## Files Created/Modified

| File | Action |
|---|---|
| `supabase/migrations/XXXX_add_email_type.sql` | Migration: add email_type to email_logs |
| `supabase/functions/send-branded-email/index.ts` | New: centralized email sender + 26 template builders |
| `supabase/functions/send-branded-email/deno.json` | New: dependencies |
| `supabase/functions/auth-email-hook/index.ts` | New: Supabase Auth webhook handler |
| `supabase/functions/auth-email-hook/deno.json` | New: dependencies |
| `supabase/functions/send-report-email/index.ts` | Refactor: use shared templates, white-label with org branding |
| `src/types/database.ts` | Update: add email_type to EmailLog type |

---

## Constraints Respected

- All emails use inline CSS only (no external stylesheets)
- Category 3 (client-facing) emails are fully white-labelled — org logo, colours, name; never shows "AMW Reports" or "Lovable"
- Uses existing Resend API key and `reports@amwmedia.co.uk` domain
- Templates are pure functions (no database calls inside templates)
- email_logs tracks every send with email_type
- No trigger infrastructure built (deferred per your choice)
- No sync functions or dashboard components touched

