

## Plan: Remove Reach from Facebook Entirely

### What and Why
Facebook's reach metrics (`page_total_media_view_unique`) are unreliable for distinguishing organic vs paid. Rather than continuing to fix the subtraction model, we'll remove reach from Facebook entirely — both the sync logic and the frontend display.

### Changes

**1. `supabase/functions/sync-facebook-page/index.ts`**
- Remove variable declarations `totalUniqueViewers` and `totalUniqueViewersOrganic` (lines 238-239)
- Remove the entire reach try/catch block (lines 291-333)
- Remove `reach` and `reach_total` from `metricsData` object (lines 479-480)
- Remove `reach=${totalUniqueViewers}` from the final console.log (line 550)

**2. `src/components/clients/dashboard/PlatformSection.tsx`**
- Remove `'reach'` from `FACEBOOK_KEY_METRICS` array (line 95)

**3. `src/components/clients/PlatformMetricsCard.tsx`**
- Add a filter to hide `reach` and `reach_total` metrics when platform is `facebook`

No database changes needed. Other platforms' reach metrics are untouched.

### Technical Detail
- The `PlatformMetricsCard` will filter out metric keys `reach` and `reach_total` only when `platform === 'facebook'`
- The sync function will no longer make any API calls for `page_total_media_view_unique`
- Existing stored snapshot data with reach values will still exist but won't display
- Edge function will be redeployed after changes

