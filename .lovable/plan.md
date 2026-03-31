

# Plan: Add Reddit (Organic) and Reddit Ads Integrations

This is a large integration touching database schema, 4 new edge functions, the OAuth callback, and multiple frontend files. It follows the exact same pattern as your existing platforms (e.g. LinkedIn, Pinterest).

**Before I can build anything, you need to create two Reddit applications.** I will guide you through that below.

---

## Prerequisites — Reddit App Setup (You Do This)

### App 1: Reddit Organic (subreddit/profile data)

1. Go to **https://www.reddit.com/prefs/apps**
2. Click **"create another app..."**
3. Fill in:
   - **Name**: AMW Reports - Organic
   - **Type**: Select **"web app"**
   - **Redirect URI**: `https://kcdixfmjiifpnbtplodv.supabase.co/functions/v1/oauth-callback`
4. Save — note the **Client ID** (under app name) and **Client Secret**
5. I will ask you to store these as `REDDIT_CLIENT_ID` and `REDDIT_CLIENT_SECRET`

### App 2: Reddit Ads (ad account reporting)

Reddit Ads uses the **same OAuth infrastructure** (reddit.com/api/v1/authorize) but with ads-specific scopes (`ads_read`). You can either:
- **Use the same app** (recommended — one app, different scopes per flow), or
- Create a second app if you want separate credentials

The Reddit Ads API base URL is `https://ads-api.reddit.com/api/v3/`. You need to **request Ads API access** from Reddit — go to **https://www.reddit.com/wiki/api/** and apply, as Ads API requires approval.

I will ask you to store these as `REDDIT_ADS_CLIENT_ID` and `REDDIT_ADS_CLIENT_SECRET` (or reuse the same credentials).

---

## Technical Implementation

### Step 1 — Database Migration

Add two new values to the `platform_type` enum:

```sql
ALTER TYPE public.platform_type ADD VALUE IF NOT EXISTS 'reddit';
ALTER TYPE public.platform_type ADD VALUE IF NOT EXISTS 'reddit_ads';
```

Insert metric defaults for both platforms.

### Step 2 — Add Logo Assets

You will need to provide a Reddit logo (`.webp`). I will add it as `src/assets/logos/reddit.webp`.

### Step 3 — Update Frontend Type Definitions (`src/types/database.ts`)

- Add `'reddit' | 'reddit_ads'` to `PlatformType`
- Add entries to `PLATFORM_LABELS`, `PLATFORM_LOGOS`, `METRIC_LABELS`, `AVAILABLE_METRICS`
- Add `reddit` to "Organic Social" category, `reddit_ads` to "Paid Advertising" category

### Step 4 — Update Platform Routing (`src/lib/platformRouting.ts`)

```typescript
// CONNECT_FUNCTION_MAP
reddit: 'reddit-connect',
reddit_ads: 'reddit-ads-connect',

// SYNC_FUNCTION_MAP
reddit: 'sync-reddit',
reddit_ads: 'sync-reddit-ads',
```

Add both to `OAUTH_SUPPORTED` and `ALL_PLATFORMS`.

### Step 5 — Create Edge Functions (4 new functions)

| Function | Purpose |
|---|---|
| `reddit-connect` | Build OAuth URL for Reddit organic (scopes: `identity`, `read`, `mysubreddits`) |
| `reddit-ads-connect` | Build OAuth URL for Reddit Ads (scopes: `identity`, `ads_read`) |
| `sync-reddit` | Fetch subreddit/profile stats from `oauth.reddit.com/api/v1/me`, subscriber counts, post engagement |
| `sync-reddit-ads` | Fetch ad account metrics from `ads-api.reddit.com/api/v3/ad_accounts/{id}/reports` (impressions, clicks, spend, CTR, CPC, CPM, conversions) |

### Step 6 — Update OAuth Callback (`supabase/functions/oauth-callback/index.ts`)

Add `handleReddit` and `handleRedditAds` handlers that:
1. Exchange auth code for tokens at `https://www.reddit.com/api/v1/access_token`
2. Discover available subreddits (organic) or ad accounts (ads)
3. Auto-select if single result, otherwise populate metadata for the account picker

### Step 7 — Update Scheduled Sync (`supabase/functions/scheduled-sync/index.ts`)

Add `reddit` and `reddit_ads` to the `SYNC_FUNCTION_MAP`.

### Step 8 — Update Remaining Frontend Files

- `src/components/onboarding/steps/PlatformsStep.tsx` — add reddit to the grid
- `src/components/clients/ConnectionDialog.tsx` — already dynamic from `ALL_PLATFORMS`

### Step 9 — Reddit Organic Metrics

| Key | Label |
|---|---|
| `subscribers` | Subscribers |
| `subscriber_growth` | Subscriber Growth |
| `posts_published` | Posts Published |
| `post_karma` | Post Karma |
| `comment_karma` | Comment Karma |
| `impressions` | Impressions |
| `engagement` | Engagement |
| `engagement_rate` | Engagement Rate |
| `upvotes` | Upvotes |
| `comments` | Comments |

### Step 10 — Reddit Ads Metrics

| Key | Label |
|---|---|
| `spend` | Spend |
| `impressions` | Impressions |
| `clicks` | Clicks |
| `ctr` | CTR |
| `cpc` | CPC |
| `cpm` | CPM |
| `conversions` | Conversions |
| `reach` | Reach |
| `video_views` | Video Views |
| `engagement_rate` | Engagement Rate |

---

## Files Affected

| File | Change |
|---|---|
| New migration | Add `reddit`, `reddit_ads` to enum + metric defaults |
| `src/assets/logos/reddit.webp` | New logo asset (need from you) |
| `src/types/database.ts` | Add types, labels, logos, metrics, categories |
| `src/lib/platformRouting.ts` | Add routing entries |
| `supabase/functions/reddit-connect/index.ts` | New — OAuth connect |
| `supabase/functions/reddit-ads-connect/index.ts` | New — OAuth connect |
| `supabase/functions/sync-reddit/index.ts` | New — organic data sync |
| `supabase/functions/sync-reddit-ads/index.ts` | New — ads data sync |
| `supabase/functions/oauth-callback/index.ts` | Add Reddit + Reddit Ads handlers |
| `supabase/functions/scheduled-sync/index.ts` | Add to sync map |
| `src/components/onboarding/steps/PlatformsStep.tsx` | Add to grid |

---

## What I Need From You First

1. **Create the Reddit app(s)** at https://www.reddit.com/prefs/apps (follow steps above)
2. **Provide a Reddit logo** in `.webp` format (or confirm I should use a generic one)
3. **Confirm**: Do you want one Reddit app for both organic + ads, or separate apps?
4. **Reddit Ads API access**: Have you applied for / been approved for the Reddit Ads API? (It requires separate approval from Reddit)

Once you confirm these, I will store the secrets and build everything.

