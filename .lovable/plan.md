

# Change Connection Add-On Pricing: Pack of 5 for £9.99

## What's Changing

Currently: additional connections cost £4.99/mo **each** (1 connection).
New: additional connections cost £9.99/mo per **pack of 5**, usable across any clients.

## Changes Required

### 1. Database — Update `subscription_plans` table
Use the insert tool to update `additional_connection_price` from 4.99 to 9.99 for both freelance and agency plans.

### 2. `src/hooks/useEntitlements.ts`
- Remove the old `LOCKED_CONNECTIONS_PER_CLIENT = 3` logic entirely — connections are now fully flexible
- Change `maxConnections` calculation: each `additional_connections` unit now represents 5 connections, so multiply by 5:
  ```ts
  : (plan?.included_connections ?? 5) + ((subscription?.additional_connections ?? 0) * 5);
  ```
- Remove `canAddConnectionForClient`, `flexiblePoolRemaining`, and the locked-slot logic — all additional connections are freely assignable
- Simplify to just `canAddConnection: currentConnections < maxConnections`

### 3. `src/components/entitlements/UpgradePrompt.tsx`
- Change connection price from `£4.99` to `£9.99`
- Update copy: "add packs of 5 connections at £9.99/month" instead of "individual connections at £4.99/month"

### 4. `src/components/clients/ConnectionDialog.tsx`
- Replace `canAddConnectionForClient(clientConnectionCount)` with just `canAddConnection` (no per-client locking)

### 5. `src/pages/PricingPage.tsx`
- Change "Add-on connections £4.99/mo each" → "Add-on connections £9.99/mo (5 pack)"
- Update comparison table row: "£4.99/mo each" → "£9.99/mo (5 pack)"

### 6. `src/components/settings/BillingSection.tsx`
- No price references to connections here, but the usage display remains the same

### 7. `index.html` — Static SEO HTML
- Update all 3 occurrences of "£4.99/mo each" → "£9.99/mo (5 pack)" in pricing cards and comparison table

### 8. Other pages referencing connection pricing
- `src/pages/ForFreelancersPage.tsx`, `src/pages/WhiteLabelReportsPage.tsx` — search and update any "£4.99" connection references

| File | Change |
|---|---|
| DB: `subscription_plans` | Update `additional_connection_price` to 9.99 |
| `src/hooks/useEntitlements.ts` | Multiply additional_connections by 5, remove locked-slot logic |
| `src/components/entitlements/UpgradePrompt.tsx` | £4.99 → £9.99, update copy for 5-pack |
| `src/components/clients/ConnectionDialog.tsx` | Remove per-client check, use simple `canAddConnection` |
| `src/pages/PricingPage.tsx` | Update pricing text and comparison table |
| `index.html` | Update static HTML pricing references |
| Audience pages | Update any £4.99 connection references |

