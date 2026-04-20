

## Content Lab — round 3 fixes

### Issues to fix

**1 & 2. "Building benchmarks · 0" + benchmark median 0**
Two separate causes, both symptoms of the same root issue:
- `RunDetailPage` header counts `posts.filter(p => p.bucket === 'benchmark')`, but legacy rows have `bucket = null` (only `source` is set). New scrapes set `bucket`, old ones don't.
- Benchmark median is computed from `posts.filter(p => p.bucket === 'benchmark').map(p => p.views)` → empty array → median 0.

**Fix:** in `RunDetailPage`, derive bucket with a fallback chain: `p.bucket ?? (p.source === 'benchmark' || p.source === 'competitor' ? 'benchmark' : p.source === 'own' ? 'own' : null)`. Backfill `bucket` column on existing rows via one-off SQL using the same logic against the niche's `own_handle` / `top_global_benchmarks` / `top_competitors`.

**3. Pipeline drag still broken**
Current `IdeaPipelineBoard` uses `useDraggable` on the whole card with a separate "Open" button. The `activationConstraint` is on `useSensor(PointerSensor)` but the sensors aren't actually wired into a `DndContext` properly — and columns use `useDroppable` but the `onDragEnd` handler doesn't account for dropping on empty columns.

**Fix:** rewrite with `@dnd-kit/core`'s `DndContext` + sortable kit, give each column a stable droppable id (`status:not_started`, `status:scripted`, etc.), and on `onDragEnd` parse the over.id to extract target status. Add visible drag handle (grip icon) on card to make it obvious. Keep "Open" button separate.

**4. AI memory loop — performance feeds back into next ideation**
When an idea is linked to a real post (via auto-suggest or manual), we already snapshot `actual_views`, `actual_likes`, `actual_engagement_rate`. We need to feed this into future runs:
- New table `content_lab_idea_performance_history` (or reuse linked ideas) — already covered by the `linked_post_id` columns added last round.
- In `content-lab-ideate`, before generating, fetch the niche's last N linked ideas + their actual performance, group by hook pattern / format / topic, and inject into the prompt as: `"These ideas worked: [hook A] (12k views, 8% ER). These flopped: [hook B] (200 views, 0.5% ER). Lean into what worked, avoid what flopped."`
- Each successive monthly run gets smarter automatically.

**5. 10 benchmark-driven + 2 wildcard ideas**
Currently `content-lab-ideate` generates N ideas all from benchmark patterns. Split the prompt:
- Generate 10 ideas grounded in the benchmark posts + own performance history.
- Generate 2 "wildcard" ideas explicitly tagged as `is_wildcard = true` — instruct the model to propose untested formats/angles nobody in the niche is doing yet, designed to set a new trend.
- Add `is_wildcard boolean default false` column to `content_lab_ideas`. Show a small "Wildcard 🚀" badge in the UI on those cards.

**6. Stay-in-tab navigation for client Content Lab tab**
Currently `ClientContentLabTab` shows runs as cards that, on click, navigate to `/content-lab/run/:id` (the global page). User wants to stay inside `/clients/:id?tab=contentlab` and see content/viral feed/ideas/pipeline/hook library inline.

**Fix:** refactor `ClientContentLabTab` into an inner-tabbed view:
```
[Niches & Runs] [Your Content] [Viral Feed] [Ideas] [Pipeline] [Hook Library]
```
Each inner tab queries scoped to `clientId` only (no run navigation). When a user picks a specific run from the niches list, it sets local state `selectedRunId` and the other 5 tabs reflect that run's data. No route change.

**7. Redesign + cleanup**
- **Run naming:** rename run titles from "Untitled run · {date}" to `{ClientName} · {Month YYYY}` with a 1-line auto-generated description (e.g., "12 ideas across Instagram + TikTok, 3 wildcards"). Stored as `summary.display_name` + `summary.description` on existing `content_lab_runs.summary` jsonb (no schema change).
- **Group by client** in the global Content Lab page (already partially done — extend with the new naming).
- **"How it works" inline guide** on first visit (already exists, polish copy).
- **Cleanup:** delete all `content_lab_runs` where `status = 'failed'` OR (`status = 'pending'` AND `created_at < now() - interval '24 hours'`) OR (no ideas + no posts). Cascade deletes step_logs.

### Files to change

**Frontend**
- `src/components/content-lab/IdeaPipelineBoard.tsx` — rewrite drag with proper DndContext + droppable columns + visible grip handle
- `src/pages/content-lab/RunDetailPage.tsx` — bucket fallback derivation; show wildcard badge
- `src/components/clients/tabs/ClientContentLabTab.tsx` — convert to inner-tabbed surface (no navigation away)
- `src/pages/content-lab/ContentLabPage.tsx` — use new run naming `{client} · {month}` + description line
- `src/components/content-lab/IdeaCard` (inline in board) — wildcard badge

**Backend**
- `supabase/functions/content-lab-ideate/index.ts` — split into 10 grounded + 2 wildcard; inject performance history from prior linked ideas
- `supabase/functions/content-lab-pipeline/index.ts` — write `summary.display_name` + `summary.description` on completion

**Database (migration)**
- Add `is_wildcard boolean default false` to `content_lab_ideas`
- Backfill `content_lab_posts.bucket` from `source` + niche handles for legacy rows
- Cleanup query: delete failed runs, stale pending runs, and empty runs

### Open questions
None — proceeding on approval.

### Risks
- Pipeline drag rewrite touches a working-but-broken component; will keep the existing API (`onSelect`, `runId`, `ideas[]`) so callers don't change.
- AI memory feed only kicks in once users start linking posts — first run after deploy still works the old way.
- Wildcard ideas may feel "off-brand" — that's the point, but we'll flag them clearly so users know to expect it.

