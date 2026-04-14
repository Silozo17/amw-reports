

## Plan: Server-Side Admin Sync with Granular Controls

### Implemented

**1. New Edge Function: `supabase/functions/admin-sync/index.ts`**
- Server-side sync orchestrator — runs independently of the browser
- Processes connections sequentially (one at a time), then months sequentially within each connection
- 1.5s delay between months, 3s delay between connections to respect API rate limits
- Supports 3 modes: `single_month`, `date_range`, `full` (24 months)
- Auto-caps Pinterest to 3 months
- Validates caller is a platform admin via JWT + `is_platform_admin` RPC
- Returns full results summary when complete

**2. Redesigned `src/components/admin/AdminSyncDialog.tsx`**
- Step 1: Scope — Single Channel / Single Client / Whole Org / Whole Platform
- Step 2: Channel selection — All channels or multi-select specific ones (checkbox list)
- Step 3: Time range — Single month (with month/year picker), Date range (from/to), Full 24 months
- Calls `admin-sync` edge function — sync runs server-side, page can be closed
- Loading spinner during sync call
- Pinterest cap noted in UI

**3. Simplified `src/components/admin/AdminOrgClients.tsx`**
- Removed all client-side sync state (activeSyncs, syncStartTime, SyncProgressBar)
- Removed sync callback props — sync is now fully server-side
- Clean, focused component

### Architecture
- Each connection is processed one at a time (sequential queue)
- Within each connection, each month is processed one at a time (sequential queue)
- No concurrent API calls — prevents rate limiting
- Navigating away does NOT stop the sync
