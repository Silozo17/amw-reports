

## Gap analysis

**Immediate bug you spotted (small, fixable now):**
The niche form only has one handle field labelled "Your Instagram handle". When users tick Facebook or TikTok, there's nowhere to enter those handles. The scraper then has nothing to fetch for those platforms, so own-account scrape silently returns empty.

**vs. v2 spec — what's still missing:**

| Area | Spec | Current | Gap |
|---|---|---|---|
| Own handles per platform | IG + TikTok + FB handles | IG only | **Missing** |
| Zero-config discovery | Firecrawl + Apify IG + Gemini + Claude → auto-fill voice + competitors | Discover exists, but no website scrape, no IG profile pre-scrape, no brand voice profile | Partial |
| Brand voice profile | `content_lab_brand_voice_snapshots` with vocab, banned words, example captions | Brand brief form exists, but not auto-built from scrapes | Missing |
| Hook variants | 3 per idea, each different mechanism | 1 hook per idea | **Missing** |
| Visual post preview | Phone-frame mockups (TikTok/IG/FB) | Card previews exist (`IdeaPreviewInstagram/TikTok/Facebook`) | ✅ Already done |
| Trend Radar verification | Ahrefs / Google Trends | Trends generated but not verified | Missing |
| Hook Library tab | Standalone tab grouped by mechanism | Hooks stored in DB, no tab | Missing |
| Swipe File / favourites | Star → swipe file, drag to calendar | Not built | Missing |
| Content Calendar (Scale) | Drag ideas onto dates | Not built | Missing |
| Credit system | Per-idea regen costs credits | Not built | Missing |
| Regenerate / Remix idea | 1 credit per regen, modifier prompt | Not built | Missing |
| Trending audio (TikTok) | Lookup + suggest per idea | Not built | Missing |
| Tier gating (Starter/Growth/Scale) | 3 tiers with niches/runs/credits limits | Not gated | Missing |
| Discovery progress UI | Step-by-step reveal (60-90s) | Single spinner | Polish |

## What I propose to build now

Given "one task at a time" and your immediate observation, I'll split into **two phases**. Phase 1 ships now (hotfix + foundations). Phase 2 is a separate approval after you see Phase 1.

### Phase 1 (this PR) — Fix the handle gap + the highest-leverage gaps

1. **Per-platform own handles** *(fixes the bug you spotted)*
   - Replace single "Your Instagram handle" input with 3 conditional fields shown only when that platform is ticked: IG handle, TikTok handle (`@`), Facebook page URL or handle.
   - Persist into `content_lab_niches.tracked_handles` jsonb as `[{platform, handle}]` (column already exists, already supports it).
   - Update `content-lab-scrape` to read all 3, route IG handle → IG actor, TikTok handle → TikTok actor, FB handle/URL → FB actor for the `own` bucket. Already handles per-platform competitor scraping; this just adds own routing.
   - Auto-fill from `clients.social_handles` jsonb when a client is picked (already supports `instagram`, `tiktok`, `facebook` keys).

2. **3 hook variants per idea** *(biggest quality lever in the spec)*
   - Update `content-lab-ideate` prompt + JSON schema to require `hook_variants: [{text, mechanism, why}]` × 3, each a different mechanism.
   - Add `hook_variants jsonb` column to `content_lab_ideas` (keep existing `hook` as the selected/primary).
   - UI: idea detail shows 3 hook cards, click to set as the working hook (purely client-side, persists selection back to `hook`).

3. **Hook Library tab** on Run Detail
   - New tab after Ideas. Pulls from `content_lab_hooks` (already populated by analyse) + flattens `hook_variants` from ideas.
   - Grouped by `mechanism`, copy-to-clipboard on each, source post link.

4. **Discovery progress UX**
   - Replace single spinner on Discover button with a 5-step reveal (Scanning website → Reading posts → Classifying niche → Finding competitors → Building voice). Pure UI, no edge function change — driven by elapsed time + step durations.

### Out of scope for this PR (next phase, separate approval):
- Credit system + Stripe credit packs
- Regenerate / Remix per-idea
- Swipe File + Content Calendar
- Trend verification (Ahrefs / Google Trends)
- Trending audio lookup for TikTok
- Tier gating UI (Starter / Growth / Scale limits)
- Brand voice auto-extraction from website + last-30-posts (separate `content-lab-discover` rewrite)
- White-label PDF export

## Files touched (Phase 1)

- `src/pages/content-lab/NicheFormPage.tsx` — per-platform handle fields, conditional on ticked platforms
- `supabase/functions/content-lab-scrape/index.ts` — read tracked_handles per platform for `own` bucket
- `supabase/functions/content-lab-ideate/index.ts` — request 3 hook_variants in schema + prompt
- `supabase/migrations/<new>.sql` — `alter table content_lab_ideas add column hook_variants jsonb default '[]'::jsonb`
- `src/pages/content-lab/RunDetailPage.tsx` — Hook Library tab + select hook variant from idea detail
- `src/components/content-lab/HookLibrary.tsx` (new) — grouped-by-mechanism display
- `src/components/content-lab/DiscoveryProgress.tsx` (new) — 5-step reveal

## Risks / things to confirm
- **Existing ideas have no `hook_variants`** — the UI will fall back to showing the single `hook` field for old runs. New runs get the 3 variants.
- **Facebook handle vs page URL** — FB scraper needs the page URL or page slug, not an `@handle`. The field will accept either and normalise.
- **TikTok own scrape** — `clockworks/tiktok-scraper` requires the handle without `@`, which the existing scraper already handles for competitors.

