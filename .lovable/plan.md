

## Problem

The current Meta OAuth flow only requests the `ads_read` scope, which limits what the user can access. It doesn't grant permission to:
- See/select their **Business Portfolio** (Business Manager)
- Access **Facebook Pages** and **Instagram accounts**
- Read **page insights** and **Instagram insights**

The OAuth dialog therefore only shows minimal permissions and doesn't prompt for business asset selection.

## Solution

Expand the Meta OAuth scopes and enhance the callback to discover business assets (pages, Instagram accounts, ad accounts).

### Changes

**1. `supabase/functions/meta-ads-connect/index.ts`** — Add broader scopes:
- `ads_read` — ad account data
- `pages_show_list` — list Facebook Pages the user manages
- `pages_read_engagement` — read page posts and engagement
- `instagram_basic` — access linked Instagram accounts
- `business_management` — access Business Portfolio/Manager assets

This will make the Facebook OAuth dialog show the business portfolio selector and let the user grant access to their pages and Instagram accounts.

**2. `supabase/functions/oauth-callback/index.ts`** (Meta section) — After token exchange, also discover:
- Facebook Pages via `/me/accounts`
- Instagram business accounts linked to those pages
- Store discovered pages/Instagram accounts in the connection's `metadata` field so the frontend can display them

**3. `src/components/clients/ConnectionDialog.tsx`** — Show discovered business assets (pages, Instagram accounts) in the connection card after successful OAuth.

### Technical Details

**Scopes string:** `ads_read,pages_show_list,pages_read_engagement,instagram_basic,business_management`

**Discovery endpoints (post-OAuth):**
- `GET /me/accounts?fields=id,name,instagram_business_account{id,username}` — pages + linked IG
- `GET /me/adaccounts?fields=id,name,account_status` — ad accounts (existing)

**Metadata structure stored on connection:**
```json
{
  "pages": [{"id": "123", "name": "My Page", "instagram": {"id": "456", "username": "mypage"}}],
  "ad_accounts": [{"id": "act_789", "name": "Main Account"}],
  "long_lived": true
}
```

> **Note:** These additional scopes (`pages_show_list`, `pages_read_engagement`, `instagram_basic`, `business_management`) must be approved in your Meta App's **App Review** if the app is in Live mode. If the app is still in Development mode, they'll work for app admins/testers only.

