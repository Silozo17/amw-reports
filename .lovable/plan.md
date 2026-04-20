

## Fix Hook Library filtering

### What's broken

1. **Mechanism filter never matches.** Dropdown options send display labels like `"Curiosity gap"`, `"Negative"`, `"Stat shock"` but the DB stores snake_case slugs (`curiosity_gap`, `negative`, `stat_shock`) — plus values like `other`, `story`, `promise`, `callout`, `listicle`, `statement`, `demo` that aren't even in the dropdown. Selecting any mechanism returns 0 hooks.
2. **Platform filter excludes real data.** DB has hooks on `instagram`, `tiktok`, `facebook` only — but the dropdown also lists `linkedin`, `threads`, `youtube` (which return 0) and the visible options can't filter to "only what exists".
3. **Niche dropdown is post-filter.** Niches are derived from the *currently fetched 200* rows, so the list shrinks as you filter — and an empty result hides every niche option, trapping the user.
4. **Capitalisation/formatting mismatch on rendered chips.** Mechanism badge shows raw slugs (`curiosity_gap`) in uppercase — ugly and inconsistent with dropdown labels.

### Fix

**1. Single mechanism vocabulary** — Define one canonical list mapping slug → label, used by the dropdown, the RPC call, and the badge:
```ts
const MECHANISM_OPTIONS = [
  { slug: 'curiosity_gap', label: 'Curiosity gap' },
  { slug: 'negative',      label: 'Negative' },
  { slug: 'social_proof',  label: 'Social proof' },
  { slug: 'contrarian',    label: 'Contrarian' },
  { slug: 'pattern_interrupt', label: 'Pattern interrupt' },
  { slug: 'stat_shock',    label: 'Stat shock' },
  { slug: 'stat',          label: 'Stat' },
  { slug: 'question',      label: 'Question' },
  { slug: 'story_open',    label: 'Story open' },
  { slug: 'story',         label: 'Story' },
  { slug: 'promise',       label: 'Promise' },
  { slug: 'callout',       label: 'Callout' },
  { slug: 'listicle',      label: 'Listicle' },
  { slug: 'statement',     label: 'Statement' },
  { slug: 'demo',          label: 'Demo' },
  { slug: 'other',         label: 'Other' },
  { slug: 'unknown',       label: 'Unknown' },
];
```
Dropdown sends `slug` as the value (matches what the RPC compares). Badge renders `MECHANISM_LABELS[h.mechanism] ?? h.mechanism` in normal case, not uppercase.

**2. Platform list trimmed to what we actually have data for** — Drop `linkedin`, `threads`, `youtube` from the dropdown (no hooks exist for them yet). The remaining `instagram` / `tiktok` / `facebook` match the DB. When data lands for the others later, they can be re-added.

**3. Niche list independent of filters** — Add a separate lightweight query that fetches the distinct niche labels once on mount (calls `get_global_hook_library` with no filters and a small limit, or uses the existing 200-row pull but only re-derives the niche list when *all filters except niche* change). Simplest correct version: keep the `niches` list memoised against the **unfiltered initial fetch**, not the post-filter `hooks` array. This means the niche dropdown always shows every niche in the library.

**4. Mechanism badge formatting** — `uppercase` class removed; render the human label via the lookup table.

### Files

**Edited (1)**
- `src/pages/content-lab/HookLibraryPage.tsx` — replace `MECHANISMS` const with `MECHANISM_OPTIONS` (slug+label pairs) + `MECHANISM_LABELS` lookup, trim `PLATFORMS`, fix the badge render, base the niche list on an always-unfiltered fetch (separate small query), wire the dropdown to send slugs.

No DB or edge function changes — `get_global_hook_library` already filters correctly when given a real slug.

### Verification after deploy
- "All mechanisms" → ~175 hooks (current total).
- Selecting "Story" → 22 hooks. Selecting "Curiosity gap" → 3. Selecting "Other" → 68.
- Platform = TikTok → 33 hooks. Platform = Facebook → 12.
- Niche dropdown shows both "B2B Creative Agencies for UK SMEs" and "Global Athletic Apparel & Footwear" regardless of other filter selections.

