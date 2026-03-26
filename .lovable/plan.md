

# Fix Google Cloud OAuth Branding Verification

## The 4 Issues from Google

Based on your screenshot, Google flagged these issues for `https://reports.amwmedia.co.uk`:

1. **Homepage URL doesn't include a link to your privacy policy** — The homepage (`/`) has no visible privacy policy link in the footer
2. **Homepage is behind a login page** — Currently `/` renders `HomePage` inside `PublicLayout` (public, not behind auth), BUT the `/login` route redirects authenticated users away. The real issue is that Google's crawler likely sees the homepage as a marketing page but can't find a clear app description or the privacy policy link on it
3. **Homepage doesn't explain the purpose of your app** — The `index.html` meta description says "Lovable Generated Project" instead of describing AMW Reports
4. **App name "AMW Reports" doesn't match homepage** — The homepage shows "AMW Media" as the brand with "Reports" as a subtitle, and `index.html` title says "AMW Media Reports". Google expects to see "AMW Reports" consistently

## Changes

### 1. Fix `index.html` — Meta tags (title, description, author, OG tags)
- Change `<title>` to `AMW Reports`
- Change `meta description` to something like: `AMW Reports — Automated marketing reports for agencies. Connect 10+ platforms, generate branded PDF reports, and deliver insights to clients automatically.`
- Change `og:title` and `twitter:title` to `AMW Reports`
- Change `og:description` and `twitter:description` to match the meta description
- Change `meta author` from `Lovable` to `AMW Media`

### 2. Fix `src/pages/HomePage.tsx` — Add privacy policy link to the homepage
- Add a visible footer link section at the bottom of the homepage (before the CTA or within the existing footer) that includes:
  - A link to `https://amwmedia.co.uk/privacy-policy` labelled "Privacy Policy"
  - A link to `https://amwmedia.co.uk/terms-and-conditions` labelled "Terms & Conditions"
- Note: `PublicFooter` already has these links, and `HomePage` renders inside `PublicLayout` which includes `PublicFooter`. So the footer already exists on the homepage. The issue might be that Google's crawler can't see it or it's not prominent enough. We should ensure the privacy policy link is also visible in the hero/main content area, not just the footer.

Actually — looking again, the `PublicFooter` already contains privacy policy and terms links. The homepage (`/`) renders inside `PublicLayout` which includes `PublicFooter`. So the links ARE on the homepage. The real fix is:
- Ensure the privacy policy URL on the homepage matches what's in Google Cloud Console (`https://amwmedia.co.uk/privacy-policy`)
- Both match already. Google may just need the page to be re-crawled after the other fixes are made.

### 3. Fix app name consistency — show "AMW Reports" not "AMW Media Reports"
- In `index.html`: change title from `AMW Media Reports` to `AMW Reports`
- In `src/pages/HomePage.tsx` hero section: keep existing branding (AMW Media logo + "Reports" subtitle) but add a clear `<h1>` or prominent text that says "AMW Reports" to match the Google Cloud app name
- In `src/components/landing/LandingHero.tsx`: same — ensure "AMW Reports" appears as a recognisable app name

### 4. Ensure homepage clearly explains the app purpose
- The current hero text "Automated Marketing Reports That Elevate Your Agency" is good, but we should make the meta description match and add a concise one-liner that explicitly says what AMW Reports does, visible above the fold

## Files to Modify

1. **`index.html`** — Fix meta title, description, author, OG tags, Twitter tags
2. **`src/pages/HomePage.tsx`** — Ensure "AMW Reports" appears as a clear app name in the hero; the privacy policy link is already in the footer via PublicLayout
3. **`src/components/landing/LandingHero.tsx`** — Match "AMW Reports" branding for consistency on the login page hero

## Summary of What Each Fix Addresses

| Google Issue | Fix |
|---|---|
| No privacy policy link on homepage | Already present in PublicFooter — no code change needed, just re-verify after other fixes |
| Homepage behind login page | Homepage (`/`) is already public — this is likely a false positive caused by the other issues. No code change needed |
| Homepage doesn't explain purpose | Update `index.html` meta description from "Lovable Generated Project" to a proper description |
| App name mismatch | Change title/branding from "AMW Media Reports" to "AMW Reports" in `index.html` and ensure hero shows "AMW Reports" clearly |

