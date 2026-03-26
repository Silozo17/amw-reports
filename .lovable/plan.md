

# Public Marketing Website — Home, Features, Pricing

## Overview

Replace the current single landing page (auth-only split screen) with a full public marketing website consisting of three pages. The existing login/signup flow moves to a dedicated `/login` route. Logged-in users still redirect to `/dashboard`.

## Current State

- `/` — Split-screen: auth forms on the left, dark hero panel on the right
- No public marketing pages exist
- The `LandingHero` component has brand assets (mascot, logo, warped grid, star decorations) that can be reused

## New Route Structure

| Route | Page | Purpose |
|-------|------|---------|
| `/` | HomePage | Full marketing homepage |
| `/features` | FeaturesPage | Detailed platform capabilities |
| `/pricing` | PricingPage | Plan comparison and CTA |
| `/login` | LoginPage (existing `LandingPage.tsx` renamed) | Auth forms with hero panel |

## Shared Components

### `PublicNavbar.tsx`
Sticky top nav with AMW Reports logo, links (Home, Features, Pricing), and Login / Get Started buttons. Mobile hamburger menu. Dark background matching the brand.

### `PublicFooter.tsx`
Full footer with: AMW Media branding, links (Privacy, Terms, Features, Pricing), social links, copyright. Reuses existing footer content from `LandingPage.tsx`.

### `PublicLayout.tsx`
Wraps all public pages with `PublicNavbar` + `PublicFooter`. Keeps the dark premium aesthetic (`bg-amw-black text-amw-offwhite`).

## Page 1: HomePage (`/`)

Sections top to bottom:

1. **Hero** — Reuse/adapt the existing `LandingHero` component. Full-width dark section with the mascot, headline ("Automated Marketing Reports That Elevate Your Agency"), subtitle, and two CTAs: "Get Started Free" → `/login` (signup view) and "See Features" → `/features`.

2. **Platform Logos** — "Trusted integrations" strip showing Google Ads, Meta Ads, GA4, Search Console, YouTube, Facebook, Instagram, LinkedIn, TikTok, Google Business Profile icons/logos.

3. **How It Works** — 3-step visual: Connect → Sync → Report. Brief explanation of the automated workflow.

4. **Stats at a Glance** — Grid of key metrics the platform tracks, grouped by category (Ads, SEO, Social, Web Analytics). Reference the `METRIC_EXPLANATIONS` data to show breadth. E.g. "70+ metrics across 10 platforms."

5. **Why AMW Reports** — Comparison points vs. competitors: white-label, automated delivery, multi-platform in one place, no per-seat pricing, built by marketers for marketers.

6. **Founder Quote** — Quote block from Amir (AMW Media founder). Photo placeholder, name, title, short testimonial about why they built the platform.

7. **CTA Banner** — "Ready to elevate your reporting?" with Get Started Free button.

## Page 2: FeaturesPage (`/features`)

Sections:

1. **Hero** — "Everything You Need to Report Like a Pro." Subtitle explaining the platform.

2. **Platform Deep Dives** — One card/section per integration (Google Ads, Meta Ads, GA4, GSC, YouTube, Facebook Pages, Instagram, LinkedIn, TikTok, Google Business Profile). Each shows: platform icon, name, list of metrics synced (pulled from `METRIC_EXPLANATIONS` keys), and a brief description of what data is collected.

3. **Reporting Features** — Branded PDF generation, automated monthly email delivery, white-label customisation, client portal with shared links.

4. **Client Management** — Multi-client dashboard, per-client connections, audience demographics, top content tracking.

5. **Agency Tools** — White-labelling (custom logo, colours, domain