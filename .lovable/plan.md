
Responsive scope: every route in `src/App.tsx`, plus the shared components those routes render. This pass covers authenticated app pages, admin pages, auth screens, client portal screens, public marketing pages, share pages, and system pages.

## Route inventory to be fixed
- Authenticated app: `/dashboard`, `/clients`, `/clients/new`, `/clients/:id`, `/reports`, `/connections`, `/logs`, `/settings`, `/onboarding`
- Content Lab app: `/content-lab`, `/content-lab/onboard`, `/content-lab/niche/new`, `/content-lab/niche/:id`, `/content-lab/run/:id`, `/content-pipeline`, `/ideas`, `/content-lab/swipe-file`, `/content-lab/trends`, `/content-lab/hooks`
- Admin/debug: `/admin`, `/admin/organisations`, `/admin/organisations/:id`, `/admin/users`, `/admin/activity`, `/admin/content-lab`, `/admin/security`, `/debug`
- Auth/portal/system: `/login`, `/reset-password`, `/client-portal`, `/portal/:token`, `/auth/callback`, `/auth/threads/callback`, `*`
- Public marketing: `/`, `/features`, `/pricing`, `/social-media-reporting`, `/seo-reporting`, `/ppc-reporting`, `/white-label-reports`, `/for-agencies`, `/for-freelancers`, `/for-smbs`, `/for-creators`, `/integrations`, `/how-it-works`, `/content-lab-feature`, `/about`

## Concrete issues found in the audit
1. Several pages still start at 2 columns on phone widths instead of 1 (`Index`, `HeroKPIs`, `PlatformSection`, report generators, public metric grids).
2. A number of tab bars are still not mobile-scrollable (`AdminContentLab`, `AdminOrgDetail`, `DebugConsole`, portal tab bar).
3. Portal pages use desktop-only `px-6` headers/main wrappers and non-wrapping header rows.
4. Multiple header/action bars still rely on `justify-between` with long text + buttons, which will squeeze or overflow on 320–430px widths.
5. Filter bars still contain fixed-width selects that stack poorly unless their wrappers are normalized.
6. Long log rows, badges, error text, and table cells still need `min-w-0`, wrapping, or scroll containers.
7. Several public pages have dense metric/badge chip walls and screenshot sections that need smaller gaps, safer grids, and better image stacking on phones.

## Implementation plan

### 1) Normalize shared shells first
- `src/components/layout/AppLayout.tsx`
  - Keep the 1024 mobile breakpoint behavior.
  - Ensure mobile header text can shrink instead of forcing overflow.
  - Keep one consistent inner max-width/padding pattern.
- `src/components/admin/AdminLayout.tsx`
  - Keep tablet-as-mobile sidebar behavior.
  - Ensure admin content and sticky header spacing remain safe on 320px.
- `src/components/landing/PublicNavbar.tsx`
  - Tighten desktop spacing before links collide.
  - Ensure mobile menu targets remain full-width and easy to tap.
- `src/components/landing/PublicFooter.tsx`
  - Collapse footer columns more cleanly at phone widths and prevent cramped two-column text blocks.

### 2) Fix auth + portal screens
- `src/pages/LandingPage.tsx`
  - Make the auth pane consistently full-width on phones.
  - Prevent OTP slots / bot check / form controls from squeezing.
  - Make the two-column auth+hero layout degrade cleanly on tablet.
- `src/pages/ResetPassword.tsx`
  - Add safer page padding and consistent centered card spacing for 320px.
- `src/pages/ClientPortal.tsx`
  - Replace `px-6` wrappers with mobile-first `px-4 sm:px-6`.
  - Stack org/client header content on mobile.
- `src/pages/ClientPortalAuth.tsx`
  - Same wrapper fix as above.
  - Convert top header + tab nav + connection row actions into mobile-safe stacks.
  - Make dashboard/connections tab switcher horizontally scrollable on narrow screens.
- `src/pages/OAuthCallback.tsx`, `src/pages/ThreadsCallback.tsx`, `src/pages/NotFound.tsx`
  - Ensure centered states have proper padding and readable text on small screens.

### 3) Fix core authenticated pages
- `src/pages/Index.tsx`
  - Change summary cards from `grid-cols-2` base to `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`.
  - Audit later sections for mobile stacking and text truncation.
- `src/pages/Connections.tsx`
  - Stack reconnect banner vertically on phones.
  - Make connection card meta/status alignments wrap safely.
- `src/pages/Reports.tsx`
  - Change generate bar to `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`.
  - Make action icon row in report cards wrap on phones.
  - Ensure grouped client headings don’t collide with counts.
- `src/pages/Logs.tsx`
  - Convert each log row from forced side-by-side into stacked mobile layout.
  - Keep tab strip horizontally scrollable.
- `src/pages/SettingsPage.tsx`
  - Keep centered container; verify all tab triggers remain usable on small widths.
- `src/pages/OnboardingPage.tsx`
  - Audit each step container for safe field/button spacing and smaller-screen text.
- `src/pages/clients/ClientList.tsx`
  - Add `min-w-0` / truncation to card title blocks and badges.
- `src/pages/clients/ClientForm.tsx`
  - Stack logo upload row on mobile.
  - Convert settings rows from forced `justify-between` to mobile-friendly stacked rows where needed.
  - Make submit/cancel actions stack on phones.
- `src/pages/clients/ClientDetail.tsx`
  - Make deletion banner fully stack on small screens.
  - Rework header action cluster so month/year/report/delete/share/edit controls wrap cleanly.
  - Keep tab list scrollable and verify each tab panel below 390px.

### 4) Fix client dashboard components
- `src/components/clients/ClientDashboard.tsx`
  - Stack header controls instead of right-packing them on phones.
  - Make AI analysis dialog tabs scrollable.
- `src/components/clients/DashboardHeader.tsx`
  - Force platform/period controls into `flex-col` on small widths.
  - Make button/select triggers `w-full sm:w-auto`.
- `src/components/clients/dashboard/HeroKPIs.tsx`
  - Change base grid to `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`.
  - Prevent KPI label/platform-icon rows from crushing.
- `src/components/clients/dashboard/PlatformSection.tsx`
  - Change metric grid base to 1 column, then grow progressively.
- `src/components/clients/dashboard/PerformanceOverview.tsx`
  - Hide or simplify legends below `sm`.
  - Ensure chart cards remain readable at 320px.
- `src/components/clients/dashboard/AdCampaignBreakdown.tsx`
  - Verify all tab/table wrappers scroll correctly and ad cards don’t squeeze stat pairs.
- `src/components/clients/dashboard/GeoHeatmap.tsx`
  - Keep horizontal scroll on the table and verify map/table stacking.
- Additional dashboard widgets to audit in the same pass:
  - `DeviceBreakdown`, `HealthScore`, `OpportunityAlerts`, `PlatformSection` platform extras, `PortalUpsells`, `VoiceBriefing`, `AiChatDrawer`

### 5) Fix Content Lab comprehensively
- Pages:
  - `ContentLabPage.tsx`
  - `NicheFormPage.tsx`
  - `RunDetailPage.tsx`
  - `ContentPipelinePage.tsx`
  - `IdeasLibraryPage.tsx`
  - `SwipeFilePage.tsx`
  - `HookLibraryPage.tsx`
  - `TrendsLibraryPage.tsx`
- Shared/high-risk components:
  - `ContentLabHeader.tsx`
  - `ContentLabFilterBar.tsx`
  - `IdeaCard.tsx`
  - `IdeaPipelineBoard.tsx`
  - `ViralPostCard.tsx`
  - `PatternInsightsWidget.tsx`
  - onboarding steps under `src/components/content-lab/onboard/*`
- Specific fixes:
  - Remove remaining fixed-width select pressure in filter bars.
  - Keep all list/filter/action bars stacking cleanly.
  - Keep run detail action buttons and tabs readable on phones.
  - Ensure stacked idea layout stays single-column until there is real width.
  - Make kanban use mobile row mode cleanly up to tablet where needed.

### 6) Fix admin + debug pages
- `src/pages/admin/AdminDashboard.tsx`
  - Make stats grid single-column on phones.
- `src/pages/admin/AdminOrgList.tsx`
  - Stack page header/button on phones.
  - Keep table scroll wrapper and ensure dialog sizing is safe.
- `src/pages/admin/AdminOrgDetail.tsx`
  - Make header actions stack.
  - Make tab list horizontally scrollable.
- `src/pages/admin/AdminUserList.tsx`
  - Stack top stats cards at phone width.
  - Keep table/action controls usable on narrow screens.
- `src/pages/admin/AdminActivityLog.tsx`
  - Convert activity rows into stacked mobile cards.
- `src/pages/admin/AdminContentLab.tsx`
  - Make observability tabs horizontally scrollable.
- `src/pages/admin/AdminSecurity.tsx`
  - Stack freeze card header actions and keep spend cards readable.
- `src/pages/DebugConsole.tsx`
  - Make client selector/full tabs mobile-safe.
  - Stack connection cards and sync log rows.

### 7) Fix public marketing pages
Pages to audit and patch:
- `HomePage.tsx`
- `FeaturesPage.tsx`
- `PricingPage.tsx`
- `HowItWorksPage.tsx`
- `IntegrationsPage.tsx`
- `ContentLabPublicPage.tsx`
- `AboutPage.tsx`
- `ForAgenciesPage.tsx`
- `ForFreelancersPage.tsx`
- `ForSmbsPage.tsx`
- `ForCreatorsPage.tsx`
- `SocialMediaReportingPage.tsx`
- `SeoReportingPage.tsx`
- `PpcReportingPage.tsx`
- `WhiteLabelReportsPage.tsx`

Public-page rules for the pass:
- Every chip wall and metric grid must go `1 col` or `2 col` on phones before expanding.
- Every hero/button row must stack.
- Every screenshot block must remain full-width without clipped edges.
- Every FAQ/summary block must keep comfortable padding at 320px.
- `HowItWorksPage` report-preview grid specifically needs `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` instead of `grid-cols-2` base.

## Verification standard
Every route above will be checked at:
- 320
- 360
- 375
- 390
- 414
- 768
- 820
- 1024
- 1280

A route is only done when:
- no horizontal scroll from layout bugs
- no one-word-per-line wrapping
- no clipped buttons/badges/icons
- no unreadable legends/tabs
- no crushed form fields/selects
- no action rows overlapping
- all tables are reachable on phones
- portal/admin/auth/public pages all pass the same standard

## Deliverable
One repo-wide responsive cleanup touching every route group above, plus the shared components they depend on, with mobile-first breakpoints and concrete fixes for every remaining overflow, squeeze, wrap, and tap-target issue across the entire codebase.
