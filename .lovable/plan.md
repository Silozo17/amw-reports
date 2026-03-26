

# Settings Overhaul: Account, Branding, Reports, Client Portal, Custom Domains

This is a large set of interconnected features. The plan is organized into 5 phases, each buildable independently. I recommend implementing them in order across multiple prompts.

---

## Phase 1: Account & Profile Editing

**Goal**: Users can update their name, email, password, and contact details.

### Database Changes
- Add `phone` and `position` columns to `profiles` table

### UI Changes -- `src/pages/SettingsPage.tsx`
- Replace the read-only "Your Account" card with editable fields:
  - Full name (updates `profiles` table)
  - Email (uses `supabase.auth.updateUser({ email })` -- triggers confirmation)
  - Phone, position (updates `profiles` table)
  - Change password section (uses `supabase.auth.updateUser({ password })` with current password confirmation)
  - Avatar upload (upload to `client-logos` bucket or a new `avatars` bucket, save URL to `profiles.avatar_url`)

### Files Modified
- Migration: add `phone`, `position` to `profiles`
- `src/pages/SettingsPage.tsx` -- editable account section
- `src/hooks/useAuth.tsx` -- refresh profile after updates

---

## Phase 2: Organisation Branding (UI Customisation)

**Goal**: Owners can change org name, upload logo, set primary/secondary colors, and choose fonts. The entire platform UI reflects these choices.

### Database Changes
- Add columns to `organisations`: `secondary_color`, `heading_font`, `body_font`, `accent_color`

### UI Changes
- New "Branding" card in Settings with:
  - Org name (editable)
  - Logo upload (to a storage bucket, saved to `organisations.logo_url`)
  - Color pickers for primary, secondary, accent colors
  - Font selectors (dropdown with Google Fonts options like Anton, Montserrat, Inter, Poppins, etc.)
  - Live preview swatch

### Runtime Theming -- `src/hooks/useOrg.ts` + `src/App.tsx`
- When org loads, inject CSS custom properties (`--primary`, `--secondary`, `--accent`, font-family overrides) onto `document.documentElement`
- The existing Tailwind CSS variable system already supports this -- just update the HSL values dynamically
- Load selected Google Fonts dynamically via `<link>` injection

### Files Modified
- Migration: add branding columns to `organisations`
- `src/pages/SettingsPage.tsx` -- branding section with color pickers and font selectors
- `src/hooks/useOrg.ts` -- expose branding fields
- `src/App.tsx` or a new `BrandingProvider` -- apply CSS variables on load
- Storage bucket for org logos (reuse existing or create `org-assets`)

---

## Phase 3: PDF Report White-Labeling

**Goal**: Reports use the organisation's branding (logo, colors, fonts) instead of hardcoded AMW styles.

### Edge Function Changes -- `supabase/functions/generate-report/index.ts`
- Fetch the organisation's branding (logo_url, primary_color, secondary_color, fonts) when generating reports
- Replace hardcoded `C` color constants with org-specific colors (convert hex to RGB)
- Replace hardcoded "AMW" text with org name
- Use org logo on cover page instead of AMW logo
- Add org branding to headers/footers

### UI Changes
- New "Report Layout" section in Settings:
  - Toggle: show/hide org logo on report
  - Toggle: include AI insights section
  - Color override for report accent color
  - Preview button to generate a sample page

### Files Modified
- `supabase/functions/generate-report/index.ts` -- dynamic branding
- `src/pages/SettingsPage.tsx` -- report layout preferences section
- Possible migration: add `report_settings` JSONB column to `organisations`

---

## Phase 4: Client View-Only Portal

**Goal**: Generate shareable read-only links for clients to view their dashboard data without logging in.

### Database Changes
- New `client_share_tokens` table:
  - `id` (uuid), `client_id` (uuid), `org_id` (uuid), `token` (text, unique), `expires_at` (timestamptz nullable), `is_active` (boolean), `created_at`, `created_by` (uuid)
- RLS: org members can manage their own share tokens; public SELECT by token value via a security definer function

### New Route & Page
- `/portal/:token` -- public route (no auth required)
- New `src/pages/ClientPortal.tsx`:
  - Validates token via edge function or direct query
  - Renders a read-only version of `ClientDashboard` with org branding applied
  - No edit mode, no sidebar, no settings -- just the dashboard data
  - Shows org logo and name in header (white-labeled)

### UI in Settings/Client Detail
- "Share" button on client detail page
- Generates a unique token, shows copyable link
- Option to set expiry or revoke access
- If org has a custom domain, the link uses that domain

### Files Modified
- Migration: create `client_share_tokens` table with RLS
- `src/App.tsx` -- add `/portal/:token` public route
- New `src/pages/ClientPortal.tsx` -- read-only dashboard
- `src/pages/clients/ClientDetail.tsx` -- share button/dialog
- New edge function or security definer function to validate tokens

---

## Phase 5: Custom Domain Management

**Goal**: Users can add their own domain, verify via DNS TXT record, and have their client portal links use it.

### Database Changes
- New `custom_domains` table:
  - `id`, `org_id`, `domain` (text), `verification_token` (text), `verified_at` (timestamptz nullable), `is_active` (boolean), `created_at`
- RLS: org members can manage their own domains

### UI in Settings
- "Custom Domain" card:
  - Input for domain name
  - Generates a unique TXT record value (e.g., `amw-verify=abc123`)
  - Instructions: "Add a TXT record `_amw-verify` with value `abc123` to your DNS"
  - "Verify" button that checks DNS via an edge function
  - Status indicator (pending / verified / failed)

### Edge Function -- `supabase/functions/verify-domain/index.ts`
- Accepts domain + expected token
- Performs DNS TXT lookup to verify
- Updates `custom_domains.verified_at` on success

### Portal Integration
- When generating share links, check if org has a verified custom domain
- If yes, generate links as `https://customdomain.com/portal/:token`
- The portal page checks the hostname and loads org branding accordingly

### Files Modified
- Migration: create `custom_domains` table
- `src/pages/SettingsPage.tsx` -- domain management section
- New `supabase/functions/verify-domain/index.ts`
- `src/pages/ClientPortal.tsx` -- resolve branding from hostname

---

## Recommended Implementation Order

1. **Phase 1** (Account editing) -- smallest, standalone
2. **Phase 2** (Org branding) -- foundation for phases 3-5
3. **Phase 3** (PDF white-labeling) -- builds on phase 2 branding data
4. **Phase 4** (Client portal) -- builds on phase 2 theming
5. **Phase 5** (Custom domains) -- builds on phase 4 portal

Shall I start with Phase 1 (Account & Profile editing)?

