

# Multi-Select Platform Dropdown

## Problem
Platform selection is currently a row of buttons allowing only a single selection. User wants a dropdown that supports multi-select (e.g., YouTube + Facebook together), with "All Platforms" acting as a select-all toggle.

## Approach

### 1. Change `PlatformFilter` type from single to array
**File: `src/components/clients/DashboardHeader.tsx`**

- Change `PlatformFilter` from `'all' | PlatformType` to `PlatformType[] | 'all'`
- Replace the row of `<Button>` tabs with a multi-select `<Popover>` + checkbox list dropdown
- Each platform option shows its logo + label with a checkbox
- "All Platforms" is a special option at the top — selecting it clears individual selections; selecting any individual platform deselects "All"
- The trigger shows selected platform logos/names (or "All Platforms" label)

### 2. Update props and parent state
**File: `src/components/clients/ClientDashboard.tsx`**

- Change `selectedPlatform` state from `PlatformFilter` (single) to `PlatformType[] | 'all'`
- Update all filtering logic: replace `selectedPlatform === 'all'` checks with array-based checks (e.g., `selectedPlatform === 'all' || selectedPlatform.includes(platform)`)
- Update `useMemo` filters for `filtered`, `filteredPrev`, `filteredPosts`, `kpis`, `sparklineMap`, `trendChartData`, `geoData`, and the `buildWidgets` function

### 3. Dropdown UX details
- Trigger button shows: "All Platforms" or logos of selected platforms + count
- Clicking "All Platforms" selects all and disables individual checkboxes visually
- Clicking any individual platform while "All" is active switches to just that platform
- At least one option must always be selected (prevent empty state)

## Files Modified
1. `src/components/clients/DashboardHeader.tsx` — replace button row with multi-select dropdown, update types
2. `src/components/clients/ClientDashboard.tsx` — update state type and all platform filtering logic

