## Two issues, two fixes

### 1. Content Lab run failed for AMW Media

**Root cause** (from edge logs):
```
[content-lab-run] failed: persistPosts: invalid input syntax for type integer: "42.281"
```
Apify scrapers (TikTok especially) return float values for fields like `videoDuration` and occasionally counts. The `content_lab_posts` table has these as `integer`: `likes`, `comments`, `shares`, `views`, `author_followers`, `video_duration_seconds`. The insert blew up on the first float.

**Fix** in `supabase/functions/content-lab-run/index.ts` `persistPosts`:
Add a small `toInt(v)` helper (`Math.round(Number(v))`, returning `null` for nullish/NaN) and wrap all six integer fields. Pure defensive coercion — no schema change.

### 2. Service-based businesses still missing from competitor search

**Root cause**: The current call passes `includedPrimaryTypes: ["establishment"]`. In **Places Autocomplete (New)**, `establishment` is a *category root*, not a valid primary type — so it acts as an over-restrictive filter that drops service-area businesses, agencies, and brands without a strict POI primary type.

**Fix** in `supabase/functions/google-places-lookup/index.ts`:
- Remove `includedPrimaryTypes` entirely. Autocomplete defaults to the same broad index Google Maps' search box uses (covers physical + service-area + brands).
- Keep `includeQueryPredictions: true` as a safety net so generic queries still surface results.
- On a 0-result response, log the raw payload so we can see if Google is returning predictions in a different shape (e.g. `queryPredictions`).
- Also map `queryPredictions` (no `placeId`) into the result list as name-only entries that skip the Place Details lookup on click.

### 3. (bonus) React ref warning in `CompetitorPicker`

The console shows: *"Function components cannot be given refs… Check the render method of `CompetitorPicker`"* — caused by `<PopoverTrigger asChild>` wrapping a `<div>` containing the `Input`. Radix needs a single ref-forwarding child.

**Fix** in `src/components/clients/CompetitorPicker.tsx`: drop `asChild` so PopoverTrigger renders its own button wrapper, OR put a real `forwardRef` element as the only child. Simplest: remove `asChild` and let the trigger be invisible/inline — keep the existing input layout outside the trigger and control popover open state programmatically (already done via `open`/`onOpenChange`).

## Files touched

- `supabase/functions/content-lab-run/index.ts` — add `toInt` helper + wrap 6 fields in `persistPosts`
- `supabase/functions/google-places-lookup/index.ts` — drop `includedPrimaryTypes`, add `includeQueryPredictions`, map `queryPredictions`
- `src/components/clients/CompetitorPicker.tsx` — fix Popover ref warning, support query-only predictions (no place_id → add by name only)

## Out of scope

- No DB migrations. No Apify changes. No new secrets.