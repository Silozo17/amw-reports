## What we're building

Two focused changes to make Content Lab much easier to use from inside a client:

1. **Smart competitor picker** in client Settings tab — search Google to find competitors by name, or paste a URL. Each pick is added to a chip list (one by one).
2. **In-client Content Lab tab** becomes the full launchpad — shows the data the run will use, lets you launch a run inline, surfaces missing inputs, and shows progress/history without bouncing to the global page.

Plus a couple of quality-of-life nudges so non-technical users always know what to do next.

---

## 1. Competitors → searchable, structured list

Today `clients.competitors` is a single free-text string ("A, B, C"). It works but gives the AI fuzzy matches and no website signal.

**Behaviour**
- New `CompetitorPicker` component (used in `ClientSettingsTab` and the new client form):
  - Search box → calls existing `google-places-lookup` edge function (already wired to Google Places API, returns name + address + website).
  - Results show as a dropdown: name, address, website. Click → adds to the list below.
  - Alternative input: "Add by URL" — paste any website, validated client-side, added as `{ name: <hostname>, website: <url> }`.
  - List below shows each competitor as a removable chip with name + small website link.
  - Reorder not needed for v1.

**Storage** (no schema change — keep it simple, low risk)
- Continue using the existing `clients.competitors` text column.
- Store as **newline-separated `Name | https://website`** entries (e.g. `Joe's Garage | https://joesgarage.co.uk`).
- Parser/serialiser lives in `src/lib/competitors.ts` so both the picker and the edge functions can read it consistently.
- Backwards compatible: existing comma-separated strings parse as name-only entries.

**Edge function update**
- `content-lab-run` (orchestrator) and `content-lab-discover-competitors` already read `client_snapshot.competitors`. Update the snapshot builder to also pass a parsed `competitors_list: [{name, website}]` so AI prompts can use the websites directly.

---

## 2. Client → Content Lab tab becomes the full launchpad

Today the tab is a thin teaser ("Open Content Lab"). We'll inline the whole flow scoped to this one client.

**New layout for `ClientContentLabTab`** (replaces current file):

1. **Header** — "Content Lab for {company}" + credits badge + "Buy credits" link.
2. **Readiness card** — a checklist of inputs the run will use, pulled from the client record:
   - Industry ✓/✗
   - Location ✓/✗
   - Social handles (Instagram / TikTok / Facebook) — count connected
   - Competitors — count in the new list
   - Brand voice ✓/✗
   - Each missing item links to the Settings tab with the relevant field focused.
3. **"What this run will do" summary** — short bullets reflecting actual values: "We'll scan @handle's last 30 days, pull posts from N competitors, find viral content in {industry} worldwide, then draft 30 ideas."
4. **Generate button** — calls `content-lab-run` directly (same call as the global page). Confirmation dialog warns about credit cost. Disabled with a helpful tooltip when no credits / no industry / no competitors.
5. **Progress strip** — if the latest run is `pending`/`running`, show the live phase from `content_lab_run_progress` (reuse polling logic from `RunDetailPage`).
6. **History list** — all previous runs for this client with status + open button.

**Reuse, don't duplicate**
- Extract the run-trigger + confirmation dialog from `ContentLabPage` into `useStartContentLabRun` hook + `<StartRunDialog />` so both pages share one implementation.
- Extract the live-progress polling from `RunDetailPage` into `useRunProgress(runId)` hook.

---

## 3. Easy-to-use nudges (small)

- **Empty competitors warning** in the readiness card: "Add 3-5 competitors for sharper local research" with a one-click jump to Settings.
- **Industry/Location auto-suggest**: when the user picks a Google Places result for the *client itself* (already supported in `ClientForm`), pre-fill `location` from the result's city if currently empty.
- **Tab badge**: show a small dot on the "Content Lab" client tab when a run is `running` so the user can see progress while on other tabs.

---

## Technical details

**New files**
- `src/lib/competitors.ts` — `parseCompetitors(str): {name, website?}[]` and `serializeCompetitors(arr): string`.
- `src/components/clients/CompetitorPicker.tsx` — search + URL input + chip list.
- `src/hooks/useStartContentLabRun.ts` — wraps the `content-lab-run` invoke + toast + invalidations.
- `src/hooks/useRunProgress.ts` — polls `content_lab_run_progress` every 4s.
- `src/components/content-lab/StartRunDialog.tsx` — shared confirmation dialog.
- `src/components/content-lab/RunReadinessCard.tsx` — checklist + "what will run" summary.

**Edited files**
- `src/components/clients/tabs/ClientSettingsTab.tsx` — replace competitors `<Input>` with `<CompetitorPicker>`.
- `src/pages/clients/ClientForm.tsx` — same swap in new-client form.
- `src/components/clients/tabs/ClientContentLabTab.tsx` — full rewrite to the launchpad layout above.
- `src/pages/content-lab/ContentLabPage.tsx` — refactor to use the new shared hook + dialog (no behaviour change).
- `src/pages/content-lab/RunDetailPage.tsx` — refactor to use `useRunProgress`.
- `supabase/functions/content-lab-run/index.ts` — extend `client_snapshot` with `competitors_list` (parsed).

**No DB migration needed.** `clients.competitors` stays as TEXT, with a documented format. If we later want first-class structure, that's a follow-up.

**No new secrets needed.** `GOOGLE_API_KEY` already exists and `google-places-lookup` is already deployed.

---

## Out of scope (flag for follow-up)

- Promoting `competitors` to a real `client_competitors` table — only worth doing if we start storing extra fields per competitor (notes, priority).
- Automatically discovering competitor social handles from a website URL — possible via Firecrawl but adds cost; ask before adding.
- Editing the run's input data inline from the Content Lab tab — current plan is "view here, edit in Settings". Confirm if you'd rather edit in place.