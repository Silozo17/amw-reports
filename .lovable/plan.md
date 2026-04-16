

# Fix: Pixelated Ad Creative Images

## Problem
The `AdCard` component (line 212) uses `thumbnail_url || image_url` — preferring the thumbnail. Meta's thumbnail URLs are low-resolution (64-128px), which looks pixelated when stretched to fill the `aspect-video` container.

## Fix

**File: `src/components/clients/dashboard/AdCampaignBreakdown.tsx`** — line 212

Swap the priority so `image_url` is preferred over `thumbnail_url`:

```typescript
// Before
const thumbUrl = ad.creative?.thumbnail_url || ad.creative?.image_url;

// After
const thumbUrl = ad.creative?.image_url || ad.creative?.thumbnail_url;
```

One line change. No other files affected.

