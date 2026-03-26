

# GBP Integration — Root Cause Analysis & Fix Plan

## What I Found

### Root Cause 1: My Business Account Management API — Quota = 0 (429 errors)
From your Google Cloud screenshot: the **My Business Account Management API** has **3 requests, 100% error rate** — all returning **HTTP 429** (rate limit / quota exceeded).

This is a **well-documented Google issue**: new GCP projects that enable this API get a **default quota of 0 requests/minute**. You must submit a **GBP API access request** via Google's official form to get a non-zero quota. The docs state:

> "If you have a quota of 0 after enabling the API, please request for GBP API access."

This means the `accounts.list` call in discovery (line 723) always fails → no accounts found → no locations discovered → sync fails with "No location selected."

**This is NOT a code bug — it's a Google Cloud configuration issue.** You need to request quota via: https://docs.google.com/forms/d/e/1FAIpQLSf6sFkVvMHASmDgJlCQ4LmCTODMJkLOmBNfCtKNDm_4CanCRg/viewform

### Root Cause 2: Reviews endpoint uses deprecated v4 API
The sync function (line 167-168) calls:
```
https://mybusiness.googleapis.com/v4/${locationId}/reviews
```
The **v4 My Business API was deprecated** (sunset March 2023). Reviews should now be fetched through `https://mybusiness.googleapis.com/v4/` is gone — the replacement is not yet clear for reviews specifically (Google hasn't released a standalone reviews v1 API publicly). For now, the code silently catches this failure, so it's non-blocking but reviews data will always be zero.

### Root Cause 3: Discovery error not surfaced clearly for 429
Currently, a 429 from the Account Management API hits the `else` branch at line 733 and produces a generic error message. It should specifically detect 429 and tell the user about the quota issue.

## Plan

### Step 1: Improve error handling in `oauth-callback/index.ts` (handleGoogleBusinessProfile)
- Detect HTTP 429 specifically and set `discoveryError` to: "My Business Account Management API has 0 quota. Please request GBP API access from Google before connecting."
- This gives the user a clear, actionable error message instead of a generic failure.

### Step 2: Improve error handling in `sync-google-business-profile/index.ts`
- When `metricRes` returns non-200, log the actual response body for debugging (currently it just `continue`s silently).
- Add detailed error logging for the reviews call too.

### Step 3: Remove deprecated v4 reviews endpoint
- Remove the `mybusiness.googleapis.com/v4/` reviews call since it's deprecated and always fails silently.
- Set `reviewsCount` and `avgRating` to `null` (not 0) so the dashboard can distinguish "no data" from "zero reviews."
- Add a TODO comment noting the reviews API status.

### Step 4: Add `My Business Business Information API` detection
- In the discovery flow, when fetching locations under accounts (line 738), detect if this API returns a 403/PERMISSION_DENIED and surface a specific error asking the user to enable it.

### What You Need To Do (not code — Google Cloud Console)
1. Go to https://console.cloud.google.com/apis/api/mybusinessaccountmanagement.googleapis.com/quotas
2. Check if the quota is 0 QPM
3. Submit the GBP API access request form: https://docs.google.com/forms/d/e/1FAIpQLSf6sFkVvMHASmDgJlCQ4LmCTODMJkLOmBNfCtKNDm_4CanCRg/viewform
4. Google typically grants access within a few business days

### Files to modify
- `supabase/functions/oauth-callback/index.ts` — lines 700-774 (handleGoogleBusinessProfile)
- `supabase/functions/sync-google-business-profile/index.ts` — lines 136-178 (metrics + reviews)

