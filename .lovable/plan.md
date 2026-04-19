

User wants observability for Content Lab inside the Platform Admin area. Let me check what admin debug surfaces already exist so I match the pattern.

Existing patterns I know from context:
- `src/pages/admin/AdminActivityLog.tsx` — platform-wide sync/report log viewer
- `src/pages/DebugConsole.tsx` — admin-only JSON inspection at `/debug`
- `src/components/layout/AppSidebar.tsx` — admin collapsible nav
- Tables: `content_lab_runs`, `content_lab_posts`, `content_lab_ideas`, `content_lab_niches`
- Edge functions: `content-lab-pipeline`, `content-lab-discover`, `content-lab-scrape`, `content-lab-analyse`, `content-lab-ideate`

Confirming scope before building. The pipeline writes status + `error_message` to `content_lab_runs`, but per-step logs only live in edge function logs. To make this debuggable end-to-end we need both: (a) a UI surface in admin, and (b) richer step-level persistence.

## Plan — Content Lab admin debug & logs

### What you'll get
A new admin page **`/admin/content-lab`** with three tabs:

1. **Runs** — every run across all orgs. Columns: org, client, niche, status, started, duration, post count, idea count, cost, error. Click a row to expand into a detail drawer showing:
   - Niche config snapshot (handles, competitors, benchmarks, preferences)
   - Per-step timeline (discover → scrape → analyse → ideate) with status, duration, error
   - Scraped posts grouped by bucket (own / competitor / benchmark) with counts per handle
   - Generated ideas grouped by platform
   - Raw JSON viewer (collapsed) for the full run row

2. **Step Logs** — chronological feed of per-step events from a new `content_lab_step_logs` table. Filter by run, status, step. Each row: timestamp, run, step name, status, duration ms, message, payload JSON.

3. **Niches** — every niche across all orgs with discovery status, last run, total runs, total cost.

### Data layer
New table `content_lab_step_logs`:
- `id`, `run_id`, `step` (discover|scrape|analyse|ideate), `status` (started|ok|failed), `started_at`, `completed_at`, `duration_ms`, `message`, `payload jsonb`, `error_message`
- RLS: platform admins read all; org members read their own runs' logs

Each edge function (`content-lab-pipeline`, `-scrape`, `-analyse`, `-ideate`, `-discover`) gets a small `logStep()` helper that writes start/end rows. Existing `console.log` JSON lines stay (for raw edge function logs).

### UI layer
- `src/pages/admin/AdminContentLab.tsx` — page shell + tabs
- `src/components/admin/contentLab/RunsTable.tsx` — runs list
- `src/components/admin/contentLab/RunDetailDrawer.tsx` — expand panel with timeline + posts + ideas
- `src/components/admin/contentLab/StepLogsTable.tsx` — step log feed
- `src/components/admin/contentLab/NichesTable.tsx` — niches overview
- `src/hooks/useAdminContentLab.ts` — TanStack Query hooks (runs, logs, niches, run detail)

### Sidebar
Add "Content Lab" entry under the existing admin collapsible in `AppSidebar.tsx`, pointing to `/admin/content-lab`. Route registered in `App.tsx` behind the platform-admin guard.

### Realtime (lightweight)
Subscribe to `content_lab_runs` and `content_lab_step_logs` on the admin page so a running pipeline updates live without refresh.

### Out of scope (ask if you want them)
- Re-run / cancel buttons (read-only console for now)
- Cost graphs / spend charts
- Exporting logs to CSV

### Build order
1. Migration: `content_lab_step_logs` + RLS
2. Add `logStep()` calls to the 5 edge functions
3. Hooks + page + 4 components
4. Sidebar link + route
5. Pause for you to test

Approve and I'll start with the migration.

