

# Responsiveness Audit — AMW Reports

---

## CRITICAL (breaks usability — user cannot complete a task)

### C1. Reports page — report row action buttons overflow on mobile
**Component**: `Reports.tsx` (line 200-244), `ClientReportsTab.tsx` (line 198-243)
**Breakpoints**: XS (320px), SM (375px), MD (428px)
**Problem**: The report row uses `flex items-center justify-between` with 4-5 icon buttons + a badge on the right side. At 320-428px, these buttons overflow or get crushed. The badge + 4 buttons need ~200px minimum, leaving almost no room for the report info on the left. The row becomes unusable — buttons are too small or clip off-screen.

### C2. Client Detail header — action bar overflows on mobile
**Component**: `ClientDetail.tsx` (lines 400-445)
**Breakpoints**: XS (320px), SM (375px), MD (428px)
**Problem**: The action bar contains: Active badge, Share button, Edit button, Delete button, Month select (w-28), Year select (w-20), Generate Report button — all in a single `flex flex-wrap`. On XS/SM this wraps to 3+ rows and the month/year selectors are cramped. The `ml-12` on mobile (line 400) pushes the entire bar right unnecessarily.

### C3. DashboardHeader — controls overflow on small phones
**Component**: `DashboardHeader.tsx` (line 182)
**Breakpoints**: XS (320px), SM (375px)
**Problem**: `flex flex-wrap items-center gap-3` contains: Platform dropdown (`min-w-[180px]`), Period type dropdown (`w-[160px]`), Arrow nav with label (`min-w-[180px]`). Total minimum width: ~520px. On 320px (with ~288px content area after sidebar padding), the first two items alone exceed available width. When custom date range is selected, two calendar buttons + "to" label are also squeezed in.

### C4. Settings tabs overflow on mobile
**Component**: `SettingsPage.tsx` (lines 60-65)
**Breakpoints**: XS (320px), SM (375px), MD (428px)
**Problem**: `TabsList className="flex w-full"` with up to 6 tabs (Organisation, Account, White Label, Metrics, Upsells, Billing), each with `flex-1`. At 320px, each tab gets ~50px — text truncates and becomes untappable. No horizontal scroll is applied.

---

## IMPORTANT (degrades experience but task is still possible)

### I1. Connections page — row layout cramped on mobile
**Component**: `Connections.tsx` (lines 89-113)
**Breakpoints**: XS (320px), SM (375px)
**Problem**: Each connection card uses `flex items-center justify-between` with left (icon + name + details) and right (badge + last sync date). On narrow screens, the badge and date text overflow or wrap awkwardly. The "Last sync:" text should be hidden on mobile.

### I2. Top Posts table horizontal overflow on mobile
**Component**: `PlatformSection.tsx` (lines 430-510)
**Breakpoints**: XS-MD (320-428px)
**Problem**: The social posts table has 6-7 columns (Image, Post, Views, Reactions, Comments, Shares, Link). Tables do not reformat or scroll horizontally — they overflow their container. The `overflow-hidden` on the wrapper clips content instead of allowing scroll.

### I3. HeroKPIs — 2-column grid too tight at 320px
**Component**: `HeroKPIs.tsx` (line 154)
**Breakpoints**: XS (320px)
**Problem**: `grid grid-cols-2 lg:grid-cols-4 gap-4` means each card gets ~140px at 320px. The KPI value text (`text-3xl`) plus the label row (icon + text + tooltip + platform logos) can overflow. Values like "£12,345.67" clip.

### I4. Landing page hero — feature cards tight on small phones
**Component**: `LandingHero.tsx` (line 61), `HomePage.tsx` (line 61-71)
**Breakpoints**: XS (320px)
**Problem**: `grid grid-cols-2 gap-3` for feature cards. At 320px, each card is ~146px wide. Text wraps heavily and description becomes hard to read.

### I5. Client Detail tabs — no scroll indicator
**Component**: `ClientDetail.tsx` (line 453)
**Breakpoints**: XS-SM (320-375px)
**Problem**: `TabsList className="w-full overflow-x-auto flex-nowrap justify-start"` — 5 tabs (Dashboard, Connections, Upsells, Reports, Settings). The overflow-x-auto is correct but there's no visual indicator that more tabs exist (no fade edge or scroll shadow). Users may not discover the Reports/Settings tabs.

### I6. Reports page generate bar — selects cramped on mobile
**Component**: `Reports.tsx` (lines 262-301)
**Breakpoints**: XS (320px), SM (375px)
**Problem**: `flex flex-wrap items-center gap-3` with label + 3 selects (w-52, w-28, w-20) + button. On XS the w-52 client select alone nearly fills the row. The selects wrap to separate lines but the "Generate:" label orphans.

### I7. No max-width on main content area for large screens
**Component**: `AppLayout.tsx` (line 51)
**Breakpoints**: 4XL (1920px+)
**Problem**: The main content area has `p-6 lg:p-8` but no `max-w-*` constraint. On 1920px+ monitors, content like the Dashboard KPI grid stretches very wide. Charts and cards become disproportionately large. Only the Settings page uses `max-w-4xl`.

### I8. ClientReportsTab header — generate controls overlap on mobile
**Component**: `ClientReportsTab.tsx` (lines 155-178)
**Breakpoints**: XS (320px), SM (375px)
**Problem**: `flex items-center justify-between` with "Reports" title on left and Month select + Year select + Generate button on right. On 320px, the three right-side elements don't fit alongside the title — they overflow or wrap below without proper alignment.

---

## MINOR (cosmetic, spacing, visual polish)

### M1. Dashboard heading too large on XS
**Component**: `Index.tsx` (line 255)
**Breakpoints**: XS (320px)
**Problem**: `text-3xl` for "Dashboard" heading is 30px — takes up significant vertical space on small phones. Should reduce to `text-2xl` on mobile.

### M2. Sidebar org switcher popover — no mobile optimization
**Component**: `AppSidebar.tsx` (line 96)
**Breakpoints**: XS-SM (320-375px)
**Problem**: The org switcher popover is `w-60`. When sidebar is in a Sheet on mobile, the popover can extend beyond the Sheet boundary.

### M3. Navigation arrow buttons are 28px (h-7 w-7)
**Component**: `DashboardHeader.tsx` (line 276)
**Breakpoints**: All mobile
**Problem**: Touch targets are 28x28px — below the 44x44px recommended minimum. The period label between arrows (`min-w-[180px]`) also doesn't have enough room.

### M4. MetricCard text size — 11px label
**Component**: `PlatformSection.tsx` (line 129)
**Breakpoints**: All
**Problem**: `text-[11px]` metric labels are below the 12px readability threshold on mobile devices.

### M5. Various icon-only buttons lack aria-label
**Components**: Multiple — Preview/Download/Regenerate/Send buttons in Reports, nav arrows in DashboardHeader, back button in ClientDetail
**Breakpoints**: All
**Problem**: `<Button size="sm" variant="ghost" title="Preview">` uses `title` but not `aria-label`. Screen readers won't announce the purpose.

### M6. Invite popover in sidebar could clip on mobile
**Component**: `AppSidebar.tsx` (lines 143-177)
**Breakpoints**: XS-SM
**Problem**: The invite popover is `w-72` (288px) with `side="top"`. Inside the mobile Sheet (w-64 = 256px), it may overflow.

### M7. OTP input on landing page — slots are wide on desktop
**Component**: `LandingPage.tsx` (lines 262-273)
**Breakpoints**: 3XL-4XL
**Problem**: The OTP slots spread across the `max-w-md` container without constraint — looks slightly sparse on large screens. Minor visual issue.

---

## ALREADY RESPONSIVE (working correctly)

- **AppLayout mobile shell**: Correctly uses Sheet for sidebar on mobile with hamburger trigger, header with org logo/name. Desktop shows fixed sidebar.
- **Sidebar navigation**: Full nav on desktop, slide-out Sheet on mobile with proper close-on-navigate behavior.
- **Client list page**: Uses `grid gap-4 md:grid-cols-2 lg:grid-cols-3` — correctly stacks to 1 column on mobile, 2 on tablet, 3 on desktop. Card-based layout works well.
- **Landing page (LandingPage.tsx)**: Split layout — form on left, hero hidden on mobile (`hidden lg:block lg:w-1/2`). Form section properly centered with `max-w-md`.
- **Public navbar (PublicNavbar.tsx)**: Hamburger menu on mobile (`md:hidden`), desktop links visible at `md:`. CTA buttons stack full-width on mobile.
- **HomePage public pages**: All sections use `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8` — properly constrained and responsive.
- **Dialog component**: Uses `w-full max-w-lg` — fills viewport on mobile with appropriate margins.
- **Client list search bar**: Full-width input with icon — works at all breakpoints.
- **Client cards**: Properly flex layout with truncation on email addresses.
- **Platform metric grid**: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5` — good breakpoint progression.
- **All Recharts components**: Consistently use `<ResponsiveContainer width="100%" height="100%">` — charts resize correctly.
- **Signup form**: `grid grid-cols-2 gap-3` for name fields works at all sizes. All inputs are full-width.
- **Admin layout**: Same Sheet pattern as AppLayout for mobile — consistent and functional.
- **Performance overview charts**: Use ResponsiveContainer with fixed height containers — scale properly.
- **Skeleton loaders**: Match the responsive grid patterns of their corresponding content.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 4 |
| Important | 8 |
| Minor | 7 |
| Already working | 15+ areas |

The most impactful fixes would be: (1) making report rows and client detail action bars stack vertically on mobile, (2) making DashboardHeader controls stack/scroll on small screens, and (3) making settings tabs horizontally scrollable.

