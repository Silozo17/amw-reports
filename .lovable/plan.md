

# PageSpeed Insights Performance Optimization

Based on the Lighthouse audit (Mobile: Performance 53, Accessibility 95, Best Practices 100, SEO 100), here are the issues and fixes.

## Issues Identified from Screenshots

### Performance (Score: 53)
1. **FCP 4.5s / LCP 5.3s** — Slowdex.otf (37.83 KiB) is on the critical rendering path and blocks LCP. The LCP element is the hero `<h1>`.
2. **CLS 0.256** — The WarpedGrid SVG (`w-[110%] h-[110%]`) causes massive layout shift (0.250 score). Web fonts (Slowdex, Google Fonts) also contribute.
3. **Render-blocking resources (1,350ms)** — Google Fonts CSS `@import` in `index.html` `<style>` block blocks render. Also duplicated in `src/index.css`.
4. **No cache headers** — All assets have `Cache TTL: None` (hosting config, not code — but we can add preconnect).
5. **Unused JS (339 KiB)** — The entire app bundle loads on the landing page.
6. **Images without width/height** — `dashboardSnapshot`, `perfOverview`, `amwLogo`, `mascot` images lack explicit dimensions.

### Accessibility (Score: 95)
7. **Contrast failures** — `text-amw-offwhite/30` on step numbers ("01", "02", "03") fails WCAG AA.
8. **Heading order** — Footer uses `<h4>` without preceding `<h2>`/`<h3>`. Pages skip heading levels.

---

## Plan

### 1. Fix render-blocking Google Fonts
Remove the `@import` from the `<style>` block in `index.html` (line 24). Replace with a `<link rel="preload">` + `<link rel="stylesheet">` with `media="print" onload` swap pattern. Also add `<link rel="preconnect" href="https://fonts.googleapis.com">` and `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`.

In `src/index.css`, change the `@import url(...)` on line 1 to use `font-display: swap` (already has it but it's duplicated from index.html — remove the one in index.html `<style>` block entirely since it's only for `#seo-static` which doesn't need real fonts).

**Files:** `index.html`

### 2. Preload Slowdex font
Add `<link rel="preload" href="/fonts/Slowdex.otf" as="font" type="font/opentype" crossorigin>` in `index.html` `<head>`. This font is on the critical path (37.83 KiB) and causes 3,382ms delay.

**Files:** `index.html`

### 3. Fix CLS from WarpedGrid SVG
The SVG with `w-[110%] h-[110%]` and `absolute -left-[5%] -top-[5%]` causes CLS of 0.250. Add explicit `width` and `height` attributes to the SVG element to prevent layout shift. Since it's `position: absolute` inside a relative container, it shouldn't shift — the issue is likely that the SVG renders before fonts load, then the section resizes. Fix by ensuring the hero section has a minimum height set from the start.

In `HomePage.tsx`, add `min-h-[600px] lg:min-h-[700px]` to the hero section to prevent reflow when content renders.

**Files:** `src/pages/HomePage.tsx`, `src/components/landing/WarpedGrid.tsx`

### 4. Add explicit width/height to images
Add `width` and `height` attributes to all landing page images to prevent CLS:
- `amwLogo` images: `width={160} height={40}`
- `dashboardSnapshot`: `width={576} height={400}` (approximate)
- `perfOverview`: `width={1024} height={600}` (approximate)
- `mascot` SVG: `width={448} height={448}`

**Files:** `src/pages/HomePage.tsx`, `src/components/landing/LandingHero.tsx`, `src/components/landing/PublicNavbar.tsx`, `src/components/landing/PublicFooter.tsx`

### 5. Add preconnect hints
Add `<link rel="preconnect">` for Google Fonts origins in `index.html` `<head>`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
```

**Files:** `index.html`

### 6. Fix contrast for step numbers
Change `text-amw-offwhite/30` to `text-amw-offwhite/50` on the "01", "02", "03" step indicators in `HomePage.tsx` (line 189) to meet WCAG AA 3:1 for large text.

Also fix similar low-contrast instances across other pages where `text-amw-offwhite/30` is used on visible text.

**Files:** `src/pages/HomePage.tsx` and other pages with step numbers

### 7. Fix heading hierarchy in footer
Change `<h4>` tags in `PublicFooter.tsx` to `<p>` with the same styling, since the footer column labels ("Product", "Solutions", etc.) are not semantic headings in the page structure.

**Files:** `src/components/landing/PublicFooter.tsx`

### 8. Lazy-load below-fold images
Add `loading="lazy"` to `perfOverview` image (below the fold) in `HomePage.tsx`.

**Files:** `src/pages/HomePage.tsx`

---

## Expected Impact

| Metric | Before | After (estimated) |
|---|---|---|
| FCP | 4.5s | ~2.5s (font preload + no render-block) |
| LCP | 5.3s | ~3.0s (font preload + preconnect) |
| CLS | 0.256 | <0.1 (min-height + image dimensions) |
| Accessibility | 95 | 100 (contrast + heading fixes) |
| Performance | 53 | ~70-80 |

Note: Cache headers and code-splitting are hosting/build-level concerns that cannot be fully resolved in source code alone.

