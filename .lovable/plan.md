

## Content Lab — Mobile Responsive Pass + Thumbnail Fix

### Part A — Every page & subpage in scope

**Top-level routes**
1. `/content-lab` — `ContentLabPage.tsx` (header, niche cards, recent runs accordion)
2. `/content-lab/niche/new` and `/content-lab/niche/:id` — `NicheFormPage.tsx` (long form, 795 lines)
3. `/content-lab/niche/onboard` — `OnboardWizardPage.tsx` (6-step wizard + voice-building screen)
4. `/content-lab/run/:id` — `RunDetailPage.tsx` (5 tabs: Your Latest, Viral Feed, Ideas, Pipeline, Hooks)
5. `/content-lab/ideas` — `IdeasLibraryPage.tsx`
6. `/content-lab/pipeline` — `ContentPipelinePage.tsx` (kanban DnD board)
7. `/content-lab/swipe-file` — `SwipeFilePage.tsx`
8. `/content-lab/hooks` — `HookLibraryPage.tsx`
9. `/content-lab/trends` — `TrendsLibraryPage.tsx` (coming-soon, mostly fine)
10. `/share/content-lab/:token` — `ContentLabRunShare.tsx` (public share)

**Reusable components touched**
- `ContentLabHeader` · `ContentLabFilterBar` · `ContentLabPaywall`
- `ViralPostCard` · `IdeaCard` (grid + stacked variants) · `IdeaDetailDrawer` · `IdeaCommentsDrawer`
- `IdeaPipelineBoard` (DnD) · `HookLibrary` · `BuyCreditsDialog` · `ShareWithClientDialog`
- `IdeaPreviewInstagram/TikTok/Facebook` · `IdeaActionButtons` · `PatternInsightsWidget`
- `onboard/Step1…Step6` + `VoiceBuildingScreen`

### Part B — Concrete responsive issues found

| Surface | Problem at <768px | Fix |
|---|---|---|
| `RunDetailPage` header | Title row + 3 action buttons forced side-by-side; overflows | Stack vertically, wrap action buttons full-width |
| `RunDetailPage` Tabs | 5 tabs in a `TabsList` row don't fit 360-414px | Make tab list horizontally scrollable (`overflow-x-auto`, `whitespace-nowrap`); shrink labels |
| Run Detail "Your latest" stats card | Badge + multi-segment text crammed | Stack on mobile, use `flex-col sm:flex-row` |
| `IdeaCard` stacked variant | Fixed `md:grid-cols-[260px_1fr]` is fine but body actions row overflows | Wrap action buttons, allow phone-mockup full width on mobile |
| `IdeaPipelineBoard` | DnD kanban with 5 columns side-by-side — unusable on phone | Already has `useIsMobile` import — switch to vertical column stack on mobile, keep DnD; or use status `<Select>` per card as the mobile interaction |
| `ContentLabFilterBar` selects | Multiple `w-[180px]` triggers wrap awkwardly | Use `w-full sm:w-auto sm:min-w-[160px]` for triggers; bar already stacks |
| `HookLibraryPage` | 4 selects of fixed width | Same select-width fix |
| `NicheFormPage` (795 lines) | Multi-column grids, long form — needs audit per section | Replace any `grid-cols-2/3` without `md:` prefix with mobile-first `grid-cols-1 md:grid-cols-2` |
| `OnboardWizardPage` + steps | Footer Back/Next buttons + step content padding | Ensure `p-4 md:p-6`, sticky footer stacks on mobile |
| `BuyCreditsDialog` / `ShareWithClientDialog` | Fixed dialog widths | `max-w-[95vw] sm:max-w-md` |
| `ViralPostCard` action row | "View reel" + "Transcript" buttons can wrap badly with date | `flex-wrap` with date on its own row at <360px |
| `IdeaPreviewInstagram/TikTok/Facebook` | Fixed `max-w-[240px]` is fine; phone mockup centered |  Keep as-is, just ensure parent doesn't clip |
| `ContentLabPage` Latest Run card | Action button row uses `justify-between` | Stack header + status badge on mobile |
| `IdeaDetailDrawer` (Sheet) | Default Sheet width may be too narrow | Explicitly set `w-full sm:max-w-2xl` |

### Part C — Thumbnail fix (root cause identified)

**Problem:** `ViralPostCard` uses `<img src={proxiedSrc(url)}>` pointing at the `content-lab-image-proxy` edge function. The function rejects any request without an `Authorization: Bearer …` header (lines 47–50) and serves a 1×1 transparent PNG instead. Browsers cannot attach `Authorization` headers to `<img>` requests — so **every thumbnail returns the blank fallback** on web, PWA, and mobile alike. This is also why the viral feed appears empty of imagery.

**Fix:**
1. Remove the `Authorization` requirement from `content-lab-image-proxy/index.ts`. Security is already provided by:
   - Hostname allow-list (Instagram/Facebook/TikTok CDN suffixes)
   - HTTPS-only check
   - Public Cache-Control so Supabase edge caches absorb load
2. Append the publishable anon key as a query string — Supabase Functions accept `apikey` as a query param — so the request is still attributed to the project for rate-limiting. Update `proxiedSrc()` in `ViralPostCard` to send `?url=…&apikey=…`. (`VITE_SUPABASE_PUBLISHABLE_KEY` is already in `.env`.)
3. Add `loading="lazy"`, `decoding="async"`, and a `width`/`height` on the `<img>` to prevent CLS on mobile.
4. Keep the existing `imgFailed` fallback to the original CDN URL — works on Wi-Fi where Instagram CDN is reachable directly.

### Part D — Implementation order

1. **Fix thumbnails first** — edge function + `ViralPostCard` (single biggest visual win; unblocks viral feed)
2. **Run Detail page** — tab scroll + header stack + stats card
3. **Idea pipeline board** — mobile vertical layout with status select
4. **List pages** — Ideas / Swipe File / Hooks / Pipeline filter bar selects → full-width mobile
5. **Niche form** — pass through `NicheFormPage` for any non-mobile-first grids
6. **Onboard wizard** — pad + footer button stack
7. **Dialogs** — width caps for mobile (BuyCredits, Share, IdeaDetail Sheet)
8. **Smoke test** at 360 / 390 / 414 / 768 / 1280

### Part E — What this does NOT change

- No new features, no copy changes, no design overhaul
- No DB migrations, no auth changes, no pricing changes
- Desktop layouts remain identical (only adds `md:` breakpoints, never removes them)
- Edge function security model stays equivalent (host allow-list + HTTPS), only the unusable `Authorization` gate is removed in favour of the public anon key

