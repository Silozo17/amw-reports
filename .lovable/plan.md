

## AMW Content Lab — Build Plan

A new module added inside the existing AMW Reports app at `/content-lab/*`. Scoped per existing client, gated by an add-on subscription.

### What gets built (full feature set, phased)

**Phase 1 — Foundation & MVP (Instagram only, manual trigger)**
1. DB schema + RLS
2. Niche setup screen
3. Run pipeline end-to-end for Instagram via existing OAuth + Apify for tracked competitor handles
4. Run Detail screen: Viral Feed + 12 Ideas tabs
5. Branded PDF export (reuses existing `generate-report` patterns + jsPDF)
6. Internal-only (no paywall yet)

**Phase 2 — Expand platforms & full report**
- Add TikTok and Facebook competitor scraping
- Add remaining tabs: Trend Radar, Hook Library, Best Openers, Export
- Add Ahrefs + Google Trends verification for trends
- Voice/brand tone prompt baked into ideation

**Phase 3 — Billing & automation**
- Three new Stripe products (£49 Lite / £149 Pro / £299 Agency) as add-ons to existing plans
- `content_lab_tier` column on `org_subscriptions`, gated routes
- pg_cron monthly auto-run by tier cadence
- Email delivery via existing Resend pipeline

**Phase 4 — Admin & polish**
- Admin run table at `/content-lab/admin` (platform admins): cost, status, retry, mark-as-reviewed
- Cost cap per run, health-check on Apify actors

### Architecture decisions (locked from your answers)

| Layer | Choice |
|---|---|
| Routes | `/content-lab/*` inside existing app, gated by `content_lab_tier` |
| Scraping | Hybrid — existing OAuth connections for client's own IG/FB/TikTok; Apify for competitor handles only |
| AI — strategy/ideation | Claude (new `ANTHROPIC_API_KEY` secret) for trend synthesis + 12 ideas + hook analysis |
| AI — per-post summaries | Lovable AI gateway (`google/gemini-2.5-flash-lite`) — cheap, no key needed |
| Verification | Existing Ahrefs (needs `AHREFS_TOKEN`) + Google Trends (free) |
| PDF | Same jsPDF approach as existing reports, branded via existing `organisations` colors/fonts |
| Storage | Two new buckets: `content-lab-thumbs`, `content-lab-reports` |
| Scheduling | pg_cron → enqueue into existing `sync_jobs`-style queue (new `content_lab_runs` table follows same pattern) |
| Email | Existing `send-branded-email` |

### New database tables (all with RLS keyed to existing `org_id`)

```
content_lab_niches      (id, client_id, org_id, label, tracked_handles jsonb,
                         tracked_hashtags text[], tracked_keywords text[],
                         competitor_urls text[], language)
content_lab_runs        (id, client_id, org_id, niche_id, status, started_at,
                         completed_at, pdf_storage_path, summary jsonb, cost_pence)
content_lab_posts       (id, run_id, platform, source enum(oauth, apify), author_handle,
                         post_url, post_type, caption, thumbnail_url, likes, comments,
                         shares, views, engagement_rate, posted_at, bucket,
                         ai_summary, hook_text, hook_type)
content_lab_trends      (id, run_id, label, description, momentum, verification_source,
                         verification_url, recommendation, supporting_post_ids uuid[])
content_lab_ideas       (id, run_id, idea_number, title, based_on_post_id, caption,
                         hook, body, cta, duration_seconds, visual_direction,
                         why_it_works, hashtags text[], filming_checklist text[])
content_lab_hooks       (id, run_id, hook_text, source_post_id, mechanism, why_it_works,
                         engagement_score)
```
Add `content_lab_tier` (text: null/lite/pro/agency) to `org_subscriptions`.

### New edge functions

- `content-lab-scrape` — pulls posts: existing OAuth for own accounts, Apify for competitors
- `content-lab-analyse` — Lovable AI for per-post summaries, Claude for trend detection
- `content-lab-ideate` — Claude single structured tool-call returning 12 ideas
- `content-lab-render-pdf` — jsPDF, branded, uploads to `content-lab-reports`
- `content-lab-pipeline` — orchestrator chaining the above, status updates, error recovery
- `content-lab-cron` — daily pg_cron entry that enqueues runs by tier cadence

### New screens

1. `/content-lab` — Dashboard: latest run, "Run new report" CTA, niche cards, upgrade banner
2. `/content-lab/niche/new` and `/content-lab/niche/[id]` — Niche setup form
3. `/content-lab/run/[id]` — 6-tab report view (Viral Feed, Trend Radar, 12 Ideas, Hook Library, Best Openers, Export)
4. `/content-lab/billing` — Three-tier add-on pricing, current plan, manage via Stripe portal
5. `/content-lab/admin` — Platform admin only: all runs, cost, retry

Sidebar: add a single "Content Lab" entry under existing nav, hidden when org has no `content_lab_tier`.

### Secrets needed (will request when we hit each phase)

- `ANTHROPIC_API_KEY` (Phase 1)
- `APIFY_TOKEN` (Phase 1)
- `AHREFS_TOKEN` (Phase 2)
- Stripe price IDs for the 3 add-on products (Phase 3) — created via tools, no manual key

### What I'm NOT building

- Replacement for any existing functionality
- Changes to existing report generation, sync, or dashboards
- Notion/Google Calendar exports (deferred to "later")
- White-label PDF logo swap (Phase 4 polish)

### Risks flagged

1. **Apify TOS / cost runaway** — hard cost cap per run, weekly health check, fallback provider in env config
2. **Claude API key billing** — you absorb this directly; budget ~£1.20 per Pro run
3. **60s edge function limit** — pipeline split into 5 functions chained via the orchestrator (same pattern as existing sync)
4. **Idea quality drift** — 1–5 star rating UI on each idea so the team can flag weak outputs and we iterate the prompt

### Build order — what I'll ship first

Phase 1 only, in this order:
1. Migration: tables + RLS + bucket creation
2. `/content-lab` dashboard + `/content-lab/niche/new` with mock data
3. `content-lab-scrape` (OAuth path first, Apify second) wired against one real client
4. `content-lab-analyse` + `content-lab-ideate` wired
5. `/content-lab/run/[id]` with Viral Feed + 12 Ideas tabs against real data
6. `content-lab-render-pdf` + Export tab
7. Pause for your review before Phase 2

Approve this and I'll start with Phase 1, step 1 (the migration). I'll request `ANTHROPIC_API_KEY` and `APIFY_TOKEN` right after the migration is applied, before wiring the scraper.

