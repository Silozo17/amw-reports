

# Update All SEO Content for 12 Platforms + AI Bot Access

## What Changed
TikTok Ads was added as a separate platform (Business API), bringing the total from 11 to **12 platforms**. The SEO static HTML in `index.html`, React page content, `robots.txt`, and meta descriptions all reference outdated platform counts ("10+", "10", "11") and are missing "TikTok Ads" from platform lists. The `robots.txt` also lacks rules for AI crawlers.

## Plan

### 1. Update `robots.txt` — AI bot access
Add explicit rules for all major AI crawlers to ensure content is accessible:
- `GPTBot`, `ChatGPT-User` (OpenAI)
- `Google-Extended`, `Googlebot` (Google/Gemini)  
- `anthropic-ai`, `Claude-Web` (Anthropic)
- `Bytespider` (TikTok/Bytedance)
- `PerplexityBot`, `YouBot`, `CCBot`, `Applebot-Extended`
- All set to `Allow: /`

### 2. Update `index.html` SEO static content
Every `data-seo-page` section needs these changes:

**Global across all pages:**
- Copyright `© 2025` → `© 2026`
- All "10 platforms" / "10+" references → "12"
- All "11 platforms" references → "12"

**Home page (`/`):**
- Platform pills: add `TikTok Ads` pill (currently only has `TikTok`)
- "70+ Metrics Across 10 Platforms" → "12 Platforms"
- "10 platforms in one dashboard" → "12 platforms"
- "connects 10+ marketing platforms" → "connects 12 marketing platforms"

**Features page (`/features`):**
- "10 platforms, 70+ metrics" → "12 platforms"
- Split TikTok card into **TikTok** (organic: followers, views, likes, comments, shares, video views) and **TikTok Ads** (paid: spend, impressions, clicks, CTR, CPC, CPM, conversions, conv. value, reach, video views, conversion rate)
- FAQ "We currently support...TikTok..." → add "TikTok Ads"

**Integrations page (`/integrations`):**
- "Connect 11 marketing platforms" → "Connect 12 marketing platforms"
- Platform pills already has TikTok Ads — confirmed correct

**Social Media Reporting (`/social-media-reporting`):**
- TikTok card currently shows ad metrics — rename to "TikTok Ads" or add a separate organic TikTok card
- Add TikTok Ads as distinct platform card

**PPC Reporting (`/ppc-reporting`):**
- FAQ: "Google Ads, Meta Ads, and TikTok Ads" — already correct
- Ensure TikTok Ads card is present with full metrics

**For SMBs (`/for-smbs`):**
- Platform pills: add `TikTok Ads`

**For Creators (`/for-creators`):**
- Platform pills: add `TikTok Ads` (creators may run ads too)

**Pricing (`/pricing`):**
- FAQ "What platforms are supported?": update to include TikTok Ads, say "12 platforms in total"

### 3. Update `index.html` head meta tags
- `<meta name="description">`: "Connect 10+ marketing platforms" → "Connect 12 marketing platforms"
- OG/Twitter descriptions: same update

### 4. Update React page meta descriptions + content
Files to modify with "10+" → "12" and add "TikTok Ads" to platform arrays:

| File | Changes |
|---|---|
| `HomePage.tsx` | PLATFORMS array: add `'TikTok Ads'`; FEATURES desc: "12"; WHY_POINTS: "12 platforms"; pageTitle desc: "12"; stat labels: "12 Platforms" |
| `FeaturesPage.tsx` | usePageMeta desc: "12"; hero text: "12"; section title: "12" |
| `IntegrationsPage.tsx` | usePageMeta title: "12"; already has TikTok Ads in PLATFORMS |
| `HowItWorksPage.tsx` | PLATFORMS array: add `'TikTok Ads'`; step text: "12 platforms" |
| `SocialMediaReportingPage.tsx` | Add TikTok Ads to PLATFORMS array with ad metrics; update TikTok entry to organic metrics |
| `PpcReportingPage.tsx` | Verify TikTok Ads is listed |
| `ForSmbsPage.tsx` | PLATFORMS array: add `'TikTok Ads'` |
| `ForAgenciesPage.tsx` | "10 platforms" → "12 platforms" |
| `PricingPage.tsx` | "10+ Platform Support" → "12 Platform Integrations"; FAQ answer: "12 platforms" |
| `ForFreelancersPage.tsx` | "10 platforms" → "12 platforms" |
| `LandingHero.tsx` | FEATURES desc: "12 platforms" if referenced |

### 5. Update `LandingHero.tsx`
- Feature card "Google, Meta, TikTok, LinkedIn & more" → "Google, Meta, TikTok Ads, LinkedIn & more"

---

## Technical Details

**Files to modify:**
- `public/robots.txt`
- `index.html` (SEO static HTML + head meta tags)
- `src/pages/HomePage.tsx`
- `src/pages/FeaturesPage.tsx`
- `src/pages/IntegrationsPage.tsx`
- `src/pages/HowItWorksPage.tsx`
- `src/pages/SocialMediaReportingPage.tsx`
- `src/pages/PpcReportingPage.tsx`
- `src/pages/ForSmbsPage.tsx`
- `src/pages/ForAgenciesPage.tsx`
- `src/pages/ForFreelancersPage.tsx`
- `src/pages/PricingPage.tsx`
- `src/components/landing/LandingHero.tsx`

No new files. No database changes. No edge function changes.

