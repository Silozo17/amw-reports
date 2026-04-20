

## Wire Content Lab into the public website (with real AMW examples)

Goal: surface Content Lab everywhere on the marketing site it makes sense, and add a real read-only "live demo" section using the AMW Media run that's already public via `get_shared_run`.

---

### 1. Homepage — add a Content Lab section

Insert a new section on `HomePage.tsx` between **"Built For"** and the existing **"Key Features"** block (so it sits in the natural product-tour position).

Section contents:
- Eyebrow: *"NEW · Content Lab"*, headline *"Stop guessing what to post. **Decode what's working.**"*, sub-line about AI content engine.
- Three-column mini feature row: **Viral Feed**, **12 Ready Ideas**, **Hook Library**.
- Right-side: live `<IdeaPreviewInstagram>` mockup with one of the real AMW idea hooks (hard-coded snippet from the demo run for instant render).
- Two CTAs: `[See it in action →]` (anchors to the new live-demo block on `/content-lab-feature`) and `[Open Content Lab →]` (`/content-lab-feature`).

### 2. `/content-lab-feature` — add a real, read-only AMW live-demo section

New section "**See a real run**" inserted between the "What you get per idea" mockup section and the "Built for" audiences section.

Mechanism:
- New hook `useContentLabPublicDemo()` calls the existing `get_shared_run` RPC with the AMW share slug `d35fb028e66dcf012548ac6f` (already active, public, no auth). This gives us 12 real ideas + top performing reference posts with thumbnails — exactly the data the `/share/content-lab/...` page renders.
- Add the slug as a constant in `src/lib/contentLabDemo.ts` (`AMW_DEMO_SHARE_SLUG`).
- The section renders four tabs (shadcn `Tabs`):
  1. **Viral Feed** — grid of the top 8 reference posts (thumbnail · @handle · views · ER) — pulls from `top_posts`.
  2. **Ideas** — first 6 real ideas as `<IdeaPreviewInstagram/TikTok/Facebook>` phone mockups in a 3-col grid (using the actual `hook`, `caption`, `target_platform` fields).
  3. **Pipeline** — static visual of a 4-column kanban (Scripted / Filming / Edit / Posted) seeded with idea titles from the run, read-only (no DB writes — just shows what the in-app board looks like).
  4. **Hook Library** — a small card list rendered from each idea's hook string (since `content_lab_hooks` for this run is empty, this is the safe fallback). Mirrors the look of the real Hook Library cards.
- Footer link: *"This is real data from AMW Media's most recent run — open the full version →"* deep-links to `/share/content-lab/d35fb028e66dcf012548ac6f`.
- Loading: skeleton grid. Error/empty: hide the section silently (the rest of the page still works).

### 3. Cross-link Content Lab from existing pages

Small but high-impact additions — no new components, just a content block on each:

- **`HowItWorksPage.tsx`** — append a "Beyond reporting" callout card linking to `/content-lab-feature`.
- **`PricingPage.tsx`** — add a single row in the comparison/table area noting that **Content Lab is included** with a "Learn more" link.
- **`FeaturesPage.tsx`** — add a Content Lab feature card (same pattern as the existing 4-card row), icon `Sparkles`.
- **`ForAgenciesPage.tsx`**, **`ForCreatorsPage.tsx`**, **`ForFreelancersPage.tsx`** — each gets one paragraph + CTA card sized to the page (different copy emphasising the audience benefit).
- **`PublicFooter.tsx`** — already has the link; no change.

### 4. Files

**New (1)**
- `src/hooks/useContentLabPublicDemo.ts` — `useQuery` wrapper around `get_shared_run` RPC with the AMW slug.

**Edited**
- `src/lib/contentLabDemo.ts` — add `AMW_DEMO_SHARE_SLUG` constant.
- `src/pages/HomePage.tsx` — new Content Lab section.
- `src/pages/ContentLabPublicPage.tsx` — insert "See a real run" tabs section.
- `src/pages/HowItWorksPage.tsx` — append callout.
- `src/pages/PricingPage.tsx` — Content Lab inclusion row + link.
- `src/pages/FeaturesPage.tsx` — feature card.
- `src/pages/ForAgenciesPage.tsx`, `ForCreatorsPage.tsx`, `ForFreelancersPage.tsx` — audience-tailored CTA card.

No DB changes, no new RPCs — `get_shared_run` already exists and is public-readable. No edge functions, no auth changes.

### Risks / notes

- **Share-token data only**: `get_shared_run` returns titles/hooks/captions/platforms/wildcard flags + top reference posts. It does not return script/CTA/why-it-works/filming-checklist (those live behind RLS). The phone-mockup tab uses what's available — if you want full ideas exposed publicly, that needs a new RPC and your sign-off (different scope). Flagging now.
- **Hook Library tab fallback**: `content_lab_hooks` for this run is empty in the DB. The tab renders idea-level hooks instead, labelled "Hooks from these ideas" so it stays truthful.
- **Real thumbnails**: top-post thumbnails are external URLs from Apify scrapes; they may occasionally 404. Each card has a graceful fallback (existing pattern from share page).
- **Mobile**: the live-demo tabs scroll horizontally on `<sm` like other tabs in the app — already a global pattern.

