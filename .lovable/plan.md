

## Content Lab — Premium Redesign

Focused redesign of the Content Lab section only. Three goals: (1) make `/ideas` look like the premium run-detail Ideas tab, (2) deduplicate sub-pages so each has a clear job, (3) build a live-demo paywall using AMW Media's most recent run.

---

### 1. Information architecture (kill duplication)

Current state has overlap: the new-run hub (`/content-lab`) lists niches+runs, the client tab lists niches+runs again, every sub-page (Pipeline / Ideas / Trends / Hooks / Swipe File) repeats the same header pattern, and ideas exist in three different visual styles. We tighten roles:

| Page | Job | Becomes |
|---|---|---|
| `/content-lab` | New-run launchpad | Stays as the only place to create niches + start runs. Lists "Active runs" (in-progress only) and "Recent reports" (completed). |
| `/content-pipeline` | Kanban: drag ideas through script→posted | Unchanged behaviour, restyled header. |
| `/ideas` | Browse every idea ever generated | **Rebuilt** with phone-mockup preview cards (see §2). |
| `/content-lab/trends` | Cross-run trend signals | Unchanged. |
| `/content-lab/hooks` | Cross-run hook library | Unchanged. |
| `/content-lab/swipe-file` | Saved/favourited ideas | Restyled to match Ideas card style. |
| Client → Content Lab tab | Per-client view | **Stripped of duplication**: removes its own niche/run list (already on `/content-lab`). Becomes a focused single-client view: "Latest run summary + Top 6 ideas + Open full report". |
| Run detail `/content-lab/run/:id` | The full report (own/feed/ideas/pipeline/hooks tabs) | Header polish + nothing else. This is already the premium artefact. |

Every Content Lab page gets a shared `<ContentLabHeader>` component (eyebrow + title + subtitle + right-side actions slot) so they look like one product, not five.

---

### 2. The premium Idea card (used on `/ideas` AND swipe file)

Today's `/ideas` is a flat one-line table. New design = **the run-detail Ideas card, rebuilt as a reusable component** (`<IdeaCard variant="grid" | "stacked" />`).

Layout (per card, grid variant for `/ideas`, 320px wide):

```text
┌──────────────────────────────┐
│  [9:16 phone preview mockup] │  ← IdeaPreviewInstagram/TikTok/Facebook
│   • hook overlay             │     with functional ❤ 💬 ➤
│   • interactive icons        │
├──────────────────────────────┤
│  IDEA #03   ·  Reel · 30s    │  ← eyebrow row
│  Title in display font       │
│  Hook: "..." (1 line clamp)  │
│  ⭐ 8/10  ·  Status badge    │
│  Client · Niche              │
│  [Open report ➜]             │
└──────────────────────────────┘
```

- Click anywhere on the card → opens a Sheet drawer with the full idea detail (hook variants, body, CTA, why-it-works, hashtags, action buttons, performance strip — the same content that's on the run-detail page today, just lifted into a drawer for `/ideas`).
- Heart/comment/send remain functional inside the preview.
- Stacked variant (used inside run detail and the client tab Ideas section) keeps today's `260px_1fr` two-column layout for richer in-context reading.
- Single source of truth: extract `src/components/content-lab/IdeaCard.tsx` and `src/components/content-lab/IdeaDetailDrawer.tsx`. Replaces the bespoke list rows in `/ideas`, the duplicate cards in `ClientContentLabTab.tsx` `RunIdeasTab`, and the cards in the swipe file page (swipe file also gains the phone preview thumbnail — currently text-only).

`/ideas` page itself: keep the existing filter bar (search / client / platform / sort) — it works. Just swap the row list for `<IdeaCard variant="grid" />` in a 3-col responsive grid.

---

### 3. Premium polish (visual)

Applied across all 6 Content Lab pages and the run detail:

- **Page header pattern**: eyebrow (uppercase tracking-[0.3em] muted, with section icon) + display-font H1 + one-line subtitle + right-aligned action slot. This already exists on a few pages; standardise it via a shared `<ContentLabHeader>`.
- **Section dividers**: subtle `border-t border-border/40 pt-6` between major blocks instead of plain stacking — gives the report-like rhythm the run page already has.
- **Card hover state**: `transition-all duration-200 hover:border-primary/40 hover:shadow-lg hover:-translate-y-0.5` — currently only some cards have this, makes everything feel tactile.
- **Empty states**: every page already uses `EmptyStateMascot` — keep, but unify copy ("Nothing here yet" + 1-line action hint + primary CTA button). Currently inconsistent.
- **Sidebar Content Lab group**: keep collapsible, add a small Sparkles glow on the parent label when there's a run in progress (poll `content_lab_runs` for status in `[scraping, analysing, ideating]`). Subtle, premium-feeling.
- **Filter bar**: every page that has filters (Ideas / Trends / Hooks / Swipe File) currently has slightly different layouts. Unify to a shared `<ContentLabFilterBar>` — search left, filter selects right, all on one card with consistent spacing.

No font, palette, or theming changes — those are locked by project memory (Anton/Montserrat/Inter, dark theme).

---

### 4. The paywall — live AMW Media demo

When a user without `content_lab_tier` hits any Content Lab page, instead of today's tiny "Content Lab not enabled" card, they see a **full-page interactive demo** of AMW Media's most recent completed run, behind a soft locked overlay.

```text
┌─────────────────────────────────────────────────┐
│  [Hero strip — gradient bg]                     │
│  ✦ CONTENT LAB                                  │
│  Stop guessing what to post.                    │
│  See exactly what is working in your niche      │
│  and turn it into 12 ready-to-film ideas.       │
│  [▶ Start your trial — £X/mo]  [See pricing →] │
├─────────────────────────────────────────────────┤
│  Live preview · AMW Media's April 2026 run      │
│  ┌─────┬─────┬─────┬─────┬─────┐                │
│  │Tabs │Feed │Ideas│Hooks│Trnds│                │
│  └─────┴─────┴─────┴─────┴─────┘                │
│  [Renders the same components used in the real  │
│   run detail page, fed from get_shared_run()    │
│   with AMW's latest run id]                     │
│  ┊┊┊┊┊┊┊ subtle blur from row 4 down ┊┊┊┊┊┊┊   │
│         [🔒 Unlock — Start your trial]          │
├─────────────────────────────────────────────────┤
│  [Feature grid — 6 cards, each with icon + title│
│   + 1 sentence + tiny mockup screenshot:]       │
│   • Viral Feed scraping (own / benchmarks /     │
│     competitors, last 60d)                      │
│   • 12 ready-to-film ideas every month          │
│   • Hook Library with mechanism + why-it-works  │
│   • Live Trends with momentum + recommendations │
│   • Pipeline Kanban (script → posted)           │
│   • Swipe File (per-org saved ideas)            │
│   • Client portal sharing (DOCX export, run     │
│     share links, comments)                      │
│   • Wildcard 🚀 ideas + remix + regenerate      │
├─────────────────────────────────────────────────┤
│  How it works · Discover → Decode → Create      │
│  (3 cards, mirrors today's tutorial banner)     │
├─────────────────────────────────────────────────┤
│  [Pricing recap + final CTA]                    │
└─────────────────────────────────────────────────┘
```

Mechanics:

- **Demo source**: hardcoded constant `CONTENT_LAB_DEMO_RUN_ID` in `src/lib/contentLabDemo.ts`. I'll pre-resolve it server-side: query AMW Media's (`org_id = 319ab519-4f9a-470f-b9f7-9d98e90f6d2f`) most-recent completed run on first paywall load via a tiny new RPC `get_demo_content_lab_run()` so we don't hardcode a stale run id. Falls back to a static screenshot card if no run exists.
- **Auth**: paywall page is gated to authenticated users on a Free/Creator plan only — visible inside the app, never on the public marketing site. Reuses `useContentLabAccess()`.
- **Read-only enforcement**: the demo renders the existing `RunDetailPage` body components in a new `<DemoMode>` wrapper that disables all action buttons (regenerate, comment, share, save) and replaces them with onClick handlers that open the upgrade dialog.
- **Paywall trigger points**: any page in the Content Lab section + the client tab. Today they all show different stub screens (`Card p-10 text-center`); they all redirect to one component: `<ContentLabPaywall />`.

The paywall component is the deliverable that "explains every feature" — see §5 for its file.

---

### 5. Files

**New (5 files):**
```
src/components/content-lab/IdeaCard.tsx                  ← unified card (grid + stacked variants)
src/components/content-lab/IdeaDetailDrawer.tsx          ← Sheet with full idea details
src/components/content-lab/ContentLabHeader.tsx          ← shared page header
src/components/content-lab/ContentLabFilterBar.tsx       ← shared filter bar
src/components/content-lab/ContentLabPaywall.tsx         ← live AMW demo paywall
src/lib/contentLabDemo.ts                                ← demo run resolver + constants
supabase/migrations/<ts>_demo_run_rpc.sql                ← get_demo_content_lab_run() RPC
```

**Edited (8 files):**
```
src/pages/content-lab/IdeasLibraryPage.tsx     ← swap row list for <IdeaCard grid>
src/pages/content-lab/SwipeFilePage.tsx        ← use <IdeaCard grid>, add preview thumbnails
src/pages/content-lab/TrendsLibraryPage.tsx    ← use <ContentLabHeader> + <ContentLabFilterBar>
src/pages/content-lab/HookLibraryPage.tsx      ← same
src/pages/content-lab/ContentPipelinePage.tsx  ← same; replace stub paywall card
src/pages/content-lab/ContentLabPage.tsx       ← header polish; replace stub paywall card; tighten "Recent runs" section
src/pages/content-lab/RunDetailPage.tsx        ← extract idea card to use shared IdeaCard "stacked"
src/components/clients/tabs/ClientContentLabTab.tsx ← strip niche/run list (live in /content-lab); show latest-run summary + 6 idea cards via <IdeaCard grid>
src/components/layout/AppSidebar.tsx           ← live "run in progress" pulse on Content Lab parent
```

---

### 6. Risks

- **`<IdeaDetailDrawer>` duplicates the run-detail Ideas tab content**: I'll factor the shared body out as `<IdeaDetailBody />` so the run page and the drawer use the exact same component. No drift.
- **Live demo couples the paywall to AMW org existing**: handled via fallback (static screenshot card if `get_demo_content_lab_run()` returns null). The RPC is `SECURITY DEFINER` and only ever returns the AMW org's id-bound run, so no data leakage.
- **Client tab strip-down**: today the client tab lists this client's niches and runs. After cleanup it only shows the latest run summary + ideas. Anyone wanting the full niche/run picker per client uses `/content-lab` filtered by client. Flagging because someone might miss the in-tab run selector. Mitigation: keep the Run-picker dropdown in the tab header so clients with multiple runs can switch — just stop duplicating the niche table.
- **Existing `<ViralPostCard>`, `<HookLibrary>`, `<IdeaPipelineBoard>`** are not touched. Visual polish only.
- **No DB schema changes** beyond the one new read-only RPC.
- **Images/assets**: paywall uses the existing `mascot.svg` and the actual demo run's data — no new assets needed.

### Open questions
None. AMW org id confirmed (`319ab519-4f9a-470f-b9f7-9d98e90f6d2f`, 3 completed runs, latest 2026-04-20). Proceeding once approved.

