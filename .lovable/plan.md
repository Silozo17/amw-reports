

## Site-wide Responsive Pass — All Pages, All Devices

### Scope: every route, grouped by area

**App (authenticated)**
- Dashboard / client overview: `Index.tsx`, `clients/ClientList.tsx`, `clients/ClientDetail.tsx`, `clients/ClientForm.tsx`
- Client dashboard widgets: `HeroKPIs`, `PerformanceOverview`, `PlatformSection`, `AdCampaignBreakdown`, `DeviceBreakdown`, `GeoHeatmap`, `HealthScore`, `OpportunityAlerts`, `PortalUpsells`, `VoiceBriefing`, `AiChatDrawer`, all `dashboard/platforms/*`
- Client tabs & dialogs: `ClientConnectionsTab`, `ClientContentLabTab`, `ClientSettingsTab`, `AccountPickerDialog`, `ConnectionDialog`, `ShareDialog`, `RecipientDialog`, `DeleteClientDialog`, `ClientEditDialog`, `MetricConfigPanel`, `PortalUpsellsSettings`, `UpsellTab`
- Connections, Reports, Logs, Settings: `Connections.tsx`, `Reports.tsx`, `Logs.tsx`, `SettingsPage.tsx` + all `settings/*` sections (Account, Billing, Branding, CustomDomain, MetricsDefaults, Organisation, ReportSettings, UpsellsOverview, AvatarCropDialog)
- Onboarding: `OnboardingPage.tsx` + 7 step components
- Auth: `ResetPassword.tsx`, `ClientPortalAuth.tsx`, `OAuthCallback.tsx`, `ThreadsCallback.tsx`
- Client portal: `ClientPortal.tsx`
- Content Lab: already passed — verify only

**Admin**
- `AdminLayout.tsx`, `AdminDashboard`, `AdminUserList`, `AdminOrgList`, `AdminOrgDetail` (+ `AdminOrgClients`, `AdminOrgMembers`, `AdminOrgOnboarding`, `AdminOrgSubscription`), `AdminActivityLog`, `AdminSecurity`, `AdminContentLab` (+ `NichesTable`, `RunsTable`, `StepLogsTable`, `RunDetailDrawer`, `ContentLabAnalyticsTab`, `ContentLabHealthPanel`), `AdminSyncDialog`, `UserActionDialogs`, `UserEditDialog`, `UserResetPasswordDialog`, `DebugConsole.tsx`

**Public marketing site** (`PublicLayout`, `PublicNavbar`, `PublicFooter`, `LandingHero`, `WarpedGrid`)
- `LandingPage`, `HomePage`, `AboutPage`, `FeaturesPage`, `HowItWorksPage`, `IntegrationsPage`, `PricingPage`, `ForAgenciesPage`, `ForCreatorsPage`, `ForFreelancersPage`, `ForSmbsPage`, `PpcReportingPage`, `SeoReportingPage`, `SocialMediaReportingPage`, `WhiteLabelReportsPage`, `ContentLabPublicPage`, `NotFound`

**Shared public**: `share/ContentLabRunShare.tsx`

### Target breakpoints
320px (small phone) · 375–414px (phone) · 768px (iPad portrait) · 1024px (iPad landscape) · 1280px (laptop) · 1536px+ (desktop)

### Common fix patterns to apply

1. **Page padding** — replace any `p-6`/`p-8` only with `p-4 md:p-6 lg:p-8`.
2. **Grids** — convert any `grid-cols-2`/`grid-cols-3`/`grid-cols-4` lacking a breakpoint prefix to mobile-first: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`.
3. **Tables** — wrap every `<Table>` in `<div className="overflow-x-auto">`; on phone, switch dense admin tables (`UserList`, `OrgList`, `RunsTable`, `NichesTable`, `StepLogsTable`, `ActivityLog`) to a stacked-card view via `useIsMobile`.
4. **Headers / toolbars** — `flex` rows with multiple actions become `flex-col gap-3 md:flex-row md:items-center md:justify-between`. Buttons get `w-full sm:w-auto`.
5. **Tabs** — long `TabsList` rows (settings, client detail, admin org detail) get `overflow-x-auto whitespace-nowrap` wrapper on mobile.
6. **Dialogs / Sheets** — cap with `max-w-[95vw] sm:max-w-md` (or `sm:max-w-lg`/`2xl` as appropriate); `Sheet` sides use `w-full sm:max-w-md`.
7. **Selects / filter bars** — `w-full sm:w-auto` on `SelectTrigger`s and dropdowns.
8. **Charts** — wrap Recharts `ResponsiveContainer` in a parent with `min-h-[240px]` and ensure `width="100%"`; reduce label density on mobile (hide axis ticks below `sm`).
9. **Heatmap / Leaflet** — set explicit `aspect-[4/3] md:aspect-[16/9]` to avoid 0-height on mobile.
10. **Public marketing pages** — hero text scales `text-4xl sm:text-5xl md:text-6xl lg:text-7xl`; hero CTA stacks; nav becomes hamburger sheet on `<lg`; footer columns `grid-cols-2 md:grid-cols-4`.
11. **Forms** — long `ClientForm`, `NicheFormPage`, settings sections: every field group `grid-cols-1 md:grid-cols-2`; sticky save bar buttons full-width on mobile.
12. **Sticky bars / footers** — wizard footers stack on mobile (`flex-col-reverse sm:flex-row`).
13. **Images** — add `loading="lazy"`, `decoding="async"`, intrinsic `width`/`height` (already done in Content Lab).
14. **Dark mode** — preserve existing tokens; no colour changes.

### Out of scope (will not change)
- No new features, no copy changes, no design redesign.
- No DB or auth changes.
- No edge function changes.
- Desktop layouts at ≥1280px stay pixel-identical (only adds smaller breakpoints, never removes `md:`/`lg:`).
- Recharts/Leaflet library swaps — only container sizing tweaks.

### Execution plan (phased, in order)

**Phase 1 — Foundations (shared layout)**
- `AppLayout` content padding + max-width audit
- `AppSidebar` mobile sheet polish
- `AdminLayout` mobile nav
- `PublicLayout` + `PublicNavbar` mobile menu, `PublicFooter` columns

**Phase 2 — App pages**
- Client area: `Index`, `ClientList`, `ClientDetail` (tabs scroll, header stack), `ClientForm`, all dialogs
- Client dashboard widgets (KPIs grid, charts, geo map, platform sections)
- Connections, Reports, Logs
- Settings page (tabs scroll + every section grid)
- Onboarding wizard footer + step content padding
- Client portal

**Phase 3 — Admin**
- `AdminDashboard`, `AdminUserList`, `AdminOrgList`, `AdminOrgDetail` + sub-components
- All admin tables → horizontal scroll + mobile card mode
- `AdminContentLab` + tabs/tables/drawer
- `AdminSecurity`, `AdminActivityLog`, `DebugConsole`
- All admin dialogs cap widths

**Phase 4 — Public marketing**
- `LandingPage`, `HomePage`, `AboutPage`, `FeaturesPage`, `HowItWorksPage`, `IntegrationsPage`, `PricingPage`
- 4× persona pages (Agencies, Creators, Freelancers, SMBs)
- 4× reporting pages (PPC, SEO, Social, WhiteLabel)
- `ContentLabPublicPage`, `NotFound`
- `LandingHero` (font scale + CTA stack), `WarpedGrid` (mobile rendering)

**Phase 5 — Verification**
- Smoke-test critical routes at 320 / 375 / 768 / 1024 / 1280 / 1536 widths via browser tools (post-implementation)
- Verify dark mode at each breakpoint on 5 sample pages

### Risks / things flagged
- **Admin tables are dense** — switching to a stacked-card mobile view changes IA; truncation may hide columns. Will preserve all data, just reorder.
- **Recharts** — some chart legends become illegible <360px; will hide legend below `sm` and rely on tooltips.
- **Leaflet GeoHeatmap** — needs explicit height; tile loading on slow mobile is unchanged.
- **Public marketing hero animations** (`WarpedGrid`) may need `prefers-reduced-motion` and a simpler fallback on phones for perf.
- This is a **large pass touching ~80+ files**. I'll work in the phases above and pause after each phase so you can review before proceeding to the next.

