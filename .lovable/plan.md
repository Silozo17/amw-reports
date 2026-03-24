

# Plan: Client Form Enhancements, Logo Upload, Phone Formatting, Currency, Platform Logos, Data Display Fix

## Issue Analysis

After inspecting the database, sync functions, and dashboard:

1. **Data "not showing"**: Data exists in `monthly_snapshots` but the dashboard defaults to the previous month. For Feb 2026, most platforms have zero data. Jan 2026 has real Meta Ads data ($147 spend, 114 clicks). The dashboard shows zeros because it's looking at a month with no activity. The fix is to auto-detect the latest month with actual data instead of blindly defaulting to "previous month."

2. **No Google Business Profile integration** exists yet for auto-filling client details.

3. **No `logo_url` column** on the `clients` table, no storage bucket for logos.

4. **Phone numbers** are stored as-is with no formatting.

5. **Currency** defaults to AUD (hardcoded), should be GBP with a proper dropdown.

6. **Platform logos** are uploaded as images but not used anywhere — the UI uses text labels and lucide icons.

---

## Changes

### 1. Google Business Profile Lookup for Client Form

- Create a new edge function `google-places-lookup` that uses the Google Places API (Text Search) to find businesses by name and return address, phone, website
- Add a "Search Google" button next to Company Name in `ClientForm.tsx` and `ClientEditDialog.tsx`
- On selection, auto-fill business_address, phone, website fields
- Uses existing `GOOGLE_CLIENT_ID` / requires a Google Places API key (will check if available or request)

### 2. Client Logo Upload

**Database**: Add `logo_url` column to `clients` table.

**Storage**: Create a `client-logos` public bucket with RLS policies for authenticated users.

**UI Changes**:
- `ClientForm.tsx`: Add logo upload area (drag & drop or click) before contact fields
- `ClientEditDialog.tsx`: Add logo upload/change area
- `ClientDetail.tsx`: Display logo next to company name in header
- `ClientDashboard.tsx`: Show logo in KPI header area
- `generate-report/index.ts`: Fetch and embed client logo on PDF cover page

**Type**: Add `logo_url` to the `Client` interface in `types/database.ts`.

### 3. Phone Number Formatting (No Country Code)

- Add a `formatPhone` utility in `src/lib/utils.ts` that strips country codes (e.g., +44, +1, +48) and formats as local number
- Apply on save in `ClientForm.tsx` and `ClientEditDialog.tsx`
- Apply on display in `ClientDetail.tsx`

### 4. Currency Selector (Default GBP)

- Replace the free-text currency `Input` with a `Select` dropdown in both `ClientForm.tsx` and `ClientEditDialog.tsx`
- Options: GBP (default), EUR, USD, PLN, CAD, AUD, NZD
- Change default from `'AUD'` to `'GBP'`
- Update `ClientDashboard.tsx` KPI cards to use the client's currency symbol instead of hardcoded `$`

### 5. Platform Logo Images

- Copy all 7 uploaded logo images to `src/assets/logos/` (Facebook, Google, Instagram, LinkedIn, Meta, TikTok, All Socials)
- Create a `PLATFORM_LOGOS` map in `src/types/database.ts` importing these assets
- Update `ConnectionDialog.tsx`: Show platform logo next to name in connection list and dropdown
- Update `ClientDashboard.tsx` / `PlatformMetricsCard.tsx`: Show platform logo in section headers and chart legends
- Update `DashboardHeader.tsx`: Show platform logo in platform selector tabs
- Update `AccountPickerDialog.tsx`: Show platform logo in header

### 6. Fix Dashboard Data Display

The root cause: dashboard defaults to `now.getMonth()` (previous month). If that month has zero data, everything shows zeros even though older months have real data.

**Fix**:
- In `ClientDashboard.tsx`, after fetching all snapshots, find the most recent month with non-zero data and default to that
- Add a visual indicator when viewing a month with no data: "No activity recorded for this month. Try selecting a different period."
- When KPI values are all zero, show the "Data unavailable" placeholder more prominently instead of showing $0.00 cards

---

## Files Modified

- `src/pages/clients/ClientForm.tsx` — logo upload, phone formatting, currency dropdown, default GBP
- `src/components/clients/ClientEditDialog.tsx` — same updates
- `src/pages/clients/ClientDetail.tsx` — display logo, formatted phone
- `src/components/clients/ClientDashboard.tsx` — platform logos, currency-aware formatting, smart month default
- `src/components/clients/PlatformMetricsCard.tsx` — platform logos
- `src/components/clients/DashboardHeader.tsx` — platform logos in tabs
- `src/components/clients/ConnectionDialog.tsx` — platform logos
- `src/components/clients/AccountPickerDialog.tsx` — platform logos
- `src/types/database.ts` — add `logo_url` to Client, add PLATFORM_LOGOS map
- `src/lib/utils.ts` — add formatPhone utility
- `supabase/functions/generate-report/index.ts` — embed client logo

**New files**:
- `supabase/functions/google-places-lookup/index.ts` — Google Places search
- `src/assets/logos/` — 7 logo image files

**Database migration**:
- Add `logo_url text` column to `clients`
- Create `client-logos` storage bucket (public)
- Add storage RLS policies for authenticated uploads

## Execution Order

1. Database migration (logo_url column + storage bucket)
2. Copy logo assets to `src/assets/logos/`
3. Create PLATFORM_LOGOS map and formatPhone utility
4. Update ClientForm + ClientEditDialog (logo upload, currency dropdown, phone formatting)
5. Update dashboard components with platform logos and smart defaults
6. Create google-places-lookup edge function
7. Update generate-report to embed client logo

