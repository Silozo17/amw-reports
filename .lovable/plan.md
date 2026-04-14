

## Fix Remaining Outdated Platform Counts

Three places still show wrong numbers. All are simple text edits.

### Changes

**1. `src/pages/HomePage.tsx`**
- Line 92: Change `12 Platforms` → `14 Platforms`
- Line 271: Change `70+ Metrics Across 12 Platforms` → `70+ Metrics Across 14 Platforms`

**2. `src/pages/FeaturesPage.tsx`**
- Line 89: Change `13 Platform Integrations` → `14 Platform Integrations`
- Add LinkedIn Ads to the `PLATFORM_DETAILS` array (after TikTok Ads, line 19) with metrics: Spend, Impressions, Clicks, CTR, CPC, CPM, Conversions, Conversion Rate, Cost/Conv., Engagement

