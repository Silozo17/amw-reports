

# Improve Page Readability: Orange Pills + Alternating Dark/Light Sections

## Two Problems

1. **Purple metric pills** (`bg-primary/10 text-primary`) are nearly invisible on the dark `bg-amw-black` background
2. **All sections look the same** — monotone dark creates visual fatigue and makes content hard to scan

## Solution

### 1. Change Metric Pills to Orange on Dark Backgrounds

Replace all instances of `bg-primary/10 text-primary` on metric pill/badge spans with `bg-amw-orange/15 text-amw-orange` across all marketing pages. This applies to the metric tags inside platform cards (e.g., "Search Clicks", "Sessions", "Spend" etc.).

Also update the platform strip tags (e.g., "Google Ads", "Meta Ads") which currently use `bg-sidebar-accent/40 border border-sidebar-border/50 text-amw-offwhite/70` — these are fine as-is since they're neutral, but the metric-specific pills need the orange treatment.

### 2. Alternate Dark/Light Sections

Introduce alternating section backgrounds across all pages. Every other section gets a slightly lighter background to create visual rhythm:

- **Dark sections** (default): no extra class — inherits `bg-amw-black` from the page
- **Light sections**: add `bg-[hsl(340_7%_18%)]` (a slightly lighter shade of the dark theme, matching `--sidebar-accent`) — this creates a subtle but noticeable contrast band

Pattern per page: Hero (dark) → next section (light) → next (dark) → next (light) → etc.

The light sections replace the current `border-t border-sidebar-border/30` dividers with the background contrast itself, making dividers optional but still kept for extra definition.

## Files to Modify

| File | Changes |
|---|---|
| `src/pages/HomePage.tsx` | Orange pills on metric tags; alternate `bg-sidebar-accent/30` on even sections |
| `src/pages/FeaturesPage.tsx` | Orange pills on platform metric badges; alternate light sections |
| `src/pages/SeoReportingPage.tsx` | Orange pills; alternate light sections |
| `src/pages/SocialMediaReportingPage.tsx` | Orange pills; alternate light sections |
| `src/pages/PpcReportingPage.tsx` | Orange pills; alternate light sections |
| `src/pages/WhiteLabelReportsPage.tsx` | Alternate light sections |
| `src/pages/ForAgenciesPage.tsx` | Orange pills on platform strip; alternate light sections |
| `src/pages/ForFreelancersPage.tsx` | Alternate light sections |
| `src/pages/ForSmbsPage.tsx` | Orange pills on platform strip; alternate light sections |
| `src/pages/ForCreatorsPage.tsx` | Alternate light sections |

## Specific Changes

### Pill colour change (all pages)
```
// Before
bg-primary/10 text-primary

// After
bg-amw-orange/15 text-amw-orange
```

### Alternating section backgrounds
Every other `<section>` gets an additional class to create the light band:
```
// Light band section
className="py-20 lg:py-28 bg-white/[0.03] border-t border-sidebar-border/30"
```
This `bg-white/[0.03]` is extremely subtle on dark backgrounds — enough to break the monotony without looking jarring. Combined with the existing border-t dividers, it creates clear content zones.

### Implementation order
1. All 10 pages updated in parallel — pill colour swap is a simple find-replace, section backgrounds are added to alternating sections

