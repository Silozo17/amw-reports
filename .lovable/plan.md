

# Fix Client Settings Effectiveness + Add Email Preferences

## Problem Summary

1. **Client settings toggles don't affect reports**: The four client-level switches (`enable_mom_comparison`, `enable_yoy_comparison`, `enable_explanations`, `enable_upsell`) are saved to the database but the `generate-report` edge function completely ignores them. It always renders MoM comparison tables, AI explanations ("What This Means"), and the upsell section (when upsell data exists).

2. **Metrics defaults tab works partially**: The Settings > Metrics tab saves to `metric_defaults` correctly, and `MetricConfigPanel` reads from it. However, the `generate-report` function only reads `client_platform_config.enabled_metrics` — it does not fall back to `metric_defaults.default_metrics` when a client has no per-platform config. So the org-level defaults are only applied on the dashboard, not in reports.

3. **No email preferences per client**: There's no way to configure which email types go to clients vs the agency, or to opt clients in/out of specific email categories.

---

## Plan

### 1. Wire up client setting toggles in `generate-report` edge function

**File: `supabase/functions/generate-report/index.ts`**

The function already fetches the full `client` row (line 1067: `select("*")`), so all toggles are available. Add conditional logic:

- **`enable_mom_comparison`**: Guard the MoM comparison table rendering (~line 1735). When `client.enable_mom_comparison === false`, skip the comparison table section entirely.
- **`enable_yoy_comparison`**: Currently there's no YoY table in the report (only MoM). This toggle is a UI placeholder — leave as-is for now, but add a comment noting it's reserved for future YoY comparison support.
- **`enable_explanations`**: Guard the "What This Means For You" section (~line 1703). When `client.enable_explanations === false`, skip the AI summary text block.
- **`enable_upsell`**: Guard the upsell/agency note section (~line 1596 in ToC, ~line 1967 in rendering). When `client.enable_upsell === false`, skip the upsell page even if `upsellData` exists.

### 2. Wire up metric defaults fallback in `generate-report`

**File: `supabase/functions/generate-report/index.ts`**

Around line 1066, add a fetch for `metric_defaults`:
```
supabase.from("metric_defaults").select("*")
```

Then in the metric selection logic (~line 1218), when `config?.enabled_metrics` is empty, fall back to `metric_defaults` for that platform's `default_metrics` before falling back to the auto-detect logic (`cleanMetricsForDisplay`).

### 3. Add email preferences to the clients table

**Database migration** — add columns to `clients`:
```sql
ALTER TABLE public.clients
  ADD COLUMN email_report_delivery boolean NOT NULL DEFAULT true,
  ADD COLUMN email_weekly_update boolean NOT NULL DEFAULT false,
  ADD COLUMN email_monthly_digest boolean NOT NULL DEFAULT true,
  ADD COLUMN email_alert_warnings boolean NOT NULL DEFAULT true,
  ADD COLUMN email_recipient_mode text NOT NULL DEFAULT 'agency';
```

`email_recipient_mode` values: `'agency'` (emails go to org members), `'client'` (emails go to client recipients), `'both'`.

### 4. Add Email Preferences UI to ClientSettingsTab

**File: `src/components/clients/tabs/ClientSettingsTab.tsx`**

Add a new Card section "Email Preferences" with:
- **4 switches**: Report Delivery, Weekly Updates, Monthly Digest, Alert Warnings — each maps to the new boolean columns
- **1 select**: "Email Recipient" with options: Agency Only, Client Only, Both — maps to `email_recipient_mode`

All changes use the existing `onSettingChange` callback which already does generic `supabase.update`.

### 5. Update Client type

**File: `src/types/database.ts`**

Add the new fields to the `Client` interface so TypeScript knows about them.

---

## Files Changed

| File | Change |
|---|---|
| `supabase/functions/generate-report/index.ts` | Respect 4 client toggles + metric_defaults fallback |
| `src/components/clients/tabs/ClientSettingsTab.tsx` | Add Email Preferences card |
| `src/types/database.ts` | Add email preference fields to Client type |
| Database migration | Add 5 new columns to `clients` table |

