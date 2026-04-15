

# SEO Content Expansion Plan — Keyword-Rich Copy for All Public Pages

## Overview

This plan adds 400–1000 words of keyword-targeted, semantically relevant content to each of the 12 public marketing pages. The content will be added as new `<section>` blocks that follow the existing design patterns (alternating `section-light` backgrounds, consistent typography classes, max-width containers). No existing content will be modified or removed.

## Pages and Target Keywords

| Page | File | Current ~Words | Target Keywords |
|------|------|---------------|-----------------|
| **Home** | `HomePage.tsx` | ~350 | marketing reporting tool, automated client reports, multi-platform analytics dashboard, agency reporting software |
| **About** | `AboutPage.tsx` | ~400 | about AMW Reports, marketing agency reporting, UK marketing tool, agency automation |
| **Pricing** | `PricingPage.tsx` | ~300 | marketing report pricing, free reporting tool, agency report cost, freelancer reporting plan |
| **Features** | `FeaturesPage.tsx` | ~350 | marketing report features, branded PDF reports, automated report delivery, client portal dashboard |
| **Social Media Reporting** | `SocialMediaReportingPage.tsx` | ~350 | social media reporting tool, Instagram analytics report, Facebook reporting, TikTok analytics |
| **SEO Reporting** | `SeoReportingPage.tsx` | ~250 | SEO reporting tool, Google Search Console report, GA4 analytics report, keyword ranking report |
| **PPC Reporting** | `PpcReportingPage.tsx` | ~250 | PPC reporting tool, Google Ads report, Meta Ads report, ad spend tracking |
| **White-Label Reports** | `WhiteLabelReportsPage.tsx` | ~300 | white-label reporting, branded client reports, custom domain reports, agency white-label tool |
| **For Agencies** | `ForAgenciesPage.tsx` | ~300 | agency reporting software, multi-client reporting, automated agency reports |
| **For Freelancers** | `ForFreelancersPage.tsx` | ~200 | freelancer reporting tool, freelance marketing reports, client reporting for freelancers |
| **For Creators** | `ForCreatorsPage.tsx` | ~200 | creator analytics, social media analytics for creators, sponsor-ready reports |
| **For Small Businesses** | `ForSmbsPage.tsx` | ~300 | small business marketing analytics, SMB reporting tool, marketing dashboard for small businesses |
| **Integrations** | `IntegrationsPage.tsx` | ~150 | marketing integrations, Google Ads integration, Meta Ads integration, platform connections |
| **How It Works** | `HowItWorksPage.tsx` | ~250 | how marketing reports work, automated report generation, marketing data sync |

## Content Strategy Per Page

Each page gets **1–3 new sections** added before the final CTA, containing:

1. **Long-form explanatory copy** — 2–4 paragraphs of natural, keyword-rich text explaining the value proposition in depth
2. **"Why" or "Who It's For" section** — addressing specific user pain points with targeted search phrases
3. **FAQ expansion** (where FAQs don't already exist) — 3–5 Q&A pairs using long-tail question keywords (e.g., "What is the best social media reporting tool for agencies?")

Content will be written in the existing brand voice: professional, direct, no jargon, UK English spelling.

## Technical Approach

- **No new components** — all content uses existing HTML elements (`<section>`, `<h2>`, `<h3>`, `<p>`) with existing Tailwind classes
- **No new dependencies**
- **Preserves existing layout** — new sections inserted between existing content and the final CTA
- **SEO meta descriptions** will be reviewed and expanded where currently under 150 characters
- All heading tags will follow proper hierarchy (h1 → h2 → h3)
- Keywords will be naturally integrated, not stuffed — targeting 1–2% keyword density

## Implementation Order

1. Home page (highest priority — landing page)
2. Features page
3. Solution pages (Social, SEO, PPC, White-Label)
4. Audience pages (Agencies, Freelancers, Creators, SMBs)
5. Supporting pages (Pricing, About, Integrations, How It Works)

## Estimated Scope

- 12–14 files modified
- ~6,000–10,000 total words of new content
- No database or backend changes
- No visual design changes — uses existing section patterns

