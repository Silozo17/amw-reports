

## Fix Button Contrast When Org Uses Light Primary Color

### Problem

The `BrandingProvider` sets `--primary` from the org's `primary_color` but never computes a matching `--primary-foreground`. When an org picks a light/white primary color, buttons using `bg-primary text-primary-foreground` become invisible — white text on a white background.

Same issue applies to `--secondary`, `--accent`, and their foreground counterparts.

### Solution

Add a contrast-aware foreground calculation to `BrandingProvider`. When any brand color is applied, parse the HSL values and compute whether the color is "light" or "dark" using its lightness channel. Set the corresponding `--*-foreground` CSS variable to dark text (`340 7% 13%`) for light backgrounds, or white (`0 0% 100%`) for dark backgrounds.

**Lightness threshold**: If L >= 55%, the color is considered light → use dark foreground. Otherwise → use white foreground.

### File to edit

| File | Change |
|---|---|
| `src/components/BrandingProvider.tsx` | Add `computeForeground(hsl: string)` helper. After setting each color variable, also set its `-foreground` counterpart. Add foreground vars to cleanup array. |

### Technical detail

```typescript
/** Given an HSL string like "295 60% 47%", return a contrasting foreground HSL */
const computeForeground = (hsl: string): string => {
  const parts = hsl.match(/[\d.]+/g);
  if (!parts || parts.length < 3) return '0 0% 100%';
  const lightness = parseFloat(parts[2]);
  // Light colors get dark text, dark colors get white text
  return lightness >= 55 ? '340 7% 13%' : '0 0% 100%';
};
```

Applied to each color:
- `--primary` → also set `--primary-foreground`
- `--secondary` → also set `--secondary-foreground`
- `--accent` → also set `--accent-foreground`
- `--sidebar-primary` → also set `--sidebar-primary-foreground`
- `--success` → also set `--success-foreground`

