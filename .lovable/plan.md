

# Plan: Pricing Page Expansion, Dashboard Categories, Portal AI Analysis

## Task 1 — Expand Pricing Page with Comparison Table and Tooltips

The current pricing page has plan cards and a basic comparison table but lacks explanatory tooltips or detailed feature descriptions.

**Changes to `src/pages/PricingPage.tsx`:**
- Add an `info` tooltip (ℹ) to each row in `COMPARISON_ROWS` with a plain-English explanation of what the feature means (e.g. "Connections" → "A connection links one client to one platform. Connecting Google Ads + Instagram for one client = 2 connections.")
- Expand `COMPARISON_ROWS` to include additional features: AI Analysis, Data Retention, Team Members, Report Customisation, Email Support
- Add a "What's included in every plan" expanded section below universal features with short descriptions for each
- Use `TooltipProvider` / `Tooltip` from shadcn for the (i) icons in the comparison table
- Add a "Who is this for?" blurb under each plan card name

**No new files.** Single file edit.

---

## Task 2 — Categorise Platform Breakdowns on Dashboard

Currently, the "Platform Breakdown" section in `ClientDashboard.tsx` lists all platforms in a flat list. This will group them under category headings.

**Changes to `src/types/database.ts`:**
- Add a `PLATFORM_CATEGORIES` constant mapping categories to platforms:
  - **Paid Advertising**: `google_ads`, `meta_ads`, `tiktok_ads`
  - **Organic Social**: `facebook`, `instagram`, `tiktok`, `linkedin`, `youtube`, `pinterest`
  - **SEO & Web Analytics**: `google_search_console`, `google_analytics`, `google_business_profile`

**Changes to `src/components/clients/ClientDashboard.tsx`:**
- Replace the flat `filtered.map(snapshot => ...)` with a grouped render:
  - Loop through `PLATFORM_CATEGORIES`, filter snapshots per category
  - Render a category heading (e.g. "Paid Advertising", "Organic Social", "SEO & Web Analytics") with an icon before each group
  - Skip empty categories (no snapshots for that group)

---

## Task 3 — Add AI Analysis to Client Portal (Share Link)

Currently, AI analysis is hidden when `isPortal` is true. This will enable it for portal users with a restructured prompt that generates a main overview + per-category section breakdowns.

### 3a. Update Edge Function — `supabase/functions/analyze-client/index.ts`

- Accept an optional `portal` boolean in the request body
- Restructure the AI prompt to generate:
  1. **Overall Performance Summary** (2-3 paragraphs covering everything)
  2. **Paid Advertising** section (only if paid platform data exists)
  3. **Organic Social** section (only if organic platform data exists)
  4. **SEO & Web Analytics** section (only if SEO platform data exists)
- Each section uses a markdown `## Heading` so it can be split/rendered in the UI
- Increase `max_tokens` from 1000 to 2000 to accommodate the longer structured output

### 3b. Update `useClientDashboard.ts`

- Remove the `isPortal` guard that prevents AI analysis from running
- Allow portal users to trigger analysis (the edge function uses service role key, so no auth needed)
- Store the analysis text as before

### 3c. Update `ClientDashboard.tsx`

- Remove the `!isPortal &&` guards around the AI Analysis card, button, and dialog
- Parse the markdown analysis into sections using `## ` heading splits
- Render the main summary at the top as before
- Render per-category mini-analysis cards under each platform category group (from Task 2), matching by heading name
- In the full analysis dialog, show all sections with proper heading hierarchy

### 3d. Update `supabase/functions/portal-data/index.ts`

- No changes needed — the analyze-client function already uses service role key and accepts client_id directly

---

## Files Affected

| File | Change |
|---|---|
| `src/pages/PricingPage.tsx` | Add tooltips, expand comparison table, add feature descriptions |
| `src/types/database.ts` | Add `PLATFORM_CATEGORIES` constant |
| `src/components/clients/ClientDashboard.tsx` | Group platforms by category, enable AI for portal, section-based rendering |
| `src/hooks/useClientDashboard.ts` | Remove portal guard on AI analysis |
| `supabase/functions/analyze-client/index.ts` | Restructure prompt for sectioned output, increase max_tokens |

