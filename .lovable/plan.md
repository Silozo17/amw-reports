

# Static SEO Pages + Sitemap + Meta + Semantic HTML

## Overview

5 changes:
1. Add static HTML for **Features**, **Pricing**, and **Login** pages into `index.html`
2. Create `public/sitemap.xml`
3. Add per-page `<title>` and `<meta description>` via a React hook (no library needed)
4. Fix heading hierarchy (h1→h2→h3) and add `alt` tags across all public pages
5. Update `robots.txt` with sitemap reference

---

## 1. Static HTML in `index.html`

Add three new page blocks inside `#seo-static`, each wrapped in a container with `data-page` attributes. Use CSS to show only the correct page based on URL path matching via a small inline `<script>` that runs before React:

```text
<script>
  (function(){
    var p = location.pathname;
    var pages = document.querySelectorAll('[data-seo-page]');
    for(var i=0;i<pages.length;i++){
      pages[i].style.display = pages[i].getAttribute('data-seo-page') === p ? '' : 'none';
    }
  })();
</script>
```

Each page block reuses the existing `ss-*` CSS classes already in `index.html`.

### Features page static HTML (`data-seo-page="/features"`)
- Navbar (reuse same markup)
- Hero: h1 "Everything You Need to Report Like a Pro"
- Platform Integrations section: h2 + 10 platform cards with metric pills (uses new `ss-platform-grid` CSS — 2-col grid)
- Reporting & Delivery section: h2 + 4 feature cards with inline SVG icons
- Agency Tools section: h2 + 3 cards
- CTA section
- Footer (reuse same markup)

### Pricing page static HTML (`data-seo-page="/pricing"`)
- Navbar
- Hero: h1 "Simple, Transparent Pricing"
- 3 plan cards (Creator Free, Freelance £49.99, Agency £69.99) with feature lists and checkmarks
- Compare Plans table (h2): 10-row comparison with ✓/✗
- FAQ section (h2): 8 questions as `<details><summary>` elements (native, no JS needed)
- CTA section
- Footer

### Login page static HTML (`data-seo-page="/login"`)
- Minimal: just a centered card with h1 "Sign In to AMW Reports", brief description, and links to signup/home. No actual form (crawlers don't need it).
- Footer links for privacy/terms

### Existing home page block
- Wrap in `data-seo-page="/"` attribute

### Additional CSS
Add to the existing `<style>` block:
- `.ss-platform-grid` — 1-col mobile, 2-col at 768px
- `.ss-plan-grid` — 1-col mobile, 3-col at 768px
- `.ss-plan-card` — card styling with highlight variant
- `.ss-compare-table` — basic table styling
- `details summary` — FAQ accordion styling
- `.ss-feature-row` — icon + text flex row

---

## 2. `public/sitemap.xml`

Create with all public URLs:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://reports.amwmedia.co.uk/</loc><priority>1.0</priority></url>
  <url><loc>https://reports.amwmedia.co.uk/features</loc><priority>0.8</priority></url>
  <url><loc>https://reports.amwmedia.co.uk/pricing</loc><priority>0.8</priority></url>
  <url><loc>https://reports.amwmedia.co.uk/login</loc><priority>0.5</priority></url>
</urlset>
```

---

## 3. Per-Page Meta Titles & Descriptions

Create `src/hooks/usePageMeta.ts` — a simple hook that sets `document.title` and the meta description tag on mount:

```ts
useEffect(() => {
  document.title = title;
  document.querySelector('meta[name="description"]')?.setAttribute('content', description);
}, [title, description]);
```

Apply to each page component:

| Page | Title (≤60 chars) | Description (≤155 chars) |
|---|---|---|
| HomePage | `AMW Reports — Automated Marketing Reports for Agencies` | `Connect 10+ platforms, generate branded PDF reports, and deliver client insights automatically. Built for agencies.` |
| FeaturesPage | `Features — AMW Reports` | `10 platforms, 70+ metrics, branded PDFs, automated email delivery, and a white-label client portal.` |
| PricingPage | `Pricing — AMW Reports` | `Start free with 1 client. Upgrade to Freelance or Agency plans. No contracts, no per-seat pricing.` |
| LandingPage | `Log In — AMW Reports` | `Sign in to your AMW Reports account or create a new one. Automated marketing reports for agencies.` |

Also update OG/Twitter tags dynamically in the same hook.

---

## 4. Heading Hierarchy & Alt Tags

### React components to fix:

**HomePage.tsx**: Already correct (h1 → h2 → h3). Add `alt` text to logo images.

**FeaturesPage.tsx**: Already correct. No images to fix.

**PricingPage.tsx**: 
- Plan names use `h3` under an implicit section — correct
- `CellValue` check/x icons need `aria-label`

**LandingPage.tsx**:
- Mobile header has `h1` for "AMW" but the main login form uses `h2` — this is fine since the h1 exists
- Add `role="img"` and `aria-label` to the hero side panel

**PublicNavbar.tsx**: Logo img already has `alt="AMW Reports"` — good.

**PublicFooter.tsx**: Logo img already has `alt="AMW Reports"` — good. Add `aria-label` to external links.

### Static HTML in index.html:
- Ensure all `<img>` have descriptive `alt`
- Ensure all `<a>` have either visible text or `aria-label`
- Heading order: each page section uses h1 (hero) → h2 (sections) → h3 (cards)

---

## 5. `public/robots.txt`

Add sitemap reference:
```
Sitemap: https://reports.amwmedia.co.uk/sitemap.xml
```

---

## Files Modified

| File | Change |
|---|---|
| `index.html` | Add Features/Pricing/Login static HTML + page-switcher script + new CSS classes |
| `public/sitemap.xml` | New file |
| `public/robots.txt` | Add Sitemap line |
| `src/hooks/usePageMeta.ts` | New hook for dynamic title/description |
| `src/pages/HomePage.tsx` | Add `usePageMeta()` call |
| `src/pages/FeaturesPage.tsx` | Add `usePageMeta()` call |
| `src/pages/PricingPage.tsx` | Add `usePageMeta()` call, add aria-labels |
| `src/pages/LandingPage.tsx` | Add `usePageMeta()` call |
| `src/components/landing/PublicFooter.tsx` | Add aria-labels to external links |

