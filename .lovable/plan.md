

## Two Major Gaps to Fix

### Issue 1: Onboarding Doesn't Set Up Organisation

**Current flow:** Signup collects company name → OTP verifies → org is auto-created from `companyName` during OTP verification → onboarding wizard starts. The onboarding wizard only asks marketing questions (account type, platforms, client count, reason, referral). It never lets the user configure their organisation name, upload a logo, or set branding.

**Fix:** Add a new step between the current Step 1 (account type) and Step 2 (platforms) that lets users set up their organisation. This step will:
- Pre-fill org name from what they entered at signup
- Let them edit the org name
- Upload an org logo (to `org-assets` bucket)
- Optionally set brand colours (primary, secondary, accent)
- Save to the `organisations` table on continue

**File:** `src/pages/OnboardingPage.tsx`
- Increase `TOTAL_STEPS` from 6 to 7
- Insert new Step 2: "Set up your organisation" with fields for org name, logo upload, and optional brand colour pickers
- Shift all subsequent steps by 1 (current step 2→3, 3→4, etc.)
- On "Continue" from org step, update `organisations` table with name/logo/colours
- Fetch current org data on mount to pre-fill

### Issue 2: Admin User & Org Management Is Incomplete

**Current state:**
- `AdminUserList`: Only shows user table with deactivate and delete. No editing of name, email, password reset, or org reassignment.
- `AdminOrgDetail`: Manages subscription, views clients, views members (remove only), views onboarding data. No editing of org name, no editing of member details.
- No way to edit a user's profile (name, email, position, phone)
- No way to reset a user's password
- No way to edit an organisation's name or details from admin

**Fix — AdminUserList enhancements:**

Add an "Edit User" dialog (triggered by a pencil icon per row) with:
- Edit full name, email, phone, position
- Change organisation assignment (dropdown of all orgs)
- Change role (owner/manager)
- Save updates to `profiles` and `org_members` tables

Add a "Reset Password" action:
- Create a new edge function `admin-reset-password` that uses the service role key to call `supabase.auth.admin.updateUser()` with a new generated password, or sends a password reset email
- Button in the user row triggers this, shows the temporary password or confirms email sent

**Fix — AdminOrgDetail enhancements:**

Add org detail editing:
- Editable org name field at the top of the page
- Save changes to `organisations` table

Add member editing within the Members tab:
- Edit member role (owner/manager dropdown)
- Edit member profile (name, email) inline or via dialog

**Files to modify:**
1. `src/pages/admin/AdminUserList.tsx` — Add Edit User dialog with profile fields, org assignment, role change. Add Reset Password button and flow.
2. `src/pages/admin/AdminOrgDetail.tsx` — Add editable org name field. Add member role editing and profile editing in Members tab.
3. `src/pages/OnboardingPage.tsx` — Insert org setup step (step 2) with name, logo, colours.
4. `supabase/functions/admin-reset-password/index.ts` — New edge function for password reset via service role.

### Technical Details

**Org setup step (onboarding):**
- Fetch org via `profiles.org_id` → `organisations` row
- Logo upload uses existing `org-assets` public bucket
- Colour pickers use simple hex input fields with preview swatches
- On continue, `supabase.from('organisations').update(...)` with the edited values

**Admin user edit:**
- Profile updates: `supabase.from('profiles').update({ full_name, email, phone, position }).eq('user_id', ...)`
- Org reassignment: Delete old `org_members` row, insert new one, update `profiles.org_id`
- Role change: `supabase.from('org_members').update({ role }).eq('id', ...)`

**Admin password reset edge function:**
- Uses `SUPABASE_SERVICE_ROLE_KEY` (already available)
- Accepts `user_id` and generates a temporary password or triggers a reset email
- Returns result to admin UI
- Protected: verifies caller is a platform admin

**Admin org name edit:**
- Simple input field bound to org name, save button calls `supabase.from('organisations').update({ name }).eq('id', ...)`

