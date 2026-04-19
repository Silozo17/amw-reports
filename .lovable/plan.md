

## Goal
Cap Apify spend per scrape run while keeping the data signal strong enough for analyse + ideate to produce quality output.

## Current cost surface (per run)

From `content-lab-scrape/index.ts`:
- Own bucket: 1 Apify call, up to 20 posts (or free if IG OAuth)
- Competitors: up to 7 handles → chunks of 5 → up to 2 calls × 5 handles × 10 posts = **100 posts**
- Benchmarks: same maths → **100 posts**
- Hard cap: `MAX_TOTAL_POSTS = 300`

Apify `instagram-scraper` bills roughly per result item. So worst case = ~220 items per run, and there's no per-org/per-month ceiling. A user spamming "Run Pipeline" can rack up cost fast.

## Recommended approach — three layers

### Layer 1: Tighten per-run caps (cheap, immediate)
Lower the data we ask Apify for, without losing analytical value:

| Setting | Now | Proposed | Why |
|---|---|---|---|
| Competitor handles | up to 7 | **5** | More than 5 dilutes signal; ideate only references top posts anyway |
| Benchmark handles | up to 7 | **3** | Benchmarks are inspiration, not breadth — 3 strong global accounts beats 7 mid ones |
| Posts per competitor | 10 | **8** | 8 × 5 = 40 still gives a solid distribution |
| Posts per benchmark | 10 | **6** | 6 × 3 = 18 — enough to spot patterns |
| Own posts (Apify path) | 20 | **15** | Own brand voice signal saturates fast |
| `MAX_TOTAL_POSTS` | 300 | **80** | Realistic worst case becomes 15 + 40 + 18 = 73 |

Net effect: ~73 items/run instead of ~220. **~3× cost reduction** with negligible quality loss because analyse already ranks by engagement and ideate only uses the top ~12.

### Layer 2: Per-org monthly run limit (prevents runaway spend)
Add a soft credits model now (precursor to the Phase 2 credit system) without building Stripe:

- New table `content_lab_usage(org_id, month, year, runs_count)`.
- New constant `MAX_RUNS_PER_ORG_PER_MONTH = 10` (Creator), `25` (Studio), `60` (Agency) — read tier from `org_subscriptions.content_lab_tier`, fall back to 10.
- `content-lab-pipeline` checks usage at start: if over limit, fail fast with friendly message ("You've used X/Y runs this month. Resets on the 1st.").
- Increment counter atomically only after scrape succeeds (don't charge for failed runs).
- Surface "X / Y runs used this month" badge on `/content-lab` page header.

This is the single most important guardrail — it caps worst-case cost per org with certainty.

### Layer 3: Re-run guard (prevents accidental double-spend)
- If a niche has a successful run within the last **24 hours**, the "Run Pipeline" button shows a confirm dialog: *"You ran this niche 4 hours ago. Re-running costs another scrape. Continue?"*
- Prevents the most common waste pattern: user clicking Run twice while waiting.

## What I won't change
- Own-handle IG OAuth path stays (it's free — uses Graph API, not Apify).
- Parallelism + chunking from last turn stays (perf, not cost).
- No change to analyse / ideate — they already only consume top posts.

## Files touched
- `supabase/migrations/…` — create `content_lab_usage` table + RLS (org members read own, service role write).
- `supabase/functions/content-lab-scrape/index.ts` — lower the 6 constants in the table above.
- `supabase/functions/content-lab-pipeline/index.ts` — pre-flight usage check, post-success increment.
- `src/pages/content-lab/ContentLabPage.tsx` — usage badge in header, 24h re-run confirm dialog.
- `src/hooks/useContentLab.ts` — fetch usage row, expose `runsThisMonth` + `runsLimit`.

## Risks
- Lower benchmark count (7 → 3) means fewer "global inspiration" sources. Mitigation: discovery already ranks them, so we keep the strongest 3.
- Tier-based limits are hardcoded constants until the real credit system lands in Phase 2. Fine as a stop-gap; trivially swappable later.

## Open question — your call

I've assumed 10 / 25 / 60 runs per month for Creator / Studio / Agency. **Are those the right ceilings, or do you want different numbers?** If you don't know yet, I'll ship those defaults and we can tune in a future turn.

Approve and I'll start with the migration.

