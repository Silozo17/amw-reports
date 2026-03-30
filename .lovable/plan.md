

# Entitlements, Payments & Grace Period Hardening

## Current State

The platform has basic entitlement enforcement:
- `useEntitlements` checks client/connection counts against plan limits
- `UpgradePrompt` blocks adding clients/connections when limits are reached
- `check-subscription` syncs Stripe status to `org_subscriptions`
- `stripe-webhook` sends emails for payment failures and cancellations
- `scheduled-sync` gates syncs by plan slug and only processes `status = 'active'` subscriptions

## Critical Gaps Found

### 1. No grace period for failed payments (P0)
When a payment fails, the webhook sends an email but does **nothing** to the `org_subscriptions` status. The subscription stays `active` in the database even if Stripe marks it `past_due`. Features remain fully unlocked indefinitely after payment failure.

### 2. No feature locking on cancelled/past_due subscriptions (P0)
`useEntitlements` doesn't check `subscription.status`. A cancelled or past-due subscription still returns full entitlements (clients, connections, whitelabel). There is no downgrade to Starter limits.

### 3. Webhook doesn't sync subscription status changes (P1)
The `stripe-webhook` handles emails for `customer.subscription.updated`, `customer.subscription.deleted`, and `invoice.payment_failed`, but **never updates `org_subscriptions.status`** in the database. Only `check-subscription` (called from the frontend) syncs status, but only for `active` subscriptions.

### 4. `check-subscription` only queries active Stripe subscriptions (P1)
Line 58-61: `status: "active"` filter means past_due/cancelled subscriptions are invisible. If a subscription becomes `past_due`, the function reports `subscribed: false` and falls back to Starter — but doesn't update `org_subscriptions` to reflect that.

### 5. No `past_due` or `grace_period` status in `org_subscriptions` (P1)
The `status` column is a plain `text` with no concept of grace periods. There's no `grace_period_end` column to track when features should be locked.

### 6. Sync engine doesn't check subscription status (P2)
`scheduled-sync` queries `org_subscriptions` with `.eq("status", "active")` but never considers `past_due` or `cancelled`. This is actually correct behaviour IF the status is properly synced — but currently it isn't.

---

## Implementation Plan

### Step 1: Add `grace_period_end` column to `org_subscriptions`
Migration to add:
```sql
ALTER TABLE org_subscriptions ADD COLUMN grace_period_end timestamptz DEFAULT NULL;
```
This column stores the deadline after which features are locked. Set to 7 days after payment failure.

### Step 2: Update `stripe-webhook` to sync subscription status
When the webhook receives:
- `invoice.payment_failed` → set `org_subscriptions.status = 'past_due'`, set `grace_period_end = now() + 7 days`
- `customer.subscription.updated` with status `canceled`/`past_due` → update `org_subscriptions.status` accordingly
- `customer.subscription.deleted` → set status to `cancelled`, set `grace_period_end = now() + 7 days` (if not already set)
- `checkout.session.completed` → set status to `active`, clear `grace_period_end`

### Step 3: Update `check-subscription` to handle non-active statuses
- Query Stripe for `past_due` subscriptions as well (not just `active`)
- When syncing to `org_subscriptions`, set the correct status (`active`, `past_due`, `cancelled`)
- If past_due with no existing grace_period_end, set it to 7 days from now

### Step 4: Update `useEntitlements` to enforce status-based feature locking
Add new fields to the `Entitlements` interface:
- `subscriptionStatus: 'active' | 'past_due' | 'cancelled' | 'none'`
- `isInGracePeriod: boolean` (past_due but grace_period_end is in the future)
- `isLocked: boolean` (past_due/cancelled AND grace period expired)

When `isLocked`:
- `canAddClient = false`
- `canAddConnection = false`
- `hasWhitelabel = false`
- Fall back to Starter plan limits (1 client, 5 connections)

When `isInGracePeriod`:
- Keep current plan features but set `canAddClient = false` and `canAddConnection = false` (no expansion)

### Step 5: Add a billing status banner
Create a `BillingStatusBanner` component shown in `AppLayout` when:
- **Past due (grace period)**: Yellow warning banner — "Your payment failed. Features will be restricted on {date}. Please update your payment method."
- **Locked (grace expired)**: Red banner — "Your subscription has been suspended. Upgrade or update payment to restore access."

Both banners link to `/settings?tab=billing`.

### Step 6: Update `BillingSection` to show status prominently
Display the grace period deadline when `past_due`. Show a prominent "Update Payment Method" CTA that opens the Stripe customer portal.

---

## Technical Details

**Files to create:**
- `src/components/layout/BillingStatusBanner.tsx` — warning/error banner component

**Files to modify:**
- `supabase/functions/stripe-webhook/index.ts` — sync status to `org_subscriptions`
- `supabase/functions/check-subscription/index.ts` — query past_due subscriptions, sync grace period
- `src/hooks/useEntitlements.ts` — add status-aware feature locking
- `src/components/layout/AppLayout.tsx` — render `BillingStatusBanner`
- `src/components/settings/BillingSection.tsx` — show grace period info and payment CTA

**Migration:**
- Add `grace_period_end` column to `org_subscriptions`

**Grace period policy:**
- 7-day grace period after first payment failure
- During grace: existing features work, no new clients/connections
- After grace: fall back to Starter limits, white-label disabled, syncs stop (because scheduled-sync already filters by `active` status)

