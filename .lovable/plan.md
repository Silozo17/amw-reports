# Content Lab v5 — Client-First Rebuild (revised)

## What we're building (plain English)

User picks a client → 1 credit → ~3-min research run → 30 ideas across 4 tabs (Your content / Local competitors / Viral worldwide / Ideas). Free AI edits per idea, rate-limited.

## Hard rules folded in from your review

1. **Apify concurrency cap = 5.** Manual semaphore in `content-lab-scrape`. Every actor call awaits a slot. No parallel firehose.
2. **OAuth-first for own content.** `content-lab-scrape` checks `platform_connections` per platform. If IG is connected via Graph API, use it (free, instant). Apify only as fallback for own posts. Competitors and viral pools always use Apify (no OAuth available).
3. **Ideate = 3 parallel calls of 10.** Default. Same shared context (client snapshot + 3 pools + analyse output) sent to each call, with `idea_index_offset` 0/10/20 in the prompt so they don't overlap themes. Single 30-in-one is removed entirely.
4. **`industry` + `location` live on `clients`.** Migration adds `clients.industry text` and `clients.location text` (nullable) — populated once in client onboarding/edit dialog, editable any time. Run reads them straight from the client row. No per-run Gemini website inference.
5. **Analyse step kept (cheap).** New `content-lab-analyse` runs Claude Haiku on all scraped posts (own + competitor + viral) in one batched call: per-post `hook_type`, `hook_text`, `pattern_tag`. Output stored on `content_lab_posts`. Ideate prompt receives these tags so it has structured signal, not just raw captions.
6. **Handle pre-filter regex** runs *before* Apify validation:
   - IG: `^[A-Za-z0-9._]{1,30}$`
   - TikTok: `^[A-Za-z0-9._]{2,24}$`
   - Facebook: `^[A-Za-z0-9.\-]{5,50}$` (page slug rules)
   - Anything containing spaces, "&", "ltd", "limited" → rejected without an Apify call.
7. **Pre-migration export.** Before the destructive migration runs, a one-shot script dumps every Content Lab table to JSONL in `content-lab-reports/legacy-export-{timestamp}/` (private bucket). One file per table. Kept indefinitely.

## Phase order in `content-lab-run` (single orchestrator)

```text
0. spend_content_lab_credit (1 credit, refund on failure)
1. snapshot client → runs.client_snapshot
2. discover                              ← Gemini, 1 call
   - 10 competitor handles (uses clients.competitors first, AI tops up)
   - 10 viral worldwide accounts
   - 3 niche hashtags
3. pre-filter handles by regex
4. validate competitors via Apify profile-info (semaphore=5)
5. scrape (semaphore=5 across all Apify calls)
   - own: OAuth where available, Apify fallback
   - competitors: Apify
   - viral accounts: Apify
   - viral hashtags: Apify hashtag scrapers
   - all scoped to last 30 days
   - cross-platform dedupe by caption fingerprint + week
6. analyse                               ← Haiku, 1 batched call
7. ideate                                ← Claude Sonnet, 3 parallel calls × 10
8. notify-complete (email)
```

Each phase writes to `content_lab_run_progress` (renamed step_logs) so the UI shows live status. ≤1 retry per phase, partial success allowed (e.g. if Facebook scrape fails, run still completes with IG+TikTok).

## Schema (final)

Migration:
```text
ALTER TABLE clients ADD COLUMN industry text, ADD COLUMN location text;
-- (clients.competitors already exists as text — we'll parse it as comma-separated)

DROP TABLE: content_lab_niches, content_lab_runs, content_lab_ideas,
            content_lab_posts, content_lab_hooks, content_lab_trends,
            content_lab_step_logs, content_lab_benchmark_pool,
            content_lab_seed_pool, content_lab_pool_refresh_jobs,
            content_lab_verticals, content_lab_swipe_file,
            content_lab_swipe_insights, content_lab_idea_comments,
            content_lab_run_share_tokens
KEEP:    content_lab_credits, content_lab_credit_ledger, content_lab_usage

CREATE:
  content_lab_runs(
    id, org_id, client_id, status, credit_ledger_id,
    client_snapshot jsonb,            -- handles, website, industry, location, competitors at run time
    competitor_handles jsonb,         -- 10 validated
    viral_accounts jsonb,             -- 10
    viral_hashtags jsonb,             -- 3
    summary jsonb, error_message,
    started_at, completed_at, created_at, updated_at
  )
  content_lab_run_progress(
    id, run_id, step, status, message, payload jsonb,
    started_at, completed_at, duration_ms
  )
  content_lab_posts(
    id, run_id, bucket('own'|'competitor'|'viral'),
    platform, author_handle, post_url, thumbnail_url, caption,
    views, likes, comments, shares, engagement_rate, posted_at,
    transcript, hashtags[],
    duplicate_group_id,               -- cross-platform dedupe key
    hook_type, hook_text, pattern_tag -- from analyse step
  )
  content_lab_ideas(
    id, run_id, idea_number, title, hook, hook_variants jsonb,
    body, caption, visual_direction, cta, hashtags[],
    best_fit_platform, source_post_id, why_it_works,
    status, rating, ai_edit_count, last_edited_at, created_at
  )
  content_lab_idea_edits(            -- rate limiting
    id, idea_id, user_id, prompt, created_at
  )
```

RLS mirrors existing org-member / client-user / platform-admin pattern.

## Edge functions

**Delete:** `content-lab-discover`, `content-lab-onboard`, `content-lab-pool-refresh`, `content-lab-manual-pool-refresh`, `content-lab-validate-handle`, `content-lab-pipeline`, `content-lab-step-runner`, `content-lab-resume`, `content-lab-monthly-digest`, `content-lab-swipe-insights`, `content-lab-link-suggest`, `content-lab-remix-idea`.

**New / rewritten:**
- `content-lab-run` — orchestrator (spends credit, runs phases 1-8, refunds on failure)
- `content-lab-scrape` — semaphore=5, OAuth-first own scrape, Apify fallback
- `content-lab-analyse` — Haiku batched hook/pattern extraction
- `content-lab-ideate` — 3 parallel Sonnet calls × 10 ideas
- `content-lab-regenerate-idea` — free, rate-limited (5 per idea per user per 24h, 50 per org per day)

**Kept and ported:** `content-lab-render-pdf`, `content-lab-export-docx`, `content-lab-image-proxy`, `content-lab-notify-complete`.

## Apify usage (verified)

- IG profile (own fallback / competitors / viral accounts): `apify~instagram-scraper`, `resultsLimit: 30`, `onlyPostsNewerThan: "30 days"`
- TikTok profile: `clockworks~tiktok-scraper`, `resultsPerPage: 30`, date-filter in code
- Facebook page: `apify~facebook-pages-scraper`, `resultsLimit: 30`
- IG hashtag viral: `apify~instagram-hashtag-scraper`, `resultsLimit: 30`
- TikTok hashtag viral: `clockworks~tiktok-scraper` (hashtag mode)
- Profile validation: `apify/instagram-profile-scraper`, `clockworks/tiktok-profile-scraper`

All routed through one `runApifyActor()` helper that takes a semaphore slot before fetching.

## UI

**Removed routes:** `/content-lab/niche/new`, `/content-lab/onboard/*`, `/content-lab/trends`, `/content-lab/hooks`, `/content-lab/swipe`, `/content-lab/pipeline`.

**`/content-lab` (rewritten):** searchable client picker, credit balance, "Generate ideas" CTA per client, list of past runs grouped by client.

**`/content-lab/run/:id` (new):** 4 tabs:
- Your content — last 30d, deduped, per-platform sub-grids, hook tags shown
- Local competitors — 10 cards, expand for top posts
- Viral worldwide — top 15 posts grid
- Ideas — 30 cards, filter by `best_fit_platform`, regenerate/edit button each

**`ClientContentLabTab`:** simplified to "latest run + open report".

**`ClientForm` / edit dialog:** new fields for `industry` and `location`.

## Risks I want you aware of

1. **Wall time:** ~3-6 min with semaphore=5. UI shows live progress per phase.
2. **Apify cost variance:** capped per actor at 30 results; worst case ~$0.50/run.
3. **OAuth own-scrape only covers Instagram today** (Graph API). TikTok and Facebook own-scrape will still go through Apify until those platforms get OAuth scrape support — flagging now.
4. **Hashtag actor returns hit-or-miss data on niche topics** (e.g. "car detailing UK" will work; "luxury car servicing milton keynes" likely won't). The fallback is the 10 viral accounts pool, which is more reliable.
5. **Destructive migration** — confirmed full reset, JSONL export to private bucket runs first.

## Build order (one task at a time)

1. JSONL export script → run it → confirm files in `content-lab-reports/legacy-export-{timestamp}/`
2. Migration: drop old tables, add `clients.industry`/`clients.location`, create new schema + RLS
3. New `content-lab-run` orchestrator + simplified `content-lab-scrape` (semaphore + OAuth-first)
4. New `content-lab-analyse` (Haiku batch)
5. New `content-lab-ideate` (3×10 parallel)
6. New `content-lab-regenerate-idea` (free, rate-limited)
7. Port `render-pdf`, `notify-complete`, `image-proxy`, `export-docx` to new schema
8. New `/content-lab` launchpad + run page with 4 tabs
9. Add industry/location to ClientForm; simplify `ClientContentLabTab`; remove dead routes/components
10. Smoke-test against Wheels VT

Approve and I start at step 1.