

## Plan: Client Management Improvements + Dashboard Redesign

This is a large set of changes spanning 8 areas. Here is the implementation plan broken into logical groups.

---

### 1. Delete Client

**ClientDetail.tsx** — Add a "Delete" button (with confirmation dialog) next to the Edit button. On confirm:
- Delete from `clients` table (RLS already allows owners to delete)
- Cascade will handle related rows (recipients, connections, etc.) if foreign keys are set; otherwise delete manually from `platform_connections`, `client_recipients`, `client_platform_config`, `monthly_snapshots`, `sync_logs`, `reports`, `report_logs`, `email_logs` for the client
- Navigate back to `/clients`

**Database**: Add a migration with `ON DELETE CASCADE` foreign keys from all child tables to `clients(id)` if not already present. This ensures clean deletion.

---

### 2. Timezone Editing

**ClientEditDialog.tsx** — Add a timezone `Select` dropdown (currently timezone is in the form state but not exposed in the edit dialog). Add a list of common timezones (Europe/London, America/New_York, etc.) as a select field in the edit form, similar to currency.

**ClientForm.tsx** — Same timezone dropdown for new client creation.

---

### 3. Editable Settings Tab

**ClientDetail.tsx** — Replace the read-only Settings tab with an inline editable form. Each setting row gets a `Switch` or `Select` that saves directly to the database on change (or a "Save" button). Uses the same fields already in `ClientEditDialog` but displayed inline: detail level, MoM, YoY, AI explanations, upsell, currency, timezone.

---

### 4. Merge Facebook/Instagram into "Meta" in Add Connection

**ConnectionDialog.tsx** — Remove `facebook` and `instagram` from the `PLATFORMS` dropdown. Show only: `google_ads`, `meta_ads`, `tiktok`, `linkedin`. Facebook and Instagram connections are auto-created when selecting assets in the Meta Ads Account Picker (already handled). Update `META_DEPENDENT` handling so FB/IG connections are created automatically during the Meta picker flow rather than manually.

---

### 5. Remove Connections Directly from Connections Tab

**ClientDetail.tsx** (connections tab) — Add a delete button (Trash2 icon) on each connection row in the Connections tab, not just inside the Add Connection dialog. On click, show a confirmation and delete the connection.

---

### 6. Delete Associated Data When Connection is Removed

When a connection is removed (either from the tab or the dialog):
- Delete all `monthly_snapshots` for that `client_id` + `platform`
- Delete all `sync_logs` for that `client_id` + `platform`
- Delete `client_platform_config` for that `client_id` + `platform`

Create a helper function `removeConnectionAndData(connectionId, clientId, platform)` used by both the dialog and the tab.

---

### 7. Auto-Sync Historical Data on New Connection

When a new connection is fully set up (account selected via picker), automatically trigger a bulk sync for up to 12 months including the current month. This fires after the Account Picker completes:
- In `ClientDetail.tsx`, after the picker `onComplete` callback, detect if it's a newly connected platform and run `runSyncForMonth` for each of the last 12 months sequentially
- Show a toast with progress ("Syncing historical data... 3/12")

---

### 8. Dashboard Redesign (DashThis-inspired)

Redesign the dashboard to be more visually engaging, taking cues from the uploaded reference images and the AMW PDF report style:

**Section-based layout with explanations** — Instead of a flat grid of charts, organise the dashboard into named sections with descriptive headers:
- "Ad Performance" section with a brief explanation: "How your paid campaigns are performing across platforms"
- "Social Engagement" section: "How people are interacting with your content"
- "Audience Growth" section: "How your following is changing over time"

**Key visual changes to ClientDashboard.tsx and PlatformMetricsCard.tsx:**

a) **Hero KPI cards** — Larger, more prominent KPI cards with colored accent backgrounds (using platform brand colors), showing the metric name in plain English with a subtitle explaining what it means (e.g. "People Reached — Total unique people who saw your content")

b) **Section descriptions** — Each chart/section gets a 1-line plain-English explanation beneath the heading, like the PDF does ("In plain English: You spent £636 over 4 months...")

c) **Comparison callouts** — Instead of just "▲ 12.5%", show contextual text: "Up 12.5% from last month" in a colored badge

d) **Cleaner chart styling** — Rounded corners on bars, softer gradients, more whitespace between sections. Use card-based sections with subtle borders and section titles.

e) **Platform metrics** — Instead of a flat 4-column grid of small metric tiles, use a 2-column layout with larger metric cards that include an icon, the metric name, value, change indicator, and a one-line explanation

f) **Summary cards** — At the top of each platform section, show 2-3 "hero" numbers (like the DashThis Posts/Clicks/Shares cards on the right side of the reference image) with bold colored values

**Files changed:**
- `src/components/clients/ClientDashboard.tsx` — Major restructure into sections with descriptions
- `src/components/clients/PlatformMetricsCard.tsx` — Larger metric tiles with explanations
- New component: `src/components/clients/SectionHeader.tsx` — Reusable section header with title + description
- New component: `src/components/clients/HeroMetricCard.tsx` — Large single-metric display card with explanation text

---

### Technical Details

**Files to modify:**
- `src/pages/clients/ClientDetail.tsx` — Delete button, inline settings, connection remove buttons, auto-sync trigger
- `src/components/clients/ConnectionDialog.tsx` — Remove FB/IG from platforms list
- `src/components/clients/ClientEditDialog.tsx` — Add timezone selector
- `src/pages/clients/ClientForm.tsx` — Add timezone selector
- `src/components/clients/ClientDashboard.tsx` — Full dashboard redesign
- `src/components/clients/PlatformMetricsCard.tsx` — Redesigned metric display
- `src/types/database.ts` — Add TIMEZONE_OPTIONS constant

**New files:**
- `src/components/clients/SectionHeader.tsx`
- `src/components/clients/HeroMetricCard.tsx`

**Database migration:**
- Add `ON DELETE CASCADE` to all child table foreign keys referencing `clients(id)`

**Metric explanations** — Add a `METRIC_EXPLANATIONS` map in `types/database.ts` with plain-English descriptions for each metric key (e.g. `spend: "Total amount spent on ads across this platform"`, `reach: "Number of unique people who saw your content"`)

