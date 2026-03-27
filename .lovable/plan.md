

# Rewrite Client Portal to Reuse the Real Dashboard

## Problem
The current `ClientPortal.tsx` is a completely separate, simplified implementation with basic KPI cards and flat metric grids. It doesn't match the styled dashboard users see inside the platform (Hero KPIs with sparklines, Performance Overview charts, Platform Sections with trend data, etc.).

## Approach
Replace the custom portal rendering with the actual `ClientDashboard` component, feeding it data from the `portal-data` edge function. The portal will be view-only but fully interactive for month/platform selection.

## Changes

### 1. Make `ClientDashboard` work without auth (portal mode)

Currently `ClientDashboard` fetches its own data from Supabase using the authenticated client. For the portal, we need to pass pre-fetched data or let it fetch via the edge function.

**Best approach**: Add an optional `portalToken` prop to `ClientDashboard`. When present:
- Instead of querying Supabase tables directly, call the `portal-data` edge function with the token + selected period
- Hide admin-only features (AI Analysis button, sync status, metric config)
- Keep all interactivity: period selector, platform filter, charts, sparklines

This avoids duplicating the entire dashboard. The edge function already returns all needed data (snapshots, prevSnapshots, trendData, configs, connections).

### 2. Update `portal-data` edge function

The edge function currently only supports a single month. Update it to accept the same period parameters the dashboard uses (`type`, `month`, `year`, `startDate`, `endDate`) and return aggregated data accordingly — mirroring the logic in `ClientDashboard.fetchSnapshots`.

### 3. Rewrite `ClientPortal.tsx`

Strip it down to:
- Token validation via `portal-data` (initial call to get client + org info)
- Apply org branding (keep existing `applyBranding`)
- Render a portal header (org logo + client name)
- Render `<ClientDashboard clientId={...} clientName={...} currencyCode={...} portalToken={token} />`
- Footer with "Powered by {org.name}"

### 4. `ClientDashboard` changes (detail)

Add `portalToken?: string` prop. When set:
- Replace all `supabase.from(...)` queries in `fetchSnapshots` with a single `supabase.functions.invoke('portal-data', { body: { token, ...period } })`
- Map the response to the same state variables (snapshots, prevSnapshots, trendData, connections, platformConfigs)
- Hide: AI Analysis button, sync timestamps, any edit/config controls
- Keep: `DashboardHeader` (platform filter + period selector), `HeroKPIs`, `PerformanceOverview`, `PlatformSection`

## Files

| File | Change |
|---|---|
| `supabase/functions/portal-data/index.ts` | Support full period types (quarterly, ytd, custom, etc.) + return trend data properly |
| `src/components/clients/ClientDashboard.tsx` | Add `portalToken` prop; when set, fetch via edge function and hide admin controls |
| `src/pages/ClientPortal.tsx` | Rewrite to validate token, apply branding, render real `ClientDashboard` |

