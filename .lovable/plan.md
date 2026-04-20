

## Phase 4 — Retention & Polish

Eight workstreams. I'll group them into 4 shippable milestones to keep PRs small and reviewable.

---

### Milestone A — Swipe File + Docx Export (the compounding asset + the deliverable)

**A1. Swipe file**
- New table `content_lab_swipe_file`: `id, org_id, client_id (nullable), user_id, idea_id, niche_id, saved_at, notes, tags text[]`. RLS: org members read/write their org's rows.
- Heart icon on every `IdeaCard` (Pipeline board, Run Detail ideas grid, swipe-file page). Toggles save/unsave; optimistic update via TanStack Query.
- New page `src/pages/content-lab/SwipeFilePage.tsx` (route `/content-lab/swipe-file`):
  - Filters: niche, platform, topic cluster (derived from idea hashtags), date saved.
  - Bulk select → "Export selected" (.docx) and "Share subset" (read-only public link, reuses A4 link infra).
- **Pattern Insights widget** (top of swipe-file page): edge function `content-lab-swipe-insights` runs Claude Haiku on the user's saved ideas (cached for 24h), returns 1-line summary like "60% transformations, 40% myth-busting". Stored in `content_lab_swipe_file_insights`.

**A2. Docx export**
- Use the docx skill (already available — node `docx` package).
- New edge function `content-lab-export-docx`: takes `run_id` OR `idea_ids[]`, returns signed Storage URL.
- Per-idea page: title → angle → 5 hook variants → TikTok script → IG script → FB script → caption variants → visual direction → benchmark thumbnails (downloaded inline) + URLs.
- Cover page uses org `logo_url`, `primary_color`, client name, month. White-label compliant.
- Triggered from: Run Detail "Export client brief" button, Swipe File bulk action, Pipeline board "Export run".

---

### Milestone B — Agency Mode + Client Share Links

**B1. Agency mode (multi-niche under one org)**
- Subscription tier `agency` already exists. Remove the 1-niche-per-tier check in `useContentLabAccess.ts` for agency tier; allow unlimited.
- **Niche switcher** in `AppSidebar` Content Lab section: Linear-style popover listing all org niches, grouped by client. Persists last-selected niche to `localStorage` per user.
- **Per-niche seat assignment** — new table `content_lab_niche_members (niche_id, user_id, role enum('viewer','editor'))`. Org owners assign; RLS gates write actions on niche/run/idea tables by checking membership when role differs from 'owner'.
- Shared credit pool: no change — already org-level.

**B2. Client read-only share links**
- New table `content_lab_run_share_tokens (id, run_id, slug, is_active, view_count, last_viewed_at, client_logo_url nullable, created_by, created_at, expires_at nullable)`.
- New public route `/share/content-lab/:slug` (no auth): renders read-only run summary — ideas, hooks, top benchmarks. No swipe-file, no regenerate, no admin.
- Header uses client_logo_url override if set, else org branding.
- New edge function `content-lab-share-view` records `view_count++` and `last_viewed_at` on each load.
- "Share with client" button on Run Detail page → dialog with slug + copy + view analytics ("Viewed 4 times").

---

### Milestone C — Monthly Digest Email + Internal Analytics

**C1. Monthly digest email**
- New edge function `content-lab-monthly-digest` (cron 1st of month 9am UK).
- For each active Content Lab user (has subscription, has at least 1 niche): pulls top 5 viral posts from their latest pool (highest `engagement_rate` from `content_lab_posts` where `bucket = 'benchmark'` in their niche).
- Resend template via existing `send-branded-email` infra. Subject: "This month's top 5 viral posts in {niche.label}". CTA → run page.
- Lapsed branch (no run in 30d): softer copy + mentions rolled-over credits.
- **Weekly swipe-file digest** (cron Mondays 9am UK): users with ≥3 saved-but-untouched ideas get nudge email "3 ideas you saved 2 weeks ago — need scripts?". Links straight into regen flow.

**C2. Internal analytics dashboard**
- New page `/admin/content-lab` — admin role-guarded (reuse `is_platform_admin`).
- Tabs: Revenue, Engagement, Churn signals, Pool quality.
- Metrics queries (read-only views in DB):
  - `v_content_lab_mrr_by_tier`: MRR by `org_subscriptions.content_lab_tier`.
  - `v_content_lab_arpu`: blended subscription + credit pack ARPU per org.
  - `v_content_lab_run_completion`: completion rate grouped by `niches.industry_slug`.
  - `v_content_lab_pool_quality`: % runs flagged "Limited" by vertical.
  - `v_content_lab_churn_signals`: orgs no run >21d, cancelled after one run, credit balance at cancellation.
  - `v_content_lab_regen_rate`: avg regens per idea per run (healthy 1–2).

---

### Milestone D — Error States + Performance Polish

**D1. Error states**
New shared component `<ContentLabEmptyState astronaut="..." title="..." subtitle="..." cta={...} />` reused for:
- Pool empty / building
- Run failed (with "Retry" CTA — auto-refunds credit via `content-lab-credit-ledger` insert with `delta = +1`)
- Payment failed (Stripe Customer Portal link via existing `customer-portal` function)
- 404 / niche deleted
- Network error fallback (wrap pages in section error boundaries)

Astronaut illustrations: reuse `public/mascot.svg` family — 5 variants (sad, building, broken, lost, offline). Need user to confirm if they want me to generate variants or use existing single mascot for all.

**D2. Performance polish**
- Skeleton loaders on Pool grid and Ideas grid (use existing `<Skeleton>` component).
- Lazy-load benchmark thumbnails: `loading="lazy"` + `IntersectionObserver` for first-paint cards.
- Edge function warmup: cron `content-lab-keepalive` every 5min between 8am-7pm UK, pings `discover/scrape/ideate` with `?warmup=1` (returns 200 immediately when flag present).
- TanStack Query `staleTime: 1h` on `useContentLabVerticals` (already done) and add same to `useContentLabNiches`.

---

### Files to add/change

**Frontend (new)**
- `src/pages/content-lab/SwipeFilePage.tsx`
- `src/pages/admin/AdminContentLabAnalytics.tsx`
- `src/pages/share/ContentLabRunShare.tsx` (public route)
- `src/components/content-lab/SwipeFileHeart.tsx`
- `src/components/content-lab/PatternInsightsWidget.tsx`
- `src/components/content-lab/NicheSwitcher.tsx`
- `src/components/content-lab/ContentLabEmptyState.tsx`
- `src/components/content-lab/ShareWithClientDialog.tsx`
- `src/hooks/useSwipeFile.ts`, `useNicheMembers.ts`, `useContentLabAnalytics.ts`

**Frontend (edit)**
- `src/components/content-lab/IdeaPipelineBoard.tsx` — heart icon
- `src/pages/content-lab/RunDetailPage.tsx` — heart, "Export brief" CTA, "Share with client" CTA, skeletons
- `src/components/layout/AppSidebar.tsx` — niche switcher slot
- `src/App.tsx` — new routes
- `src/hooks/useContentLabAccess.ts` — drop niche cap for agency tier

**Backend / edge functions (new)**
- `supabase/functions/content-lab-export-docx/index.ts` (uses `docx` npm via esm.sh)
- `supabase/functions/content-lab-swipe-insights/index.ts`
- `supabase/functions/content-lab-monthly-digest/index.ts`
- `supabase/functions/content-lab-weekly-swipe-digest/index.ts`
- `supabase/functions/content-lab-share-view/index.ts`
- `supabase/functions/content-lab-keepalive/index.ts`

**Database (one migration per milestone)**
- A: `content_lab_swipe_file`, `content_lab_swipe_file_insights`
- B: `content_lab_niche_members`, `content_lab_run_share_tokens`
- C: 6 read-only analytics views; 2 cron jobs (monthly digest, weekly swipe digest)
- D: 1 cron job (keepalive)

### Risks
- Docx generation in edge function: `docx` library is heavy (~2MB). May need to chunk benchmark thumbnail downloads to stay under 60s. Mitigation: render sequentially, cap benchmarks per idea at 3.
- Niche switcher UX: must not break existing `?tab=contentlab` deep links into a specific client. Mitigation: switcher only changes the *active niche within the current client*, not the client itself.
- Monthly digest at scale: pulling top 5 posts per active user × N users could time out. Mitigation: queue-based processing via `process-sync-queue` pattern, batch of 50 per cron tick.
- Public share route bypasses auth — must hard-enforce `is_active` and never expose `org_id`/internal IDs in payload.

### Open questions
1. **Astronaut illustrations** — generate 5 SVG variants for empty states, or reuse the single existing mascot for all? I'd recommend 5 variants for warmth.
2. **Swipe file scope** — saves attached to `org_id` (whole team can see) or `user_id` (personal)? You wrote "personal library" — confirming personal-only.
3. **Agency niche cap** — current Agency tier limit is what? Need to confirm before removing the cap so we don't break existing checks.

I'll wait for answers to those 3 before writing the migrations.

