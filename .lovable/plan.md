## What you'll get

A Content Lab that actually delivers what it promises: every post has a thumbnail and view count, every "Viral" post is a real high-engagement video, and ideas are presented as interactive Instagram-style phone mockups your team can react to, comment on, and share with the client.

---

## 1. Ideas → interactive Instagram-style mockups

Replace the current flat `IdeaCard` with a phone-frame mockup that feels like an Instagram preview.

**Per idea, the AI now returns:**
- 3 hook variations (instead of 1)
- 1 caption + 1 script outline + 1 CTA
- Hashtags
- "Why it works" with a citation back to a specific competitor or viral post in the run (credibility line)
- Visual direction

**Mockup UI (right side of the card):**
- Phone frame with IG header (client handle + avatar)
- Square preview area showing the active hook (tap arrows to cycle through the 3 hooks)
- IG action row: ❤️ Like, 💬 Comment, ↗️ Share, 🔖 Save
- Caption + hashtags below

**Interactive behaviour:**
- **Like** — anyone in the org can like; ideas with the most likes float to the top of the list (sort: likes desc, then idea_number).
- **Comment** — opens an inline thread; anyone with access to the run (org members + the client portal user) can read and post comments. Shows author name + timestamp.
- **Share** — opens a dialog with a white-labelled public link (`/share/idea/{slug}`) plus an email/copy button. The shared page is read-only, branded with the org's logo/colours, and shows the mockup + hooks + caption.

**DB additions:**
- `content_lab_idea_hooks` (idea_id, hook_text, position 0–2)
- `content_lab_idea_reactions` (idea_id, user_id, kind='like') — unique per (idea, user)
- `content_lab_idea_comments` (idea_id, author_user_id or author_client_user_id, body, created_at)
- `content_lab_idea_share_tokens` (idea_id, slug, org_id, is_active, view_count) + RLS for public read by slug
- New public route `/share/idea/:slug` (no auth, like the existing run share)

**Ideate prompt change:** ask for `hooks: string[3]` instead of single `hook`, and require `why_it_works` to reference a specific handle/post pulled from the prompt's "viral / competitor patterns" list.

---

## 2. Fix "Your content" — every post needs a thumbnail + views

**Root causes from the latest run:**
- IG carousel posts often expose images under `images[0]` not `displayUrl` — we currently miss them.
- IG photo posts have no `videoPlayCount` so views show as 0.

**Fixes in `content-lab-run/index.ts` `mapIG`:**
- `thumbnail_url`: fall back through `displayUrl → images?.[0] → childPosts?.[0]?.displayUrl`
- For IG photos (non-video), use `likesCount + commentsCount` impressions estimate is wrong — instead **hide the views row when `views === 0` AND it's not a video**, and show "Photo" badge instead. (IG doesn't expose photo view counts via this scraper — showing 0 is misleading.)
- Add a `media_kind` field (video | photo | carousel) so the UI knows what to render.

**`PostGrid` UI fix:**
- If no `thumbnail_url` → show a branded placeholder (caption excerpt on coloured tile) instead of an empty grey square so the user can still scan the post.
- Show views only for videos; show a "Photo" / "Carousel" badge for non-video posts.

---

## 3. Fix "Local Competitors"

- Same thumbnail fallback chain as above fixes the missing IG carousel covers.
- Apply the same "show views only for videos, badge non-video posts" rule.
- Filter out posts where caption is null/empty AND no thumbnail AND no engagement — these are scraper junk rows and should never reach the UI.
- Group header now shows aggregate stats (avg views, avg likes, post count) so the user can compare accounts at a glance.

---

## 4. Fix "Viral worldwide" → rename to "Viral" and make it actually viral

**Rename the tab to just "Viral"** (drop "worldwide").

**Quality fixes — this is the biggest one:**
- **Drop the IG hashtag scrape entirely** for the Viral bucket. The current `apify~instagram-hashtag-scraper` returns mostly low-engagement photo carousels (today's run: 104 posts, 91 with 0 views, only 13 videos — exactly the user complaint).
- Replace with a stricter sourcing pipeline:
  1. **Always scrape the AI-discovered viral accounts** (already working — TikTok viral averaged 14k views, IG viral 0 views due to same photo issue).
  2. **Use TikTok hashtag/keyword scraper** (`clockworks~tiktok-scraper` with `hashtags` input) for niche tags — TikTok hashtag content is video-first and high-signal.
  3. **For IG**: scrape Reels-only via a Reels scraper actor input filter (`onlyReels: true` on the IG scraper), so we get videos not photos.
- **Hard quality gate before showing in Viral:**
  - Must be a video (`media_kind === 'video'`)
  - Must have `views >= 10000` OR `engagement_rate >= 0.05`
  - If after filtering the bucket has fewer than 10 posts, fall back to top engagement-rate posts from the viral pool but still video-only.
- Sort the Viral tab by views desc, not engagement rate (engagement rate flatters tiny accounts).

---

## 5. Small ref warnings on `HookLibraryPage` / `RunDetailPage`

The console shows: *"Function components cannot be given refs"* — `UsageHeader` is being given a ref by `ContentLabHeader` (likely `<UsageHeader />` inside an asChild slot). Fix by wrapping `UsageHeader` in `forwardRef`. 5-min change, included.

---

## Out of scope (flagging, not building)

- Real-time comment notifications (email when a teammate comments) — can add later.
- Image generation for idea mockups — currently shows the hook text on a styled background, not a generated image. We can wire Lovable AI image generation into the mockup later if you want.
- Multi-language captions — English only for now.

---

## Technical summary

**Edge functions:**
- `content-lab-ideate/index.ts` — schema change: `hook` → `hooks[3]`, tighten `why_it_works` to require a citation.
- `content-lab-run/index.ts`:
  - `mapIG`: thumbnail fallback chain, `media_kind`, fix IG views logic.
  - `phaseScrape`: drop IG hashtag scrape, add TikTok hashtag scrape, IG `onlyReels: true` for viral handles.
  - Quality gate filter for Viral bucket before persist.

**Migrations:**
- `content_lab_idea_hooks`, `content_lab_idea_reactions`, `content_lab_idea_comments`, `content_lab_idea_share_tokens` with RLS (org_members manage, client_users view, public read for share tokens).
- Add `media_kind` text column to `content_lab_posts`.

**Frontend:**
- New `IdeaMockupCard.tsx` (phone frame, hook carousel, IG action row, like/comment/share state).
- `CommentThread.tsx`, `ShareIdeaDialog.tsx`.
- New page `src/pages/share/SharedIdeaPage.tsx` + route `/share/idea/:slug`.
- `RunDetailPage.tsx`: rename Viral tab, sort ideas by likes, swap `IdeaCard` → `IdeaMockupCard`.
- `PostGrid` updates: thumbnail fallback, video-only views, photo/carousel badge.
- `UsageHeader` → `forwardRef` to silence ref warning.

---

Want me to proceed with all 5 sections, or trim any of them first?