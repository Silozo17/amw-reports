

# Fix TikTok Organic vs TikTok Ads — Complete Audit

## Current State (fully mapped)

### Edge Functions — Connect
| Function | Credentials | OAuth URL | State platform | Purpose |
|---|---|---|---|---|
| `tiktok-ads-connect` | `TIKTOK_APP_ID` / `TIKTOK_APP_SECRET` | `tiktok.com/v2/auth/authorize/` (Login Kit) | `"tiktok"` | Organic TikTok |
| `tiktok-business-connect` | `TIKTOK_BUSINESS_APP_ID` / `TIKTOK_BUSINESS_APP_SECRET` | `business-api.tiktok.com/portal/auth` | `"tiktok_ads"` | TikTok Ads |

### CONNECT_FUNCTION_MAP (ConnectionDialog.tsx)
- `tiktok` → `tiktok-ads-connect` ✅ (confusing name, but correctly uses Login Kit for organic)
- `tiktok_ads` → `tiktok-business-connect` ✅ (confusing name, but correctly uses Business API for ads)

### OAuth Callback
- `"tiktok"` → `handleTikTok()` → Login Kit v2 token exchange with `TIKTOK_APP_ID` ✅
- `"tiktok_ads"` → `handleTikTokAds()` → Business API token exchange with `TIKTOK_BUSINESS_APP_ID` ✅

### Edge Functions — Sync (THIS IS WHERE IT'S BROKEN)
| Function | Actually calls | Credentials used | Purpose |
|---|---|---|---|
| `sync-tiktok-business` | `open.tiktokapis.com/v2/video/list/` | `TIKTOK_APP_ID` | Organic TikTok ✅ |
| `sync-tiktok-ads` | `open.tiktokapis.com/v2/video/list/` + `user/info/` | `TIKTOK_APP_ID` | **ALSO Organic TikTok** ❌ |

### SYNC_FUNCTION_MAP (triggerSync.ts + scheduled-sync)
- `tiktok` → `sync-tiktok-business` ✅
- `tiktok_ads` → `sync-tiktok-ads` — but `sync-tiktok-ads` has **organic** code, not ads code ❌

### AdminSyncDialog PLATFORM_LABELS (line 43)
- `tiktok` → `'TikTok Ads'` ❌ — should be `'TikTok'`
- `tiktok_ads` → **missing entirely** ❌

---

## Problems Summary

1. **`sync-tiktok-ads/index.ts` contains organic TikTok code** instead of TikTok Ads (Business API) code. It needs to be rewritten to call `business-api.tiktok.com/open_api/v1.3/report/integrated/get/` with `advertiser_id` and the Business API access token.

2. **AdminSyncDialog has wrong label** — `tiktok` is labeled `'TikTok Ads'` (line 43), which is why the screenshot shows "TikTok Ads — BLACK STEEL DOORS" for an organic TikTok connection. Also missing `tiktok_ads` entry.

3. The connect functions, oauth callback, sync maps, and `sync-tiktok-business` are all correct. No changes needed there.

---

## Plan

### Step 1: Rewrite `sync-tiktok-ads/index.ts` for actual TikTok Ads
Replace the current organic code with a proper TikTok Business API sync:
- Call `business-api.tiktok.com/open_api/v1.3/report/integrated/get/` with the `advertiser_id` from `connection.account_id`
- Use the Business API access token (long-lived, no refresh needed)
- Fetch ad metrics: `spend`, `impressions`, `clicks`, `ctr`, `cpc`, `cpm`, `conversions`, `conversion_value`, `reach`, `video_views`, `conversion_rate`
- Log platform as `tiktok_ads` in sync_logs and monthly_snapshots
- No token refresh needed (Business API tokens are long-lived)

### Step 2: Fix AdminSyncDialog PLATFORM_LABELS
**File:** `src/components/admin/AdminSyncDialog.tsx`
- Change `tiktok: 'TikTok Ads'` → `tiktok: 'TikTok'`
- Add `tiktok_ads: 'TikTok Ads'`

### No other changes needed
- Connect functions: correct ✅
- OAuth callback: correct ✅
- SYNC_FUNCTION_MAP: correct ✅ (`tiktok` → `sync-tiktok-business`, `tiktok_ads` → `sync-tiktok-ads`)
- `sync-tiktok-business`: correct ✅ (organic Login Kit API)
- Global `PLATFORM_LABELS` in `database.ts`: correct ✅

---

## Files Modified

| File | Change |
|---|---|
| `supabase/functions/sync-tiktok-ads/index.ts` | Full rewrite — replace organic code with TikTok Business API ads reporting |
| `src/components/admin/AdminSyncDialog.tsx` | Fix `tiktok` label from "TikTok Ads" to "TikTok", add `tiktok_ads` entry |

