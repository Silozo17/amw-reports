

# Fix LinkedIn Ads — `pivotValue` → `pivotValues`

## Root Cause

The LinkedIn AdAnalyticsV8 schema uses **`pivotValues`** (plural, type `string[]`) — not `pivotValue`. The current code requests and reads `pivotValue`, which the API rejects as an unknown field.

## Fix

### File: `supabase/functions/sync-linkedin-ads/index.ts`

**Change 1 — Field constants (lines 18-19):**
Replace `pivotValue` with `pivotValues` in both `ACCOUNT_FIELDS` and `CAMPAIGN_FIELDS`.

**Change 2 — Campaign parsing (line 215):**
Replace `el.pivotValue || ""` with `(el.pivotValues && el.pivotValues[0]) || ""` since the API returns an array.

