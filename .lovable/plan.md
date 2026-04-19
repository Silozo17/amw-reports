

Phase 1 is functionally complete (DB, niche form, scrape, analyse, ideate, dashboard, run detail with Viral Feed + 12 Ideas). The plan said: **pause for review after Phase 1, then proceed to Phase 2 once you've tested an end-to-end run.**

Two sensible "next" paths. Recommending the first.

## Recommended next: finish Phase 1 properly before expanding

Two small gaps remain in Phase 1 before moving to Phase 2:

1. **PDF export** (`content-lab-render-pdf` + Export tab) — listed as Phase 1 step 6 in the approved build order, not yet built.
2. **End-to-end smoke test** — create a niche on the current client, click Run Now, watch it complete, sanity-check posts/ideas/PDF.

This closes Phase 1 cleanly so we can pause for your review with a complete shippable slice.

### What I'd build (one task)

**`content-lab-render-pdf` edge function**
- Inputs: `run_id`
- Loads run + niche + posts (top 12 by engagement) + ideas (all 12)
- Generates branded A4 landscape PDF via jsPDF using the org's colors/fonts (same pattern as existing `generate-report`)
- Sections: Cover (niche label, date, client logo) → Viral Feed top 12 (thumbnail, handle, caption, metrics, AI summary) → 12 Ideas (number, title, hook, body, CTA, hashtags, filming checklist) → Footer
- Uploads to `content-lab-reports` bucket at `{org_id}/{run_id}.pdf`
- Updates `content_lab_runs.pdf_storage_path`

**Pipeline wiring**
- Add a `rendering` step to `content-lab-pipeline` that invokes `content-lab-render-pdf` after `ideate` succeeds, before marking run `completed`

**Run Detail UI**
- Add an **Export** tab with a "Download PDF" button (signed URL from the private bucket)
- Show a "PDF generating…" state while `status='rendering'`

### What I'm NOT doing in this step
- No new platforms (TikTok/Facebook = Phase 2)
- No Trend Radar / Hook Library / Best Openers tabs (Phase 2)
- No Ahrefs/Google Trends verification (Phase 2)
- No billing/Stripe (Phase 3)
- No cron auto-runs (Phase 3)
- No admin run table (Phase 4)

### Risks
- **jsPDF size**: a run with 12 thumbnail images can produce a 3-5 MB PDF. Will fetch thumbnails server-side and downscale to 800px wide before embedding to keep it under 2 MB.
- **Edge function 60s limit**: Render should finish in 10-20s for 12 posts. If it ever creeps up we can split image fetch into a parallel batch — flagging now, not pre-optimising.

## Alternative paths if you'd rather skip ahead

- **Skip PDF, jump to Phase 2 tabs** (Trend Radar, Hook Library, Best Openers) — faster visual progress but ships an incomplete Phase 1.
- **Skip PDF, jump to Phase 3 billing** — gates the feature behind a paywall now. Risky without an end-to-end test first.
- **Just run the smoke test** — no new code, just create a niche and click Run Now together so we confirm the pipeline actually works before building the PDF on top.

If you don't tell me otherwise I'll proceed with the recommended path: build `content-lab-render-pdf` + Export tab, then ask you to do the smoke test.

