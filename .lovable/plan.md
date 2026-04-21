

## Fix: Content Lab header wrapping one-word-per-line on tablet

### What's broken
On the `/content-lab` page at tablet widths (≈700–1000px), the subtitle ("Pull the highest-performing posts…") renders **one word per line**, as visible in your screenshot.

### Root cause
`ContentLabHeader.tsx` switches from stacked to side-by-side at the **`md:` breakpoint (768px)**:

```
<header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
```

At 768px the right-hand `actions` slot contains **three wide items** (the runs/credits badge "4 / 0 runs · 1000000 credits" + "Buy credits" button + "New Niche" button). Together they need ~520px. The title column has no `flex-1` or `min-w-0` width guarantee, so flexbox shrinks it down to ~60–80px. Every word in the subtitle is wider than that column, forcing one word per line.

The same bug affects every Content Lab subpage that uses this shared header (Pipeline, Ideas, Hooks, Swipe File, Trends, Niche form, Run detail, Onboard wizard).

### Fix (single file, ~2 lines)

**`src/components/content-lab/ContentLabHeader.tsx`**

1. Move the row breakpoint from `md:` → `lg:` so header stays stacked on tablets where the actions are wide.
2. Add `flex-1` to the title column so when it does go side-by-side it claims remaining space instead of collapsing.

```tsx
<header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
  <div className="min-w-0 flex-1">
    …
  </div>
  {actions && <div className="flex flex-wrap items-center gap-2 [&>button]:flex-1 sm:[&>button]:flex-initial lg:shrink-0">{actions}</div>}
</header>
```

That's it. Title + subtitle get full width on phones and tablets; the actions sit below (already wrap nicely thanks to `flex-wrap`). On desktop (≥1024px) the original side-by-side layout returns.

### Out of scope
- No copy changes, no design changes, no other files touched.
- Desktop (≥1024px) layout is unchanged.
- All other Content Lab pages benefit automatically because they share this header.

### Verification after merge
Resize the preview to 768px and 900px — subtitle should read as one or two normal lines, not stacked words.

