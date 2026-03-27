

# Server-Side Static HTML for SEO — index.html

## Approach

Inline the full HomePage content (navbar + all sections + footer) as plain HTML in `index.html`, styled with an embedded `<style>` block. Use a pure-CSS trick to hide the static content instantly when React hydrates — no layout shift.

### How the hide mechanism works
```text
<div id="root"></div>          ← React renders here
<div id="seo-static">...</div> ← visible while #root is empty

CSS: #root:not(:empty) ~ #seo-static { display: none }
```
When React mounts (even the loading spinner), `#root` is no longer `:empty`, so the sibling static div is hidden instantly via CSS — no JS needed, no flash.

## Asset requirement

The logo (`AMW_Logo_White.png`) and mascot (`mascot.svg`) live in `src/assets/` which Vite hashes at build time. The static HTML in `index.html` cannot reference hashed paths. Two files need to be copied to `public/`:

- `public/amw-logo-white.png` (copy of `src/assets/AMW_Logo_White.png`)
- `public/mascot.svg` (copy of `src/assets/mascot.svg`)

Static HTML references `/amw-logo-white.png` and `/mascot.svg`.

## Changes

### File 1: `index.html`

1. Add `<style>` block in `<head>` containing:
   - CSS custom properties (same HSL values from `index.css` — the dark/AMW theme)
   - Font imports (Google Fonts for Anton + Montserrat, plus Slowdex `@font-face`)
   - All utility classes used by the static content (layout, typography, colors, spacing)
   - The hide rule: `#root:not(:empty) ~ #seo-static { display: none }`

2. Add `<div id="seo-static">` after `<div id="root">` containing the full static HTML equivalent of:
   - **PublicNavbar** — logo, nav links (Home, Features, Pricing), Log In / Get Started buttons
   - **Hero section** — logo, "We Are AMW Media" accent text, main heading, subtitle, CTA buttons, mascot image (hidden on mobile via CSS)
   - **Platform logos strip** — 10 platform name pills
   - **How It Works** — 3 cards (Connect, Sync, Report) with SVG icons
   - **70+ Metrics** — 4 stat group cards (Ads, SEO, Social, Web)
   - **Why AMW Reports** — heading + 6 check-mark bullet points
   - **Founder Quote** — blockquote with attribution
   - **CTA Banner** — heading + button
   - **PublicFooter** — logo, product links, legal links, copyright

3. All links use standard `<a href="...">` tags (not React Router `<Link>`)
4. SVG icons (arrows, check marks, plug, etc.) are inlined as `<svg>` elements
5. No JavaScript in the static block — pure HTML + CSS

### File 2: Copy assets to `public/`
- `public/amw-logo-white.png`
- `public/mascot.svg`

### Constraints
- The `<style>` block uses scoped selectors (all prefixed with `#seo-static`) to avoid any conflict with the React app's styles
- No Tailwind classes in the static HTML — all styling is in the embedded `<style>` block
- The static content is semantically identical to the React version for consistent SEO signals
- Mobile responsive: mascot hidden, grid stacks to single column, nav links hidden (hamburger not functional in static — acceptable since crawlers don't need it)

