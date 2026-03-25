## Current State: Multi-Tenant SaaS — Complete

All 5 phases implemented:

### ✅ Phase 1: Database Migration
- Created `organisations` and `org_members` tables
- Added `org_id` column to `clients`, `reports`, `sync_logs`, `report_logs`, `email_logs`, `profiles`
- Migrated existing data to "AMW Media" organisation
- Rewrote all RLS policies to scope by organisation via `user_org_id()` helper
- Updated `handle_new_user()` trigger to auto-link invited users

### ✅ Phase 2: Landing Page & Auth
- New 50/50 split-screen landing page at `/` with login + signup
- OTP email verification on signup
- Organisation auto-created after verification
- Route restructured: `/` = landing, `/dashboard` = main app

### ✅ Phase 3: Frontend — Org Context
- `useOrg()` hook provides org data throughout the app
- Sidebar shows org name/logo (white-label ready)
- `useAuth` reads roles from `org_members`
- `ClientForm` includes `org_id` on insert

### ✅ Phase 4: Edge Functions Update
- All 10 sync functions include `org_id` in `sync_logs` inserts
- `generate-report` includes `org_id` in `reports` and `report_logs` inserts
- `send-report-email` includes `org_id` in `email_logs` inserts

### ✅ Phase 5: Settings Page
- Team management uses `org_members` instead of `user_roles`
- Invite dialog: enter email + role → invited user auto-joins on signup
- Organisation info displayed
