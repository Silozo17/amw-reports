

## Analysis: Facebook Sync Issues

### Root Causes Found

**Issue 1: Sync pulls ALL pages, not just the selected one**

The oauth-callback discovers ALL 25+ pages the user manages and stores them in `metadata.pages`. When the user picks "AMW Media" in the AccountPickerDialog, it saves `account_id = "342811868918578"` on the connection. But `sync-facebook-page` reads `metadata.pages` and loops over ALL of them (line 98: `for (const page of pages)`), aggregating metrics from every page. This is why you see wrong metrics — they're a mix of all 25+ pages.

**Issue 2: Deprecated metrics cause 100% failure on insights**

The sync requests these metrics: `page_impressions, page_impressions_paid, page_post_engagements, page_media_view, page_daily_follows_unique, page_daily_unfollows_unique, page_follows`

Per Meta's November 15, 2025 deprecation:
- `page_impressions` — **DEPRECATED** (replacement: `page_media_view`)
- `page_impressions_paid` — **DEPRECATED** (replacement: `page_media_view` with `is_from_ads` breakdown)
- `page_daily_follows_unique` — **DEPRECATED**
- `page_daily_unfollows_unique` — **DEPRECATED**

Since deprecated and valid metrics are mixed in one API call, the entire request fails with `(#100) The value must be a valid insights metric`. This means NO insights data is returned at all — zero follower growth, zero impressions, zero views.

**Issue 3: Debug Console sends wrong param name**

DebugConsole sends `{ connectionId, clientId, month, year }` but the sync function expects `{ connection_id, month, year }`. The sync ignores the camelCase param and fails.

### Fix Plan

#### Fix 1: Filter sync to selected page only
**File:** `supabase/functions/sync-facebook-page/index.ts`
- After loading `metadata.pages`, filter to only the page matching `conn.account_id`
- If `account_id` is set, use only that page; otherwise fall back to all pages (backward compat)

#### Fix 2: Update to v25-valid metrics only
**File:** `supabase/functions/sync-facebook-page/index.ts`
- Replace the insights API call with v25-valid metrics:
  - `page_media_view` (replaces page_impressions) — period=day
  - `page_post_engagements` — still valid, period=day
  - `page_follows` — still valid (running total), period=day
- Fetch `page_media_view` with breakdown `is_from_ads` separately to get paid vs organic split
- Remove all deprecated metrics: `page_impressions`, `page_impressions_paid`, `page_daily_follows_unique`, `page_daily_unfollows_unique`
- Add follower count from `page_follows` (last day's value = total followers)

#### Fix 3: Fix Debug Console param names
**File:** `src/pages/DebugConsole.tsx`
- Change `{ connectionId, clientId, month, year }` to `{ connection_id: conn.id, month, year }` to match what the edge function expects

### Files to modify:
1. `supabase/functions/sync-facebook-page/index.ts` — Filter to selected page + fix metrics
2. `src/pages/DebugConsole.tsx` — Fix param naming

