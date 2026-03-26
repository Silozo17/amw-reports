

## Two Changes

### 1. Onboarding Platform Order (Step 2 of 5)

**File: `src/pages/OnboardingPage.tsx`**

Change the `PLATFORM_IDS` array from:
```
google_ads, meta_ads, facebook, instagram, tiktok, linkedin, google_search_console, google_analytics, google_business_profile, youtube
```
To:
```
facebook, instagram, tiktok, linkedin, youtube, meta_ads, google_ads, google_search_console, google_analytics, google_business_profile
```

This gives two visual rows of 5: social platforms on top, ad/analytics platforms on bottom.

### 2. Add Video Views Column to Top Posts Tables

**File: `src/components/clients/dashboard/PlatformSection.tsx`**

The social posts table (lines 367-405) currently shows: Thumbnail, Post, Reach, Likes, Comments, Link. It does NOT show video views.

Add a "Views" column to the social posts table between Reach and Likes. Display `video_views` value when available (non-zero), otherwise show "—". This ensures video view counts are visible per-post for Facebook, Instagram, TikTok, and any platform that stores `video_views` in top content.

No changes needed for the hero KPI aggregation — the code at line 324 already sums `video_views` across all platforms, and line 351 already collects platform icons for all platforms that have `video_views > 0`. If only YouTube's icon shows, it means the other platforms had zero video views in their `metrics_data` for that period. The aggregation logic is correct.

### Files Modified
- `src/pages/OnboardingPage.tsx` — reorder `PLATFORM_IDS`
- `src/components/clients/dashboard/PlatformSection.tsx` — add video views column to social posts table

