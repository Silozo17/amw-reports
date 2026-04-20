

## Scope
Make the Viral Feed cards look like real Instagram posts: working thumbnails, full stat row (views, likes, comments, shares), and a "View reel" button that opens the original post. No backend re-scrape — work with the data we already have.

## What I found
1. `content_lab_posts` already stores: `thumbnail_url`, `post_url`, `likes`, `comments`, `shares`, `views`, `post_type`, `posted_at`.
2. Thumbnails are blank because Instagram CDN URLs (from Apify `displayUrl` and IG Graph `thumbnail_url`) are signed + short-lived AND blocked by Instagram's referrer policy when loaded from another domain. So `<img src={p.thumbnail_url}>` 404s or returns blank.
3. `shares` is always `0` for Instagram (Graph API and Apify do not expose share counts for organic posts). `views` is only present for videos/reels.
4. The card layout in `RunDetailPage.tsx` only shows likes + comments and has no link out to the original post.

## Plan

### 1. Fix thumbnails (proxy through an edge function)
- Add a tiny new edge function `content-lab-image-proxy` (verify_jwt = false) that:
  - Accepts `?url=<encoded instagram cdn url>`.
  - Validates the URL host is on an allowlist (`*.cdninstagram.com`, `*.fbcdn.net`, `scontent*.cdninstagram.com`, `*.tiktokcdn.com` for later).
  - Fetches server-side (no browser referrer issue) and streams the bytes back with `Content-Type` from upstream + `Cache-Control: public, max-age=86400`.
  - Returns a 1×1 transparent PNG on failure so the card never shows a broken icon.
- In the frontend, render thumbnails via this proxy:
  ```
  /functions/v1/content-lab-image-proxy?url=<encoded>
  ```
- Add `<img loading="lazy" onError={hide}>` so any remaining failures collapse cleanly.

### 2. Real-looking post card
Update the Viral Feed card in `src/pages/content-lab/RunDetailPage.tsx` (extracted into a new `src/components/content-lab/ViralPostCard.tsx` to keep file size sensible):
- Header row: small circular avatar placeholder + `@handle` + platform badge.
- Square (1:1) image area using the proxied thumbnail; fallback gradient if missing.
- Action row beneath the image with icons (heart, comment, paper plane / share, bookmark) — visual only, like a real IG card.
- Stats line: `{likes} likes · {comments} comments` and, when `views > 0`, a leading `{views} views` line above (matches how Reels display).
- Caption: 2-line clamp.
- Footer:
  - **"View reel"** button (primary, small) when `post_type` is `video`/`reel`/`clip` AND `post_url` exists → opens `post_url` in a new tab.
  - **"View post"** button otherwise, same behaviour.
  - Posted-at relative time (e.g. "3d ago") on the right.

### 3. Honest handling of missing metrics
- If `views === 0` → hide the views line (don't show a misleading "0 views").
- If `shares === 0` → hide the shares chip (Instagram organic doesn't expose it, showing 0 looks broken).
- Keep the "Hook" highlight box as it is — it's useful.

### 4. No DB or scrape changes
- We already have everything we need in `content_lab_posts`. No migration. No new Apify calls. No extra cost.

## Files to touch
- `supabase/functions/content-lab-image-proxy/index.ts` (new)
- `supabase/config.toml` (register new function with `verify_jwt = false`)
- `src/components/content-lab/ViralPostCard.tsx` (new)
- `src/pages/content-lab/RunDetailPage.tsx` (replace the inline card markup with `<ViralPostCard />`)

## Risks / trade-offs
- The image proxy is the only way to reliably show Instagram CDN images in the browser. It is a small egress cost (cached 24h per URL).
- "Shares" will not appear for Instagram even after this fix — the platform doesn't expose it. I'll flag this in the UI by simply omitting the field, not by faking a number.
- "Views" will only show on video/reel posts.

## Expected result
- Cards look like real Instagram posts: avatar + handle, square image, action icons, likes/comments/views line, caption, hook highlight, and a clear "View reel" / "View post" button that opens the original.
- Thumbnails actually render.
- No misleading zero values.

