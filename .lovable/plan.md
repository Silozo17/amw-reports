

# Static SEO HTML for All Pages + Fix Flash

## Two Problems to Solve

### 1. Flash of static content on reload
The current mechanism `#root:not(:empty) ~ #seo-static { display: none }` shows the static HTML until React renders. Users see a brief flash of unstyled/shifted content.

**Fix**: Hide `#seo-static` from users entirely using CSS, but keep it visible to crawlers:
```css
/* Hidden from visual users immediately — crawlers still read it */
#seo-static {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```
This is the standard "visually hidden" / sr-only technique. Search engine crawlers parse the DOM regardless of CSS visibility, so all content remains indexable. No flash, no layout shift, no user-visible artifact.

Remove the old `#root:not(:empty) ~ #seo-static { display: none }` rule and the inline page-switcher `<script>` (no longer needed since content is always visually hidden).

### 2. Add static HTML for all 11 missing public pages

Add `data-seo-page` blocks for each missing page. Each block contains:
- Semantic navbar with links
- Full page content (headings, paragraphs, lists, FAQs) matching the React component
- Footer
- Proper heading hierarchy (h1 → h2 → h3)
- Alt tags on images, aria-labels on links

#### Pages to add:
| Route | Source component |
|---|---|
| `/social-media-reporting` | `SocialMediaReportingPage.tsx` |
| `/seo-reporting` | `SeoReportingPage.tsx` |
| `/ppc-reporting` | `PpcReportingPage.tsx` |
| `/white-label-reports` | `WhiteLabelReportsPage.tsx` |
| `/for-agencies` | `ForAgenciesPage.tsx` |
| `/for-freelancers` | `ForFreelancersPage.tsx` |
| `/for-smbs` | `ForSmbsPage.tsx` |
| `/for-creators` | `ForCreatorsPage.tsx` |
| `/integrations` | `IntegrationsPage.tsx` |
| `/how-it-works` | `HowItWorksPage.tsx` |
| `/about` | `AboutPage.tsx` |

Each static block will replicate the full text content from its React component using the existing CSS classes (`.ss-section`, `.ss-container`, `.ss-section-title`, `.ss-faq-item`, `.ss-pill`, `.ss-metric-pill`, `.ss-feature-row`, `.ss-plan-card`, etc.).

## Files Modified

| File | Change |
|---|---|
| `index.html` | (1) Replace hide rule with visually-hidden CSS, (2) remove page-switcher script, (3) add 11 new `data-seo-page` blocks with full semantic HTML |

## Implementation Batches

Due to the size of `index.html` (will grow significantly), implementation in 2 batches:
1. **Batch 1**: Fix the flash (CSS change + remove script) + add 6 pages (social-media-reporting, seo-reporting, ppc-reporting, white-label-reports, integrations, how-it-works)
2. **Batch 2**: Add 5 audience pages (for-agencies, for-freelancers, for-smbs, for-creators, about)

