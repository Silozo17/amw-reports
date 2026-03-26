

# Fix: Admin Panel Responsiveness, Missing Org, and Homepage Button Text

## Issues Identified

1. **Admin panel not responsive on mobile** — The `AdminLayout` uses a fixed `w-64` sidebar with `flex` layout. On mobile (402px viewport from your screenshot), both sidebar and content try to render side-by-side, causing content overflow and truncation ("PLATFORM OVERVIEW" text gets cut off).

2. **Re Digital organisation not visible** — The `AdminOrgList` query fetches all organisations but filters connections globally (`platform_connections` without filtering by org). More importantly, Re Digital may not have an `org_subscriptions` record yet (the seed migration may not have matched their actual org ID). Need to verify and ensure the query works regardless.

3. **Homepage white "See Features" button has invisible text** — The outline button on the dark homepage uses `variant="outline"` which applies `border-input bg-background` — `bg-background` is the light beige/cream colour (`32 44% 92%`), making the button background light while the text colour `text-amw-offwhite` is also light/white. The text becomes invisible against the light background.

---

## Plan

### 1. Make AdminLayout responsive (mobile-friendly)

**File: `src/components/admin/AdminLayout.tsx`**
- On mobile (`< md`), hide the sidebar by default and show a hamburger/sheet trigger
- Use the shadcn `Sheet` component for a slide-out sidebar on mobile
- Keep the fixed sidebar on `md:` and above
- Add a mobile header bar with "AMW Admin" title and menu button

### 2. Fix homepage outline button text visibility

**File: `src/pages/HomePage.tsx`**
- The "See Features" button uses `variant="outline"` which inherits `bg-background` (light beige). On the dark homepage this makes text invisible.
- Remove `variant="outline"` and use explicit dark-compatible classes instead: transparent background, visible border, white text. E.g. `className="border border-amw-offwhite/30 bg-transparent text-amw-offwhite hover:bg-amw-offwhite/10"`

### 3. Investigate and fix missing Re Digital organisation

**Database check needed** — The `AdminOrgList` connection count query doesn't filter by org (`platform_connections` has no `org_id` column — it links to clients which link to orgs). This means every org shows the same global connection count. Fix:
- Join through `clients` to count connections per org: query `platform_connections` joined with `clients.org_id`
- Verify Re Digital's organisation exists in the `organisations` table and has a subscription record

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/admin/AdminLayout.tsx` | Add mobile sheet sidebar with hamburger toggle, keep desktop sidebar |
| `src/pages/HomePage.tsx` | Fix "See Features" button styling for dark background |
| `src/pages/admin/AdminOrgList.tsx` | Fix connection count query to filter by org via clients table |

