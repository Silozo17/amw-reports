

## Plan: Add "Performance by Post" Table to Dashboard

### What we're building
A table similar to DashThis (from your screenshot) showing all published posts for the selected period with their image thumbnail, caption text, engagement, impressions, reach, and engagement rate — sorted by engagement descending.

### Changes

#### 1. `src/components/clients/ClientDashboard.tsx` — Fetch `top_content` + render table

**Data fetching:**
- Add `top_content` to the snapshot select query (line 319): `"platform, metrics_data, top_content, report_month, report_year"`
- Update `SnapshotData` interface to include `top_content`
- Collect all posts from `top_content` across filtered snapshots into a single array, sorted by `total_engagement` descending

**New section** (inserted after Performance Trend, before Audience Map ~line 1120):
- Section header: "Performance by Post" with description "How each piece of content performed this period"
- A responsive table with columns:
  - **Post With Image** — thumbnail (48x48 rounded) + truncated message text (max 2 lines)
  - **Engagement** — likes + comments + shares total
  - **Post Impressions** — reach value
  - **Total Post Reach** — reach value  
  - **Post Engagement Rate** — calculated as `(total_engagement / reach) * 100`
- Each row links to the original post via `permalink_url` (opens in new tab)
- Show platform badge/icon per post if multiple platforms have content
- Empty state when no posts available

**Multi-month aggregation:**
- When viewing quarterly/YTD/custom ranges, concatenate all `top_content` arrays across the matching snapshots (no deduplication needed since each month has different posts)

#### 2. Import additions
- Import `Table, TableHeader, TableBody, TableRow, TableHead, TableCell` from `@/components/ui/table`
- Import `ExternalLink, FileText` from lucide-react

### Files to modify
1. `src/components/clients/ClientDashboard.tsx`

