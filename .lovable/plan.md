

# Standardize Platform Ordering Across All Pages

## Canonical Order

Organic Social → Paid Advertising → SEO & Web Analytics (no category labels shown):

1. Facebook
2. Instagram
3. LinkedIn
4. YouTube
5. TikTok
6. Pinterest
7. Threads
8. Google Ads
9. Meta Ads
10. TikTok Ads
11. LinkedIn Ads
12. Google Search Console
13. Google Analytics
14. Google Business Profile

## Files to Update

| File | Current Order | Change |
|------|--------------|--------|
| `src/pages/HomePage.tsx` | Ads → SEO → Social (mixed) | Reorder to canonical |
| `src/pages/ForAgenciesPage.tsx` | Ads first, mixed | Reorder to canonical |
| `src/pages/ForCreatorsPage.tsx` | YouTube first, mixed | Reorder subset to canonical |
| `src/pages/ForSmbsPage.tsx` | Ads first, mixed | Reorder to canonical |
| `src/pages/HowItWorksPage.tsx` | Same as Agencies | Reorder to canonical |
| `src/pages/IntegrationsPage.tsx` | Ads → SEO → Social | Reorder to canonical (keep category field for badge but reorder array) |
| `src/pages/SocialMediaReportingPage.tsx` | Already organic-only, minor reorder if needed |
| `src/pages/PpcReportingPage.tsx` | Already paid-only — keep as-is |
| `src/pages/SeoReportingPage.tsx` | Already SEO-only — keep as-is |

## Technical Details

- Each file has a `PLATFORMS` constant — reorder the array entries only
- No structural, styling, or logic changes
- Category-specific pages (PPC, SEO, Social) keep their existing order within their domain
- ForCreatorsPage has a subset (8 platforms) — reorder within same canonical sequence

