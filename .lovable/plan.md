

# Add Platform Screenshots Across the Entire Marketing Website

## Overview

Copy 10 uploaded screenshots into `src/assets/screenshots/` and place them strategically across all public marketing pages to showcase the platform. The Facebook screenshot gets a CSS gradient fade at the bottom. All images get descriptive alt tags. Images are imported as ES modules for proper bundling.

## Image Inventory

| File | Asset name | Strategic use |
|---|---|---|
| `Dashboard_Snapshot.webp` | `dashboardSnapshot` | HomePage hero area, FeaturesPage, ForAgenciesPage |
| `Performance_Overview.webp` | `perfOverview` | HomePage (features section), FeaturesPage |
| `facebook.webp` | `facebookPlatform` | SocialMediaReportingPage, ForCreatorsPage |
| `instagram.webp` | `instagramPlatform` | SocialMediaReportingPage, ForCreatorsPage, ForFreelancersPage |
| `Google_ads.webp` | `googleAdsPlatform` | PpcReportingPage, ForAgenciesPage |
| `Meta_ads.webp` | `metaAdsPlatform` | PpcReportingPage |
| `G4A.webp` | `gaPlatform` | SeoReportingPage, ForSmbsPage |
| `gsc.webp` | `gscPlatform` | SeoReportingPage |
| `tiktok.webp` | `tiktokPlatform` | SocialMediaReportingPage |
| `YouTube.webp` | `youtubePlatform` | SocialMediaReportingPage, ForCreatorsPage |

## Facebook Gradient Fade

Wrap the Facebook image in a container with a CSS pseudo-element or a div overlay gradient from transparent to background colour at the bottom ~20% of the image, since the screenshot was cut off.

```css
.screenshot-fade-bottom {
  position: relative;
}
.screenshot-fade-bottom::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 25%;
  background: linear-gradient(to bottom, transparent, hsl(var(--background)));
}
```

## Strategic Placement Per Page

### 1. HomePage (`src/pages/HomePage.tsx`)
- **Hero section**: Replace mascot on desktop with `dashboardSnapshot` — full-width showcase of the actual product (much more impactful than a mascot illustration)
- **"How it Works" section**: Add `perfOverview` below the 3 steps to show what the output looks like

### 2. FeaturesPage (`src/pages/FeaturesPage.tsx`)
- **Hero section**: Add `dashboardSnapshot` below the hero text as a large centred showcase
- **Reporting Features section**: Add `perfOverview` alongside the reporting features cards

### 3. SocialMediaReportingPage (`src/pages/SocialMediaReportingPage.tsx`)
- **Hero section**: Add `instagramPlatform` below hero CTA
- **Platform cards section**: Add `facebookPlatform` (with fade), `tiktokPlatform`, `youtubePlatform` interspersed between or after the platform cards

### 4. SeoReportingPage (`src/pages/SeoReportingPage.tsx`)
- **Hero section**: Add `gscPlatform` below hero CTA
- **Platform section**: Add `gaPlatform` alongside the platform detail cards

### 5. PpcReportingPage (`src/pages/PpcReportingPage.tsx`)
- **Hero section**: Add `googleAdsPlatform` below hero CTA
- **Platform section**: Add `metaAdsPlatform` alongside ad platform cards

### 6. WhiteLabelReportsPage (`src/pages/WhiteLabelReportsPage.tsx`)
- **"How it works" section**: Add `dashboardSnapshot` to show the branding in context

### 7. ForAgenciesPage (`src/pages/ForAgenciesPage.tsx`)
- **Hero or solution section**: Add `dashboardSnapshot` showing multi-platform overview
- **Features section**: Add `googleAdsPlatform` to show per-platform depth

### 8. ForFreelancersPage (`src/pages/ForFreelancersPage.tsx`)
- **Hero section**: Add `instagramPlatform` to show what a freelancer's client sees

### 9. ForSmbsPage (`src/pages/ForSmbsPage.tsx`)
- **Features section**: Add `gaPlatform` to show simple analytics view

### 10. ForCreatorsPage (`src/pages/ForCreatorsPage.tsx`)
- **Hero section**: Add `youtubePlatform` to show creator-relevant metrics
- **Metrics section**: Add `instagramPlatform`

## Image Styling

All screenshots will be styled consistently:
- `rounded-xl border border-sidebar-border/30 shadow-2xl` for card-like appearance
- Max-width constrained to `max-w-5xl` for larger showcases, `max-w-3xl` for inline
- On dark backgrounds, they'll pop naturally since they have transparent backgrounds — add `bg-background/50 backdrop-blur-sm` to give them a subtle backing

## Files Modified

| File | Change |
|---|---|
| `src/assets/screenshots/` | Copy all 10 `.webp` files |
| `src/index.css` | Add `.screenshot-fade-bottom` utility class |
| `src/pages/HomePage.tsx` | Replace mascot with dashboard screenshot, add perfOverview |
| `src/pages/FeaturesPage.tsx` | Add dashboard + perfOverview screenshots |
| `src/pages/SocialMediaReportingPage.tsx` | Add instagram, facebook (faded), tiktok, youtube |
| `src/pages/SeoReportingPage.tsx` | Add gsc + ga screenshots |
| `src/pages/PpcReportingPage.tsx` | Add google ads + meta ads screenshots |
| `src/pages/WhiteLabelReportsPage.tsx` | Add dashboard screenshot |
| `src/pages/ForAgenciesPage.tsx` | Add dashboard + google ads screenshots |
| `src/pages/ForFreelancersPage.tsx` | Add instagram screenshot |
| `src/pages/ForSmbsPage.tsx` | Add ga screenshot |
| `src/pages/ForCreatorsPage.tsx` | Add youtube + instagram screenshots |

## Implementation Batches

1. **Batch 1**: Copy all images, add CSS utility, update HomePage + FeaturesPage + ForAgenciesPage
2. **Batch 2**: Update all reporting pages (Social, SEO, PPC, White-Label)
3. **Batch 3**: Update audience pages (Freelancers, SMBs, Creators)

