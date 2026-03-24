

# Plan: Fix 5 Issues — Account Picker, Client Dashboard, Reports, Mobile

## Issue 1: Split Meta Account Picker Into Stages

**Problem**: When connecting Meta Ads, ad accounts and FB/IG pages are shown together in one confusing view.

**Solution**: Redesign `AccountPickerDialog.tsx` as a multi-step wizard for Meta:
- **Step 1**: Select the Meta Ads account from a list (radio-style, not dropdown)
- **Step 2**: Select the Facebook Page — with a note: "If an Instagram Business account is linked to this page, it will be connected automatically"
- **Step 3**: Confirmation summary showing what will be saved
- Other platforms (Google, TikTok, LinkedIn) keep single-step selection

**Files**: `src/components/clients/AccountPickerDialog.tsx` (rewrite)

## Issue 2: Bigger, Clearer Account Selection Dialog

**Problem**: Dialog is `max-w-md` (small) and hard to see.

**Solution**:
- Increase dialog to `max-w-lg` (or `max-w-xl` for Meta's multi-step)
- Use larger card-style items instead of tiny checkboxes
- Add platform icons, clearer typography, step indicators for Meta
- Add visual feedback (selected state with border highlight)

**Files**: `src/components/clients/AccountPickerDialog.tsx`

## Issue 3: Client Dashboard with Platform Data, Charts & AI Analysis

**Problem**: No per-client dashboard exists — `ClientDetail.tsx` overview tab only shows contact info and counts.

**Solution**: Create a rich dashboard tab in ClientDetail with:
- **Per-platform data cards** showing key metrics from `monthly_snapshots`
- **Pie charts** (using Recharts, already installed) for spend distribution, engagement breakdown
- **Bar/Line charts** for trends (MoM comparison)
- **Info tooltips** `(i)` on each metric explaining what it means
- **AI Analysis section**: Call a new `analyze-client` edge function that uses Lovable AI to summarize the client's current performance across all platforms
- Clearly separated sections per connected platform
- Beautiful design matching AMW brand colors

**New files**:
- `src/components/clients/ClientDashboard.tsx` — main dashboard component
- `src/components/clients/PlatformMetricsCard.tsx` — per-platform metric display
- `src/components/clients/MetricTooltip.tsx` — (i) helper component
- `supabase/functions/analyze-client/index.ts` — edge function calling Lovable AI

**Modified files**:
- `src/pages/clients/ClientDetail.tsx` — replace Overview tab content with dashboard

## Issue 4: Fix Report Generation (No Data)

**Problem**: Reports generate but contain no data. Root cause: the `generate-report` edge function uses the **wrong AI gateway URL** (`https://ai.lovable.dev/api/v1/chat/completions` instead of `https://ai.gateway.lovable.dev/v1/chat/completions`). This means AI calls silently fail and fall back to empty content. Additionally, if no `monthly_snapshots` exist (data hasn't been synced), the report will be empty regardless.

**Solution**:
- Fix the AI gateway URL in all 3 fetch calls in `generate-report/index.ts`
- Add better error logging when AI calls fail
- Add a pre-check: if no snapshots exist, return an error telling the user to sync data first instead of generating an empty PDF

**Files**: `supabase/functions/generate-report/index.ts`

## Issue 5: Mobile-Friendly Platform

**Problem**: Fixed sidebar layout breaks on mobile. No responsive design.

**Solution**:
- **AppLayout**: Add mobile hamburger menu — sidebar becomes a slide-out sheet on screens < 768px
- **AppSidebar**: Convert to responsive — full sidebar on desktop, sheet/drawer on mobile
- **ClientDetail**: Stack header buttons vertically on mobile, make tabs scrollable horizontally
- **Dashboard (Index)**: Grid already uses `md:grid-cols` so mostly works, but action buttons need wrapping
- **All pages**: Audit padding, button sizing, tab overflow for small screens
- Use the existing `useIsMobile` hook

**Modified files**:
- `src/components/layout/AppLayout.tsx` — add mobile sheet wrapper
- `src/components/layout/AppSidebar.tsx` — responsive sidebar with sheet on mobile
- `src/pages/clients/ClientDetail.tsx` — responsive header and tabs
- `src/pages/Index.tsx` — responsive tweaks
- `src/pages/clients/ClientList.tsx` — responsive table/cards
- Other page files as needed for padding/button adjustments

## Execution Order
1. Fix report generation (Issue 4) — smallest change, unblocks testing
2. Account picker redesign (Issues 1 & 2) — single component rewrite
3. Mobile responsiveness (Issue 5) — layout changes
4. Client dashboard (Issue 3) — largest feature, new components + edge function

