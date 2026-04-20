
## Content Lab — full reliability + UX overhaul

### What's actually broken right now (verified from DB + code)

1. **"Stuck on ideating" is a status bug, not ideation failure.**
   Run `875ea4f0` actually completed: 12 ideas saved (4 IG + 4 TikTok + 4 FB), every per-platform ideate logged `ok`. But the orchestrator never wrote `status='completed'` because the sequential pipeline runs ~510s in one background task (scrape 92s + analyse 41s + 3 × ideate ~125s) and Supabase background tasks die around ~400s. The work succeeds; the final status update never fires.

2. **Scrape volume is wrong vs. spec.**
   Currently pulls up to 15 own + 5 competitors × 8 + 3 benchmarks × 6, deduped to 80, across all enabled platforms. User wants: 8–10 own per platform; benchmarks = 4 latest from each verified account; then pick top 10 highest-engagement pieces only.

3. **Per-platform asymmetry.**
   IG goes through a chunked Apify call; TikTok and FB go one handle at a time. If IG actor times out partially, IG returns less. No retry, no per-platform target floor.

4. **No notification.**
   User isn't told runs take time and isn't emailed when ready. The page just sits on "ideating" with a spinner.

5. **Analyse is caption-only.**
   No transcript fetch, no hook/topic/intent extraction from video frames. Only the IG Apify return includes `videoTranscript` when present.

6. **Discovery accounts are AI-guessed**, not verified to exist or actually post in this niche. The pool refresh is the verifier but isn't blocking and is timeout-prone.

---

### Plan — what we'll build

#### 1. Fix the orchestrator (root cause of every "stuck" run)

Replace the single sequential `runPipeline` background task with a self-chaining state machine:

- `content-lab-pipeline` becomes a **dispatcher** that just enqueues the next step and returns 202.
- A new `content-lab-step-runner` edge function reads `status` from `content_lab_runs`, runs ONE step, writes the new status, then re-invokes itself for the next step.
- Each invocation lives well under the 150s function ceiling.
- Stale-run sweep stays in dispatcher, but threshold tightened to 10 min per step (not 30 min total).
- Final `completed` write happens inside the runner, not the dispatcher, so it can never be lost to a dead background task.

#### 2. Rewrite scraping to match the spec

In `content-lab-scrape`:

- **Own posts**: 8 latest per enabled platform (not 15 IG-heavy).
- **Cross-platform dedupe**: compare caption fingerprint (first 60 chars normalised) + same posted week → mark as duplicate so users who cross-post don't fill the pool.
- **Benchmarks**: for every verified benchmark account in the pool, fetch 4 latest videos per enabled platform (not 6 from only 3 accounts).
- **Competitors**: same — 4 latest per account per platform.
- **Score + cull**: after collecting, score every piece by `(views × 0.6) + (engagement_rate × views × 0.4)`, then keep only the **top 10 benchmark + top 10 competitor** pieces for analysis. Everything else is stored but not analysed.
- Per-platform retry: if a platform returns 0 posts for an account, retry once with a longer Apify timeout (120s) before giving up.
- Hard cap retained at 80 inserted rows.

#### 3. Real video analysis, not just caption parsing

Upgrade `content-lab-analyse`:

- For top 10 benchmark + top 10 competitor + own posts that have `transcript` already (from Apify IG actor), feed transcript + caption + thumbnail URL to Gemini 2.5 Pro with a structured tool call returning: `hook_text`, `hook_type`, `topic`, `intent`, `format_pattern`, `script_summary`, `style_notes`.
- For posts WITHOUT transcript (TikTok/FB Apify actors don't return one), call a transcript-fetch step using the Apify `clockworks/tiktok-scraper` `shouldDownloadSubtitles=true` mode for TikTok, and skip transcript for FB (caption + thumbnail only).
- Frame-by-frame is not feasible in an edge function budget — instead we pass the thumbnail to Gemini Vision for visual style notes. That's the right cost/value trade today.
- Keep the cheap model for the long tail; only top 20 get the Pro treatment.

#### 4. Ideation alignment

In `content-lab-ideate` (already per-platform):

- Inspiration pool changes to: top 10 analysed benchmark + top 10 analysed competitor pieces (not 30 raw).
- Continue per-platform invocation, kept under 130s each.
- Hard validator stays.
- Keep the hook variants (3 per idea).

#### 5. Notification + "this will take a while" UX

- Insert a confirmation dialog before launching a run: "This typically takes 20–40 minutes. We'll email you the moment your ideas are ready."
- Add `email_run_complete` boolean to `content_lab_runs` (default true).
- New edge function `content-lab-notify-complete` invoked at the end of the runner; uses existing branded-email infra to send a styled email with a deep link to the run.
- In-app: keep the polling and add a passive toast when a run completes while the user is on a different page.

#### 6. Discovery quality

- Keep the current Gemini-driven discovery as the "draft" stage.
- After it returns, immediately verify each suggested handle by hitting Apify's profile-info endpoint (cheap call, batch of 10): drop any handle that doesn't exist, has < 5,000 followers, or hasn't posted in 60 days. Replace dropped handles with verified ones from `content_lab_seed_pool` for the same vertical.
- Surface verification status to the niche form so the user sees which AI suggestions survived.
- The user's 3 manually added benchmarks bypass verification (their choice).

#### 7. Pool refresh hardening

- Lower default `MAX_CANDIDATES` from 25 → 15 and `MAX_SAMPLED_TARGET` 18 → 10.
- Persist partial progress to `content_lab_pool_refresh_jobs` after every candidate so a retry resumes instead of restarting.
- Job stays non-blocking — runs never depend on it.

#### 8. Regenerate

- `content-lab-regenerate-idea` already exists. Confirm wired to the FE buttons in `IdeaPipelineBoard.tsx` and `ViralPostCard.tsx`. Add a "regenerated N times" indicator and disable after 5 regenerations per idea (so users can't burn credits accidentally).

#### 9. Data cleanup before deploy

- Mark run `875ea4f0` as `completed` (its 12 ideas are real and valid).
- Mark any other org's runs older than 10 min in active states as `failed`.

---

### Files to change

Backend:
- `supabase/functions/content-lab-pipeline/index.ts` — slim to dispatcher
- `supabase/functions/content-lab-resume/index.ts` — same dispatcher pattern
- `supabase/functions/content-lab-step-runner/index.ts` — NEW
- `supabase/functions/content-lab-scrape/index.ts` — new caps, cross-platform dedupe, scoring, cull
- `supabase/functions/content-lab-analyse/index.ts` — Pro model for top 20 + transcript handling + thumbnail vision
- `supabase/functions/content-lab-ideate/index.ts` — pool reduced to top 20 analysed
- `supabase/functions/content-lab-discover/index.ts` — post-verify handles via Apify profile-info
- `supabase/functions/content-lab-pool-refresh/index.ts` — smaller batches, resume-safe
- `supabase/functions/content-lab-notify-complete/index.ts` — NEW (branded email)

Frontend:
- `src/pages/content-lab/ContentLabPage.tsx` — pre-run AlertDialog ("20–40 min, you'll be emailed")
- `src/components/content-lab/IdeaPipelineBoard.tsx` + `ViralPostCard.tsx` — regen counter + cap
- `src/hooks/useContentLab.ts` — refetch on run-complete realtime channel for passive toast

Database:
- New column `content_lab_runs.email_on_complete boolean default true`
- New column `content_lab_ideas.regen_count` already exists — just enforce cap in FE + edge function

---

### Side effects / risks

- **Apify spend will go UP** because we're now analysing 20 pieces with Gemini Pro and verifying discovered handles. Expect ~£0.05–0.10 per run instead of ~£0.02. Worth flagging because this is a real cost change.
- **Run wall-clock will go DOWN** because the orchestrator can no longer die mid-flight, but total user wait stays in the 20–40 min band as advertised.
- The cull-to-top-20 step means we no longer present every scraped post in the run detail UI — only the analysed ones get rich metadata. We'll add a "showing top 20 by engagement" label so this isn't confusing.
- **Discovery verification** can drop AI-suggested handles. If verification yields fewer than 10 surviving accounts, we backfill from `content_lab_seed_pool`. If the seed pool is also empty for that vertical, we keep the unverified AI suggestions and tag them `unverified` so the run can still proceed.

---

### Open questions
None — proceed on approval.
