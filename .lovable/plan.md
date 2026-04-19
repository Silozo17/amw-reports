

## Why reports fail

The pipeline reaches **Scrape**, finds 0 posts, and the orchestrator (correctly) marks the run as **Failed** with the message *"No posts could be fetched..."*. The real cause is in the edge function logs:

```
Apify error: 401 user-or-token-not-found
```

I called Apify directly with the project's `APIFY_TOKEN` secret and got the same 401 — **the stored Apify token is invalid or revoked**. Every Apify call (own / competitor / benchmark / legacy) returns 0 posts, the run has nothing to ideate on, and pipeline fails.

For the Nike test specifically, even with a valid token the **Own** bucket would still go through Apify (no Instagram OAuth connection on the test client), so a working token is the only fix here.

## Fix — Step 1 (blocking)

Rotate the `APIFY_TOKEN` secret. I'll trigger the secret prompt so you can paste a fresh token from https://console.apify.com/account/integrations. Nothing else can be tested until this is done.

## Spec audit — Content Lab build

I cross-checked the 5 edge functions, the 3 frontend pages, the schema, and the admin observability surface against the spec we agreed in earlier steps. Findings:

### Working as spec
- Discovery flow (Firecrawl + Gemini) — populates competitors, benchmarks, hashtags, keywords, defaults.
- Niche save + list + run trigger — confirmed end-to-end after the discover-response fix.
- Pipeline orchestrator — clears prior posts/ideas, runs scrape → analyse (best-effort) → ideate, marks failures with friendly messages, no PDF step.
- Step logging via `content_lab_step_logs` + admin `/admin/content-lab` page (Runs / Step Logs / Niches tabs, realtime).
- Ideate uses Claude with platform style guide + master prompt, distributes 12 ideas across selected platforms, writes `target_platform`, `caption_with_hashtag`, `script_full`.
- RLS: org members manage, client users read own, platform admins read all — correct on every Content Lab table.

### Bugs / gaps to fix in this pass

1. **Apify token invalid** — rotate secret (above). Without this nothing else matters.

2. **`RunDetailPage` still references the removed PDF step.**  
   Spec says PDF is gone (in-app feed only). The page still has an "Export → Download PDF" tab, a "rendering" status branch, and a `pdf_storage_path` download handler. Remove the Export tab and the PDF UI; keep only Viral Feed + 12 Ideas.

3. **`ContentLabPage` STATUS_CONFIG includes `rendering`.**  
   Same residue from the old PDF step — remove the `rendering` entry.

4. **No surfacing of partial scrape errors.**  
   The scrape function collects per-bucket errors into `errors[]` but never returns them to the run row, so when (say) only competitors fail you get a green run with thin data and no signal. Persist `errors[]` to `content_lab_runs.summary.scrape_errors` and surface them in the admin Run Detail drawer (StepLogs already captures the headline, this adds detail).

5. **`logStep` calls missing from `content-lab-discover` and `content-lab-scrape`.**  
   Step 7 added them to `pipeline` and `ideate` only. For the admin Step Logs tab to be complete, wrap discover and scrape with `logStepStart`/`finish` too — recording handle counts per bucket on success and the Apify error string on failure. This is exactly the kind of issue we want logs to catch next time.

6. **Empty-handle guard.**  
   If `top_competitors` and `top_global_benchmarks` are both empty (rare, but possible if discovery returns nothing), the scrape still runs the legacy block and may end with 0 posts and a confusing message. Add a pre-flight check in the pipeline: if the niche has no own_handle, no competitors, and no benchmarks, fail fast with "Niche has no handles to scrape — re-run discovery."

7. **React ref warnings (low priority).**  
   Console shows: *"Function components cannot be given refs"* for `RunDetailPage` and `AppLayout`. Caused by `React.lazy` + `Suspense` forwarding a ref. Wrap both in `React.forwardRef` (one-line fix each). Cosmetic only — no functional impact.

### Out of scope (not changing)
- Apify actor choice, cost capping, or scraper rate limiting.
- Adding TikTok/Facebook scraping (still Phase 2 per the form).
- Re-introducing PDF rendering (explicitly removed in Step 7).

## Build order

1. Prompt for new `APIFY_TOKEN` (blocks everything).
2. Strip residual PDF UI (`RunDetailPage`, `ContentLabPage`).
3. Add `logStep` instrumentation to `content-lab-discover` + `content-lab-scrape`; persist scrape errors to run summary.
4. Pre-flight empty-handle check in `content-lab-pipeline`.
5. `forwardRef` wrap on `RunDetailPage` + `AppLayout`.
6. Stop and ask you to re-run a niche so we can verify end-to-end with the new token + fresh logs.

Approve and I'll start with the secret prompt.

