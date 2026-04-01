

# Hide Health Score from Portal & PDF Reports

## What This Does
Adds a toggle in the client settings (per-client) allowing org owners/managers to hide the Marketing Health Score from shareable portal links and PDF reports.

## Approach
Since the health score is a **per-client** feature (some clients may want it, others not), the toggle belongs on the `clients` table — not the org-level `report_settings`.

## Changes

### 1. Database Migration
Add a `show_health_score` boolean column to the `clients` table, defaulting to `true` (existing behaviour preserved).

```sql
ALTER TABLE public.clients ADD COLUMN show_health_score boolean NOT NULL DEFAULT true;
```

### 2. `src/components/clients/tabs/ClientSettingsTab.tsx`
Add a "Show Health Score" toggle in the report/display settings area, wired to `onSettingChange('show_health_score', value)`.

### 3. `src/components/clients/ClientDashboard.tsx`
- Accept a `showHealthScore` prop (derived from client data)
- Conditionally render `<HealthScore>` only when `showHealthScore` is true

### 4. `src/pages/ClientPortal.tsx` & `src/pages/clients/ClientDetail.tsx`
Pass `showHealthScore` from the client record through to `ClientDashboard`.

### 5. `supabase/functions/generate-report/index.ts`
The health score is **not currently rendered** in the PDF report, so no changes needed there right now. If/when it gets added to reports, it will respect this flag.

## Files Changed

| File | Change |
|---|---|
| Migration | Add `show_health_score` column to `clients` |
| `src/components/clients/tabs/ClientSettingsTab.tsx` | Add toggle |
| `src/components/clients/ClientDashboard.tsx` | Conditionally render HealthScore |
| `src/pages/ClientPortal.tsx` | Pass flag to dashboard |
| `src/pages/clients/ClientDetail.tsx` | Pass flag to dashboard |

