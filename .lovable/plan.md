

## What the doc actually asks for

776-line spec for a full "Content Lab v2" add-on: 3-field discovery → scrape → analyse → ideate → 5-tab run UI → swipe file → calendar → credits → Stripe → admin. The doc's own Section 10 explicitly says:

> **Stop after Phase 1 and ask me to review with a real discovery run.** Don't wire Stripe or pg_cron until I've seen the end-to-end flow work.

So Phase 1 is the only target right now. Phase 2 (credits, Stripe, hook library, trend radar, swipe file) and Phase 3 (calendar, cron, admin A/B, email) are out of scope for this turn — I'll list what's missing so you can pick the next slice.

## Where we are vs Phase 1 spec

| Phase 1 requirement | Status |
|---|---|
| DB tables + RLS + storage buckets | ✅ done |
| 3-field niche onboarding + discovery progress UI | ✅ done |
| Auto-filled review screen | ✅ done |
| `content-lab-discover` (Firecrawl + Apify + Gemini + Claude) | ⚠️ done, no Apify IG profile scrape (uses Firecrawl + Gemini only — brand voice profile from real captions is missing) |
| `content-lab-scrape` chained | 🔴 **failing — orchestrator timeout** (this run) |
| `content-lab-analyse` (per-post summary) | ✅ done |
| `content-lab-ideate` (12 ideas, anti-cringe prompt) | ⚠️ done, prompt is mid-strength — missing several banned phrases, no 3-hook-variant requirement, no `evidence_link`/`why_it_works` enforcement |
| Run Detail: **Viral Feed** + **Content Ideas** with **visual post previews** | ⚠️ tabs exist, but ideas are not rendered as platform-mimicking phone-frame previews; they're plain cards |
| End-to-end working against `@nike` test | 🔴 blocked by scrape failure |

## Why this run failed (root cause)

Latest logs:

```
content-lab-pipeline → Scrape failed: 504 IDLE_TIMEOUT (150s)
content-lab-scrape  → Apify error: 400 run-failed (TIMED-OUT) on competitors
                    → Apify error: 400 run-failed (TIMED-OUT) on benchmarks
                    → Own (Apify): 20 posts ✓
                    → Legacy: 141 posts ✓
                    → Total runtime ~163s
```

Two compounding problems:

1. **Apify actor times out** when given 7 competitor handles in one request with `timeout=50` — too many handles, too short a timeout, default actor is slow.
2. **Orchestrator has a 150s idle timeout**, but scrape sequentially runs 4 Apify jobs (own → competitors → benchmarks → legacy) which takes >150s even when individual jobs succeed. The pipeline gives up before scrape finishes.

## Plan — focused fix + Phase 1 alignment

### A. Unblock the pipeline (must-do, this turn)

1. **Split the scrape into independent jobs.**  
   Inside `content-lab-scrape`, run own / competitors / benchmarks / legacy as **parallel `Promise.allSettled`** instead of sequentially. Cuts wall time from ~160s to ~50s (longest single bucket).

2. **Cap and chunk competitor + benchmark handles per Apify call.**  
   - Limit to **5 handles per Apify request**, chunk the rest.
   - Lower `MAX_POSTS_PER_HANDLE` from 20 → **10** for competitors/benchmarks (keeps own at 20).
   - Bump Apify `timeout` from 50 → **90s** per chunk.
   This eliminates the actor TIMED-OUT errors.

3. **Drop the legacy bucket from the default scrape path.**  
   Legacy `tracked_handles` + `competitor_urls` are no longer populated by the v2 discovery flow (they're a leftover from the pre-discovery niche form). Keeping them double-scrapes data and contributes ~50s. Remove from runtime; leave columns + RLS untouched.

4. **Raise the pipeline orchestrator's wait window** to match the new realistic ceiling (~120s) and surface partial scrape errors to `summary.scrape_errors` (already done last turn — verify it logs).

5. **Verify `engagement_rate` clamp + chunked insert** still in place (last turn's fix). No change needed.

### B. Tighten the Claude ideate prompt to spec (small, high-leverage)

The doc's Section 5 prompt is the "quality moat". Current `_shared/contentLabPrompts.ts` is ~30% of that spec. Update it to add:

- **Full banned-phrases list** verbatim from doc Section 5 (currently ~15 of ~30 phrases).
- **3 hook variants per idea**, each a different mechanism from the 8-mechanism enum.
- **Evidence requirement**: every idea must include `based_on_post_id`, `why_it_works` referencing source metric, `evidence_link` to `post_url`.
- **British English** instruction.
- **Specificity rule** (real numbers, `[bracketed]` placeholders if missing).

Update `content-lab-ideate` to write `hook_variants` array (currently writes a single hook), and to set `based_on_post_id` from the top-engagement post in the run.

### C. Visual post previews on the Ideas tab (the spec's hero feature)

The spec is explicit: ideas render as **phone-frame mocks** of the target platform. Currently they're plain cards. This is the single biggest "wow" gap in Phase 1.

Build three small preview components:
- `IdeaPreviewInstagram.tsx` — vertical 9:16 frame, gradient placeholder, audio sticker, right-rail icons.
- `IdeaPreviewTikTok.tsx` — phone frame, FYP header, trending audio banner, right-rail icons.
- `IdeaPreviewFacebook.tsx` — horizontal frame, page header, like/comment/share row.

Slot into `RunDetailPage.tsx` Ideas tab. Click → existing detail drawer (already has script/caption/CTA).

### D. Out of scope this turn (call out, don't build)

These are all in the doc but are Phase 2/3 per the doc's own instructions:

- Hook Library tab, Trend Radar tab, Swipe File tab
- 3 hook variants UI (data: yes; UI: next turn)
- Credit system + `content-lab-regenerate-idea` + `content-lab-remix-idea`
- Stripe add-on products + credit packs + webhooks + Customer Portal
- Calendar view (Scale tier)
- pg_cron scheduling + Resend monthly email
- Admin A/B prompt panel (current `/admin/content-lab` is observability only — fine for Phase 1)
- Apify IG profile scrape inside discovery for richer brand voice (currently Firecrawl + Gemini only)

If you want any of these next, I'll plan them as a separate slice.

## Build order

1. `content-lab-scrape`: parallelise buckets, cap handles per Apify call, drop legacy path, bump per-call timeout
2. `_shared/contentLabPrompts.ts`: complete banned-phrases + 3-hook + evidence + British rules
3. `content-lab-ideate`: write `hook_variants`, set `based_on_post_id`
4. Three platform preview components + wire into Ideas tab
5. Stop, ask you to re-run a niche end-to-end against `@nike` (or `@amwmedia` per doc) to verify

## Risks

- Parallel Apify calls hit account concurrency limits on free/low-tier Apify plans. If we see 429s, fall back to a small sequential queue with 2 in flight.
- Tightened prompt may produce JSON validation failures more often (stricter schema). If so, I'll add a single retry on parse failure.
- Visual previews are static mocks — they won't render real thumbnails until we wire `content-lab-thumbs` storage downloads (already a bucket, no current writes). Mock placeholders are fine for Phase 1 review.

Approve and I'll start with the scrape parallelisation.

