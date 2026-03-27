

# Add Sync Frequency to Pricing & Enforce Monthly Sync for Creator Plan

## Changes

### 1. Update `src/pages/PricingPage.tsx` — Add sync frequency to plan features & comparison table

**PLANS array:**
- Creator: change `'Monthly sync'` → `'Monthly sync (4th of each month)'`
- Freelance: add `'Daily data sync'` to features list
- Agency: add `'Daily data sync'` to features list

**COMPARISON_ROWS:**
- Add row: `{ feature: 'Data Sync Frequency', starter: 'Monthly', freelance: 'Daily', agency: 'Daily' }`

### 2. Update `supabase/functions/scheduled-sync/index.ts` — Filter by plan

The scheduled sync currently syncs ALL active connections regardless of plan. We need to:
- Join connections with their client's org subscription and plan
- For orgs on the `starter` (Creator) plan: only sync if today is the 4th of the month
- For orgs on `freelance` or `agency` plans: sync daily as normal

**Implementation:** Query each connection's org plan via `clients → org_id → org_subscriptions → subscription_plans.slug`. Check the day of month and skip starter-plan connections unless it's the 4th.

### 3. Add FAQ entry about sync frequency

Add: `{ q: 'How often is my data synced?', a: 'Creator plans sync data once per month on the 4th. Freelance and Agency plans benefit from daily automatic syncing to keep your dashboards up to date.' }`

## Files to Modify

| File | Change |
|---|---|
| `src/pages/PricingPage.tsx` | Update features, comparison row, FAQ |
| `supabase/functions/scheduled-sync/index.ts` | Filter sync by plan (daily vs monthly on 4th) |

