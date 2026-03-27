

# Price Reduction + Freelance Weekly Sync — Full Platform Update

## Overview

Three changes:
1. Reduce Freelance from £49.99 → £29.99/mo and Agency from £69.99 → £49.99/mo
2. Change Freelance sync frequency from daily → weekly
3. Create new Stripe prices and migrate existing subscribers

---

## 1. Stripe: Create New Prices

Use Stripe tools to create two new recurring prices on the existing products:
- Freelance product: new price £29.99/mo (GBP)
- Agency product: new price £49.99/mo (GBP)

Then use Stripe to update existing active subscriptions to the new price IDs (schedule change at next billing period to avoid mid-cycle disruption).

Archive the old prices (`price_1TFHsVHCGP7kst5ZpWooaPlh` and `price_1TFNmfHCGP7kst5ZS17zNsEQ`) in Stripe so no new checkouts use them.

---

## 2. Database: Update `subscription_plans` Table

Update the `base_price` column for both plans:
- `freelance`: `base_price` from 49.99 → 29.99
- `agency`: `base_price` from 69.99 → 49.99

(Use insert/update tool, not migration — this is data, not schema.)

---

## 3. Scheduled Sync: Add Weekly Logic for Freelance

In `supabase/functions/scheduled-sync/index.ts`, currently:
- Starter: only syncs on the 4th
- Freelance & Agency: sync daily (no filter)

Change to:
- Starter: only syncs on the 4th (unchanged)
- Freelance: only syncs on Mondays (day of week check)
- Agency: syncs daily (unchanged)

Add after the starter check (line ~99):
```ts
// Freelance plan: only sync on Mondays (weekly)
if (planSlug === "freelance" && now.getDay() !== 1) {
  skippedStarter++;
  continue;
}
```

Update the skip counter variable name to be more generic (e.g. `skippedCount`).

---

## 4. UI: Update All Price References

### `src/components/settings/BillingSection.tsx`
- Freelance price: `'£29.99/mo'`, new `priceId` (from Stripe creation)
- Agency price: `'£49.99/mo'`, new `priceId` (from Stripe creation)
- Freelance features: change `'Branded reports'` → add `'Weekly data sync'`
- Agency features: keep `'Daily data sync'` or similar to differentiate

### `src/pages/PricingPage.tsx`
- PLANS array: Freelance `'£29.99'`, Agency `'£49.99'`
- Freelance features: change `'Daily data sync'` → `'Weekly data sync'`
- Compare table row: change Freelance from `'Daily'` → `'Weekly'`
- FAQ answer about sync frequency: update to mention Freelance is weekly, Agency is daily
- Meta description: update price references

### `src/pages/ForFreelancersPage.tsx`
- Line 10: `£49.99/mo` → `£29.99/mo`
- Line 79: `£49.99/month` → `£29.99/month`

### `src/pages/WhiteLabelReportsPage.tsx`
- Line 21: `£69.99/month` → `£49.99/month`

### `src/pages/SocialMediaReportingPage.tsx`
- FAQ: "Freelance and Agency plans sync daily" → "Agency plans sync daily. Freelance plans sync weekly."

### `src/pages/SeoReportingPage.tsx`
- FAQ: same sync frequency update

### `src/pages/PpcReportingPage.tsx`
- FAQ: same sync frequency update

### `src/pages/HowItWorksPage.tsx`
- Line 64: update to mention Freelance syncs weekly, Agency syncs daily

### `index.html` (static SEO HTML)
- Freelance price: `£49.99` → `£29.99`
- Agency price: `£69.99` → `£49.99`
- Freelance sync feature: `Daily data sync` → `Weekly data sync`

---

## 5. Memory Update

Update the automation-schedule memory to reflect Freelance = weekly sync on Mondays, Agency = daily.

---

## Files Modified

| File | Change |
|---|---|
| Stripe (tool) | Create 2 new prices, migrate existing subscribers, archive old prices |
| DB (insert tool) | Update `subscription_plans` base_price for freelance and agency |
| `supabase/functions/scheduled-sync/index.ts` | Add weekly (Monday-only) check for freelance plan |
| `src/components/settings/BillingSection.tsx` | New prices, new priceIds, sync frequency in features |
| `src/pages/PricingPage.tsx` | Price updates, sync frequency in features/table/FAQ |
| `src/pages/ForFreelancersPage.tsx` | Price references |
| `src/pages/WhiteLabelReportsPage.tsx` | Agency price reference |
| `src/pages/SocialMediaReportingPage.tsx` | Sync frequency FAQ |
| `src/pages/SeoReportingPage.tsx` | Sync frequency FAQ |
| `src/pages/PpcReportingPage.tsx` | Sync frequency FAQ |
| `src/pages/HowItWorksPage.tsx` | Sync frequency description |
| `index.html` | Static HTML price + sync updates |

