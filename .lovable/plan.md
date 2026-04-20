
The user is rightly frustrated. The current system gave them garbage benchmarks. Let me think about this end-to-end before proposing anything.

**Root causes of bad benchmarks today:**
1. Discovery uses Gemini to *guess* benchmark handles from a niche description. Gemini hallucinates handles, picks small accounts, or returns brand accounts with low organic reach.
2. No view-count verification — we never check if a "benchmark" actually has millions of views. We just trust the LLM.
3. Only 3-6 benchmark handles ever get scraped, and recent posts (last 30 days) aren't filtered for view threshold.
4. No fallback when benchmarks are weak.
5. The scrape just hit 402 (Apify memory limit) — even if discovery worked, scrape capacity is tapped.

**What "robust benchmark discovery" actually requires:**
- Source candidates from real signals (hashtag search, sound search, "explore" feeds), not LLM imagination.
- Verify each candidate's real reach before promoting them to benchmark.
- Replenish — if a candidate fails the threshold, swap in another.
- Cache verified benchmarks per niche so we don't re-discover every run.

**Cost reality (this is the hard constraint):**
- Apify TikTok scraper ≈ $0.30/1000 results, but the bigger cost is Apify *memory-time*. They just hit the 32GB monthly cap.
- Hashtag-scraper actors cost more than profile actors.
- More benchmarks = linear scrape cost. Need pooling and caching to stay profitable.

**Pricing/limits the user proposed:** 1 / 3 / 10 runs. I'll confirm but flag that 1 run/mo at Starter probably needs a lower price or it'll feel like nothing. I'll fold a credit/top-up question into the questions.

Rather than dump a 4000-line plan they can't react to, I should ask the 3-4 highest-leverage questions first so the build matches their actual business model. Otherwise I'll guess wrong on cost ceilings and re-do this twice.

Critical unknowns that change the architecture:
1. Cost ceiling per Starter run (drives how many benchmarks we can scrape).
2. Benchmark sourcing strategy preference (hashtags vs trending sounds vs manual seed list per industry vs all three).
3. Should benchmarks be **shared across all clients in the same niche** (massive cost saver) or per-client?
4. Top-up credits when monthly runs are exhausted — yes/no?

I'll ask those, then write the full architecture plan in the same go.

---

# Content Lab v3 — Robust Benchmarks, Sustainable Cost

## What's actually broken (root cause)

| Symptom | Cause |
|---|---|
| "Only one account, shit results" | Discovery asks Gemini to *guess* handles from a niche description. No verification step. |
| Benchmarks have low views | We never filter by view threshold. A handle with 5k views passes the same as one with 5M. |
| Apify keeps 402'ing | We re-scrape the same handles for every client, every run. No pooling, no cache. |
| Inconsistent quality | No fallback when a benchmark fails — we just take what we got. |

## The new model — three-tier benchmark sourcing

Rather than "ask Gemini for 10 handles", we build a **verified benchmark pool** per niche from real signals:

**Tier 1 — Hashtag harvest (primary)**
For each top niche hashtag (e.g. `#fitnesscoach`, `#realestatetips`), use Apify's hashtag scraper to pull the *top* posts by view count from the last 30 days. Extract the author handles. These are real, currently-performing accounts in that niche. No guessing.

**Tier 2 — Trending sound harvest (TikTok only)**
Pull current trending sounds. Get the highest-view posts using each sound. Extract authors. Catches accounts that hashtags miss.

**Tier 3 — LLM seed (fallback only)**
Gemini suggests 5 known mega-accounts in that vertical as a safety net if Tier 1/2 yield <5 verified handles.

**Verification step (mandatory):**
Every candidate handle is profile-scraped once. Reject if:
- < 50k followers, OR
- median post views over last 12 posts < threshold (50k for IG/FB, 100k for TikTok), OR
- last post > 30 days ago (dead account), OR
- < 6 posts in last 90 days (low cadence).

Survivors get written to `content_lab_benchmark_pool` (new table) with `verified_at`, `median_views`, `niche_tags[]`, `platform`.

## Pooling — the cost killer

**Benchmarks are shared at the niche level, not the client level.**

If three of your clients are all in "London real estate", they share the same verified benchmark pool. Each client run does NOT re-scrape benchmarks. It pulls the latest pool for that niche tag, then only scrapes the client's *own* + *competitor* handles.

Refresh policy: pool is re-verified every 14 days (background job, not user-triggered). User runs are instant on benchmarks.

**Effect:** Apify cost per user run drops by ~70% because benchmarks are amortised across all clients in that niche.

## Per-platform scrape strategy

| Platform | Discovery actor | Scrape actor | Notes |
|---|---|---|---|
| Instagram | `apify/instagram-hashtag-scraper` | `apify/instagram-scraper` (profile) | Already wired; just needs hashtag step. |
| TikTok | `clockworks/free-tiktok-scraper` (hashtag + sound) | `clockworks/tiktok-scraper` (profile) | Adds sound discovery. |
| Facebook | `apify/facebook-search-scraper` (page search by keyword) | `apify/facebook-pages-scraper` | FB has no real hashtag system — keyword search instead. |

All three run in parallel during the **pool refresh** job. User runs only hit the lighter profile actor.

## New monthly run limits + credit top-up

Per your direction:
- **Starter**: 1 run/mo
- **Growth**: 3 runs/mo
- **Scale**: 10 runs/mo

Plus **credit top-ups** — pay-as-you-go for users who exhaust their monthly allowance. (Confirming this in question 2 below.)

Quality stays equal across tiers. No tier-gating on benchmark count. We're not punishing Starter users with bad data — we're metering volume only.

## UX — what the user sees change

- Niche form: when you save, we show "Building your benchmark pool — checking 30+ candidate accounts. Takes 2-3 minutes." Pool builds in background. You can leave the page.
- Run button: disabled until pool has ≥10 verified accounts. Tooltip: "Pool building — 7/10 verified."
- Run page: new "Benchmark Quality" badge — Strong (15+ verified) / Good (10-14) / Limited (5-9). Sets expectations.
- Pool freshness shown as "Last refreshed 4 days ago" with a manual refresh button (Scale tier only, costs 1 credit).
- Run duration drops because benchmark scraping is gone from the user-facing pipeline.

## Profitability math (rough)

Current: ~£0.40 Apify cost per run × 10 free runs = £4 cost, sold at £0 (Starter). Loss-leader.
New (Starter 1 run/mo): benchmarks pre-scraped & shared, user run only hits own + competitor handles ≈ £0.08/run. Top-ups at £1/credit = ~12× margin.
Pool refresh runs amortise across all niche subscribers — break-even at 3 active clients per niche.

## Sales positioning

- Old: "Generate ideas from competitors" (vague).
- New: "Reverse-engineer the top 30 viral posts in your niche this month — verified to have 100k+ views each." (Specific, defensible, hard to fake.)
- Marketing site can show example benchmark pools per industry as proof.

## Risks I want you to know about

- **Hashtag scrapers are slower & pricier per call** than profile scrapers (~3× cost), but only run in background pool refresh, not on user runs. Still net cheaper due to pooling.
- **First niche in a vertical is a "cold pool"** — the first user has to wait 2-3 min for the initial pool build. Subsequent users are instant.
- **Apify memory cap** must be raised — current 32GB plan won't fit pool refresh + user runs concurrently. Either upgrade Apify ($50/mo more) or queue pool refreshes serially overnight. I recommend queuing.
- **TikTok profile scraping for benchmark accounts is rate-limited** — pool refresh job needs throttling (max 5 handles/min per actor).

## Questions I need answered before building

1. **Cost ceiling per Starter run?** Drives how many benchmark posts we scrape per run.
2. **Top-up credits?** Yes/no, and at what price?
3. **Benchmark pool — shared across clients in same niche, or per-client?** (Shared = cheap & fast; per-client = customised but expensive.)
4. **Should we upgrade Apify plan now, or queue pool refreshes overnight?**

Once I have those four answers I can write the migration, the new pool refresh function, the discovery rewrite, and the UI changes in a single focused build.
