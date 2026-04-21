

## Responsive defects — surgical fix list

You're right to push back. The previous "responsive passes" left specific, observable bugs. Here is a **defect-by-defect** list with the actual file, the actual cause, and the actual one-line fix. No abstractions.

### Root cause #1 — the breakpoint that caused most of what you see in the screenshot

`src/hooks/use-mobile.tsx` says `MOBILE_BREAKPOINT = 768`. So at exactly **768–1023px (iPad portrait, every iPad in landscape with the chat panel open, every laptop split-screen)** the **fixed 256px sidebar is shown** and your content gets ~512px. That is why niche cards squeeze, titles stack one-word-per-line, badges overflow, dashboards feel cramped.

**Fix:** raise to `1024`. One-line change. The hamburger sheet now appears up to (and including) iPad portrait. Affects `AppLayout` and `AdminLayout` simultaneously (both already use this hook).

### Root cause #2 — niche card layout (your screenshot)

`src/pages/content-lab/ContentLabPage.tsx` line 233 uses `sm:grid-cols-2 lg:grid-cols-3`. Combined with the sidebar above, each card became ~250px → "Global Athletic Apparel & Footwear" + "Building benchmarks · 0" badge cannot fit on one row.

**Fixes (same file + `BenchmarkQualityBadge.tsx`):**
- Niche grid → `grid-cols-1 md:grid-cols-2 xl:grid-cols-3` (was `sm:` / `lg:`).
- `NicheCard` title row: add `min-w-0`, give the `<h3>` `break-words`, and give the badge wrapper `shrink-0`.
- `BenchmarkQualityBadge`: add `whitespace-nowrap` so "Building benchmarks · 0" never line-breaks.
- "Latest Run" card title `<h2>` already has `truncate` + `min-w-0` — no change needed.

### Root cause #3 — recurring overflow patterns elsewhere

| Surface | File | Bug | Fix |
|---|---|---|---|
| Settings tabs | `src/pages/SettingsPage.tsx` | `max-w-4xl` wrapper missing `space-y-6` outer padding wrapper; tab labels OK. | Wrap content in `mx-auto w-full max-w-4xl` (currently no `mx-auto` so it hugs the left). |
| Client detail | `src/pages/clients/ClientDetail.tsx` | Tabs row has many tabs, can overflow at <900px. | Wrap `TabsList` in `overflow-x-auto whitespace-nowrap`. |
| Client form | `src/pages/clients/ClientForm.tsx` | Multi-column field grids without `grid-cols-1` base on the long form. | Audit each `grid` block and ensure `grid-cols-1 md:grid-cols-2`. |
| Client dashboard skeleton + KPIs | `src/components/clients/ClientDashboard.tsx` line 36 + `HeroKPIs.tsx` | Skeleton is `grid-cols-2 lg:grid-cols-4` (no breakpoint for <360 phones) | Change to `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`. |
| Dashboard header | `src/components/clients/DashboardHeader.tsx` | Period + platform pickers can horizontally overflow at <500px. | Stack with `flex-col sm:flex-row` and `w-full sm:w-auto` on triggers. |
| Geo heatmap | `src/components/clients/dashboard/GeoHeatmap.tsx` | `<Table>` not wrapped → horizontal overflow on phones. | Wrap with `<div className="overflow-x-auto">`. |
| Reset password | `src/pages/ResetPassword.tsx` | Card has no max-width + page padding for phones. | Wrap with `min-h-screen flex items-center justify-center p-4`, `max-w-md w-full`. |
| Landing/auth | `src/pages/LandingPage.tsx` | Forms inside `LandingHero` may overflow at 320px. Verify and add `w-full max-w-sm mx-auto px-4`. |
| Admin sidebar | `src/components/admin/AdminLayout.tsx` | Already uses `useIsMobile`. Auto-fixed by Root cause #1. | – |

### Files that will change

1. `src/hooks/use-mobile.tsx` — raise breakpoint to 1024.
2. `src/components/content-lab/ContentLabHeader.tsx` — already done previous turn, leave as-is.
3. `src/pages/content-lab/ContentLabPage.tsx` — niche grid + card title row.
4. `src/components/content-lab/BenchmarkQualityBadge.tsx` — `whitespace-nowrap`.
5. `src/pages/SettingsPage.tsx` — `mx-auto` on the max-w-4xl wrapper.
6. `src/pages/clients/ClientDetail.tsx` — tabs overflow + header stacking audit.
7. `src/pages/clients/ClientForm.tsx` — field-grid mobile-first audit.
8. `src/components/clients/ClientDashboard.tsx` — skeleton grid base column.
9. `src/components/clients/DashboardHeader.tsx` — pickers stack on mobile.
10. `src/components/clients/dashboard/GeoHeatmap.tsx` — table wrapper.
11. `src/components/clients/dashboard/HeroKPIs.tsx` — verify base column count and tile sizing at 320px.
12. `src/pages/ResetPassword.tsx` — auth card centering.
13. `src/pages/LandingPage.tsx` — auth form widths at 320px.

### Verification (after the fixes)

I'll re-screenshot the same routes at 320, 375, 414, 768, 820, 1024, 1280px and inspect each:
- `/content-lab` (your screenshot)
- `/content-lab/niche/new`, `/content-lab/run/:id`, `/content-pipeline`, `/ideas`, `/content-lab/swipe-file`, `/content-lab/hooks`
- `/dashboard`, `/clients`, `/clients/:id` (every tab)
- `/connections`, `/reports`, `/logs`, `/settings` (every tab)
- `/onboarding`, `/reset-password`
- `/admin`, `/admin/organisations/:id`, `/admin/users`, `/admin/content-lab`, `/admin/security`, `/admin/activity`, `/debug`

I'll mark each one with a one-line verdict (clean / list defects) and only call done when every route is clean at every width.

### Out of scope

No copy, no design changes, no DB or auth changes, no edge functions. Desktop ≥1280px stays pixel-identical.

