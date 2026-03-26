

# Platform Entitlements, Multi-Org Tenancy & Admin Panel

## Overview

Transform the current single-org system into a SaaS platform where AMW Media is the platform owner, organisations are tenants with subscription plans, and entitlement limits (clients, connections) are enforced throughout the app.

---

## Architecture

```text
┌─────────────────────────────────────────────┐
│  PLATFORM OWNER (AMW Media)                 │
│  info@amwmedia.co.uk                        │
│  /admin — manage all orgs, plans, billing   │
├─────────────────────────────────────────────┤
│  ORG: Re Digital (free unlimited)           │
│  ORG: Agency X   (agency plan)              │
│  ORG: Freelancer  (starter/free plan)       │
└─────────────────────────────────────────────┘
```

---

## Pricing Plans

| Plan | Price | Clients | Connections | Notes |
|------|-------|---------|-------------|-------|
| Starter | Free | 1 | 5 | Content creators / small biz |
| Agency | £49.99/mo | 5 | 25 | Growing agencies |
| Custom | Agency + add-ons | 5+ | 25+ | +£9.99/client, +£4.99/connection |

---

## Database Changes (4 migrations)

### 1. `subscription_plans` table (reference data)
Stores plan definitions (starter, agency). Columns: `id`, `name`, `slug`, `base_price`, `included_clients`, `included_connections`, `additional_client_price`, `additional_connection_price`, `is_active`.

### 2. `org_subscriptions` table
Links each org to a plan. Columns: `id`, `org_id`, `plan_id`, `status` (active/cancelled/trial), `additional_clients`, `additional_connections`, `is_custom` (for overrides like Re Digital), `override_max_clients` (nullable), `override_max_connections` (nullable), `current_period_start`, `current_period_end`, `created_at`, `updated_at`.

### 3. `is_platform_admin()` security definer function
Returns true if `auth.uid()` matches the AMW Media owner. Initially checks against a known user ID or a new `platform_admins` table (single row for now). Used in RLS for admin-only tables.

### 4. Add INSERT policy to `organisations` table
Currently orgs can't be inserted via RLS. The signup flow inserts an org — we need an INSERT policy: `WITH CHECK (created_by = auth.uid())`.

### 5. Seed data
- Insert Starter and Agency plans into `subscription_plans`
- Insert subscription record for AMW Media (custom, unlimited override)
- Insert subscription record for Re Digital (custom, unlimited override)

---

## Entitlement Logic

### New hook: `useEntitlements()`
Fetches `org_subscriptions` joined with `subscription_plans` for the current org. Returns:
- `maxClients`: included + additional (or override)
- `maxConnections`: included + additional (or override)
- `currentClients`: count from `clients` table
- `currentConnections`: count from `platform_connections` where `is_connected = true`
- `canAddClient`: boolean
- `canAddConnection`: boolean
- `plan`: plan details
- `isUnlimited`: true if overrides are set to -1

### Enforcement points
1. **ClientForm.tsx** — check `canAddClient` before allowing submission; show upgrade prompt if at limit
2. **ConnectionDialog.tsx** — check `canAddConnection` before connecting; show upgrade prompt if at limit
3. **ClientList.tsx** — show usage badge (e.g. "3/5 clients")
4. **Connections page** — show usage badge (e.g. "12/25 connections")

---

## Admin Panel (`/admin`)

### Route guard
Only accessible to platform admins (checked via `is_platform_admin()` or a `platform_admins` table lookup). Regular org owners/managers get redirected.

### Pages
1. **`/admin`** — Overview: total orgs, total users, total clients across platform
2. **`/admin/organisations`** — List all orgs with their plan, client count, connection count. Actions: edit plan, toggle unlimited, suspend
3. **`/admin/organisations/:id`** — Edit org subscription: change plan, set overrides, mark as custom/free

### Components
- `AdminLayout.tsx` — separate layout with admin sidebar
- `AdminOrgList.tsx` — table of all organisations
- `AdminOrgDetail.tsx` — subscription management form

---

## Signup Flow Changes

### `LandingPage.tsx`
After OTP verification and org creation, auto-create an `org_subscriptions` record with the Starter (free) plan. No plan selection during signup — users start free and upgrade later.

### New: `/settings` Billing tab (for org owners)
- Show current plan, usage, and limits
- "Upgrade" button (placeholder for now since payments are manual)
- Shows add-on costs for extra clients/connections

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/hooks/useEntitlements.ts` | Fetch and compute entitlement limits |
| `src/hooks/usePlatformAdmin.ts` | Check if current user is platform admin |
| `src/pages/admin/AdminDashboard.tsx` | Platform admin overview |
| `src/pages/admin/AdminOrgList.tsx` | List/manage all organisations |
| `src/pages/admin/AdminOrgDetail.tsx` | Edit org subscription |
| `src/components/admin/AdminLayout.tsx` | Admin-specific layout with sidebar |
| `src/components/entitlements/UsageBadge.tsx` | Reusable "3/5 clients" badge |
| `src/components/entitlements/UpgradePrompt.tsx` | Modal shown when at limit |
| `src/components/settings/BillingSection.tsx` | Plan & usage display in settings |

## Files to Modify

| File | Change |
|------|--------|
| `src/App.tsx` | Add `/admin/*` routes with platform admin guard |
| `src/pages/LandingPage.tsx` | Auto-assign Starter plan on signup |
| `src/pages/clients/ClientForm.tsx` | Check `canAddClient` before submit |
| `src/components/clients/ConnectionDialog.tsx` | Check `canAddConnection` before connecting |
| `src/pages/clients/ClientList.tsx` | Show usage badge |
| `src/pages/Connections.tsx` | Show usage badge |
| `src/pages/SettingsPage.tsx` | Add "Billing" tab |
| `src/components/layout/AppSidebar.tsx` | Show admin link for platform admins |

---

## Technical Notes

- **Platform admin identification**: Use a `platform_admins` table (just `user_id` column) with RLS that only platform admins can read. Seed with AMW Media owner's user ID. The `is_platform_admin()` function queries this table.
- **Unlimited access**: Represented by `override_max_clients = -1` and `override_max_connections = -1` in `org_subscriptions`. The hook treats -1 as unlimited.
- **Re Digital**: Gets a custom subscription record with unlimited overrides, no billing.
- **No Stripe yet**: Billing section shows plan info and a "Contact us to upgrade" or manual upgrade flow. Stripe integration deferred per your choice.
- **RLS on new tables**: `subscription_plans` readable by all authenticated users. `org_subscriptions` readable by org members, manageable by platform admins. `platform_admins` readable only by platform admins.

