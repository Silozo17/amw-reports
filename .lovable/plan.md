
The user wants upsells visible on shared portal links, with per-client configuration for offers (price, description, related service category).

Let me check current upsell state.
<lov-tool-use id="toolu_vrtx_012jCqGCL5BNUC9PLuvGHBoY" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/clients/UpsellTab.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01XY3SPKpA3bHsSsDBm3z6kf" name="code--search_files" integration-id="code" data="{\"query\": \"report_upsells\", \"include_patterns\": \"*.ts,*.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01YAWBfWSDaAufmtm7hz84oe" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/clients/UpsellTab.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01TEPZcMGosDXjaJFt88AWAD" name="code--search_files" integration-id="code" data="{\"query\": \"report_upsells\", \"include_patterns\": \"*.ts,*.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01XTU6LXrTzR26Va8oRh4ti8" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/clients/ClientDashboard.tsx\", \"lines\": \"1-80\"}">
</lov-tool-use>
I have enough context. Let me check the ClientDashboard for portalToken handling and where to render upsells.
<lov-tool-use id="toolu_vrtx_01SkPPtQ5bFSv2AgT2Cm7AJj" name="code--search_files" integration-id="code" data="{\"query\": \"portalToken\", \"include_patterns\": \"src/**/*.tsx,src/**/*.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_012M2G1djEcpXyqxtUU1MzEy" name="code--search_files" integration-id="code" data="{\"query\": \"enable_upsell\", \"include_patterns\": \"src/**/*.tsx,src/**/*.ts,supabase/**/*.ts\"}">
</lov-tool-use>
I have all I need. The user is asking for upsells on the share link, but the existing `report_upsells` system is month-specific and PDF-focused. The user wants something different: persistent upsell offers tied to categories (Paid Ads, SEO, Organic Content) shown on the portal share link with prices/offers.

Let me ask a clarifying question and present the plan.

<lov-plan>
## Goal
Show upsell recommendations on the public share link (`/portal/:token`), with per-client settings to define which services to offer, with prices/offers, and which category they relate to (Paid Ads, SEO, Organic Content, etc.).

## How this differs from existing upsells
Today, `report_upsells` is **month-specific** — each row targets one report month and is consumed by the PDF generator. That's not the right shape for the portal because:
- The portal is always-on, not tied to a specific report month
- The user wants offers grouped by category, not scheduled per month
- Prices/offers should be persistent

So this is a **new feature**, not a modification of `report_upsells`. The existing scheduled-upsell PDF flow stays untouched.

## Plan

### 1. New table: `client_portal_upsells`
Persistent offers shown on the share link.
```
id, org_id, client_id,
category (enum: 'paid_ads' | 'seo' | 'organic_content' | 'email' | 'web' | 'other'),
title (e.g. "SEO Growth Package"),
description (short paragraph for the client),
price_label (free text, e.g. "£350+VAT/month", "From £500", "Custom quote"),
cta_label (e.g. "Book a call", default),
cta_url (mailto: / external link / calendly),
sort_order, is_active, created_at, updated_at
```
RLS: org members manage; portal access is read-only via the edge function (service role).

### 2. New per-client toggle: `clients.show_portal_upsells` (boolean, default true)
Master switch — same pattern as `show_health_score`.

### 3. New settings UI on the client page
Add a new section inside the existing **Upsells tab** (`UpsellTab.tsx`) — or a new sub-tab if preferred — titled **"Portal Offers"**:
- Toggle: "Show offers on share link"
- List of offers with Add / Edit / Delete
- Form: category (dropdown), title, description, price label, CTA label, CTA URL
- Drag-to-reorder (or up/down buttons — simpler)

The existing month-scheduled upsell UI in that tab is preserved.

### 4. Portal data wiring
- `supabase/functions/portal-data/index.ts` — also fetch active `client_portal_upsells` rows + add `show_portal_upsells` to the clients select, return as `portalUpsells` and `client.show_portal_upsells`.
- `src/pages/ClientPortal.tsx` — read both, pass to `ClientDashboard` via a new optional prop `portalUpsells`.

### 5. Portal display component
New `src/components/clients/dashboard/PortalUpsells.tsx` — rendered only when `portalToken` is set, `show_portal_upsells !== false`, and there's at least one offer.
- Section heading: "Recommended for you"
- Grouped by category (Paid Ads, SEO, Organic Content, …)
- Card per offer: title, description, price label, CTA button → opens `cta_url` in new tab (or `mailto:`)
- Inserted near the bottom of the dashboard, above the footer.

### 6. Type safety
- Add `ClientPortalUpsell` interface in `src/types/database.ts`
- After migration runs, `supabase/types.ts` regenerates automatically — no manual edit.

## Out of scope (flag for later if wanted)
- Stripe checkout / actual payment collection — CTAs are link-out only for v1
- Tracking which offers a client clicked on
- Per-month overrides of portal offers
- Reusing portal offers in the PDF report

## Files touched
- New migration: `client_portal_upsells` table + RLS + `clients.show_portal_upsells` column
- New: `src/components/clients/PortalUpsellsSettings.tsx` (offer manager, used inside `UpsellTab` or `ClientSettingsTab`)
- New: `src/components/clients/dashboard/PortalUpsells.tsx` (portal-side renderer)
- Edit: `src/components/clients/UpsellTab.tsx` — embed the new settings section
- Edit: `src/components/clients/tabs/ClientSettingsTab.tsx` — add `show_portal_upsells` toggle
- Edit: `supabase/functions/portal-data/index.ts` — fetch + return offers
- Edit: `src/pages/ClientPortal.tsx` — pass offers down
- Edit: `src/components/clients/ClientDashboard.tsx` — render `<PortalUpsells />` when in portal mode
- Edit: `src/types/database.ts` — new interface + add field to `Client`

## One thing to confirm before I build
The 6 fixed categories I'm proposing — **Paid Ads, SEO, Organic Content, Email, Web, Other** — match your existing platform groupings. OK to use those, or do you want different category names?
