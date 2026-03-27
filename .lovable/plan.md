

# Automated Email Trigger Infrastructure

## Overview

Build 7 new edge functions and cron jobs to automatically fire all 26 email templates that currently have no triggers. This covers token expiry monitoring, sync failure alerts, invitation expiry reminders, monthly digest, billing/subscription events (Stripe webhook), and security alerts.

---

## What Already Works (No Changes Needed)

- **Templates 1–5 (Auth)**: Handled by `auth-email-hook`
- **Template 6 (team_invitation)**: Wired in `OrganisationSection.tsx`
- **Template 7 (invitation_accepted)**: Wired in `useInvites.ts`
- **Template 11 (report_delivery)**: Wired via `send-report-email`
- **Template 17 (report_generation_failed)**: Wired in `src/lib/reports.ts`

---

## Cleanup First

### Fix fake UUID in send-branded-email
Line 672 still inserts `00000000-...` as `client_id` when none is provided. The nullable migration already ran — remove that fallback so non-client emails log with `NULL`.

### Register auth-email-hook in config.toml
Add the `[auth.hook.send_email]` block pointing to the `auth-email-hook` edge function so Supabase Auth actually routes through it.

---

## New Edge Functions

### 1. `check-expiring-tokens` (Cron — daily at 8:00 AM UTC)

**Triggers templates**: #8 (invitation_expiring), #14 (token_expiring), #15 (token_expired)

Logic:
- Query `platform_connections` where `token_expires_at` is within 7 days → send `token_expiring` to org owner
- Query `platform_connections` where `token_expires_at` < now AND `is_connected = true` → send `token_expired` to org owner
- Query `org_members` where `accepted_at IS NULL` and `invited_at` is 6 days ago (day 6 of 7) → send `invitation_expiring` to org owner
- All emails sent via `supabase.functions.invoke('send-branded-email', ...)`
- Track already-notified tokens in a simple `notification_tracking` table to avoid duplicate emails

### 2. `check-sync-failures` (Post-sync hook — called from `scheduled-sync`)

**Triggers template**: #16 (sync_failed)

Logic:
- After each sync completes with `success: false` in `scheduled-sync`, invoke `send-branded-email` with `sync_failed` template
- Sends to org owner with platform name, client name, error in plain English
- Modify `scheduled-sync/index.ts` to call `send-branded-email` inline when a sync fails (no separate cron needed)

### 3. `stripe-webhook` (Stripe webhook endpoint)

**Triggers templates**: #18–23 (subscription_activated, subscription_upgraded, subscription_downgraded, payment_failed, trial_ending, trial_expired)

Logic:
- Listens for Stripe webhook events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `customer.subscription.trial_will_end`
- Maps each event to the correct template
- Looks up org owner email via Stripe customer email → profiles → org_members
- Sends branded email with plan details, amounts, dates
- Requires `STRIPE_WEBHOOK_SECRET` (new secret needed from user)

### 4. `monthly-digest` (Cron — 1st of each month at 9:00 AM UTC)

**Triggers template**: #24 (monthly_digest)

Logic:
- Query all orgs with active subscriptions
- For each org: count reports sent last month, count syncs run, find failed connections, identify top-performing clients
- Send `monthly_digest` email to org owner
- Opt-in controlled by a new `digest_enabled` field on `organisations` (default `true`)

### 5. `check-security-events` (Cron — every 15 minutes)

**Triggers templates**: #25 (new_device_login), #26 (failed_login_attempts)

Logic:
- Query `auth.audit_log` (via a SECURITY DEFINER function since we can't query `auth` schema directly) for:
  - New logins with unfamiliar IP/user-agent combinations → `new_device_login`
  - 5+ failed login attempts within 15 minutes for a single email → `failed_login_attempts`
- Track known devices in a `known_devices` table (user_id, ip, user_agent hash, first_seen)

**Note**: Supabase's `auth.audit_log` access is limited. This will use a SECURITY DEFINER function to safely read login events.

### 6. `check-report-reminders` (Cron — daily at 10:00 AM UTC)

**Triggers templates**: #12 (report_link_only), #13 (report_reminder)

Logic:
- Query `email_logs` for `report_delivery` emails sent 3+ days ago
- Cross-reference with any "opened" tracking (if available) or simply send reminder after 3 days
- Send `report_reminder` to recipients who received the original report email
- Only remind once per report (track in `email_logs` with `email_type = 'report_reminder'`)

Template #12 (report_link_only) is an alternative delivery mode — wire it into `send-report-email` with a flag when PDF is too large or agency prefers link-only.

---

## New Database Objects

### Migration 1: `notification_tracking` table
```sql
CREATE TABLE public.notification_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type text NOT NULL,
  reference_id uuid NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(notification_type, reference_id)
);
ALTER TABLE public.notification_tracking ENABLE ROW LEVEL SECURITY;
-- Service role only — no user-facing RLS needed
```

### Migration 2: `known_devices` table
```sql
CREATE TABLE public.known_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ip_hash text NOT NULL,
  ua_hash text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, ip_hash, ua_hash)
);
ALTER TABLE public.known_devices ENABLE ROW LEVEL SECURITY;
```

### Migration 3: Add `digest_enabled` to organisations
```sql
ALTER TABLE public.organisations ADD COLUMN IF NOT EXISTS digest_enabled boolean NOT NULL DEFAULT true;
```

### Migration 4: SECURITY DEFINER function to read auth audit log
```sql
CREATE OR REPLACE FUNCTION public.get_recent_auth_events(_since timestamptz)
RETURNS TABLE(id uuid, user_id uuid, ip text, factor_type text, created_at timestamptz, payload jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, 
    (payload->>'actor_id')::uuid as user_id,
    ip_address::text as ip,
    (payload->>'action')::text as factor_type,
    created_at,
    payload
  FROM auth.audit_log_entries
  WHERE created_at > _since
  AND (payload->>'action') IN ('login', 'user_signedup', 'login_failed')
  ORDER BY created_at DESC
$$;
```

---

## Cron Job Registration (via SQL insert, not migrations)

Using `pg_cron` + `pg_net` to call each edge function on schedule:

| Function | Schedule | Description |
|---|---|---|
| `check-expiring-tokens` | `0 8 * * *` | Daily 8 AM UTC |
| `monthly-digest` | `0 9 1 * *` | 1st of month 9 AM UTC |
| `check-security-events` | `*/15 * * * *` | Every 15 minutes |
| `check-report-reminders` | `0 10 * * *` | Daily 10 AM UTC |

Sync failure alerts don't need a cron — they fire inline from `scheduled-sync`.

---

## Modifications to Existing Files

| File | Change |
|---|---|
| `supabase/functions/send-branded-email/index.ts` | Remove fake UUID fallback (line 672) |
| `supabase/functions/scheduled-sync/index.ts` | Add sync failure email notification after each failed sync |
| `supabase/functions/send-report-email/index.ts` | Add `link_only` mode flag support |
| `supabase/config.toml` | Add `[auth.hook.send_email]` config block |

---

## New Files

| File | Purpose |
|---|---|
| `supabase/functions/check-expiring-tokens/index.ts` | Token expiry + invite expiry monitor |
| `supabase/functions/stripe-webhook/index.ts` | Stripe billing event handler |
| `supabase/functions/monthly-digest/index.ts` | Monthly org summary email |
| `supabase/functions/check-security-events/index.ts` | Login monitoring + alerts |
| `supabase/functions/check-report-reminders/index.ts` | Report view reminder |

---

## New Secret Required

- **`STRIPE_WEBHOOK_SECRET`** — needed for Stripe webhook signature verification. The user will need to configure a webhook endpoint in their Stripe dashboard pointing to `https://kcdixfmjiifpnbtplodv.supabase.co/functions/v1/stripe-webhook` and copy the signing secret.

---

## Template Coverage After Implementation

All 26 templates will have active triggers:

| # | Template | Trigger |
|---|---|---|
| 1–5 | Auth | auth-email-hook (existing) |
| 6 | team_invitation | OrganisationSection (existing) |
| 7 | invitation_accepted | useInvites (existing) |
| 8 | invitation_expiring | check-expiring-tokens cron |
| 9 | role_changed | OrganisationSection (wire inline) |
| 10 | member_removed | OrganisationSection (wire inline) |
| 11 | report_delivery | send-report-email (existing) |
| 12 | report_link_only | send-report-email link_only flag |
| 13 | report_reminder | check-report-reminders cron |
| 14 | token_expiring | check-expiring-tokens cron |
| 15 | token_expired | check-expiring-tokens cron |
| 16 | sync_failed | scheduled-sync inline |
| 17 | report_generation_failed | reports.ts (existing) |
| 18–23 | Billing | stripe-webhook |
| 24 | monthly_digest | monthly-digest cron |
| 25 | new_device_login | check-security-events cron |
| 26 | failed_login_attempts | check-security-events cron |

Templates 9 and 10 (role_changed, member_removed) need small frontend wiring in `OrganisationSection.tsx` where role changes and removals already happen.

