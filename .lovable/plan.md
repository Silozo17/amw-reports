
User has answered Q1–Q3 cleanly and added refinements. No code yet (read-only mode). Final plan below — minimal, lock-step with their decisions.

## Phase 1 — Locked plan

### Schema migration (additive only)

**New tables:**
- `content_lab_verticals` — `slug pk text`, `display_name`, `min_views_tiktok`, `min_views_instagram`, `min_views_facebook`, `geo_focus`, `keyword_queries text[]`, `notes`, timestamps. RLS: authenticated read, platform-admin write.
- `content_lab_seed_pool` — `id`, `vertical_slug fk → verticals(slug)`, `platform text`, `handle`, `display_name`, `sub_niche`, `geo`, `followers_est`, `avg_views_est`, `notes`, `verified_at`, `is_active default true`, timestamps. Unique `(vertical_slug, platform, handle)`. RLS: authenticated read, platform-admin write.

**Additive columns on `content_lab_niches`:**
- `industry_slug text references content_lab_verticals(slug)`
- `admired_accounts jsonb default '[]'`
- `competitor_accounts jsonb default '[]'`
- `brand_voice_snapshot jsonb`
- `voice_built_at timestamptz`

**Untouched:** `content_lab_benchmark_pool`, `content_lab_credit_ledger`, `content_lab_credits`, `content_lab_usage`, `org_subscriptions`, all v3 tier names + Stripe price IDs.

### Edge functions

1. **`content-lab-onboard`** — JWT auth + Zod-validated body. Inserts niche row mapping admired/competitors into the new jsonb cols. Sets `org_subscriptions.content_lab_onboarded_at = now()`. Fires brand-voice extraction in `EdgeRuntime.waitUntil`: Firecrawl website (fall back to social-only on failure) + Apify last 12 IG posts → Claude Sonnet 4.5 with §5.2 prompt → writes `brand_voice_snapshot` + `voice_built_at`. Returns `{ niche_id, status: 'voice_building' }` immediately.

2. **`content-lab-validate-handle`** — Apify proxy. Body: `{ handle, platform }`. Returns `{ exists, follower_count, display_name }`. Cheapest profile-scraper metadata-only call. (Final actor confirmed by user before wiring.)

### UI — `/content-lab/onboard`

6-step wizard, each step its own component under `src/components/content-lab/onboard/`:
1. Niche basics (name + website)
2. Handles (IG required, TT/FB optional)
3. Industry picker (loads from `content_lab_verticals`, fallback "not listed")
4. Admired accounts × 3 — `<HandleValidator>` debounced 800ms, 60-min in-memory cache, green/amber/red feedback. **Submit never blocked on amber/unknown** — only hard-block if handle definitively doesn't exist.
5. Competitors × 2 (optional)
6. Review + submit → `content-lab-onboard`

After submit: `<VoiceBuildingScreen>` with AMW mascot. Polls `niches.brand_voice_snapshot IS NOT NULL` every 3s, **120s ceiling**, then falls back to "Still analysing — your first run will have basic voice, we'll refine it in the background." → redirect to `/content-lab/niche/:id` either way.

New hook `useContentLabVerticals.ts` (TanStack Query, 1h stale).

### Dashboard shell — `ContentLabPage.tsx` minor edits

- Repoint "New Niche" button to `/content-lab/onboard` (keep `/content-lab/niche/new` route alive as edit-only fallback)
- Tier badge + runs/credits already present — no rebuild

### XLSX seed import

After migration lands: one-off `code--exec` populating `content_lab_verticals` (8 rows) + `content_lab_seed_pool` (~200 rows) from the CSV the user will hand over. Parsed inline, inserted via `psql`. Not a cron.

### File touch list

**Create**
- `supabase/migrations/<ts>_content_lab_v4_phase1.sql`
- `supabase/functions/content-lab-onboard/index.ts`
- `supabase/functions/content-lab-validate-handle/index.ts`
- `src/pages/content-lab/OnboardWizardPage.tsx`
- `src/components/content-lab/onboard/Step1NicheBasics.tsx`
- `src/components/content-lab/onboard/Step2Handles.tsx`
- `src/components/content-lab/onboard/Step3Industry.tsx`
- `src/components/content-lab/onboard/Step4Admired.tsx`
- `src/components/content-lab/onboard/Step5Competitors.tsx`
- `src/components/content-lab/onboard/Step6Review.tsx`
- `src/components/content-lab/onboard/HandleValidator.tsx`
- `src/components/content-lab/onboard/VoiceBuildingScreen.tsx`
- `src/hooks/useContentLabVerticals.ts`

**Edit**
- `src/App.tsx` — add `/content-lab/onboard` route
- `src/pages/content-lab/ContentLabPage.tsx` — repoint "New Niche"

### Out of scope
Discover/scrape/analyse/ideate refactor, anti-cringe prompt, phone-frame previews, swipe file, pool quality page, docx export, monthly digest, Stripe rename — all deferred to Phases 2–4.

### Risks called out
- Brand-voice extraction occasionally takes >120s on slow Firecrawl — fallback copy handles it gracefully, no error state.
- Apify validation cost per keystroke is mitigated by 800ms debounce + per-handle cache; user will confirm actor + per-call cost before I wire it (will pause and ask if cost > expected).
- AMW palette in `OnboardWizardPage`: app is dark-theme-mandatory (per Core memory). Wizard will use AMW purple/blue/green as accents on the existing dark surface — not switch to off-white. Flag if you want a literal off-white wizard breaking the dark theme.

Ready to build on approval.
