## Goal

Make competitor search behave like Google Maps' search box:
1. Show suggestions as soon as the user types 2-3 characters (not only after the full name).
2. Return service-area businesses (plumbers, agencies, consultants, mobile groomers, etc.) — not just brick-and-mortar places with a pin.

## Why the current setup fails

`google-places-lookup` calls **Places API (New) Text Search** (`places:searchText`). That endpoint is designed for fully-formed queries ("Joe's Pizza Brooklyn"), so partial strings return little or nothing. It also leans heavily on geocoded POIs, which is why service-only businesses are missing.

## Fix

Switch the edge function to **Places Autocomplete (New)** (`places:autocomplete`) — the same API powering Google Maps' search box. It:
- Returns predictions from ~2 characters (true typeahead).
- Includes service-area businesses, brands, and non-physical establishments.
- Is cheaper per call than Text Search.

Then resolve the picked suggestion to full details (name, address, website) via **Place Details (New)** (`places/{id}`) only when the user clicks a result — keeps cost low.

## Changes

### 1. `supabase/functions/google-places-lookup/index.ts`
Two-mode endpoint based on request body:

- **Mode A — `{ query }` (typeahead)**: call `POST https://places.googleapis.com/v1/places:autocomplete` with `input`, `includedPrimaryTypes: ["establishment"]`, `languageCode`. Return lightweight predictions: `[{ place_id, name, secondary_text }]`. No field mask billing for full details yet.
- **Mode B — `{ place_id }` (resolve on click)**: call `GET https://places.googleapis.com/v1/places/{place_id}` with field mask `id,displayName,formattedAddress,websiteUri,nationalPhoneNumber,internationalPhoneNumber`. Return the same shape today's UI expects: `{ name, address, website, phone, place_id }`.

Keep existing JWT auth, CORS, and structured logging.

### 2. `src/components/clients/CompetitorPicker.tsx`
- Lower `MIN_QUERY_LENGTH` from 2 → 2 (already fine) and reduce debounce 350 → 250ms for snappier feel.
- On keystroke: invoke function with `{ query }`, render predictions as `name` (bold) + `secondary_text` (muted).
- On click: invoke function with `{ place_id }` to fetch the website/address, then `addCompetitor({ name, website })`.
- Loading state on the clicked row while details resolve.
- Latest-request-wins guard already in place — keep it.

## Out of scope

- No new tables, secrets, or UI surfaces.
- No change to Firecrawl social-scrape pipeline.
- `GOOGLE_API_KEY` already configured — no secret prompt needed. (Note: the key must have **Places API (New)** enabled in Google Cloud — flagging this in case Autocomplete returns 403 on first call.)

## Files touched

- `supabase/functions/google-places-lookup/index.ts` (rewrite handler — ~80 lines)
- `src/components/clients/CompetitorPicker.tsx` (search effect + click handler)