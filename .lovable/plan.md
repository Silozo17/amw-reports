

## Phase 4 — Round 4 fixes

Three workstreams. One DB migration, several edge function & UI changes.

---

### 1. Recency filter on scrape (no more 3-year-old posts)

**File:** `supabase/functions/content-lab-scrape/index.ts`

Add a constant `RECENT_DAYS = 60` (covers current + previous month). Apply it to **competitor + benchmark** buckets (not own — own posts are limited by handle and quantity already, so filtering by date there could starve the run).

Where: after each scraper returns posts, filter out anything where `posted_at` is older than `now - 60 days` OR null. Apply BEFORE the `MAX_POSTS_PER_ACCOUNT` slice so we keep the freshest 4 per account, not the 4 most-viewed-ever.

Also pass `onlyPostsNewerThan: ISO date` into the Apify input where the actor supports it (Instagram + TikTok scrapers do — Facebook ignores it harmlessly), so the API call returns less junk in the first place.

Risk: if a benchmark account has been quiet for 2 months we'll get zero posts from them. Mitigation: log it; the bucket-level fallback (`scrape_buckets.benchmark = 0`) already triggers the "Limited" badge users see.

---

### 2. Restructure Content Lab navigation + add Trends page + add Hook Library page

**Sidebar (`src/components/layout/AppSidebar.tsx`)**

Replace the current flat list with a **collapsible "Content Lab" parent** (mirrors the existing Platform Admin pattern). Sub-items, in this order:

1. Content Pipeline — `/content-pipeline`
2. Ideas — `/ideas`
3. **Trends** — `/content-lab/trends` *(new)*
4. **Hook Library** — `/content-lab/hooks` *(new)*
5. Swipe File — `/content-lab/swipe-file`

The "+ New Run" entry (currently `/content-lab` → `ContentLabPage`) becomes a **primary CTA button at the top of the collapsible**, not a sub-route, so the parent IS the Content Lab section. Auto-open the collapsible when on any `/content-lab/*`, `/content-pipeline`, or `/ideas` route.

**New page: `src/pages/content-lab/TrendsLibraryPage.tsx`**

Cross-run aggregation of `content_lab_trends`, scoped to the user's org via run join. Card grid showing label, momentum, description, recommendation, verification source link. Filters: niche, momentum (rising/steady/fading), date. Empty state uses `EmptyStateMascot`.

Hook into existing `content_lab_trends` table — no schema change.

**New page: `src/pages/content-lab/HookLibraryPage.tsx`**

Cross-run aggregation of `content_lab_hooks` (currently only shown inside one run). Same pattern as Trends. Columns: hook text, mechanism, why-it-works, source platform, run-link. Search + niche filter.

Both pages add new hooks: `useAllTrends`, `useAllHooks` in `src/hooks/useContentLab.ts`.

**Routes** — add to `src/App.tsx`:
```
/content-lab/trends   → TrendsLibraryPage
/content-lab/hooks    → HookLibraryPage
```

---

### 3. Wire up the heart / comment / share icons inside the IG/TikTok/FB preview mockups

Currently the `<Heart>`, `<MessageCircle>`, `<Send>` icons in `IdeaPreviewInstagram.tsx` / `IdeaPreviewTikTok.tsx` / `IdeaPreviewFacebook.tsx` are **decorative SVGs**. We make them functional, and they only become functional when the preview is used inside a real idea card (not in the public share view, which stays read-only).

**Approach:** add three optional props to each preview component:
```ts
interface Props {
  hook: string;
  caption?: string | null;
  handle?: string | null;
  // NEW — only passed in interactive contexts
  ideaId?: string;
  clientId?: string | null;
  nicheId?: string | null;
  runId?: string;
  isSaved?: boolean;
  onToggleSave?: () => void;
  onOpenComments?: () => void;
  onShare?: () => void;
}
```

When `ideaId` is present, the icons become buttons. When absent (public share page, hover preview), they stay decorative. This keeps all 3 platform mockups rendering identically in both contexts.

#### 3a. Heart → save to swipe file
Reuse the existing `useToggleSwipe` hook. Heart fills red when saved. Toast on action. `IdeaPipelineBoard` and `RunDetailPage` already pass `client_id` / `niche_id` context — thread it through to the preview.

#### 3b. Comment → idea-thread drawer

**New table: `content_lab_idea_comments`**
```
id uuid pk
idea_id uuid not null
org_id uuid not null
author_user_id uuid (nullable — null for client-portal posts)
author_client_user_id uuid (nullable — for client portal users)
author_label text not null   -- denormalised name for display
body text not null
created_at timestamptz
```
RLS:
- Org members: select/insert where `user_belongs_to_org(auth.uid(), org_id)`
- Client portal users: select/insert where `is_client_user(auth.uid(), idea→run→client_id)`

**New component: `src/components/content-lab/IdeaCommentsDrawer.tsx`** (uses shadcn `Sheet`). Lists comments newest-first, shows author label + relative time, has a textarea + send. Optimistic insert via TanStack Query.

**New hook:** `src/hooks/useIdeaComments.ts` — `useIdeaComments(ideaId)` + `usePostComment()`.

The comment icon shows a small numeric badge when `count > 0` (cheap aggregate query).

#### 3c. Send → share single idea via link

Reuses the existing `content_lab_run_share_tokens` infra at the **idea level** with a thin wrapper. Two minimal options:

- **Option A (simpler — chosen):** clicking Send opens a small popover with "Copy idea link" → copies `https://<host>/share/content-lab/<run-slug>?idea=<idea_id>`. The existing public share page (`ContentLabRunShare.tsx`) gets a small enhancement: if `?idea=` is present, scroll-to / highlight that one idea card. No new table needed; the existing run-level share token authorises viewing all ideas in the run anyway.

  If no share token exists yet for the run, the popover offers a "Create share link" button (calls existing dialog flow).

This keeps the surface area minimal and reuses everything already built in Milestone B.

---

### Files to add

```
src/pages/content-lab/TrendsLibraryPage.tsx
src/pages/content-lab/HookLibraryPage.tsx
src/components/content-lab/IdeaCommentsDrawer.tsx
src/components/content-lab/IdeaShareLinkPopover.tsx
src/hooks/useIdeaComments.ts
supabase/migrations/<ts>_idea_comments.sql
```

### Files to edit

```
supabase/functions/content-lab-scrape/index.ts    — 60-day filter
src/components/layout/AppSidebar.tsx              — collapsible Content Lab section
src/App.tsx                                       — 2 new routes
src/hooks/useContentLab.ts                        — useAllTrends, useAllHooks
src/components/content-lab/IdeaPreviewInstagram.tsx
src/components/content-lab/IdeaPreviewTikTok.tsx
src/components/content-lab/IdeaPreviewFacebook.tsx
src/components/content-lab/IdeaPipelineBoard.tsx  — pass ideaId/runId/etc into preview, drop the separate SwipeFileHeart (now built into preview)
src/pages/content-lab/RunDetailPage.tsx           — same prop wiring
src/pages/share/ContentLabRunShare.tsx            — honour ?idea= param
```

### Risks
- **Comment threading scope creep**: keeping it flat (no replies, no edits, no @mentions, no notifications) on purpose. Can extend later — flag it now so we don't expand mid-build.
- **Client-portal write access**: requires the client-portal user to actually be authenticated via `client_users`. If the portal currently uses a magic link without a real `auth.uid()`, posting comments from the client side won't work. Need to verify before building 3b — I'll check `ClientPortal.tsx` once approved.
- **60-day filter for benchmarks**: benchmarks chosen for being viral may have peaked 4 months ago. Filtering them out can drop pool quality. Mitigation: if a benchmark account returns 0 recent posts, fall back to "latest 4 regardless of date" for that one account only. I'll implement this fallback inline.
- **Sidebar restructure**: existing users who bookmarked `/ideas` etc still work — only the visual grouping changes, no route renames.

### Open questions
None — proceeding once approved.

