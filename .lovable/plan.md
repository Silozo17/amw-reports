

## Plan: Content Lab UX overhaul + 5 fixes

### Issue 1 — Recent run shows no Your Content / Viral Feed (data bug)

`content_lab_posts.source` is being written as `'apify'` for every row (66/66 rows for the latest completed run). The Run Detail page filters `source === 'own'` and `source === 'benchmark' | 'competitor'` so both tabs render empty.

**Fix**: in `content-lab-scrape/index.ts`, set `source` correctly per row based on which list the handle came from (`own` / `benchmark` / `competitor`). Backfill existing completed runs by inferring from `author_handle` vs the niche's `own_handle` / `top_global_benchmarks` / `top_competitors`.

### Issue 2 — Pipeline cards not draggable

`@dnd-kit` `useDraggable` spreads `attributes` + `listeners` onto a `Card` that also has `onClick={onSelect}`. The click handler intercepts the pointer-down before drag activation, and the wrapping `<Card>` (which is a styled `div`) is fine, but the real problem is that `onClick` fires on every pointerup including drag end. Also `onSelect` was wired to a no-op, so the click does nothing AND blocks drag detection because of activation distance race.

**Fix**: split drag handle from click target. Make the card body draggable (no onClick), and add a small "open" affordance for selecting. Keep `activationConstraint.distance: 6` so a quick click doesn't start a drag.

### Issue 3 — Recent Runs grouped by client

Currently a flat list of last 20 runs. Group by client (via `runs[].client_id` → look up client name), collapsible per client, sorted by most-recent-run-per-client.

### Issue 4 — Tie ideas to actual report performance

Approved approach: **auto-suggest, user confirms.**

- Add columns to `content_lab_ideas`: `linked_post_id uuid` (nullable, references `content_lab_posts.id`), `linked_at timestamptz`, `actual_views int`, `actual_likes int`, `actual_comments int`, `actual_engagement_rate numeric`.
- New edge function `content-lab-link-suggest` runs after every scrape: for each idea with `status in ('filming','posted')` and no `linked_post_id`, fuzzy-match against own posts in the same niche scraped in the last 30 days using: caption similarity (token Jaccard) + hook similarity + posted-after-idea-creation date filter. Return top suggestion + score.
- New UI on idea card (in pipeline + ideas tabs): "Suggested match: [post thumbnail + caption]. Confirm / Reject / Pick another." Confirming writes `linked_post_id` and snapshots the metrics.
- Idea card then shows a small "Performance" strip: views, likes, engagement vs the niche benchmark median already computed on the report page.

This keeps the existing reporting pipeline untouched — we read from `content_lab_posts` (which is already scraped per run) rather than wiring into `monthly_snapshots`.

### Issue 5 — UI/UX overhaul + per-client Content Lab tab + sidebar restructure + entitlement gating

**Sidebar (`AppSidebar.tsx`)** — replace `NAV_ITEMS` with:
```
Dashboard, Clients, Content Lab, Content Pipeline, Ideas, Settings
```
Reports + Connections removed from sidebar (routes preserved per your answer). Platform Admin section unchanged.

**Two new pages**:
- `/content-pipeline` — aggregated Kanban across ALL ideas the org has, grouped by client (filter dropdown), reusing `IdeaPipelineBoard` with a flat `ideas[]` query joined to runs.
- `/ideas` — flat library view of every idea ever generated for the org, filterable by client / niche / platform / status, sortable by rating. Each row links to its run detail.

**Entitlement gating** for sidebar + per-client tab:
- Read `org_subscriptions.content_lab_tier` (already exists). If null → user never bought the add-on → hide Content Lab + Ideas + Content Pipeline from sidebar entirely.
- If non-null but currently `status != 'active'` → show **Content Pipeline only** (read-only). Hide Content Lab (no new runs) and Ideas (treated as a generation surface).
- If non-null and active → show all three.
- Hook: extend `useEntitlements` (or add `useContentLabAccess`) to expose `{ hasAccess: boolean, canGenerate: boolean }`.

**Per-client Content Lab tab** (`ClientDetail.tsx`): add a `Content Lab` tab next to `Upsells`. Visible only when `hasAccess`. Shows: niches scoped to that client, runs scoped to that client (using existing `useContentLabNiches(clientId)` and `useContentLabRuns(clientId)`), plus a mini pipeline. Reuses existing components — no new business logic.

**Content Lab page (`/content-lab`) UX polish**:
- Replace single "Latest Run" card + flat run list with: hero stats strip (runs this month, credits, next reset) + niches grid + Recent Runs grouped by client (collapsible accordions, max 5 runs visible per client by default).
- Add empty state guidance + a "How it works" 3-step strip at the top of the page (collapsible, dismissible per user via localStorage).
- Make niche cards show last-run status + last-run date inline.

### Files to change

Frontend:
- `src/components/layout/AppSidebar.tsx` — new NAV_ITEMS + entitlement gating
- `src/App.tsx` — add `/content-pipeline` and `/ideas` routes
- `src/pages/content-lab/ContentLabPage.tsx` — grouped runs, hero stats, polish
- `src/pages/content-lab/ContentPipelinePage.tsx` — NEW
- `src/pages/content-lab/IdeasLibraryPage.tsx` — NEW
- `src/pages/clients/ClientDetail.tsx` — add Content Lab tab (gated)
- `src/components/clients/tabs/ClientContentLabTab.tsx` — NEW
- `src/components/content-lab/IdeaPipelineBoard.tsx` — fix drag, add link-suggestion strip
- `src/components/content-lab/IdeaPerformanceStrip.tsx` — NEW (post-link metrics)
- `src/hooks/useContentLab.ts` — add `useAllIdeas`, `useGroupedRuns`
- `src/hooks/useContentLabAccess.ts` — NEW (entitlement helper)

Backend:
- `supabase/functions/content-lab-scrape/index.ts` — write correct `source` per row
- `supabase/functions/content-lab-link-suggest/index.ts` — NEW
- Migration: `content_lab_ideas` add `linked_post_id`, `linked_at`, `actual_views`, `actual_likes`, `actual_comments`, `actual_engagement_rate`

Data fix:
- One-off update on existing `content_lab_posts` rows where `source='apify'` to infer correct source from `author_handle` vs niche config — so the recent completed run immediately shows content.

### Risks / notes
- Removing Reports + Connections from sidebar means power users will need to bookmark `/reports` and `/connections`. Routes still work.
- Adding 6 columns to `content_lab_ideas` is additive, no migration risk.
- The auto-suggest matcher will get noisy if a client posts very similar content multiple times — that's why confirmation is required.
- Pipeline drag fix: switching off `onClick` on the card body means "open detail" needs a different control. We'll add a small chevron/ellipsis button on the card header that opens the idea (won't conflict with drag).

