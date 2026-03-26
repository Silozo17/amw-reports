

# Settings Consolidation & Profile Dropdown Plan

## What Changes

### 1. Profile Dropdown Menu (replaces sidebar items)
Remove **Settings**, **Debug**, **Logs**, and **Sign Out** from the sidebar nav. Replace with a **popover/dropdown menu** that opens when clicking the profile name/avatar area at the bottom of the sidebar.

Menu items:
- **Settings** → `/settings`
- **Logs** → `/logs`
- **Debug** → `/debug` (owner only)
- **Sign Out**

**Files:** `src/components/layout/AppSidebar.tsx`
- Remove Settings, Debug, Logs from `NAV_ITEMS`
- Replace the bottom profile section with a `DropdownMenu` (from shadcn) triggered by the avatar + name
- Display `profile.avatar_url` in the sidebar avatar (currently only shows initials)

### 2. Settings Page — Tab-Based Layout
Restructure `/settings` into 4 tabs:

**Tab 1: Organisation**
- Organisation name, slug (from existing `OrganisationSection`)
- Team Members section (invite, remove — from existing inline code in `SettingsPage`)

**Tab 2: Account**
- Existing `AccountSection` (profile fields, avatar, password)
- **New: Avatar crop dialog** — when a non-square image is selected, show a crop modal before uploading

**Tab 3: White Label**
- `BrandingSection` (logo, colours, fonts)
- `ReportSettingsSection` (PDF report layout options)
- `CustomDomainSection` (custom domain management)

**Tab 4: Metrics**
- Current "Platform Metric Defaults" section
- **Fix:** Instead of showing ALL_METRICS (284 entries) for every platform identically, filter available metrics per platform using `ORGANIC_PLATFORMS`, `AD_METRICS`, and platform-specific metric prefixes (e.g. `gbp_*` only for GBP, `search_*` only for GSC, `ga_*` only for GA4, `subscribers`/`watch_time` only for YouTube)

**Files:**
- `src/pages/SettingsPage.tsx` — restructure into `Tabs` component with 4 tabs
- `src/components/settings/OrganisationSection.tsx` — expand to include team members
- `src/components/settings/AccountSection.tsx` — add crop functionality
- New: `src/components/settings/MetricsDefaultsSection.tsx` — extracted from SettingsPage with platform-aware metric filtering

### 3. Avatar Crop Function
When user selects a profile photo that isn't 1:1:
- Show a crop dialog using a canvas-based approach (no heavy library)
- Allow user to position a square crop area over the image
- Upload the cropped result
- The cropped avatar URL reflects in the sidebar immediately (requires `useAuth` to re-fetch profile or the AccountSection to update auth context)

**Implementation:** Use `HTMLCanvasElement` to crop — read the file as an image, render a crop UI with a draggable square overlay, then `canvas.toBlob()` the cropped region before uploading.

**Files:**
- New: `src/components/settings/AvatarCropDialog.tsx`
- `src/components/settings/AccountSection.tsx` — use crop dialog instead of direct upload
- `src/hooks/useAuth.tsx` — expose a `refetchProfile` method so avatar updates reflect in sidebar

### 4. Sidebar Avatar Sync
Currently the sidebar shows `profile?.full_name?.charAt(0)` as a text initial. Change to use `Avatar` + `AvatarImage` with `profile.avatar_url`, falling back to initials.

**Files:** `src/components/layout/AppSidebar.tsx`

### 5. Platform-Specific Metric Filtering
Define a `PLATFORM_AVAILABLE_METRICS` map that specifies which metrics each platform can actually have:

```text
google_ads:              spend, impressions, clicks, ctr, conversions, cpc, cpm, roas, ...
meta_ads:                spend, impressions, reach, clicks, ctr, conversions, cpc, cpm, ...
facebook:                total_followers, page_likes, page_views, engagement, ...
instagram:               total_followers, profile_visits, reach, engagement, ...
linkedin:                total_followers, impressions, engagement, ...
tiktok:                  video_views, profile_views, total_likes_received, ...
google_search_console:   search_clicks, search_impressions, search_ctr, search_position, ...
google_analytics:        sessions, active_users, new_users, bounce_rate, ...
google_business_profile: gbp_views, gbp_searches, gbp_calls, gbp_direction_requests, ...
youtube:                 subscribers, views, watch_time, videos_published, ...
```

This replaces the current approach where every platform shows all ~80 metrics.

**Files:**
- `src/types/database.ts` — add `PLATFORM_AVAILABLE_METRICS` constant
- New `src/components/settings/MetricsDefaultsSection.tsx` — use the map

### 6. Route Updates
- Remove `/settings`, `/debug`, `/logs` from sidebar `NAV_ITEMS` (they remain as routes in `App.tsx`)
- Keep them accessible via the profile dropdown

**Files:** `src/components/layout/AppSidebar.tsx`, `src/App.tsx` (no route changes, just nav)

## Technical Details

### Crop Dialog Approach
Canvas-based, no external library. Steps:
1. `FileReader.readAsDataURL()` → load into `<img>`
2. Check if image is square — if yes, skip crop, upload directly
3. If not square, show dialog with image + draggable square overlay
4. On confirm, draw cropped region to canvas at 256×256, export as blob
5. Upload blob to storage

### Auth Context Update
Add `refetchProfile` to `AuthContextType`:
```typescript
const refetchProfile = async () => {
  if (!user) return;
  const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).single();
  setProfile(data as Profile | null);
};
```

## Files Summary

| Action | File |
|--------|------|
| Modify | `src/components/layout/AppSidebar.tsx` — dropdown menu, avatar image |
| Modify | `src/pages/SettingsPage.tsx` — 4-tab layout |
| Modify | `src/components/settings/OrganisationSection.tsx` — add team members |
| Modify | `src/components/settings/AccountSection.tsx` — integrate crop dialog |
| Modify | `src/hooks/useAuth.tsx` — add `refetchProfile` |
| Modify | `src/types/database.ts` — add `PLATFORM_AVAILABLE_METRICS` |
| Create | `src/components/settings/AvatarCropDialog.tsx` |
| Create | `src/components/settings/MetricsDefaultsSection.tsx` |

