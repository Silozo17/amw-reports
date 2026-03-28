

# Full Platform Audit v2 — AMW Reports

## File Size Analysis (Large Files)

| File | Lines | Verdict |
|---|---|---|
| `ClientDetail.tsx` | **830** | Monolithic — split required |
| `OnboardingPage.tsx` | **826** | Monolithic — split required |
| `ClientDashboard.tsx` | **740** | Monolithic — split recommended |
| `PlatformSection.tsx` | **594** | Large but focused — split optional |
| `Index.tsx` (Dashboard) | **447** | Acceptable but data-heavy |
| `ClientPortalAuth.tsx` | **395** | Acceptable |
| `Reports.tsx` | **386** | Acceptable |
| `HomePage.tsx` | **351** | Acceptable |
| `LandingPage.tsx` | **329** | Acceptable |
| `AppSidebar.tsx` | **303** | Acceptable |

---

## 1. Dead / Unused Code

### `src/pages/Login.tsx` — DEAD FILE
- 87 lines, **zero imports anywhere** in the codebase. The `/login` route uses `LandingPage.tsx` instead. Safe to delete entirely.

### `src/hooks/use-toast.ts` — likely unused
- shadcn ships both `use-toast.ts` and `components/ui/use-toast.ts`. Check if both are needed or if one is orphaned.

### `as any` casts — 93 instances across 8 files
- Most concentrated in `PlatformSection.tsx` (Facebook reaction fields: `reaction_like`, `reaction_love`, `is_promoted`, `views`, `clicks`). These should be typed on the `TopContentItem` interface which already exists but is incomplete.
- `Logs.tsx` uses `any[]` for all three log arrays instead of proper types.
- `Connections.tsx` casts query results to `any[]`.

---

## 2. Monolithic Components — Split Proposals

### `ClientDetail.tsx` (830 lines) → 4 files
Split into:
- **`ClientDetail.tsx`** — page shell, routing, state orchestration (~150 lines)
- **`ClientInfoTab.tsx`** — contact info, settings, currency/timezone (~200 lines)
- **`ClientConnectionsTab.tsx`** — connections list, add/remove, sync progress (~200 lines)
- **`ClientUsersTab.tsx`** — invite users, revoke access (~100 lines)

The dashboard and reports tabs are already extracted as `ClientDashboard` and `ClientReportsTab`.

### `OnboardingPage.tsx` (826 lines) → step components
Split each onboarding step into its own component:
- **`OnboardingPage.tsx`** — stepper state, navigation, submission (~150 lines)
- **`steps/AccountTypeStep.tsx`**, **`steps/CompanyStep.tsx`**, **`steps/PlatformsStep.tsx`**, etc.

### `ClientDashboard.tsx` (740 lines) → extract data hook
- **`useClientDashboard.ts`** — all data fetching, month navigation, AI analysis (~300 lines)
- **`ClientDashboard.tsx`** — rendering only (~440 lines)

---

## 3. Resource-Heavy Setups

### Dashboard page (`Index.tsx`) fires 12 parallel queries
Lines 92-115 fire **12 simultaneous Supabase queries** on every mount. Several are redundant:
- `clientsRes` and `allClientsRes` both query `clients` with the same filters — consolidate into one.
- `syncsRes` and `allSyncLogsRes` both query `sync_logs` for failed status — consolidate.
- `connectionsRes` and `allConnectionsRes` both query `platform_connections` — consolidate.

**Fix**: Reduce from 12 to ~7 queries by reusing result sets.

### `PlatformSection.tsx` creates a `TooltipProvider` per table row
Lines 469-488 wrap each Facebook post's reaction cell in its own `<TooltipProvider>`. This creates unnecessary React context nesting for 10+ rows.
**Fix**: Move `<TooltipProvider>` to the section level (one per platform card).

### No query caching on authenticated pages
All data fetching uses raw `useState` + `useEffect` instead of TanStack Query. This means:
- No automatic cache invalidation
- No background refetching
- No stale-while-revalidate
- Full re-fetch on every navigation

This is a systemic issue but too large to address in one pass. Flag for future migration.

---

## 4. Security Check (Post-P0/P1)

### Previously fixed ✅
- ErrorBoundary added
- Reports unique index added
- DRY org recovery
- Sync timeouts + batching
- Meta App ID moved to secret
- Password reset flow

### Still outstanding
- **OAuth tokens in plain text** (P2 — documented)
- **CORS `*` on edge functions** (P1 — not yet fixed)
- **No Zod validation on edge function inputs** (P1 — not yet fixed)
- **No client-side login throttling** (P3)
- **No FK constraints** (P2)

---

## 5. Code Quality Issues

### `hexToHsl` duplicated
The `hexToHsl` utility exists in both `ClientPortalAuth.tsx` (line 38) and likely `BrandingProvider.tsx`. Should be extracted to `src/lib/utils.ts`.

### Missing page titles on authenticated routes
`Index.tsx`, `ClientDetail.tsx`, `ClientList.tsx`, `Reports.tsx`, `Connections.tsx`, `Logs.tsx`, and `SettingsPage.tsx` don't call `usePageMeta`. Browser tabs show generic titles.

### `Logs.tsx` uses `any[]` for all state
```ts
const [syncLogs, setSyncLogs] = useState<any[]>([]);
const [reportLogs, setReportLogs] = useState<any[]>([]);
const [emailLogs, setEmailLogs] = useState<any[]>([]);
```
Should define `SyncLog`, `ReportLog`, `EmailLog` interfaces.

---

## Implementation Plan

| Priority | Task | Effort |
|---|---|---|
| **P0** | Delete `Login.tsx` (dead code) | 1 min |
| **P0** | Add missing fields to `TopContentItem` interface, remove ~30 `as any` casts in `PlatformSection.tsx` | 30 min |
| **P0** | Consolidate redundant dashboard queries (12 → 7) | 20 min |
| **P1** | Split `ClientDetail.tsx` into tab components | 45 min |
| **P1** | Split `OnboardingPage.tsx` into step components | 45 min |
| **P1** | Extract `useClientDashboard` hook from `ClientDashboard.tsx` | 30 min |
| **P1** | Add `usePageMeta` to all authenticated pages | 15 min |
| **P1** | Type `Logs.tsx` state properly, remove remaining `as any` | 20 min |
| **P2** | Extract `hexToHsl` to shared utility | 5 min |
| **P2** | Move `TooltipProvider` to section level in `PlatformSection` | 10 min |
| **P2** | CORS restriction on edge functions | 30 min |
| **P2** | Zod validation on edge function inputs | 1-2 hours |

---

## What's Working Well (Unchanged from v1)

- RLS policies comprehensive with SECURITY DEFINER helpers
- Multi-tenant isolation via org_id is consistent
- Edge functions verify org membership
- Stripe webhook signature verification
- Auth state management best practices
- Token refresh covers all platforms
- Client portal properly isolated
- Subscription entitlements enforced at UI + query level
- ErrorBoundary now in place
- Reports deduplication via unique index
- Parallel sync with timeouts

