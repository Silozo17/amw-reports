

# Add Metric Tooltips & Improve Hero KPI Consolidation

## What Changes

### 1. Add (i) tooltip to every metric across the dashboard

**`MetricTooltip.tsx`** already exists but uses a duplicate `METRIC_DESCRIPTIONS` dict. Consolidate to use `METRIC_EXPLANATIONS` from `src/types/metrics.ts` (which already has descriptions for all metrics). Remove the duplicate dict.

**`PlatformSection.tsx` → `MetricCard`** — Add `MetricTooltip` next to the metric label in every card. Show the (i) icon inline with the label text.

**`HeroKPIs.tsx` → `HeroKPICard`** — Add `MetricTooltip` next to the KPI label in the header row.

### 2. Consolidate MetricTooltip to use single source of truth

Update `MetricTooltip.tsx` to import and use `METRIC_EXPLANATIONS` from `@/types/metrics` instead of its own hardcoded `METRIC_DESCRIPTIONS`. Delete the duplicate dict.

### 3. Expand Hero KPIs with more cross-platform consolidated metrics

Currently the hero shows: Spend, Video Views, Reach, Clicks, Engagement, Followers, Sessions (conditionally). Add these consolidated cross-platform KPIs when data exists:

- **Conversions** — sum from google_ads + meta_ads
- **Page Views** — sum ga_page_views + page_views + gbp_views
- **Website Clicks** — sum website_clicks + gbp_website_clicks + link_clicks

Also add appropriate icons and METRIC_EXPLANATIONS entries for any missing consolidated descriptions (e.g. "Total Reach" explanation clarifying it combines reach, impressions, search impressions across platforms).

### 4. Add missing METRIC_EXPLANATIONS

Ensure every metric key that can appear on the dashboard has an entry in `METRIC_EXPLANATIONS`. Currently missing: `cpm`, `frequency`, `search_impression_share`, `website_clicks`, `email_contacts`, `media_count`, `reel_count`, `image_count`, `carousel_count`. Add them.

## Files to Modify

| File | Change |
|------|--------|
| `src/components/clients/MetricTooltip.tsx` | Remove duplicate dict, use `METRIC_EXPLANATIONS` |
| `src/components/clients/dashboard/PlatformSection.tsx` | Add `MetricTooltip` to `MetricCard` label row |
| `src/components/clients/dashboard/HeroKPIs.tsx` | Add `MetricTooltip` next to label |
| `src/types/metrics.ts` | Add missing metric explanations |
| `src/components/clients/ClientDashboard.tsx` | Add Conversions, Page Views, Website Clicks to hero KPIs |

## Technical Details

MetricCard label row changes from:
```tsx
<p className="text-[11px] ...truncate">{label}</p>
```
to:
```tsx
<div className="flex items-center gap-1">
  <p className="text-[11px] ...truncate">{label}</p>
  <MetricTooltip metricKey={metricKey} />
</div>
```

Same pattern for HeroKPICard — add `MetricTooltip` after the label span inside the icon+label row.

