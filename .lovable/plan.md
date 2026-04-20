

## Content Lab — Full Audit

I read every edge function, the Run Detail UI, the niche form, the Kanban, the image proxy, plus recent run logs. Here's what's broken, fragile, or worth tightening — grouped by severity.

---

### 🔴 Critical bugs (live failures in your last 5 runs)

**1. `numeric field overflow` on scrape insert** (run `e059e8fd…` failed on this)
- `engagement_rate` is computed in `content-lab-scrape` with `(likes + comments) / views`. When `views` is near zero and likes are huge, it overflows the DB column. The clamp `Math.min(raw, 99.9999)` exists, but the column is likely `numeric(precision, scale)` with low precision and the engagement_rate of TikTok/own posts where `views=0` falls through the fallback formula and can still overflow.
- **Fix**: clamp to a safe range AND check the actual column precision. Switch to `numeric(7,4)` or apply `Math.min(raw, 9.9999)` (engagement rate as ratio caps at 1.0 anyway — anything >1 is a data bug).

**2. Scrape 504 IDLE_TIMEOUT** (run `2cdc5617…`)
- `content-lab-pipeline` calls `content-lab-scrape` with no timeout protection. Scrape runs 3 buckets × multiple platforms in parallel via Apify `run-sync`, each up to 90s. With 3 platforms enabled, total wall-clock can exceed Supabase's 150s edge timeout.
- **Fix options**: lower `APIFY_TIMEOUT_SEC` to 60s, fan out per-platform calls inside scrape sequentially-then-merge, or move scrape to an async Apify job poll pattern instead of `run-sync`.

**3. Bucket vs source mismatch — silently wrong ideation pool**
- `scrape` writes `bucket = 'own' | 'competitor' | 'benchmark'` to a **bucket** column. It writes `source = 'oauth' | 'apify'` (the data origin, not the role).
- `ideate` filters with `p.source === 'benchmark' || p.source === 'competitor'` and `p.source === 'own'`. **Source never has those values** — so this filter returns nothing OR everything depending on enum vs text typing. The query SELECTs both `source` and `bucket`, so the fix is one-line, but right now ideation may be operating on the wrong pool.
- **Fix**: change ideate filters to use `p.bucket` not `p.source`.

**4. Pipeline preflight checks deprecated `tracked_handles`**
- `content-lab-pipeline` line 153 still selects `tracked_handles` and counts it, but discovery no longer populates it (replaced by `top_global_benchmarks` + `top_competitors`). Old niches with `tracked_handles` still pass; new ones rely entirely on benchmarks/competitors which is fine — but the count check is misleading and you've shipped at least one "no posts could be fetched" run because of this gap.
- **Fix**: remove `tracked_handles` from preflight (or migrate it).

---

### 🟠 Logic issues / ideation quality

**5. `competitor` posts are mixed into the benchmark inspiration pool**
- Ideate treats `bucket IN ('benchmark','competitor')` as one pool. Per your stated direction, ideas should be reverse-engineered from the **top 10 global benchmarks**, not local competitors. Local competitors are useful context but not the role-models.
- **Fix**: pool inspiration from `bucket='benchmark'` only; keep competitor posts visible in the Viral Feed but exclude them from ideate's `inspirationPool` (or use them as a secondary tier with lower weight).

**6. Benchmark sample is too small for the "top 30 by views" claim**
- Scraper caps benchmarks at `MAX_BENCHMARK_HANDLES=3` × `MAX_POSTS_BENCHMARK=6` = **18 posts max**. The ideate code asks for the "top 30 benchmark posts by views" but it'll never have more than 18.
- Discovery returns 10 benchmarks but only 3 are scraped. Either raise `MAX_BENCHMARK_HANDLES` to 6–8 (cost-aware) or drop the "top 30" framing in the prompt.

**7. Hashtag/keywords/own-handle from the niche are ignored**
- `tracked_hashtags` and `tracked_keywords` from discovery are saved but **never used by scrape or ideate**. The pipeline only scrapes by handle. Either remove them from the form or actually feed hashtags into a hashtag-search Apify run.

**8. Ideate is rejecting a lot — 11 failed vs 4 ok in last 7 days**
- Validator drops ideas where `based_on_handle` doesn't match the scraped pool (case-sensitivity, `@` prefix already handled, but author_handle is sometimes truncated/changed by Apify — e.g. TikTok stores `authorMeta.name` which can differ from input handle). Then `accepted.length === 0 → continue` means a platform silently produces zero ideas.
- **Fix**: fuzzy-match handles (lowercased, no @, allow swapping `.` and `_`), and make the validator log the rejection sample to UI not just console.

**9. Anti-example block can leak even when own posts are tagged `competitor` in the bucket column**
- Same root cause as #3 — relies on `source==='own'` which never matches.

**10. `ownIsCompetitive` uses single median, not platform-aware**
- Median is computed across all benchmark posts globally, but ideate runs per-platform. A brand on par with IG benchmarks but below TikTok benchmarks gets a flat verdict.
- **Fix**: compute `benchmarkP50Views` per platform inside the loop (the `platformBenchmarks` slice is already there).

---

### 🟡 UX / front-end issues

**11. Tabs default to "own" but most runs have 0 own posts → empty first impression**
- `Tabs defaultValue="own"`. If `ownPosts.length === 0`, the first thing the user sees is an empty state.
- **Fix**: default to whichever tab has data — `own` if present, else `feed`.

**12. Ideas tab caption-vs-hook check is local only**
- Card already hides hook when it's a prefix of caption (good). But the Ideas tab itself still shows `idea.hook` even when the AI returned `hook === caption` — validator catches identical strings but not "hook is first 80 chars of caption".
- **Fix**: tighten the dedupe to a normalized prefix check, like the card already does.

**13. Pipeline tab `onSelect` is a no-op**
- `onSelect={() => { /* click-to-detail can be wired later */ }}` — clicking a card on the Kanban does nothing. Either remove the cursor change or wire it to open the existing idea detail.

**14. NicheForm: `Auto-fill from client when picked` effect has a missing dep**
- `useEffect(() => {…}, [clientId, clients, isEdit])` reads `website` and `ownHandle` but excludes them — eslint-disable wasn't added. It works but will surprise on prop change.

**15. Page meta is stale**
- `usePageMeta({ title: 'Content Lab Report', description: 'Viral feed and 12 ideas for the month.' })` — count is no longer 12 (it's adaptive across platforms).

---

### 🟢 Polish / hygiene

**16. `RECENT_RUN_WINDOW_MS` is hardcoded** in ContentLabPage — pull to a top-level constant and reuse.
**17. `MAX_TOTAL_POSTS=80` query** in `RunDetailPage` matches scraper cap — keep them in a shared constant so they don't drift.
**18. `content-lab-analyse` orders by `engagement_rate DESC`** but engagement_rate is broken/clamped per #1 — once that's fixed, ordering will be more meaningful. Also: it analyses up to 40 posts via paid LLM; consider lowering to 25 if cost matters.
**19. No retry/backoff on Apify 5xx** — every Apify call is single-attempt. 503/504 from Apify are common; add 1 retry with 1.5s delay for non-2xx.
**20. `ViralPostCard` falls back to raw IG URL on proxy failure** — but raw IG URLs almost always 403 from the browser. The fallback is effectively a broken image. Better to show the placeholder gradient when proxy fails.
**21. Step logs table has no `INSERT` policy for users** (correct — it's service-role written) but the UI never surfaces them. Consider showing the last failed step's log on the run detail page when status='failed'.

---

## Proposed fix plan (ordered by impact)

1. **Fix `bucket` vs `source` filter in ideate** — single edit, restores the entire benchmark-first logic. (Critical)
2. **Cap `engagement_rate` at 1.0 in scrape** — eliminates the numeric overflow class of failures. (Critical)
3. **Lower scrape wall-clock**: `APIFY_TIMEOUT_SEC` 90→60s and reduce per-bucket concurrency when 3+ platforms active. (Critical)
4. **Drop `tracked_handles` from pipeline preflight**; rely on benchmarks/competitors. (Critical)
5. **Pool inspiration from `bucket='benchmark'` only**; competitors stay in feed. (Quality)
6. **Raise `MAX_BENCHMARK_HANDLES` to 6** so we actually have ~36 benchmark posts to pick top-30 from. (Quality)
7. **Per-platform `ownIsCompetitive`**. (Quality)
8. **Fuzzy handle matching in validator** + surface rejection sample in `summary` so UI can show it. (Quality)
9. **Default RunDetail tab to whichever has data**; fix stale page meta + 12-ideas copy. (UX)
10. **Wire pipeline card click → idea detail dialog**. (UX)
11. **One Apify retry on 5xx**. (Reliability)
12. **Cleanup pass**: shared constants, page meta, image fallback to placeholder, optional analyse cap. (Polish)

Steps 1–4 fix the live failures you're hitting today. Steps 5–8 materially improve idea quality. 9–12 are polish.

No DB migrations needed for items 1–10. Item 2 may need one if the column precision is too tight — I'll check `content_lab_posts.engagement_rate` precision first and migrate only if needed.

