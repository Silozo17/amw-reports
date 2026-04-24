## Two fixes

### 1. Fix `google-places-lookup` edge function (broken right now)

The function uses `anonClient.auth.getClaims()` which doesn't exist on supabase-js v2.49.1 — that's why competitor search fails with `500 TypeError`. Swap for the standard `auth.getUser()` token check, then redeploy.

### 2. Reorganise Settings tab

The page is messy because the new **Content Lab Settings** card duplicates fields from the old **Business Context** card (industry, target audience, brand voice, competitors, location). Same draft, two places — confusing.

Fix:

- **Delete the standalone "Business Context" card.** All those fields now live in **Content Lab Settings** (the only place they're actually used).
- Move `service_area_type` and `service_areas` into Content Lab Settings under Location, since they're the same concept.
- Move `business_goals` and `unique_selling_points` into Content Lab Settings (used by the AI ideation prompt).
- Final card order, top to bottom:
  1. **Report Configuration** (detail level, language, comparisons, currency, timezone)
  2. **Email Preferences** (delivery, recipient mode, etc.)
  3. **Content Lab Settings** — single source of truth for everything Content Lab uses:
     - Industry + Target audience + Brand voice
     - Location + Service area type + Service areas
     - Social handles (IG / TikTok / FB)
     - Competitors (`CompetitorPicker`)
     - Business goals + Unique selling points
     - Single Save button at the bottom
  4. **Client Access** (invite client users)
- Drop the read-only "mirror" block — no longer needed since fields aren't duplicated.

No DB / type / pipeline changes. Pure UI cleanup + 1-line edge function fix + deploy.

## Files touched

- `supabase/functions/google-places-lookup/index.ts` — replace `getClaims` with `getUser`.
- `src/components/clients/tabs/ClientSettingsTab.tsx` — remove Business Context card, expand Content Lab Settings to hold all context fields in a clean grouped layout.
- Deploy `google-places-lookup`.