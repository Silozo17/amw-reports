

## Plan: Replace AMW text with logo image

### Change
In `LandingHero.tsx`, replace the text-based "AMW" heading (line 39) with the uploaded `AMW_Logo_White.png` logo image. The "Reports" subtitle stays below it.

### Steps

1. **Copy logo asset**: Copy `user-uploads://AMW_Logo_White.png` to `src/assets/AMW_Logo_White.png`

2. **Update `LandingHero.tsx`**: Import the logo and replace the `<h1>AMW</h1>` text with an `<img>` tag (~h-10 to match the text size), keeping the "Reports" text beneath it.

### Files
- `src/assets/AMW_Logo_White.png` (new — copied from upload)
- `src/components/landing/LandingHero.tsx` (modified — swap h1 for img)

