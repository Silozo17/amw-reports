

## Backfill the global Hook Library + wire it into future runs

### Problem
The `/content-lab/hooks` page reads from `content_lab_hooks` via `get_global_hook_library()`. That table has **0 rows** — no edge function ever writes to it. Meanwhile we already have:
- **120 scraped posts** in `content_lab_posts` with extracted `hook_text` / `hook_type`
- **36 generated ideas** in `content_lab_ideas` with `hook` text (and 12 with `hook_variants`)

So the Hook Library has been empty for every user since launch, even though the raw material exists.

### Fix — two parts

**Part 1 — One-off backfill migration**

A SQL migration that inserts into `content_lab_hooks` from existing data, scoped to **completed runs only** (so partial/failed runs don't pollute the library):

1. **From scraped posts** — every `content_lab_posts` row where `hook_text IS NOT NULL AND hook_text <> ''`, joined to `content_lab_runs` where `status = 'completed'`. Mapped fields:
   - `hook_text` ← `posts.hook_text`
   - `mechanism` ← `posts.hook_type` (already in the same vocabulary: curiosity_gap / negative / etc.)
   - `why_it_works` ← `NULL` (analyse step didn't store this per post)
   - `source_post_id` ← `posts.id`
   - `engagement_score` ← `posts.engagement_rate`
   - `run_id` ← `posts.run_id`

2. **From generated ideas** — every `content_lab_ideas.hook` and every entry in `hook_variants` jsonb array, joined to completed runs. For the main `hook`:
   - `hook_text` ← `ideas.hook`
   - `mechanism` ← `'unknown'` (ideas don't store mechanism on the primary hook)
   - `why_it_works` ← `ideas.why_it_works`
   - `source_post_id` ← `NULL` (these are generated, not scraped)
   - `run_id` ← `ideas.run_id`
   
   For each `hook_variants` entry (jsonb array of `{text, mechanism, why}`):
   - `hook_text` ← `variant->>'text'`
   - `mechanism` ← `variant->>'mechanism'`
   - `why_it_works` ← `variant->>'why'`

3. **De-duplication** — a unique index on `(run_id, lower(hook_text))` is added before the insert, and the insert uses `ON CONFLICT DO NOTHING`. This makes the migration idempotent (safe to re-run) and prevents duplicates when the analyse step starts writing live.

Expected backfill volume from current data: ~120 hooks from posts + ~36 + ~24 from ideas = ~180 rows. Live data will grow naturally from there.

**Part 2 — Wire future runs to write hooks**

Add a hook-extraction write to `supabase/functions/content-lab-analyse/index.ts` so that every completed analyse step inserts any new `hook_text` it extracts from scraped posts into `content_lab_hooks`. Same `ON CONFLICT DO NOTHING` upsert pattern. This stops the library from being empty for any future run.

(The ideate step's `hook` and `hook_variants` are also written to `content_lab_hooks` at the same point so the library stays in sync with the ideas drawer.)

### Files

**New (1)**
- `supabase/migrations/<ts>_backfill_content_lab_hooks.sql` — adds the unique index, runs the two `INSERT ... SELECT ... ON CONFLICT DO NOTHING` statements

**Edited (1)**
- `supabase/functions/content-lab-analyse/index.ts` — after posts are scored, insert extracted hooks into `content_lab_hooks` (idempotent upsert keyed on `(run_id, lower(hook_text))`)

No frontend changes needed — `HookLibraryPage.tsx` and `get_global_hook_library()` already render the data correctly; they were just starved of input.

### Risks

- **Mechanism is `'unknown'` for the 36 idea-level primary hooks**, because that's all we have — the analyse step never tagged the mechanism on `ideas.hook` (only on `hook_variants`). Acceptable: they still appear in the library with the right `why_it_works` text and source author/views via the post (when available); the "All mechanisms" filter shows them.
- **Backfill counts views/engagement from the source post only when there is one** — the 36 ideas without `based_on_post_id` will have null source_views in the Hook Library card, same as the existing UI already handles.
- **Live hook extraction in the analyse step adds one DB write per scraped post**. Negligible (~30–60 inserts per run, single batched insert).

### After deploy
The library will go from 0 → ~180 hooks immediately, drawn from real AMW Media + any other live runs. Every future run adds more.

