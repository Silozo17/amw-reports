

# Fix: Add Facebook to Hero KPI Platform Badges

## Problem
Two `platformsFor` helpers on lines 350-351 don't check for Facebook's metric field names (`post_clicks` for clicks, `reactions`/`shares` for engagement), so the Facebook logo never appears on those hero cards.

## Changes

**File: `src/components/clients/ClientDashboard.tsx`**

**Line 350** — `clicksPlatforms`: Add `m.post_clicks || 0` to the sum so Facebook (which stores clicks as `post_clicks`) gets detected:
```ts
const clicksPlatforms = platformsFor(m => (m.clicks || 0) + (m.search_clicks || 0) + (m.gbp_website_clicks || 0) + (m.post_clicks || 0));
```

**Line 351** — `engagementPlatforms`: Add `(m.reactions || 0)` and `(m.shares || 0)` to the fallback branch so Facebook's engagement fields are detected:
```ts
const engagementPlatforms = platformsFor(m => m.engagement ? m.engagement : (m.likes || 0) + (m.reactions || 0) + (m.comments || 0) + (m.shares || 0));
```

Two lines changed, one file. No other modifications.

