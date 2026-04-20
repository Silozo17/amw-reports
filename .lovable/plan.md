

## Two changes — Global Hook Library + Premium Swipe File detail

### 1. Make Hook Library a global, ranked, growing library

**Current:** `/content-lab/hooks` only shows hooks from the current org's runs.

**New:** All hooks from all completed runs across the entire app, ranked by real engagement, filterable by niche, mechanism, and platform.

#### Backend

New SQL migration adds a `SECURITY DEFINER` view + RPC that any authenticated user can read, joining hooks → source post (for engagement & platform) → run → niche. Privacy-safe: returns only the hook text, mechanism, why-it-works, niche label, platform, anonymised author handle (the source post's `author_handle`, which is already the public scraped creator handle, never your own org data), and computed performance score. **Never exposes** which org the hook belongs to, client names, or run ids belonging to other orgs.

```sql
CREATE OR REPLACE FUNCTION public.get_global_hook_library(
  _niche text DEFAULT NULL,
  _platform text DEFAULT NULL,
  _mechanism text DEFAULT NULL,
  _limit int DEFAULT 200
) RETURNS TABLE (
  id uuid,
  hook_text text,
  mechanism text,
  why_it_works text,
  niche_label text,
  platform text,
  author_handle text,
  source_views int,
  source_engagement_rate numeric,
  performance_score numeric,
  created_at timestamptz
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT h.id, h.hook_text, h.mechanism, h.why_it_works,
         n.label, p.platform::text, p.author_handle,
         p.views, p.engagement_rate,
         -- composite: log-views * (1 + engagement_rate)
         ROUND((LN(GREATEST(p.views, 1)) * (1 + COALESCE(p.engagement_rate, 0)))::numeric, 2),
         h.created_at
  FROM content_lab_hooks h
  JOIN content_lab_runs r ON r.id = h.run_id AND r.status = 'complete'
  LEFT JOIN content_lab_posts p ON p.id = h.source_post_id
  LEFT JOIN content_lab_niches n ON n.id = r.niche_id
  WHERE h.hook_text IS NOT NULL
    AND (_niche IS NULL OR n.label ILIKE _niche)
    AND (_platform IS NULL OR p.platform::text = _platform)
    AND (_mechanism IS NULL OR h.mechanism = _mechanism)
  ORDER BY 10 DESC NULLS LAST
  LIMIT _limit;
$$;
GRANT EXECUTE ON FUNCTION public.get_global_hook_library(text,text,text,int) TO authenticated;
```

Why an RPC and not a view + RLS: the existing `content_lab_hooks` RLS restricts rows to your own org. Loosening RLS is risky (could leak `run_id` references). An RPC bypasses RLS in a tightly controlled way and only returns whitelisted columns.

#### Frontend (`HookLibraryPage.tsx`)

Rewritten to call the RPC. New filters above the grid:
- **Search** (existing)
- **Niche** (populated from RPC results)
- **Platform** — Instagram / TikTok / Facebook / LinkedIn / Threads / YouTube
- **Mechanism** — Curiosity gap / Negative / Social proof / Contrarian / Pattern interrupt / Stat shock / Question / Story open
- **Sort** — Top performing (default) / Newest / Most engagement

Each hook card now shows:
- Hook text (display font)
- Performance rank badge ("#1", "#2", … top 50 only) + small flame icon for top decile
- Niche · Platform · Mechanism badges
- Why-it-works snippet
- "From @handle · 1.2M views · 8.4% ER" attribution line
- Copy button (existing pattern from `HookLibrary.tsx`) — copies hook text to clipboard

Removed: "View source run" link (other orgs' runs are private).

Empty state copy updated: "No hooks match these filters yet — try a broader niche or platform."

Header subtitle updated to: *"Every hook from every Content Lab run across the platform — ranked by real-world engagement. Filter by niche, platform or mechanism."*

#### Risks
- **Cross-org data exposure**: mitigated by whitelisted columns in the RPC. We expose hook copy patterns + the *public* author handle that was scraped (not the org that scraped it). No client names, no org ids, no run ids.
- **Free-tier abuse**: the page is still gated behind `useContentLabAccess()`, so only paying users see it.
- **Performance**: the join across 3 tables ordered by computed score is fine at current scale; if the table grows past ~100k rows we add an index on `(run_id, source_post_id)` and a materialised view. Not needed yet.

---

### 2. Swipe File card → opens full phone-mockup detail

**Current:** Swipe file already uses `<IdeaCard variant="grid" />` which DOES show the phone mockup preview thumbnail. Clicking it opens `IdeaDetailDrawer`, which is a text-only Sheet (no phone mockup).

**New:** Replace the text-only drawer with the **same phone-mockup + full details** layout used on the run-detail page (the `<IdeaCard variant="stacked">`).

#### Approach

`IdeaDetailDrawer.tsx` is rewritten to fetch the idea's full data (it already does — includes `hook_variants`, `body`, `cta`, `hashtags`, `filming_checklist`, etc.) PLUS the parent run's `client_id` and `niche_id` (one extra select), then render `<IdeaCard variant="stacked">` inside a wider Sheet (`sm:max-w-3xl` instead of `sm:max-w-xl` so the 260px phone preview + content fits comfortably).

This means the swipe file (and `/ideas` page) opens the **exact same premium card** users see on the run page — phone mockup on the left, hook variants / script / CTA / why-it-works / filming checklist / actions / performance strip on the right. Single source of truth: `IdeaCard` is the only place idea visuals live.

The existing `Section`, `IdeaActionButtons`, `IdeaPerformanceStrip` imports are removed from the drawer (now provided by `IdeaCard` stacked variant).

#### Risks
- **Drawer width**: `sm:max-w-3xl` (~768px) is wide but still fits comfortably on tablets up. On mobile it's full-width as before.
- **Stacked variant inside a drawer**: the `md:grid-cols-[260px_1fr]` collapses to single column below `md` — works fine in a narrower drawer too.

---

### Files

**New**
- `supabase/migrations/<ts>_global_hook_library_rpc.sql` — RPC above

**Edited**
- `src/pages/content-lab/HookLibraryPage.tsx` — call RPC, add Platform + Mechanism + Sort filters, redesign cards (rank, copy button, source attribution)
- `src/components/content-lab/IdeaDetailDrawer.tsx` — replace text layout with `<IdeaCard variant="stacked">`, widen sheet

No other files change.

### Open questions
None. AMW hook data confirmed in the table (94 hooks across 3 runs from inspection). Proceeding once approved.

