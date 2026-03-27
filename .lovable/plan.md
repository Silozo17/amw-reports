

# Fix Branding Color Drift + Redesign Layout + Website Branding Extraction

## Problem: Color Values Change on Save

The color drift is caused by **lossy hex↔HSL round-trip conversion**. The flow is:

1. User enters hex `#5B9BD5` → converted to HSL `"212 56% 60%"` via `hexToHsl()` (uses `Math.round()`)
2. Saved to DB as HSL
3. On reload, HSL `"212 56% 60%"` → converted back to hex via `hslToHex()` → produces `#5499D4` (slightly different)

The rounding in both directions compounds. Every save-reload cycle can shift the color.

**Fix**: Store hex values directly in the database. Convert to HSL only in `BrandingProvider` at render time (a read-only conversion that never persists). This eliminates the round-trip entirely.

---

## Changes

### 1. Store hex in DB, convert only in BrandingProvider

**`BrandingSection.tsx`** — Remove `hexToHsl()` from `handleSave()`. Save raw hex strings directly. Remove `hslToHex()` from the `useEffect` that loads org data (values are already hex). Keep the conversion functions only for backward compatibility during the initial load (detect if value starts with `#` or is HSL).

**`BrandingProvider.tsx`** — Add a helper that detects whether a stored value is hex or HSL and converts hex→HSL before setting CSS variables. This makes BrandingProvider work with both old HSL data and new hex data.

### 2. Consolidate into a single card with save button at top-right

Merge Identity, Colours, Chart Palette, Typography, and Report Settings into **one Card**. Place the Save button in the `CardHeader` aligned to the right. Use section dividers (`<Separator />`) between logical groups internally.

Layout within the single card:
```text
┌─────────────────────────────────────────────┐
│ Branding                         [SaveBtn] │
├─────────────────────────────────────────────┤
│ Identity (logo, name, toggle)               │
│─────────────────────────────────────────────│
│ Colours (left)  |  Live Preview (right)     │
│                 |  Chart Palette (below)    │
│─────────────────────────────────────────────│
│ Typography                                  │
│─────────────────────────────────────────────│
│ Report Settings                             │
└─────────────────────────────────────────────┘
```

### 3. Move Chart Palette below Live Preview

Currently the chart palette is in a separate card. Move it into the right column, directly below the live preview box. This way the user can see color changes reflected immediately in the preview bar chart above.

### 4. Website branding extraction

Firecrawl is available in the workspace but **not linked to this project**. Once linked, we can use Firecrawl's `branding` scrape format to extract colors, fonts, and logo from any URL.

**Implementation**:
- Link Firecrawl connector to the project
- Create a `supabase/functions/extract-branding/index.ts` edge function that calls Firecrawl with `formats: ['branding']`
- Add a small "Import from website" button/input in the Identity section of BrandingSection. User pastes a URL → calls the edge function → auto-populates primary/secondary/accent colors, fonts, and logo from the response
- Pre-fill during onboarding: if the org's website field is set (from `OnboardingPage`), offer to auto-extract branding on first visit to settings

---

## Files to Modify

| File | Change |
|---|---|
| `src/components/settings/BrandingSection.tsx` | Consolidate to single card, fix hex storage, move chart palette, add "Import from website" |
| `src/components/BrandingProvider.tsx` | Add hex detection + conversion helper |
| `supabase/functions/extract-branding/index.ts` | New edge function for Firecrawl branding extraction |

## Connector Required

Firecrawl needs to be linked to this project before the website extraction feature can work.

