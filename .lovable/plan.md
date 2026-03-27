

# Sidebar Navigation Restructure + Password UX Improvements

## Changes

### 1. Restructure AppSidebar Navigation

**Current**: Settings, Logs, Debug, Platform Admin are in the user avatar dropdown menu.
**New**: 
- **Settings** becomes a direct nav item in the sidebar (after Connections)
- **Platform Admin** becomes a collapsible section (only visible to platform admins) with a chevron arrow that expands to show sub-items:
  - Overview → `/admin`
  - Organisations → `/admin/organisations`
  - Users → `/admin/users`
  - Activity Log → `/admin/activity`
  - Debug → `/debug`
  - Logs → `/logs`
- The dropdown menu keeps only **Sign Out**

**Implementation in `src/components/layout/AppSidebar.tsx`**:
- Add `Settings` to `NAV_ITEMS` array with `/settings` route and `Settings` icon
- Add a collapsible `Platform Admin` section using `Collapsible` from radix (already available at `@/components/ui/collapsible`)
- The collapsible trigger shows `Shield` icon + "Platform Admin" + `ChevronDown`/`ChevronRight` arrow
- Sub-items render as indented nav links with smaller text
- Only rendered when `isPlatformAdmin` is true
- Auto-expand when current route starts with `/admin`, `/debug`, or `/logs`
- Remove Settings, Logs, Debug, Platform Admin from the dropdown menu — keep only Sign Out

### 2. Remove AdminLayout from Admin Pages

Since admin pages now live inside the main AppLayout sidebar, the separate `AdminLayout` with its own sidebar is no longer needed.

**Files to update**:
- `src/pages/admin/AdminDashboard.tsx` — replace `AdminLayout` with `AppLayout`
- `src/pages/admin/AdminOrgList.tsx` — replace `AdminLayout` with `AppLayout`
- `src/pages/admin/AdminOrgDetail.tsx` — replace `AdminLayout` with `AppLayout` (check import)
- `src/pages/admin/AdminUserList.tsx` — replace `AdminLayout` with `AppLayout`
- `src/pages/admin/AdminActivityLog.tsx` — replace `AdminLayout` with `AppLayout`

### 3. Login Page — Password Eye Toggle

Add a show/hide password button (Eye/EyeOff icon) to the password field on the Login page, same pattern as AccountSection.

**File**: `src/pages/Login.tsx`
- Add `showPassword` state
- Wrap password Input in a relative div
- Add eye toggle button positioned absolutely on the right
- Change `type` to `showPassword ? 'text' : 'password'`

### 4. Password Strength Indicator (AccountSection)

Add a visual password strength meter below the "New Password" field in the change password section.

**File**: `src/components/settings/AccountSection.tsx`
- Add a `getPasswordStrength` function that evaluates: length ≥ 8, uppercase, lowercase, number, special char
- Returns a score 0–4 with label (Weak / Fair / Good / Strong)
- Render a colored bar (red → orange → yellow → green) + label below the new password field
- Only shows when `newPassword` is not empty

## Files Modified

| File | Change |
|---|---|
| `src/components/layout/AppSidebar.tsx` | Add Settings nav item, add collapsible Platform Admin with 6 sub-items, simplify dropdown to Sign Out only |
| `src/pages/admin/AdminDashboard.tsx` | Replace `AdminLayout` → `AppLayout` |
| `src/pages/admin/AdminOrgList.tsx` | Replace `AdminLayout` → `AppLayout` |
| `src/pages/admin/AdminOrgDetail.tsx` | Replace `AdminLayout` → `AppLayout` |
| `src/pages/admin/AdminUserList.tsx` | Replace `AdminLayout` → `AppLayout` |
| `src/pages/admin/AdminActivityLog.tsx` | Replace `AdminLayout` → `AppLayout` |
| `src/pages/Login.tsx` | Add password show/hide eye toggle |
| `src/components/settings/AccountSection.tsx` | Add password strength indicator bar |

