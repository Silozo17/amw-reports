

# Add Platform Logos to All Platform Listing Sections

## What Changes

Every section across the site that lists marketing platforms as text-only pills will be updated to include the platform logo beside the name. The logos already exist in `src/types/database.ts` as `PLATFORM_LOGOS` (keyed by `PlatformType`).

## Affected Files (7 pages)

| File | Section | Current |
|------|---------|---------|
| `src/pages/HomePage.tsx` | "Our Integrations" strip | Text-only pills |
| `src/pages/ForAgenciesPage.tsx` | "All the Platforms Your Clients Use" | Text-only pills |
| `src/pages/ForCreatorsPage.tsx` | "Platforms for Creators" | Text-only pills |
| `src/pages/ForSmbsPage.tsx` | "All Your Marketing Tools in One Place" | Text-only pills |
| `src/pages/HowItWorksPage.tsx` | Step 1 platform list | Text-only pills |
| `src/pages/IntegrationsPage.tsx` | Platform detail cards | No logos on card headers |
| `src/pages/SeoReportingPage.tsx` | Platform detail cards | No logos on card headers |
| `src/pages/SocialMediaReportingPage.tsx` | Platform detail cards | No logos on card headers |
| `src/pages/PpcReportingPage.tsx` | Platform detail cards | No logos on card headers |

## Approach

1. **Create a shared mapping** — A simple `NAME_TO_KEY` lookup (e.g. `'Google Ads' → 'google_ads'`) to bridge the string-based `PLATFORMS` arrays to `PLATFORM_LOGOS` keys. This avoids refactoring every page's data structure.

2. **Update pill rendering** — Add an `<img>` tag (h-4 w-4) before the text in each pill:
   ```tsx
   <img src={PLATFORM_LOGOS[NAME_TO_KEY[p]]} alt="" className="h-4 w-4 object-contain" />
   ```

3. **Update detail card headers** — On IntegrationsPage, SeoReportingPage, SocialMediaReportingPage, and PpcReportingPage, add the logo next to the platform name in each card's `<h3>`.

4. **Import** `PLATFORM_LOGOS` from `@/types/database` in each affected file.

## Technical Details

- The `NAME_TO_KEY` reverse lookup will be defined as a shared constant (or inline per file since it's small) mapping display names to `PlatformType` keys
- All logos are already optimised `.webp` files imported in `src/types/database.ts`
- Decorative usage — `alt=""` since the platform name is already displayed as text
- No new dependencies, no design changes beyond adding the logo icon

