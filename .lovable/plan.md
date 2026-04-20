

The user wants to revisit the plan I previously presented. The brand brief just shipped. Now they want:
1. Facebook + TikTok scraping
2. Kanban pipeline for ideas
3. Smart use of own-account performance

Most of (3) is already implemented in the recent rewrite (own posts tagged, gating rule in ideate, "Your Latest Content" tab exists). I should call that out so we don't redo work.

Let me check current state quickly and present a tight plan.

## Scope
Three things, ordered by effort:
1. **Facebook + TikTok scraping** — extend the scraper + niche form.
2. **Kanban pipeline** — drag-and-drop board on ideas grouped by `status`.
3. **Smarter use of own posts** — already 80% done from the last rewrite; just polish.

## What's already in place (no rework needed)
- Own posts are tagged `source = 'own'` and shown on the "Your Latest Content" tab.
- Ideate function already pulls `own_avg_views`, computes `benchmark_p50`, gates own-post inspiration accordingly, and lists weak own posts as anti-examples.
- `content_lab_ideas.status` column already exists (default `'not_started'`).
- `platforms_to_scrape` array already exists on `content_lab_niches`.

## Plan

### 1) Facebook + TikTok scraping
**Niche form (`NicheFormPage.tsx`)**
- Add a 3-checkbox platform picker (Instagram / Facebook / TikTok), persisted to `platforms_to_scrape`.
- Default = Instagram only (no behaviour change for existing niches).

**Scraper (`content-lab-scrape/index.ts`)**
- Split into `scrapeInstagram` (existing), `scrapeFacebook` (new — `apify/facebook-pages-scraper`), `scrapeTikTok` (new — `clockworks/tiktok-scraper`).
- Run enabled platforms in parallel. Field map per platform:
  - FB: `likesCount`, `commentsCount`, `sharesCount`, `videoViewCount`, `text`, `topImage`, `url`, `time`, `pageName`.
  - TikTok: `playCount`→views, `diggCount`→likes, `commentCount`, `shareCount`, `text`, `videoUrl`, `cover`, `createTimeISO`, `videoMeta.duration`, `musicMeta.musicName`, `musicMeta.authorName`.
- Apply existing `media_types` filter per platform (TikTok = always video).
- Tag rows with the right `platform` enum + `source`.

**Image proxy (`content-lab-image-proxy`)**
- Extend allowlist with `*.tiktokcdn.com`, `*.tiktokcdn-us.com`, `*.tiktokv.com`. `*.fbcdn.net` already present.

**Card (`ViralPostCard.tsx`)**
- Switch the "View …" link label by platform: Reel / Post / TikTok.

### 2) Kanban pipeline
- Add `@dnd-kit/core` + `@dnd-kit/sortable`.
- New tab on Run Detail: **Pipeline** (after Ideas). 5 columns: Not started / Scripted / Filming / Posted / Archived — driven by `content_lab_ideas.status`.
- Each card shows idea number, hook, target platform badge, rating.
- Drag between columns → `update content_lab_ideas set status = newStatus`.
- Click card → opens existing idea detail.
- Mobile (<md): swap drag-and-drop for a status `Select` dropdown on each card.

### 3) Smarter own-post usage (polish only)
- Surface a one-line note on the Ideas tab when `own_avg_views < benchmark_p50`: *"Your views are below the top-10 benchmark median, so ideas are reverse-engineered from top accounts only."*
- Surface the inverse note when on par: *"Your views are on par with the top-10 benchmarks, so your top-performing posts are also being used as inspiration."*
- Add a "Top-performing own hook" line on the "Your Latest Content" tab header (computed in-page, no schema change).

## Files to touch
- `package.json` — add `@dnd-kit/core`, `@dnd-kit/sortable`
- `src/pages/content-lab/NicheFormPage.tsx` — platform multi-select
- `src/pages/content-lab/RunDetailPage.tsx` — Pipeline tab + own-post banner
- `src/components/content-lab/ViralPostCard.tsx` — platform-aware link label
- `src/components/content-lab/IdeaPipelineBoard.tsx` (new)
- `supabase/functions/content-lab-scrape/index.ts` — FB + TikTok fetchers
- `supabase/functions/content-lab-image-proxy/index.ts` — extend allowlist

No DB migration needed.

## Risks / trade-offs
- TikTok actor on Apify is paid per result (~$0.30/1000) — same model as IG, surfaces in existing usage counter.
- Facebook scraper needs the page to be public; private pages return empty (we'll show the same "no posts found" message as IG).
- Drag-and-drop on small screens degrades to a dropdown — chosen over cramped 5-column scroll.
- Existing runs stay IG-only; only new runs benefit from FB/TikTok.

## Expected result
- Niches can target IG, FB, TikTok independently.
- Run Detail gains a Kanban Pipeline tab where ideas move from "Not started" → "Posted".
- Ideas tab clearly tells the user *why* their own posts are or aren't being used as inspiration.

