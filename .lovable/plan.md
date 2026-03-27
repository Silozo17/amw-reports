

# Remaining Work to Make Email Templates Fully Operational

## Current State

The templates, the `send-branded-email` edge function, the `auth-email-hook`, and the `send-report-email` refactor are all **built and deployed**. The frontend helper `sendBrandedEmail()` exists but is **not wired into any UI flow**.

Here is what still needs to happen:

---

## 1. Register the Auth Email Hook with Supabase

The `auth-email-hook` edge function exists but Supabase Auth doesn't know about it yet. It must be registered as a **Send Email Hook** so Supabase routes auth events (signup, recovery, magic link) through it instead of sending default emails.

This requires configuring the hook in `supabase/config.toml` under `[auth.hook.send_email]`, pointing to the `auth-email-hook` edge function. Without this, all auth emails still use Supabase's default templates.

---

## 2. Fix email_logs.client_id Constraint

The `email_logs` table has `client_id` as **NOT NULL**. For non-client emails (auth, team, billing, security), the function currently inserts a fake zero UUID (`00000000-...`). This should be changed to allow `NULL` so non-client emails log cleanly.

**Migration:** `ALTER TABLE email_logs ALTER COLUMN client_id DROP NOT NULL;`

---

## 3. Wire Frontend Triggers

The `sendBrandedEmail()` helper is defined but never imported anywhere. These existing UI flows should call it:

| Template | Where to wire |
|---|---|
| `team_invitation` (#6) | Org settings invite member flow (likely `OrganisationSection.tsx` or `useInvites.ts`) |
| `report_generation_failed` (#17) | Reports page, after `generate-report` returns an error |
| `invitation_accepted` (#7) | After a user accepts an invite (in the accept invite handler) |

The `report_delivery` (#11) flow is already wired — `send-report-email` delegates to `send-branded-email`.

---

## 4. Deploy Edge Functions

Both `send-branded-email` and `auth-email-hook` need to be confirmed deployed. If not already deployed in the previous session, they need redeployment.

---

## Summary of Changes

| File | Action |
|---|---|
| `supabase/config.toml` | Add `[auth.hook.send_email]` config |
| `supabase/migrations/XXXX.sql` | Make `email_logs.client_id` nullable |
| `src/hooks/useInvites.ts` (or equivalent) | Import and call `sendBrandedEmail` for team_invitation |
| `src/pages/Reports.tsx` (or equivalent) | Call `sendBrandedEmail` for report_generation_failed on error |
| Edge functions | Confirm deployed |

---

## What Is Deferred (per your earlier choice)

These items need **trigger infrastructure** not yet built:
- Token expiry monitoring (cron to check `platform_connections.token_expires_at`)
- Sync failure alerts (hook after sync completes with `status = 'failed'`)
- Monthly digest (cron on 1st of month)
- Security alerts (login monitoring)
- Billing/subscription emails (Stripe webhook handlers)
- Invitation expiry reminders (cron to check pending invites)
- Report reminder (open tracking or time-based cron)

All templates for these are **ready** — they just need automated triggers wired up in a follow-up phase.

