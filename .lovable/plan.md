

# Full Platform Audit — AMW Reports

## Summary

The platform is well-architected for a multi-tenant SaaS reporting tool. RLS policies are comprehensive, edge functions verify ownership, and the separation of concerns is solid. However, there are several security gaps, reliability risks, code quality issues, and missing best practices that should be addressed.

---

## CRITICAL — Security Issues

### 1. OAuth tokens stored in plain text
`access_token` and `refresh_token` are stored as plain text in `platform_connections`. If the database is ever exposed, all connected accounts across all tenants are compromised.
- **Fix**: Encrypt tokens at rest using Supabase Vault or application-level AES-256 encryption in edge functions before storing, and decrypt on read.

### 2. Meta App ID hardcoded in edge functions
The Meta/Facebook App ID (`1473709394207184`) is hardcoded in `oauth-callback/index.ts`, `facebook-connect`, `instagram-connect`, and `meta-ads-connect`. This is a public-ish value but still poor practice — if it ever needs rotation, every file must be updated.
- **Fix**: Move to a secret (`META_APP_ID`) and reference via `Deno.env.get()`.

### 3. CORS allows all origins (`*`) on every edge function
All 44 edge functions set `Access-Control-Allow-Origin: "*"`. This means any website can make authenticated requests to your backend functions if it has a valid token.
- **Fix**: Restrict to your known domains (`amw-reports.lovable.app`, your custom domain, and the preview URL). Cron/webhook functions (no browser calls) don't need CORS at all.

### 4. No rate limiting on auth endpoints
The login form has no client-side throttling after failed attempts, and edge functions have no rate limiting. The `check-security-events` function detects brute force *after the fact* but doesn't prevent it.
- **Fix**: Add client-side cooldown after 5 failed attempts. Consider adding a `pg_net` based rate limiter or Cloudflare WAF rules.

### 5. Missing input validation on edge functions
Several edge functions (`portal-data`, `generate-report`, sync functions) accept `req.json()` without any schema validation. Malformed input could cause unexpected behavior.
- **Fix**: Add Zod validation to all edge function request bodies. The plan already has Zod available in the Deno runtime.

### 6. No password reset flow
The `Login.tsx` page has no "Forgot Password" link. The `LandingPage.tsx` login form also lacks it. Users have no self-service way to reset their password.
- **Fix**: Add forgot password flow with `supabase.auth.resetPasswordForEmail()` and a `/reset-password` page.

---

## HIGH — Reliability & Data Integrity

### 7. Duplicate org recovery logic (DRY violation)
The org-creation recovery code is duplicated verbatim in `OrgContext.tsx` (lines 80-151) and `Index.tsx` (lines 62-135). If one is updated and the other isn't, users could get inconsistent behavior.
- **Fix**: Extract into a shared `ensureOrgMembership()` utility in `src/lib/orgRecovery.ts`.

### 8. No ErrorBoundary anywhere in the app
Zero `ErrorBoundary` components found. An unhandled error in any component crashes the entire app with a white screen.
- **Fix**: Add a root-level `ErrorBoundary` in `App.tsx` wrapping `AppRoutes`, and page-level boundaries around client detail and dashboard.

### 9. Scheduled sync sequential processing with no timeout
`scheduled-sync/index.ts` processes all connections sequentially. If one sync hangs (e.g., a slow API), it blocks every subsequent connection. There's no per-sync timeout.
- **Fix**: Add `AbortController` with a 60-second timeout per sync invocation. Consider processing in parallel batches of 3-5 with `Promise.allSettled()`.

### 10. No foreign keys on major tables
The tables `clients`, `platform_connections`, `monthly_snapshots`, `reports`, `sync_logs`, and `email_logs` have NO foreign key constraints. Data integrity relies entirely on application logic — orphaned records can accumulate silently.
- **Fix**: Add FK references (`clients.org_id → organisations.id`, `platform_connections.client_id → clients.id`, etc.) with `ON DELETE CASCADE` where appropriate.

### 11. `reports` table upsert uses `onConflict` on non-unique columns
In `src/lib/reports.ts` line 22, the upsert uses `onConflict: 'client_id,report_month,report_year'` but there's no unique constraint on those columns, so this will silently insert duplicates.
- **Fix**: Add a unique index on `(client_id, report_month, report_year)` in the `reports` table.

---

## MEDIUM — Code Quality

### 12. 93 uses of `as any` in frontend code
Particularly concentrated in `ClientDetail.tsx` and `PlatformSection.tsx`. These bypass type safety and hide potential runtime errors.
- **Fix**: Define proper interfaces for all data shapes (e.g., `TopPost`, `FacebookPost` with reaction fields) and replace `as any` casts.

### 13. `Organisation` interface duplicated
The `Organisation` interface is defined identically in both `src/types/database.ts` and `src/contexts/OrgContext.tsx`.
- **Fix**: Export from `types/database.ts` only and import in `OrgContext.tsx`.

### 14. Large monolithic components
`Index.tsx` (500+ lines), `ClientDetail.tsx`, and `PlatformSection.tsx` are oversized. The dashboard page does data fetching, org recovery, onboarding checks, and complex rendering all in one component.
- **Fix**: Extract data-fetching into custom hooks (`useDashboardStats`), org recovery into a utility, and break down UI into smaller sub-components.

### 15. No React.StrictMode
`main.tsx` renders `<App />` directly without `<React.StrictMode>`, missing double-render detection for unsafe side effects during development.
- **Fix**: Wrap in `<React.StrictMode>` in `main.tsx`.

---

## LOW — Best Practices & Polish

### 16. No loading/empty/error states in some data views
Several pages fetch data but don't handle all three states consistently (loading skeleton, error message with retry, empty state with CTA).

### 17. Missing `<meta>` SEO tags on authenticated pages
Only `LandingPage` uses `usePageMeta`. Dashboard and client pages don't set page titles, making browser tab management difficult.
- **Fix**: Add `usePageMeta` to all authenticated pages with meaningful titles.

### 18. Google Fonts loaded via DOM manipulation
`ClientPortalAuth.tsx` injects `<link>` tags directly into `<head>` for Google Fonts. These are never cleaned up and accumulate on re-renders.
- **Fix**: Use a `useEffect` cleanup or a font-loading library, or deduplicate by checking if the link already exists.

### 19. No CSP (Content Security Policy) headers
The app doesn't set any CSP headers, leaving it vulnerable to XSS if any unsanitized content is ever rendered.
- **Fix**: Add CSP via `index.html` meta tag or edge function middleware.

### 20. `known_devices` table has no RLS policies
The table exists with RLS enabled but zero policies defined, meaning no authenticated user can read/write to it via the client SDK. It only works because edge functions use the service role key.
- **Fix**: This is actually correct for a service-role-only table, but should be documented. Alternatively, add explicit "deny all" policies for clarity.

---

## Implementation Priority

| Priority | Items | Effort |
|---|---|---|
| **P0 — Do Now** | #6 (password reset), #8 (ErrorBoundary), #11 (unique index) | 2-3 hours |
| **P1 — This Week** | #3 (CORS), #5 (input validation), #7 (DRY org recovery), #9 (sync timeout) | 4-6 hours |
| **P2 — This Sprint** | #1 (token encryption), #2 (Meta App ID), #10 (foreign keys), #12 (remove `as any`) | 6-8 hours |
| **P3 — Backlog** | #4 (rate limiting), #13-20 (code quality & polish) | Ongoing |

---

## What's Working Well

- RLS policies are comprehensive and correctly use `SECURITY DEFINER` helper functions
- Multi-tenant data isolation via `org_id` is consistent
- Edge functions verify org membership before processing
- Stripe webhook verifies signatures properly
- Auth state management follows best practices (listener before `getSession`)
- Token refresh logic (recently added) covers all platforms
- Security event detection (new device login, brute force) is well-implemented
- Client portal properly isolates data via `is_client_user()` function
- Subscription entitlements are enforced at both UI and query level

