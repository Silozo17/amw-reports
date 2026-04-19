

## Content Lab v2 — Auto-discovery, brand-aware ideation, in-app feed

### Why the first run failed
Run `d8dee349…` failed with `No posts to ideate from`. The scraper completed but returned 0 posts. Apify scraping needs valid IG handles + the `instagram-scraper` actor returns 0 if handles are private/wrong. We'll fix this with auto-discovery (Claude finds real handles) and add empty-state handling (run still completes with a clear message instead of failing).

---

### What changes (in priority order)

#### 1. Niche form rebuilt around 3 inputs + "discover everything else"
New minimal form:
- **Your IG/TikTok handle** (required)
- **Your website** (required)
- **Your location** (city/region, free text)
- **Platforms to scrape** (multi-select: Instagram now; TikTok + Facebook stubbed for Phase 2)
- **Optional creative preferences** (collapsed by default — see #2)

A new edge function **`content-lab-discover`** runs on form submit:
- Scrapes website (Firecrawl — already connected) for brand voice, services, audience
- Calls Claude with a structured tool to return:
  - `niche_label` (e.g. "London wedding photographers")
  - `niche_description`
  - `top_competitors`: 10 handles in the same niche/region
  - `top_global_benchmarks`: 10 worldwide best-in-class handles in that niche
  - `suggested_hashtags` (8)
  - `suggested_keywords` (8)
  - `default_creative_prefs` (pre-fills #2 below)
- Stores everything on `content_lab_niches` (new columns below)
- User reviews + edits before saving — nothing is silent

#### 2. Creative preferences (collapsed advanced section, all pre-filled)
New columns on `content_lab_niches`:
- `content_styles[]` — talking head, B-roll/creative, voiceover-only, UGC-style, tutorial, behind-the-scenes
- `tone_of_voice` — professional, conversational, witty, bold, educational, inspiring (single-select)
- `producer_type` — internal team, freelancer, agency, founder-on-phone (single-select)
- `video_length_preference` — 15s / 30s / 60s / 90s (single-select)
- `posting_cadence` — daily / 3x week / weekly (single-select, used for idea volume guidance)
- `do_not_use[]` — free-text array of banned terms/topics (e.g. "no dancing", "no trending audio")

All pre-filled by `content-lab-discover` based on the niche. User can override.

#### 3. Master Claude prompt rewrite (anti-AI-slop guardrails)
Centralised in a new file `supabase/functions/_shared/contentLabPrompts.ts`:

- **System persona**: "Senior content strategist who has produced 1000+ viral posts. Outputs are *filmable today* by a non-creator with a phone."
- **Hard rules**: No "Are you tired of…", no "In today's fast-paced world…", no "Game-changer", no AI clichés, no fake stats, no generic CTAs ("link in bio" alone is banned), no cringe trend-chasing, no emoji-stuffed hooks, never reference "the algorithm".
- **Required**: Hook must be something a real human says out loud, body must be specific to *this* niche/competitor pattern observed, CTA must reference something on the page (caption Q, save, send to a friend, comment word).
- **Platform fit**: Each idea tagged with which platform it's strongest on + why.
- **Brand fit**: Idea must match `tone_of_voice`, fit `content_styles`, be filmable by `producer_type`, hit `video_length_preference`, avoid `do_not_use`.
- Used by both `content-lab-ideate` and `content-lab-analyse`.

#### 4. Per-platform idea generation with adaptive volume
`content-lab-ideate` becomes platform-aware:
- 1 platform selected → 12 ideas for that platform
- 2 platforms → 6 each
- 3 platforms → 4 each
- Each idea carries `target_platform` + `platform_style_notes` (e.g. "IG: square thumbnail-first, hook in caption", "TikTok: native-feel, on-camera within 1s", "FB: longer caption, broader hook")

New columns on `content_lab_ideas`: `target_platform`, `platform_style_notes`, `caption_with_hashtag` (single hashtag, not 8), `script_full` (one continuous adaptable script, replaces hook/body/cta as separate fields — those stay for backwards compat but become derivable).

#### 5. Run Detail UI rebuilt as in-platform feed (no PDF for now)
Replace the current "Viral Feed + 12 Ideas" tabs with a **single "Content Ideas" page** structured by platform:
- Top tabs = platforms with ideas (IG / TikTok / FB)
- Each idea rendered as a **realistic post card**:
  - Header: platform icon + niche handle placeholder
  - Square media area with `visual_direction` overlay
  - Caption + 1 hashtag below
  - Like / comment / share row (visual only, decorative)
  - Expandable section: full script, why it works, filming checklist, platform style notes, 1–5 star rating
- Sticky filter: platform, sort by predicted potential
- Keep "Viral Feed" as a secondary tab (what we scraped — for trust/transparency)
- Remove "Export" tab and PDF download button
- Skip `content-lab-render-pdf` invocation in the pipeline (function stays in repo, dormant)

#### 6. Pipeline & failure-mode hardening
- `content-lab-discover` becomes step 0 (only runs if niche has no auto-discovered data yet)
- Scrape step: if all sources return 0 posts, mark run `completed_empty` (new status) with clear message instead of failing — UI shows "We couldn't find enough public posts. Check the handles in your niche."
- Per-platform try/catch so one failed scraper doesn't kill the run

#### 7. Other improvements worth shipping (from competitor research)
- **Save & remix**: "Generate variation of this idea" button on each card → re-prompts Claude with that idea as seed
- **Idea status**: not started / in production / posted (simple kanban-lite)
- **Re-discover button** on niche edit page (re-runs discovery if their account/site changes)

---

### Database changes (single migration)

```sql
ALTER TYPE content_lab_run_status ADD VALUE 'discovering';
ALTER TYPE content_lab_run_status ADD VALUE 'completed_empty';

ALTER TABLE content_lab_niches
  ADD COLUMN own_handle text,
  ADD COLUMN website text,
  ADD COLUMN location text,
  ADD COLUMN platforms_to_scrape text[] DEFAULT ARRAY['instagram'],
  ADD COLUMN niche_description text,
  ADD COLUMN top_competitors jsonb DEFAULT '[]',
  ADD COLUMN top_global_benchmarks jsonb DEFAULT '[]',
  ADD COLUMN content_styles text[] DEFAULT '{}',
  ADD COLUMN tone_of_voice text,
  ADD COLUMN producer_type text,
  ADD COLUMN video_length_preference text,
  ADD COLUMN posting_cadence text,
  ADD COLUMN do_not_use text[] DEFAULT '{}',
  ADD COLUMN discovered_at timestamptz;

ALTER TABLE content_lab_ideas
  ADD COLUMN target_platform text,
  ADD COLUMN platform_style_notes text,
  ADD COLUMN caption_with_hashtag text,
  ADD COLUMN script_full text,
  ADD COLUMN status text DEFAULT 'not_started'; -- not_started|in_production|posted
```

### New / changed edge functions
- **NEW** `content-lab-discover` — Firecrawl + Claude → fills niche metadata
- **CHANGE** `content-lab-pipeline` — adds `discovering` step, removes `rendering` step, adds empty-result handling
- **CHANGE** `content-lab-scrape` — scrapes own handle + competitors + global benchmarks, per-platform error isolation
- **CHANGE** `content-lab-ideate` — uses new master prompt, generates per platform with adaptive count, fills new columns
- **CHANGE** `content-lab-analyse` — uses master prompt for cleaner summaries
- **NEW** `_shared/contentLabPrompts.ts` — single source of truth for all prompts

### New / changed frontend
- **REBUILD** `NicheFormPage.tsx` — 3 core inputs + "Discover" button + collapsible prefs section
- **NEW** `src/components/content-lab/PostCard.tsx` — IG-style post card
- **NEW** `src/components/content-lab/PlatformTabs.tsx` — platform switcher
- **REBUILD** `RunDetailPage.tsx` — feed-style UI, drop Export tab
- **NEW** `src/hooks/useContentLabIdeas.ts` — idea status mutations + remix mutation

### What I'm NOT doing
- TikTok / Facebook scrapers (Phase 2 — IG only for now, but UI ready)
- PDF export (deferred per your call)
- Stripe billing (Phase 3)
- Cron auto-runs (Phase 3)
- Notion/Calendar export

### Risks
- **Discovery cost**: One Claude call + one Firecrawl scrape per niche save = ~£0.04. Re-runs only on user trigger.
- **Apify zero-result pattern remains** for private/banned accounts — handled now via `completed_empty` status, not silent failure.
- **Prompt drift**: Big new master prompt. Will keep it in one shared file so iteration is one-touch.

### Build order (one task at a time)
1. Migration (schema + new statuses)
2. `_shared/contentLabPrompts.ts` (master prompt)
3. `content-lab-discover` edge function
4. Rebuild `NicheFormPage` with discover flow
5. Update `content-lab-scrape` (own handle + benchmarks + per-platform isolation)
6. Update `content-lab-ideate` (per-platform, new prompt, new columns)
7. Update `content-lab-pipeline` (new steps, empty handling, no PDF)
8. Rebuild `RunDetailPage` as in-app feed with PostCard
9. Add remix + status buttons
10. Pause for end-to-end test

Approve and I'll start with steps 1–2.

