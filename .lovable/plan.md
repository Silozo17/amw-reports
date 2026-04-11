

# Categorise Platform Filter Dropdown

## What changes
Single file: `src/components/clients/DashboardHeader.tsx` (lines 232-257)

Replace the flat `availablePlatforms.map(...)` list with grouped sections using category headers and a defined display order.

## Categories and order

| Category | Platforms (in order) |
|---|---|
| **Organic Social** | Facebook, Instagram, LinkedIn, TikTok, YouTube, Pinterest |
| **Paid Advertising** | Google Ads, Meta Ads, TikTok Ads, LinkedIn Ads |
| **SEO & Web Analytics** | Google Search Console, Google Analytics, Google Business Profile |

## Implementation

1. Define a `PLATFORM_CATEGORIES` array of `{ label, platforms[] }` objects at the top of the file (or inline).
2. Replace lines 232-257 (the separator + flat map) with a loop over categories:
   - For each category, filter `availablePlatforms` to only those in that category (skip categories with zero available platforms).
   - Render a small muted category label (`text-xs text-muted-foreground px-2 pt-2 pb-1`).
   - Render each platform checkbox button (same markup as current).
   - Add a `h-px bg-border` separator between categories.
3. The "All Platforms" toggle at the top remains unchanged.

No other files change. Pure UI reordering.

