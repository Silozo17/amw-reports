

# Extend Agency Plan Historical Sync to 24 Months

## Summary
Agency plan users should sync 24 months of historical data instead of 12. This affects initial connection sync, admin sync dialog, and scheduled sync. The pricing page and comparison table need updating to reflect this.

## Changes

### 1. `src/lib/triggerSync.ts`
- `triggerInitialSync` already accepts a `months` parameter (defaults to 12). No change needed here — callers will pass the correct value.

### 2. `src/pages/clients/ClientDetail.tsx`
- Import `useEntitlements` hook
- Determine sync months: `const syncMonths = entitlements.plan?.slug === 'agency' ? 24 : 12`
- Replace all three hardcoded `12` values in `triggerInitialSync` calls and the `total: 12` in `activeSyncs` with `syncMonths`

### 3. `src/pages/ClientPortalAuth.tsx`
- This calls `triggerInitialSync(conn.id, conn.platform)` with default 12 months
- Since this is the client portal (external users connecting their own accounts), it does not have org context — leave at 12 months (client portal users don't have plan context)

### 4. `src/components/admin/AdminSyncDialog.tsx`
- Change the loop from `for (let i = 0; i < 12; i++)` to `for (let i = 0; i < 24; i++)`
- Update all UI text: "12 months" → "24 months" (button label, dialog title, description, summary)
- Admin sync always does the maximum (24) since admins are platform-level

### 5. `supabase/functions/scheduled-sync/index.ts`
- No change needed — scheduled sync only syncs current month (+ previous month in first 7 days), not historical backfill

### 6. `src/pages/PricingPage.tsx`
- **Agency plan features list**: Add `'24 months historical data sync'`
- **Freelance plan features list**: Add `'12 months historical data sync'` for clarity
- **Comparison table**: Add a new row:
  ```
  { feature: 'Historical Data Sync', tooltip: 'How many months of historical data we import when you first connect a platform.', starter: '12 months', freelance: '12 months', agency: '24 months' }
  ```

