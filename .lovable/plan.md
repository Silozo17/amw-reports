## Content Lab cleanup + Saves/Hooks/Trends + plan-aware header

### What you'll get
1. Sidebar cleanup — Content Pipeline removed from the global Content Lab section and moved into each client's tabs.
2. Three working global pages (currently dead links in the sidebar): **Trends**, **Hook Library**, **Saves** (renamed from Swipe File).
3. The ability to save trends, hooks (post hooks), and ideas from any run into those global libraries.
4. Header on every Content Lab page shows **Runs: X/Y** (using the org's plan limit), **Credits: N**, and a **Buy credits** button — side by side.
5. Verified refund of credits on failed runs (logic exists; we'll add a regression test/log line).

---

### 1. Sidebar cleanup
File: `src/components/layout/AppSidebar.tsx`

- Remove `/content-pipeline` and `/ideas` entries from `CONTENT_LAB_SUB_ITEMS`.
- Remove the `Soon` badge from Trends (we're building it).
- Rename `Swipe File` → `Saves`, route `/content-lab/swipe-file` → `/content-lab/saves`.
- Update `isContentLabRoute` matcher (drop `/content-pipeline` and `/ideas`).

Final Content Lab subnav:
- New Run · Trends · Hook Library · Saves

### 2. Move Content Pipeline into the client tab
- `ClientContentLabTab.tsx` already shows per-client runs. Add a small **"Pipeline"** sub-section at the top listing in-progress + recent runs as a kanban-style strip (Pending → Running → Completed → Failed). This replaces the deleted global `/content-pipeline` page.
- No new edge function needed — uses existing `useContentLabRuns(client.id)`.

### 3. New global pages — Trends, Hook Library, Saves

**New tables (one migration):**

```sql
-- Saved items (ideas, posts, hooks) per org
create table content_lab_saves (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  saved_by uuid,
  kind text not null check (kind in ('idea','post','hook')),
  source_run_id uuid,
  source_id uuid,            -- idea_id or post_id
  payload jsonb not null,    -- snapshot so deletes don't break Saves
  notes text,
  created_at timestamptz not null default now()
);

-- Hook library (global hooks extracted from posts, deduped per org)
create table content_lab_hooks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  hook_text text not null,
  hook_type text,
  source_post_id uuid,
  platform text,
  example_caption text,
  saved_by uuid,
  created_at timestamptz not null default now(),
  unique (org_id, hook_text)
);

-- Trends (recurring patterns / topics surfaced from runs)
create table content_lab_trends (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  label text not null,        -- e.g. "POV intro hooks", "before/after"
  description text,
  evidence jsonb not null default '[]'::jsonb,  -- array of post snapshots
  source_run_id uuid,
  saved_by uuid,
  created_at timestamptz not null default now()
);
```

RLS on all three: org members can manage; client users read-only (none for now).

**New pages:**
- `src/pages/content-lab/SavesPage.tsx` — grid of saved ideas/posts/hooks with filter chips and Delete.
- `src/pages/content-lab/HookLibraryPage.tsx` — list of hooks grouped by `hook_type`, with the source post linked.
- `src/pages/content-lab/TrendsPage.tsx` — list of trend cards (label, description, evidence thumbnails).

**New routes** in `src/App.tsx`:
- `/content-lab/saves` · `/content-lab/hooks` · `/content-lab/trends`

**Saving from a run** (`RunDetailPage.tsx`):
- Add a heart/bookmark button to each `IdeaCard` and each `PostGrid` card → calls a new `useSaveContentLabItem` hook that inserts into the right table.
- For posts, also add "Save hook" → inserts into `content_lab_hooks`.
- Trends are seeded automatically by the existing `content-lab-run` pipeline at the `analyse` phase: when patterns are detected we already write `pattern_tag` on posts. We'll add a small write-back step that upserts trends into `content_lab_trends` for the run's org.

### 4. Plan-aware header (Runs X/Y · Credits · Buy)
- New shared component `src/components/content-lab/UsageHeader.tsx`:
  - Reads `useContentLabUsage()` (already returns `runsThisMonth`, `runsLimit`, `creditBalance`).
  - Shows: `Runs: 1/10` (color: muted at <80%, amber ≥80%, destructive at limit), `Credits: 12`, `[Buy credits]` button.
- Replace the inline badge+button blocks in:
  - `ContentLabPage.tsx` (header actions slot)
  - `ClientContentLabTab.tsx` (top-right of the tab)
  - `RunDetailPage.tsx` (top header)
  - New Saves/Hooks/Trends pages
- The `runsLimit` already comes from `runLimitForTier()` — Starter 3, Growth 5, Scale 20. No backend change needed.

### 5. Failed-run credit refund
- Already implemented in `supabase/functions/content-lab-run/index.ts` at lines 622 and 708 via `refund_content_lab_credit` RPC.
- We'll add: structured log `{ event: "credit_refunded", run_id, ledger_id }` so the Debug Console can verify, and a unit-style assertion in the catch path (no silent failures).

---

### Out of scope (will not do unless you ask)
- Building a separate `/content-pipeline` global kanban — moved into client tab as you requested.
- Removing the existing run pipeline edge function — it's still needed to generate ideas.
- Deleting `IdeaPreviewFacebook/Instagram/TikTok` components — still used by ideas.

### Files touched
- `src/components/layout/AppSidebar.tsx` (subnav cleanup, rename)
- `src/components/clients/tabs/ClientContentLabTab.tsx` (pipeline strip + UsageHeader)
- `src/pages/content-lab/ContentLabPage.tsx` (UsageHeader)
- `src/pages/content-lab/RunDetailPage.tsx` (Save buttons + UsageHeader)
- `src/pages/content-lab/SavesPage.tsx` *(new)*
- `src/pages/content-lab/HookLibraryPage.tsx` *(new)*
- `src/pages/content-lab/TrendsPage.tsx` *(new)*
- `src/components/content-lab/UsageHeader.tsx` *(new)*
- `src/hooks/useContentLabSaves.ts` *(new)* — list/save/delete for all 3 collections
- `src/App.tsx` (3 new routes)
- `supabase/functions/content-lab-run/index.ts` (write trends after analyse, refund logging)
- 1 migration: `content_lab_saves`, `content_lab_hooks`, `content_lab_trends` + RLS