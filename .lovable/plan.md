

# Limit Pinterest Sync to 3 Months

## Problem
Pinterest API only allows 90 days of historical data. Currently, the system tries to sync 12-24 months for all platforms including Pinterest, which wastes API calls and likely fails silently for older months.

## Changes

### 1. `src/lib/triggerSync.ts` — Add platform-aware month cap
Add a constant map for platform sync limits and apply it in `triggerInitialSync`:

```ts
const PLATFORM_MAX_MONTHS: Partial<Record<PlatformType, number>> = {
  pinterest: 3,
};
```

In `triggerInitialSync`, cap `months` to the platform limit:
```ts
const maxMonths = PLATFORM_MAX_MONTHS[platform] ?? months;
const effectiveMonths = Math.min(months, maxMonths);
```

Use `effectiveMonths` in the loop and progress reporting. This automatically handles all call sites (ClientDetail, ClientPortalAuth, AdminSyncDialog).

### 2. `supabase/functions/backfill-sync/index.ts` — Same cap server-side
Add the same `PLATFORM_MAX_MONTHS` map and cap the `months` variable after reading it from the request body, before generating the months range.

### 3. `supabase/functions/scheduled-sync/index.ts` — Verify
The scheduled sync only syncs the current month (and optionally previous month in first 7 days). No change needed — it never requests historical data beyond 1-2 months.

### Files to update
- `src/lib/triggerSync.ts` — add platform month cap
- `supabase/functions/backfill-sync/index.ts` — add platform month cap

No other platforms have documented sync period limits that would require capping below 24 months. Google, Meta, TikTok, LinkedIn, YouTube, and Facebook all support multi-year historical data retrieval.

