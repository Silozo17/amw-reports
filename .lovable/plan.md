

## Plan: Multi-Tenant SaaS — Organisations, Signup, and Landing Page

This is the biggest architectural change to date. The platform moves from a single-tenant internal tool to a multi-tenant SaaS where each organisation is fully isolated.

---

### Summary

**What changes:**
- New `organisations` table — every data table gets an `org_id` column
- All RLS policies rewritten to scope data by organisation
- New public landing page with 50/50 split-screen login/signup
- Signup flow: OTP email verification, then organisation creation (company name, user details)
- Organisation members can invite staff
- Existing users (info@amwmedia.co.uk, test@test.com) keep their data — migrated to an auto-created organisation

**What stays the same:**
- All existing features (clients, connections, reports, syncing) work identically — just scoped per org

---

### Phase 1: Database Migration (single large migration)

**New table: `organisations`**
```
id, name, slug, logo_url, primary_color, created_by, created_at, updated_at
```

**New table: `org_members`** (replaces current `user_roles` for org-scoped access)
```
id, org_id, user_id, role (owner/manager), invited_email, invited_at, accepted_at, created_at
```

**Add `org_id` column to ALL data tables:**
- `clients` — add `org_id UUID NOT NULL` (with default for migration)
- `client_recipients` — inherits org scope via client
- `client_platform_config` — inherits via client
- `platform_connections` — inherits via client
- `monthly_snapshots` — inherits via client
- `reports` — add `org_id UUID NOT NULL`
- `sync_logs` — add `org_id UUID NOT NULL`
- `report_logs` — add `org_id UUID NOT NULL`
- `email_logs` — add `org_id UUID NOT NULL`
- `metric_defaults` — add `org_id UUID` (nullable — platform-global defaults stay null, org-specific overrides have org_id)
- `profiles` — add `org_id UUID` (current active org)

**Data migration for existing users:**
- Create an organisation "AMW Media" owned by info@amwmedia.co.uk
- Set `org_id` on all existing rows to this organisation
- Move existing `user_roles` entries to `org_members`

**RLS policy rewrite — ALL tables:**
Replace every `USING (true)` with org-scoped checks using a helper function:

```sql
CREATE OR REPLACE FUNCTION public.user_org_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT org_id FROM public.org_members
  WHERE user_id = _user_id LIMIT 1
$$;
```

Example new policy for `clients`:
```sql
CREATE POLICY "Users can view own org clients"
ON public.clients FOR SELECT TO authenticated
USING (org_id = public.user_org_id(auth.uid()));
```

**Update `handle_new_user()` trigger:**
- Still creates profile
- No longer auto-assigns owner role (that happens during org creation)

**Storage policies:** Scope report bucket access by org membership.

---

### Phase 2: Landing Page & Auth Flow

**New page: `/` (public landing page)**
- 50/50 split screen design
- Left side: Hero content — app name, tagline ("Automated Marketing Reports for Agencies"), feature bullets (multi-platform analytics, white-label reports, client management), social proof/gradient background
- Right side: Login form (default) with toggle to Sign Up form
- No navigation bar, no sidebar — clean standalone page

**Sign Up form fields:**
- First Name, Last Name
- Email
- Phone
- Password + Confirm Password
- Company/Organisation Name
- Submit → sends OTP verification email

**OTP Verification:**
- After signup, show OTP input screen (6-digit code)
- Uses Supabase `signUp` with email confirmation enabled
- User enters the code from their email to verify
- On verification, redirect to onboarding/dashboard

**Post-verification: Organisation creation**
- `handle_new_user()` trigger creates profile
- After first login, if user has no org membership → create org from signup metadata (company name)
- Insert into `organisations` and `org_members` with role `owner`

**Route restructure:**
- `/` → Landing page (public) — login/signup
- `/dashboard` → Main dashboard (protected, was previously `/`)
- All other routes stay the same but protected

---

### Phase 3: Frontend — Org Context

**New hook: `useOrg()`**
- Fetches current user's org from `org_members` join `organisations`
- Provides `org`, `orgId`, `orgRole` to all components
- Used in place of current `isOwner` checks (now checks `orgRole === 'owner'`)

**Update `useAuth` hook:**
- Add `org` and `orgRole` to context
- Remove global `isOwner` — replace with org-scoped role

**Update all data-fetching queries:**
- Currently queries like `supabase.from('clients').select('*')` return everything
- RLS handles scoping now, so queries don't need `.eq('org_id', ...)` — RLS does it automatically
- But the `org_id` must be included in all INSERT operations

**Update `ClientForm.tsx`:** Include `org_id` in client creation insert.

**Update `SettingsPage.tsx`:**
- Team management now shows/manages `org_members` instead of `user_roles`
- Invite staff: enter email → insert into `org_members` with `invited_email`, no `user_id` yet
- When invited user signs up with that email, link them to the org automatically

**Update `AppSidebar.tsx`:**
- Show org name and logo instead of hardcoded "AMW"
- White-label ready — org's branding used throughout

---

### Phase 4: Edge Functions Update

All edge functions that create records need to include `org_id`:
- `generate-report` — include org_id when inserting reports
- `send-report-email` — include org_id in email_logs
- All sync functions — include org_id in sync_logs and monthly_snapshots
- `oauth-callback` — include org_id in platform_connections

These functions receive `client_id` and can look up `org_id` from the client record.

---

### Files Summary

**New files:**
- `src/pages/LandingPage.tsx` — 50/50 split login/signup
- `src/pages/SignUp.tsx` — or embedded in LandingPage
- `src/hooks/useOrg.ts` — organisation context hook
- `src/pages/OtpVerification.tsx` — OTP code entry screen

**Modified files:**
- `src/App.tsx` — new route structure, `/` → LandingPage, `/dashboard` → Index
- `src/hooks/useAuth.tsx` — add org context
- `src/pages/Index.tsx` — move to `/dashboard` route
- `src/pages/Login.tsx` — remove (merged into LandingPage)
- `src/pages/SettingsPage.tsx` — org_members management
- `src/pages/clients/ClientForm.tsx` — include org_id
- `src/pages/clients/ClientList.tsx` — org_id in queries (RLS handles it)
- `src/components/layout/AppSidebar.tsx` — show org branding
- `src/components/layout/AppLayout.tsx` — org branding in mobile header
- `src/types/database.ts` — add Organisation, OrgMember types
- All edge functions — add org_id to inserts

**Database migration:**
- Create `organisations` and `org_members` tables
- Add `org_id` to all data tables
- Rewrite all RLS policies
- Migrate existing data to AMW Media organisation
- Update `handle_new_user()` trigger

---

### Implementation Order

Due to the scope, this should be done in stages across multiple messages:

1. **Database migration** — Create tables, add columns, migrate data, rewrite RLS
2. **Landing page + signup + OTP** — New public page, auth flow
3. **Org context + frontend updates** — useOrg hook, update all pages to use org-scoped data
4. **Edge functions update** — Add org_id to all server-side inserts
5. **Settings page overhaul** — Org member management, invitations

### Technical Consideration: OTP Email Verification

Supabase supports OTP verification natively via `supabase.auth.verifyOtp({ email, token, type: 'signup' })`. Email confirmation must be enabled (it already is — auto-confirm is disabled). The default Supabase email sends a 6-digit code that the user enters on the OTP screen.

