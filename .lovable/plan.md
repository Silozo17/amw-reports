

# LinkedIn Connection Fix

## Root Cause

The LinkedIn OAuth fails because of a **product mismatch** on the LinkedIn Developer Portal.

Your app currently has: **Pages Data Portability API** (scope: `r_dma_admin_pages_content`)
Your code requests: `r_basicprofile r_organization_social rw_organization_admin`

These scopes belong to the **Community Management API** product, which is NOT added to your app. LinkedIn rejects the authorization because the app isn't approved for those scopes.

Additionally, `r_organization_social` was **deprecated in June 2023** and replaced by `r_organization_social_feed`.

## What Needs to Happen

### Step 1: Request the correct LinkedIn product (manual — you must do this)

Go to your LinkedIn Developer Portal → Products tab → **Request access** to **Community Management API**.

This is the product that grants the scopes needed for:
- Discovering organization pages (`/organizationAcls`)
- Fetching follower statistics (`/organizationalEntityFollowerStatistics`)
- Reading posts (`/ugcPosts` or `/posts`)
- Reading post analytics (`/organizationalEntityShareStatistics`)

The Pages Data Portability API is a GDPR/DMA data export tool — it does NOT provide the analytics endpoints your sync function uses.

### Step 2: Code changes (after product approval)

**File: `supabase/functions/linkedin-connect/index.ts`**
- Update OAuth scopes from deprecated to current:
  - `r_basicprofile` → `r_liteprofile` (or remove — profile scope may not be needed)
  - `r_organization_social` → `r_organization_social_feed`
  - `rw_organization_admin` stays (still valid under Community Management API)
- Add `openid` scope if required by LinkedIn's current OAuth flow

**File: `supabase/functions/oauth-callback/index.ts` (handleLinkedIn)**
- Update LinkedIn API version header from `202401` to `202503` (current)
- The org discovery endpoint `/rest/organizationAcls` is correct and will work once the Community Management API product is approved

**File: `supabase/functions/sync-linkedin/index.ts`**
- Update LinkedIn API version header from `202401` to `202503`
- The sync endpoints are all correct (follower stats, ugcPosts, share statistics) — they just need the Community Management API product to be approved

### Summary

| What | Action |
|---|---|
| LinkedIn Developer Portal | Request **Community Management API** product (you do this manually) |
| `linkedin-connect/index.ts` | Fix scopes: `r_organization_social` → `r_organization_social_feed`, remove `r_basicprofile` |
| `oauth-callback/index.ts` | Update API version header to `202503` |
| `sync-linkedin/index.ts` | Update API version header to `202503` |

The code changes are small. The blocker is LinkedIn product approval — without the Community Management API, no scope fix will make OAuth work because the analytics endpoints require that product.

