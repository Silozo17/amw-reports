

# Full Platform Audit v4 — AMW Reports

## Status vs Previous Rounds

### Fixed in v1-v3 ✅
- Login.tsx deleted, ErrorBoundary added, Reports unique index, DRY org recovery
- Sync timeouts + parallel batching, Meta App ID to secret, React.StrictMode
- ClientDetail split (830→444), OnboardingPage split (826→269), ClientDashboard split (740→230+hook)
- Dashboard queries consolidated (12→9), TooltipProvider lifted to section level
- `hexToHsl` centralized in `colorUtils.ts` — all 3 consumers import correctly
- All `as any` removed from frontend (`src/`) — 0 instances
- FK constraints added via migration (13 FKs with CASCADE)
- KPI/sparkline calcs extracted to `dashboardCalcs.ts`
- `usePageMeta` on all main authenticated pages + all public pages
- Logs.tsx properly typed (SyncLog, ReportLog, EmailLog)

---

## Remaining Issues

### 1. `as any` still in 7 edge functions — 12 instances (P1)
All frontend casts eliminated, but edge functions still have them:
- `check-expiring-tokens/index.ts` (4): `(conn as any).clients.org_id`, `(conn as any).clients.company_name`
- `scheduled-sync/index.ts` (4): same pattern — joined `clients` data accessed via `as any`
- `sync-facebook-page/index.ts` (1): `conn.metadata as any`
- `sync-instagram/index.ts` (1): `conn.metadata as any`
- `sync-linkedin/index.ts` (1): `conn.metadata as any`
- `stripe-webhook/index.ts` (1): `event.data.previous_attributes as any`
- **Fix**: Define typed interfaces for joined query results and metadata shapes in each function.

### 2. `useState<any>` in 2 files (P0)
- `DebugConsole.tsx`: `syncLogs: any[]`, `snapshots: any[]`
- `AdminOrgDetail.tsx`: `editMember: any`
- **Fix**: Define interfaces for each (DebugSyncLog, DebugSnapshot, OrgMember).

### 3. `catch (err: any)` in AdminUserList.tsx (P0)
Line 213 uses `catch (err: any)` — should use `catch (err: unknown)` with `instanceof Error` check.

### 4. Missing `usePageMeta` on 7 pages (P1)
- `ClientForm.tsx`, `ClientPortal.tsx`, `ClientPortalAuth.tsx`, `DebugConsole.tsx`, `OnboardingPage.tsx`, `ResetPassword.tsx`
- All 4 admin pages: `AdminDashboard`, `AdminOrgList`, `AdminOrgDetail`, `AdminUserList`, `AdminActivityLog`

### 5. CORS `*` on ALL 44 edge functions — STILL OPEN (P1)
Every edge function uses `"Access-Control-Allow-Origin": "*"`. This has been flagged since audit v1.
- **Fix**: Per Lovable's edge function docs, `Access-Control-Allow-Origin: *` is the **recommended default** for edge functions called by web apps. However, cron/webhook-only functions (no browser calls) should have CORS removed entirely since they're never called from a browser. These are: `check-expiring-tokens`, `check-report-reminders`, `check-security-events`, `check-subscription`, `monthly-digest`, `process-scheduled-deletions`, `scheduled-sync`, `stripe-webhook`.
- **Action**: Remove CORS headers from those 8 cron/webhook functions. Keep `*` on the remaining 36 browser-callable functions per Lovable docs.

### 6. AdminOrgDetail.tsx is 792 lines (P2)
The largest file in the codebase. It handles org overview, subscription management, member management, client listing, and connection listing — 5 distinct concerns.
- **Fix**: Extract into `AdminOrgOverview`, `AdminOrgSubscription`, `AdminOrgMembers`, `AdminOrgClients` sub-components.

### 7. AdminUserList.tsx is 599 lines (P2)
Handles user listing, editing, password reset, deactivation, and deletion.
- **Fix**: Extract edit/reset dialogs into sub-components.

### 8. No Zod validation on edge function inputs — STILL OPEN (P1)
Edge functions accept `req.json()` without schema validation.

### 9. OAuth tokens in plain text — STILL OPEN (P3)
Documented as future work.

---

## Implementation Plan

| Priority | Task | Effort |
|---|---|---|
| **P0** | Type `DebugConsole.tsx` state (`syncLogs`, `snapshots`) and `AdminOrgDetail.tsx` (`editMember`) — remove 3 `any` uses | 10 min |
| **P0** | Fix `catch (err: any)` → `catch (err: unknown)` in `AdminUserList.tsx` | 2 min |
| **P1** | Add `usePageMeta` to 11 missing pages | 15 min |
| **P1** | Type edge function joined queries — remove 12 `as any` casts across 7 functions | 30 min |
| **P1** | Remove CORS from 8 cron/webhook-only edge functions | 20 min |
| **P1** | Add Zod validation to critical edge function inputs (portal-data, generate-report, invite-client-user, admin-reset-password) | 1 hr |
| **P2** | Split `AdminOrgDetail.tsx` (792 lines) into 4 sub-components | 45 min |
| **P2** | Split `AdminUserList.tsx` (599 lines) — extract dialogs | 30 min |
| **P3** | Encrypt OAuth tokens at rest | 2-3 hrs |

---

## What's Working Well

- **Zero `as any` in frontend** — all 93 original casts eliminated
- All monolithic components split (ClientDetail, OnboardingPage, ClientDashboard)
- `hexToHsl` properly centralized — no duplicates
- Dashboard queries consolidated and efficient
- All main pages have proper browser tab titles
- ErrorBoundary protecting against crashes
- Sync engine parallelized with timeouts
- FK constraints now in place with CASCADE deletes
- KPI/sparkline calculations extracted to pure utility functions
- RLS comprehensive with SECURITY DEFINER helpers
- Multi-tenant isolation consistent via org_id
- Stripe webhook signature verification
- Client portal properly isolated
- Token auto-refresh implemented for all platforms

