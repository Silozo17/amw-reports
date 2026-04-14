

## Plan: Update Plan Slugs and Sync Schedules

### What changed
- **Creator** (free): syncs weekly on Monday at 5am
- **Freelance** (£29.99): syncs weekly on Monday at 5am  
- **Agency** (£49.99): syncs daily at 5am
- All plans: sync current month + previous month during first 7 days of new month

### Changes required

**1. Rename `starter` → `creator` in database**
- Update `subscription_plans` table: `UPDATE subscription_plans SET slug = 'creator' WHERE slug = 'starter'`
- Update `handle_new_user` DB function to reference `'creator'` instead of `'starter'`

**2. Fix `scheduled-sync/index.ts` (lines 186-195)**
Current broken logic:
```
if (planSlug === "starter" && dayOfMonth !== 4) skip  // wrong: was monthly on 4th
if (planSlug === "freelance" && now.getDay() !== 1) skip  // correct day, wrong slug context
// agency: no gate = daily ✓
```
New logic:
```
if (planSlug === "creator" && now.getDay() !== 1) skip   // weekly Monday
if (planSlug === "freelance" && now.getDay() !== 1) skip  // weekly Monday
// agency: no gate = daily ✓
```
The previous-month-during-first-7-days logic (lines 133-138) already works correctly for all plans — no change needed there.

**3. Fix `check-subscription/index.ts`**
- Lines 59, 111, 127: change `"starter"` → `"creator"` (3 occurrences)

**4. Fix `src/lib/orgRecovery.ts`**
- Lines 74-77: change `slug = 'starter'` → `slug = 'creator'`

**5. Fix `src/pages/admin/AdminOrgList.tsx`**
- Lines 91-94: change `slug = 'starter'` → `slug = 'creator'`

**6. Fix `src/hooks/useEntitlements.ts`**
- Line 51: rename `STARTER_LIMITS` → `CREATOR_LIMITS` (cosmetic, keeps code consistent)

**7. Fix `src/pages/PricingPage.tsx`**
- Lines 26, 53-77: rename `starter` property to `creator` in the comparison table type and data
- Line 63: update sync frequency text from `'Monthly (4th of each month)'` to `'Weekly (Monday)'`

### Files touched

| File | Change |
|---|---|
| `subscription_plans` table (data update) | `slug: starter → creator` |
| `handle_new_user` DB function (migration) | `'starter' → 'creator'` |
| `supabase/functions/scheduled-sync/index.ts` | Fix plan gating logic |
| `supabase/functions/check-subscription/index.ts` | `starter → creator` (3 places) |
| `src/lib/orgRecovery.ts` | `starter → creator` |
| `src/pages/admin/AdminOrgList.tsx` | `starter → creator` |
| `src/hooks/useEntitlements.ts` | Rename constant |
| `src/pages/PricingPage.tsx` | Rename property + fix sync text |

### Not changed
- `admin-sync` edge function — unrelated to scheduled sync
- Monthly previous-month logic — already correct for all plans
- `useEntitlements` core logic — works off DB data, no slug hardcoding

