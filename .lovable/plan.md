
Immediate diagnosis

- The white-screen root cause is now clear: the app is still trying to load `src/hooks/useOrg.ts`, but that file was renamed to `useOrg.tsx`. Browser logs show a direct `404` for that path, so the app bootstrap breaks before any page renders.
- There is also a second frontend bug waiting behind it: `SettingsPage` uses `grid-cols-${tabs.length}`, which Tailwind will not generate reliably. That can break the settings layout even after the app loads.

Implementation plan

1. Stabilize the app boot path first
- Restore `src/hooks/useOrg.ts` as the stable import path.
- Move the actual provider implementation into a dedicated context file, e.g. `src/contexts/OrgContext.tsx`.
- Re-export `useOrg` and `OrgProvider` from `src/hooks/useOrg.ts` so existing imports keep working and future refactors do not blank the app again.
- Replace the dynamic tab grid class in `SettingsPage` with a fixed mapping for 1–5 tabs.

2. Clean up org-state architecture
- Keep a single shared `OrgProvider` as the only source of truth for:
  - active org
  - active org role
  - memberships
  - org loading state
- Make `switchOrg` an async action that:
  - updates the selected org immediately
  - fetches the next org record
  - refreshes org-scoped server state after switching
- Remove duplicated “recover/create org” logic from route/page components. Org creation should happen in backend onboarding/auth flows, not from random page loads.

3. Fix org switching so it updates instantly everywhere
- After `switchOrg`, invalidate/refetch all org-scoped queries:
  - entitlements
  - clients
  - reports
  - connections
  - logs
  - settings/org data
- Ensure pages that still use manual `useEffect + useState` fetches respond cleanly to `orgId` changes.
- Keep `localStorage` only as a remembered preference, never as the source of authorization.

4. Fix remaining multi-tenant data bugs
- `useEntitlements` currently counts connected platforms without filtering to the active org. This makes plan usage and upgrade prompts wrong for multi-org users.
- `OrganisationSection` fetches `profiles` too broadly, which can expose unrelated member data across orgs.
- Audit all org-scoped reads and make them explicitly filter by the selected org, even when backend rules allow multiple memberships.
- Keep the rule: backend access decides what a user may access; frontend org filters decide which current workspace they are viewing.

5. Fix branding so it actually reflects inside the platform
- Update `BrandingProvider` so it fully resets to default tokens before applying the selected org’s theme.
- Apply branding tokens consistently to:
  - primary/ring
  - sidebar tokens
  - accent/success helpers
  - font variables
- Make branding updates reflect immediately after save by updating/refetching org context once, not waiting for a refresh.
- Keep public marketing pages on the product brand unless you explicitly want white-labeling to affect public routes too.

6. Tighten user access and team-management logic
- Stop relying on `profiles.org_id` as a primary multi-org signal. A user can belong to multiple orgs, so a single `org_id` on profiles is a legacy shortcut and causes logic drift.
- For team/member views, derive membership from `org_members`, then fetch only the minimal profile fields needed for those users.
- Keep org permissions in `org_members`; keep platform-level roles separate.
- Verify owner/manager gating uses current org context everywhere, not global “first membership” assumptions.

7. Fix backend policy mismatches found in the audit
- `metric_defaults` is not tenant-safe right now:
  - the table has no `org_id`
  - any org owner can manage all rows
- Proper fix: make metric defaults org-scoped (recommended), or explicitly convert them to platform-admin-only global defaults. Because this UI lives in org settings, org-scoped is the better fit.
- Review `profiles` access so team pages do not depend on broad profile reads.
- Enable leaked-password protection in auth settings.

8. Add guardrails so the product fails safely, not as a white page
- Add a top-level error boundary for the authenticated app shell.
- Show a visible fallback panel with a retry action instead of a blank screen if a runtime error slips through.
- Add defensive loading/empty/error states to org-dependent pages.

Files likely touched
- `src/hooks/useOrg.ts`
- `src/contexts/OrgContext.tsx` (new)
- `src/App.tsx`
- `src/pages/SettingsPage.tsx`
- `src/components/BrandingProvider.tsx`
- `src/hooks/useEntitlements.ts`
- `src/components/settings/OrganisationSection.tsx`
- `src/pages/Index.tsx`
- `src/pages/Connections.tsx`
- `src/pages/Reports.tsx`
- `src/pages/Logs.tsx`
- optional: app-level error boundary files

Recommended rollout order
1. Restore stable `useOrg` import path and fix the white screen.
2. Fix `SettingsPage` tab class bug.
3. Refactor org-switch invalidation/refetch flow.
4. Fix entitlements and team/profile data isolation.
5. Fix branding token application.
6. Harden policies and cleanup legacy org/profile assumptions.
7. Run full QA across public pages, auth, dashboard, settings, org switching, invites, owner/manager access, and branding updates.

Expected outcome
- No more blank pages.
- Org switching updates instantly without refresh.
- Counts, billing limits, branding, and permissions follow the selected org correctly.
- Team/member data is safer and better isolated.
- The product becomes more robust instead of relying on fragile client-side recovery logic.
