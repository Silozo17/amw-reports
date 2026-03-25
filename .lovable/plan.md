

## Fix Landing Page Footer — Layout, Visibility & SEO Compliance

### Problems
1. Footer links on the right hero panel overlap with feature cards and are hard to read (low contrast white-on-dark with 50% opacity)
2. On mobile, the hero panel is `hidden`, so **Google cannot find the privacy policy link at all** — this is the core verification failure
3. Links lack proper `aria-label` attributes for accessibility

### Changes

#### 1. Move footer out of `LandingHero` into `LandingPage` (left side, always visible)
- Remove the footer `div` (lines 85-100) from `LandingHero.tsx`
- Add a `<footer>` element at the bottom of the **left auth panel** in `LandingPage.tsx`, below the auth forms
- This ensures the links are **always in the DOM** regardless of screen size — solving the Google verification issue

#### 2. Style the footer for the left (light) side
- Use `text-amw-black` / dark muted colors instead of white/offwhite (since the left panel has a light background)
- Links styled in a muted dark tone with `hover:text-primary` transition
- Small text: `text-xs font-body`
- Layout: stacked — disclaimer line, copyright line, then links row with dot separators
- Content:
  - "AMW Reports is operated by [AMW Media](https://amwmedia.co.uk)."
  - "© 2026 AMW Reports. All rights reserved."
  - Privacy Policy | Terms & Conditions | amwmedia.co.uk

#### 3. Add proper accessibility attributes
- All `<a>` tags get `aria-label` (e.g., `aria-label="AMW Reports Privacy Policy"`)
- Use semantic `<footer>` element with `role="contentinfo"`
- Ensure links use standard `<a>` tags (not buttons) so Google can crawl them

#### 4. Files changed
- **`src/components/landing/LandingHero.tsx`** — Remove footer section (lines 84-100)
- **`src/pages/LandingPage.tsx`** — Add semantic `<footer>` at the bottom of the left auth column with all links, disclaimer, and copyright

