

# Fix Swapped TikTok Platform Mappings

## Root Cause

The `tiktok` (organic) and `tiktok_ads` platform keys are **swapped** across three mapping files, plus there's a stray `handleLinkedIn` call in the oauth-callback. Here's the current (wrong) state:

| File | `tiktok` maps to | `tiktok_ads` maps to |
|---|---|---|
| `ConnectionDialog.tsx` CONNECT_FUNCTION_MAP | `tiktok-ads-connect` | `tiktok-business-connect` |
| `triggerSync.ts` SYNC_FUNCTION_MAP | `sync-tiktok-ads` | `sync-tiktok-business` |
| `scheduled-sync/index.ts` | `sync-tiktok-ads` | *(missing)* |

**The naming is backwards.** `tiktok-ads-connect` uses Login Kit (organic TikTok credentials: `TIKTOK_APP_ID`), while `tiktok-business-connect` uses the Business API (ads credentials: `TIKTOK_BUSINESS_APP_ID`). So when a user picks "TikTok" (organic), it calls `tiktok-ads-connect` which is actually the Login Kit flow — the naming is just confusing but the OAuth itself works. However, the **sync** is completely wrong: organic TikTok connections get routed to `sync-tiktok-ads` which tries to call the TikTok Business/Ads API expecting an advertiser `account_id`, finds none, and returns no data.

Additionally, `oauth-callback/index.ts` line 69 has a stray `await handleLinkedIn(...)` chained after `handleTikTokAds` for `tiktok_ads`.

## Plan

### 1. Fix CONNECT_FUNCTION_MAP in ConnectionDialog.tsx
Swap the mappings:
- `tiktok` → `tiktok-ads-connect` (this is correct — it's the Login Kit connect function despite the name)
- `tiktok_ads` → `tiktok-business-connect` (this is correct — it's the Business API connect function)

**Actually, the connect functions are named misleadingly but work correctly** because `tiktok-ads-connect` uses `TIKTOK_APP_ID` (Login Kit) and `tiktok-business-connect` uses `TIKTOK_BUSINESS_APP_ID`. The connect flow is fine. The problem is purely in the **sync** routing.

### 2. Fix SYNC_FUNCTION_MAP in triggerSync.ts
Swap the sync mappings:
- `tiktok` → `sync-tiktok-business` (organic TikTok uses the Business/Content API for video stats)
- `tiktok_ads` → `sync-tiktok-ads` (TikTok Ads uses the Ads reporting API)

Wait — let me re-examine. `sync-tiktok-business` calls `business-api.tiktok.com` and `sync-tiktok-ads` also calls an ads API. Need to verify which sync function actually handles organic data.

### Let me reconsider the actual function contents:

- **`sync-tiktok-ads/index.ts`** — calls the TikTok Ads reporting API, expects `account_id` (ad account). This is for **TikTok Ads**.
- **`sync-tiktok-business/index.ts`** — calls `business-api.tiktok.com` which is the TikTok Business API. This is for **organic TikTok** (video stats, followers, etc.).

So the correct mapping should be:
- `tiktok` (organic) → `sync-tiktok-business`
- `tiktok_ads` → `sync-tiktok-ads`

But currently both `triggerSync.ts` and `scheduled-sync` have it **backwards**.

### 3. Fix scheduled-sync/index.ts
Same swap + add the missing `tiktok_ads` entry:
- `tiktok` → `sync-tiktok-business`
- `tiktok_ads` → `sync-tiktok-ads`

### 4. Fix oauth-callback/index.ts line 69
Remove the stray `await handleLinkedIn(...)` that's incorrectly chained after `handleTikTokAds` in the `tiktok_ads` branch. Add a proper `else if (platform === "linkedin")` branch (which likely already exists further down — need to verify it's not missing).

### 5. Fix existing Black Steel Doors connection
After deploying the code fix, the existing `platform_connections` row for Black Steel Doors has `platform = 'tiktok'` but was authenticated via Login Kit. The OAuth token and connection are valid — the only issue was the sync was routed to the wrong function. Once the mapping is fixed, re-triggering sync from the admin panel will call the correct `sync-tiktok-business` function and data will populate.

No database migration needed — the connection record is correct, only the code routing was wrong.

---

## Files Modified

| File | Change |
|---|---|
| `src/lib/triggerSync.ts` | Swap `tiktok`↔`tiktok_ads` sync function names |
| `src/components/clients/ConnectionDialog.tsx` | Swap `tiktok`↔`tiktok_ads` connect function names (for consistency, even though they happen to work) |
| `supabase/functions/scheduled-sync/index.ts` | Swap `tiktok` mapping + add `tiktok_ads` entry |
| `supabase/functions/oauth-callback/index.ts` | Remove stray `handleLinkedIn` from `tiktok_ads` branch |

