

# Full Platform Audit v3 — AMW Reports

## Audit Status vs Previous Rounds

### Previously Fixed ✅
- Login.tsx deleted (dead code)
- ErrorBoundary added
- Reports unique index added
- DRY org recovery extracted
- Sync timeouts + parallel batching
- Meta App ID moved to secret
- Password reset flow
- `usePageMeta` on all authenticated pages
- Logs.tsx properly typed (SyncLog, ReportLog, EmailLog)
- `hexToHsl` centralized in `colorUtils.ts`
- `TooltipProvider` moved to section level
- ClientDetail.tsx split (830 → 444 lines)
- OnboardingPage.tsx split (826 → 269 lines)
- ClientDashboard.tsx split (740 → 230 lines + 505-line hook)
- Dashboard queries consolidated (12 → 9)
- React.StrictMode enabled

---

## Remaining Issues Found

### 1. `hexToHsl` STILL duplicated in `ClientPortal.tsx`
Lines 28-45 contain an inline copy of `hexToHsl`. `ClientPortalAuth.tsx` and `BrandingProvider.tsx` correctly import from `colorUtils.ts`, but `ClientPortal.tsx` was missed.
- **Fix**: Replace inline function with `import { hexToHsl } from '@/lib/colorUtils'`.

### 2. Remaining `as any` casts — 33 instances in 6 files
Down from 93, but still present:
- `AccountSection.tsx` (1): `(profile as any)?.account_type`
- `Connections.tsx` (1): `data as any[]`
- `AdminOrgList.tsx` (1): `subRes.data as any`
- `AccountPickerDialog.tsx` (2): `metadata.pages as any[]`, `metadata.ig_accounts as any[]`
- `reports.ts` (1): `'pending' as any`
- `DebugConsole.tsx` (4): `(conn as any).token_expires_at` etc.
- **Fix**: Define proper types/interfaces for each; use Supabase generated types where available.

### 3. CORS `*` on ALL 44 edge functions — STILL OPEN (P1)
Every edge function still uses `"Access-Control-Allow-Origin": "*"`. This was flagged in audit v1 as P1 but not yet addressed.
- **Fix**: Create a shared `corsHeaders.ts` utility that restricts to known origins (`amw-reports.lovable.app`, preview URL, custom domains). Cron/webhook functions (no browser calls) should remove CORS entirely.

### 4. No foreign key constraints — STILL OPEN (P2)
All major tables (`clients`, `platform_connections`, `monthly_snapshots`, `reports`, `sync_logs`, `email_logs`) have zero FK constraints. Orphaned records can accumulate silently.
- **Fix**: Migration to add FKs with `ON DELETE CASCADE`.

### 5. `useClientDashboard.ts` is now 505 lines
The hook extraction moved data logic out of the component but created a new large file. It's a single hook, not a component, so splitting is lower priority, but it could benefit from extracting the `useMemo` blocks for KPIs and sparklines into separate helper functions.
- **Fix (optional)**: Extract `computeKpis()` and `computeSparklines()` into pure utility functions in a `src/lib/dashboardCalcs.ts` file.

### 6. `PlatformSection.tsx` is still 602 lines
Still the largest component. It's focused on a single concern (platform data display) but the Facebook top-content table rendering (lines 430-550) could be extracted.
- **Fix (optional)**: Extract `FacebookTopContent` sub-component.

### 7. No Zod validation on edge function inputs — STILL OPEN (P1)
Edge functions accept `req.json()` without schema validation. Malformed input could cause unexpected behavior or crashes.

### 8. OAuth tokens in plain text — STILL OPEN (P2)
`access_token` and `refresh_token` stored as plain text in `platform_connections`.

---

## Implementation Plan

| Priority | Task | Effort |
|---|---|---|
| **P0** | Fix `hexToHsl` duplication in `ClientPortal.tsx` | 2 min |
| **P0** | Remove remaining 10 `as any` casts (6 files) | 15 min |
| **P1** | Restrict CORS on all 44 edge functions | 45 min |
| **P1** | Add Zod validation to edge function inputs | 1-2 hrs |
| **P2** | Add FK constraints via migration | 30 min |
| **P2** | Extract KPI/sparkline calc helpers from `useClientDashboard` | 20 min |
| **P3** | Encrypt OAuth tokens at rest | 2-3 hrs |

---

## What's Working Well

- All monolithic components successfully split
- Type safety dramatically improved (93 → 33 `as any`, mostly in admin/debug code)
- Dashboard queries consolidated and efficient
- All pages have proper browser tab titles
- ErrorBoundary protecting against crashes
- Sync engine parallelized with timeouts
- Reports deduplication via unique index
- DRY utilities (`orgRecovery`, `colorUtils`)
- RLS comprehensive with SECURITY DEFINER helpers
- Multi-tenant isolation consistent
- Stripe webhook signature verification
- Client portal properly isolated

