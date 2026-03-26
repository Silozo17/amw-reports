

# Remove User Sync Buttons, Add Automated Scheduling & Admin Sync

## Summary

1. Remove all user-facing sync buttons (ClientDetail sync popover, PlatformSection per-platform sync, Connections page refresh, DebugConsole sync)
2. Create a `scheduled-sync` edge function that runs daily at 5 AM — syncs current month for all connected platforms, and also syncs previous month during the first 7 days of a new month
3. After account selection (AccountPickerDialog `onComplete`), automatically trigger a background 12-month initial sync
4. Add a "Sync 12 Months" button per org in the admin panel (AdminOrgDetail) — platform admin only

## Technical Details

### 1. Remove sync buttons from user-facing UI

**`src/pages/clients/ClientDetail.tsx`**
- Remove the entire Sync `<Popover>` block (lines 420–461) — the sync button, month/year selectors, manual sync, and bulk sync
- Remove all related state: `isSyncing`, `syncMenuOpen`, `syncMonth`, `syncYear`, `isBulkSyncing`, `bulkProgress`
- Remove functions: `runSyncForMonth`, `handleManualSync`, `handleBulkSync`
- Remove `SYNC_FUNCTION_MAP` import
- Keep `RefreshCw` icon only if used elsewhere; remove if not

**`src/components/clients/dashboard/PlatformSection.tsx`**
- Remove the `handleSyncNow` function and "Sync" button (lines 230–271)
- Remove `triggerSync` import, `isSyncing` state, `Loader2`/`RefreshCw` icons if unused
- Remove the `connectionId` and `onSyncComplete` props (update interface)
- Keep the connection status badge and "Synced X ago" text

**`src/components/clients/ClientDashboard.tsx`**
- Remove `onSyncComplete={fetchSnapshots}` prop from `PlatformSection` calls

**`src/pages/Connections.tsx`**
- Remove the `<RefreshCw>` ghost button from each connection card (line 107–109)

**`src/pages/DebugConsole.tsx`**
- Remove the "Sync Now" button and `handleSyncTest` function

### 2. Create `scheduled-sync` edge function

**`supabase/functions/scheduled-sync/index.ts`**

New edge function that:
- Queries all `platform_connections` where `is_connected = true` and `account_id IS NOT NULL`
- Determines months to sync:
  - Always sync current month
  - If today's date is <= 7th of the month, also sync previous month (to catch late-reporting data)
- For each connection, invokes the appropriate sync function (using the same `SYNC_FUNCTION_MAP` logic)
- Processes connections sequentially or in small batches to avoid rate limits
- Returns a summary of results

### 3. Set up pg_cron job for daily 5 AM sync

- Use `supabase--read_query` to enable `pg_cron` and `pg_net` extensions
- Create a cron job: `0 5 * * *` (5:00 AM UTC daily) that calls the `scheduled-sync` edge function

### 4. Auto-sync 12 months on first connection

**`src/components/clients/AccountPickerDialog.tsx`**
- After `onComplete()` is called (account selection saved), trigger a background 12-month sync for the newly connected platform(s)
- Use `triggerInitialSync` from `triggerSync.ts` but updated to 12 months
- Run in background (fire-and-forget with toast notifications for progress/completion)
- For Meta Ads multi-step: after all connections (meta_ads, facebook, instagram) are created, sync all of them

### 5. Admin bulk sync button

**`src/pages/admin/AdminOrgDetail.tsx`**
- Add a "Sync All Platforms (12 months)" button to the Connection Health card header
- When clicked: fetch all connected platform connections for this org, then sequentially sync each one for the last 12 months using `supabase.functions.invoke`
- Show progress toast/badge during sync
- This is the only place where manual sync remains in the entire app

### Files to modify
1. `src/pages/clients/ClientDetail.tsx` — remove sync UI
2. `src/components/clients/dashboard/PlatformSection.tsx` — remove sync button
3. `src/components/clients/ClientDashboard.tsx` — remove onSyncComplete prop
4. `src/pages/Connections.tsx` — remove refresh button
5. `src/pages/DebugConsole.tsx` — remove sync test button
6. `src/components/clients/AccountPickerDialog.tsx` — add auto 12-month sync on connect
7. `src/lib/triggerSync.ts` — update `triggerInitialSync` default to 12 months
8. `supabase/functions/scheduled-sync/index.ts` — new edge function
9. `src/pages/admin/AdminOrgDetail.tsx` — add admin sync button

