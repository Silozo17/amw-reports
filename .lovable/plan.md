

# Restyle Marketing Pages to Match AMW Media Visual Language

## What's Changing

The AMW Media site has a distinctive visual rhythm that the Reports site currently lacks. The key differences:

1. **Accent subtitles** — AMW Media uses the `Slowdex` font for small italic labels above headings (e.g., "We are AMW Media", "Our Story", "What we do"). Reports pages have none of these.
2. **Bold gradient divider bands** — AMW Media uses full-width purple/magenta gradient strips as section separators. Reports uses invisible `border-t` lines.
3. **Stronger section contrast** — AMW Media alternates between deep charcoal and a noticeably warmer/lighter background. Reports uses barely-visible `bg-white/[0.03]`.
4. **Star decorations** — AMW Media scatters stars across multiple sections. Reports only has them on the hero.
5. **Cards with hover effects** — AMW Media cards highlight on hover. Reports cards are static.

## Changes Per Page

### Global: New CSS utilities (`src/index.css`)
- Add `.section-light` class: `bg-[hsl(340_7%_18%)]` — a visibly different lighter dark band (matching sidebar-accent shade) instead of the barely-visible `bg-white/[0.03]`
- Add `.gradient-divider` class: a full-width 4px-high purple-to-blue gradient strip (`bg-gradient-brand h-1`)

### All 12 Public Pages — Consistent Pattern
Apply this section rhythm to every page:

1. **Add Slowdex accent subtitle** above each page's main `<h1>` — a small italic label in `font-accent text-primary` (e.g., "Our Platform" on Features, "Simple Pricing" on Pricing, "Our Story" on About, "How It Works" on How It Works, etc.)
2. **Replace `bg-white/[0.03]`** with the stronger `.section-light` background class on alternating sections
3. **Add gradient divider strips** between major section transitions (1-2 per page, used sparingly for impact — typically after the hero and before the CTA)
4. **Add `StarDecoration` components** to 2-3 additional sections per page (not just the hero)
5. **Add hover state to cards**: `hover:border-primary/50 transition-colors` on all feature/platform cards

### Page-Specific Accent Subtitles

| Page | Subtitle above H1 |
|---|---|
| `HomePage.tsx` | "We Are AMW Media" (already has this in LandingHero, add to HomePage hero) |
| `FeaturesPage.tsx` | "Our Platform" |
| `PricingPage.tsx` | "Simple Pricing" |
| `SocialMediaReportingPage.tsx` | "Social Reporting" |
| `SeoReportingPage.tsx` | "SEO Reporting" |
| `PpcReportingPage.tsx` | "PPC Reporting" |
| `WhiteLabelReportsPage.tsx` | "White Label" |
| `IntegrationsPage.tsx` | "Our Integrations" |
| `HowItWorksPage.tsx` | "How It Works" |
| `ForAgenciesPage.tsx` | "For Agencies" |
| `ForFreelancersPage.tsx` | "For Freelancers" |
| `ForSmbsPage.tsx` | "For Small Businesses" |
| `ForCreatorsPage.tsx` | "For Creators" |
| `AboutPage.tsx` | "Our Story" |

Each subtitle renders as:
```tsx
<p className="font-accent text-xl text-primary mb-2">Our Platform</p>
```

### Section-Specific Changes

**Each section heading** that currently just has `<h2>` will get a smaller Slowdex label above it too, matching the AMW Media pattern of "What we do" → "OUR SERVICES", "Our work" → "FEATURED PROJECTS" etc. For example:
- "How it works" → `<p className="font-accent text-lg text-primary mb-1">How it works</p>` above `<h2>Three Steps...</h2>`
- "What you get" → above features sections
- "What they say" → above testimonial/quote sections

## Files Modified

| File | Change |
|---|---|
| `src/index.css` | Add `.section-light` and `.gradient-divider` utility classes |
| `src/pages/HomePage.tsx` | Add accent subtitle, gradient dividers, stronger section backgrounds, more stars, card hovers |
| `src/pages/FeaturesPage.tsx` | Same pattern |
| `src/pages/PricingPage.tsx` | Same pattern |
| `src/pages/SocialMediaReportingPage.tsx` | Same pattern |
| `src/pages/SeoReportingPage.tsx` | Same pattern |
| `src/pages/PpcReportingPage.tsx` | Same pattern |
| `src/pages/WhiteLabelReportsPage.tsx` | Same pattern |
| `src/pages/IntegrationsPage.tsx` | Same pattern |
| `src/pages/HowItWorksPage.tsx` | Same pattern |
| `src/pages/ForAgenciesPage.tsx` | Same pattern |
| `src/pages/ForFreelancersPage.tsx` | Same pattern |
| `src/pages/ForSmbsPage.tsx` | Same pattern |
| `src/pages/ForCreatorsPage.tsx` | Same pattern |
| `src/pages/AboutPage.tsx` | Same pattern |

## Implementation Batches

1. **Batch 1**: CSS utilities + HomePage + FeaturesPage + PricingPage + AboutPage
2. **Batch 2**: Reporting pages (Social, SEO, PPC, White-Label, Integrations, How It Works)
3. **Batch 3**: Audience pages (Agencies, Freelancers, SMBs, Creators)

