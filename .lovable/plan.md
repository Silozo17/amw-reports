

# Assessment: Your Proposed Extract-Branding Setup

## What's Already Built

The edge function (`extract-branding/index.ts`) and the UI in `BrandingSection.tsx` are **already fully implemented and working**. The current setup:

- Edge function uses Firecrawl's `formats: ['branding']` endpoint
- UI has the URL input, Import button, and auto-applies extracted colors/fonts
- Font validation against `FONT_OPTIONS` is already in place
- URL prefix handling (prepending `https://`) is already done

## Your Proposed Changes vs Current Implementation

| Aspect | Current | Your Proposal |
|---|---|---|
| Firecrawl format | `formats: ['branding']` (structured) | `formats: ['extract']` with LLM schema |
| Response shape | `data.branding.colors.primary` | `data.extract.primary_color` |
| UI flow | Auto-applies on extract | Two-step: preview extracted values, then "Apply" button |
| Review panel | None — toast notification only | Color swatches + font names shown before applying |

## Recommendation

Your proposal is a **valid improvement** in two areas:

1. **Two-step apply flow** — showing extracted values before applying is better UX. The current version silently overwrites form fields, which can surprise users.
2. **`extract` format with schema** — gives more control over what Firecrawl extracts (explicit hex codes, font names, logo URL, org name). The `branding` format returns a more complex nested structure that sometimes has unexpected shapes.

However, there are a few issues to fix in the proposal:

### Fixes needed

1. **Edge function already exists** — don't create a new file, update the existing `supabase/functions/extract-branding/index.ts`
2. **The UI markup in your proposal is missing JSX tags** — it's rendered as plain text. I'll build it properly with the correct component structure.
3. **Onboarding integration** — I need to check the onboarding page structure before adding the auto-import link there.

## Plan

### File 1: `supabase/functions/extract-branding/index.ts`
Replace the `formats: ['branding']` approach with the `formats: ['extract']` + schema approach from your proposal. Normalise hex codes. Return a flat object with `primary_color`, `secondary_color`, `accent_color`, `heading_font`, `body_font`, `logo_url`, `org_name`.

### File 2: `src/components/settings/BrandingSection.tsx`
- Add `extractedResult` state for the two-step review flow
- Update `handleExtractBranding` to store the result in state instead of immediately applying
- Add a review panel showing extracted color swatches and font names
- Add `applyExtractedBranding` that copies values into form state (with font validation against `FONT_OPTIONS`)
- Show friendly message when no colors detected

### File 3: `src/pages/OnboardingPage.tsx`
- Add optional "Auto-import branding from this website" link after the website URL field (needs investigation of current onboarding structure)

### Constraints respected
- No changes to sync functions or report generation
- Fonts validated against existing `FONT_OPTIONS` list
- Logo URL shown but not auto-applied (manual upload for quality)
- URLs without `https://` prefix handled

