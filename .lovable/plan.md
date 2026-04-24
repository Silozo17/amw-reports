# Redesign idea cards — everything visible, no clicks

## What you'll see on each idea card

A wide 2-column card (1 per row on mobile, 2 per row on large screens):

```text
+-----------------------------------------------------------+
|  [PHONE MOCKUP]    |  Idea #3 · Instagram Reel            |
|  IG header         |  "How we doubled bookings in 30 days"|
|                    |                                      |
|  Hook 1/3 (auto-   |  HOOKS (tap to preview in phone)     |
|  swipes every 4s,  |   1. Stop scrolling if you run a gym |
|  arrows + dots)    |   2. The mistake 90% of trainers...  |
|                    |   3. POV: your DMs after this reel   |
|  ❤ 12  💬  ↗  🔖   |                                      |
|  caption preview   |  SCRIPT                              |
|  #hashtags         |   Full script paragraph here...      |
|                    |                                      |
|                    |  CAPTION                             |
|                    |   Full caption text...               |
|                    |                                      |
|                    |  HASHTAGS  #a #b #c #d #e            |
|                    |                                      |
|                    |  WHY IT WORKS                        |
|                    |  [pattern tag: POV hook]             |
|                    |   Plain-English rationale...         |
|                    |   Inspired by @handle on TikTok      |
|                    |   124K views · 8.2K likes · ↗ link   |
|                    |                                      |
|                    |  [AI edit]  [Save]                   |
+-----------------------------------------------------------+
```

## How it behaves

- **Phone mockup (left, sticky)** — Instagram-style frame with the active hook displayed as the visual. Auto-rotates between the 3 hooks every 4 seconds, with arrows + dots to navigate manually.
- **Hooks list (right)** — All 3 hooks numbered and always visible. Clicking one jumps the phone to that hook and pauses auto-rotation.
- **Script, caption, hashtags** — Always rendered in full (no clamping, no "view more"). Long scripts scroll inside the card if they exceed a max height.
- **Why it works** — Pattern tag badge (e.g. "POV hook", "before/after") + AI rationale paragraph + inspiration card showing the source post (handle, platform, views, likes, link out).
- **Engagement** — Heart on the phone is wired to the existing like system; liked ideas still float to the top. Comments and Share dialogs stay as before.

## Technical changes

**File: `src/components/content-lab/IdeaPhoneMockup.tsx`** (rewrite)
- Switch to 2-column layout (`grid lg:grid-cols-[280px_1fr]`).
- Add 4-second auto-rotation effect for hooks (clears on manual interaction).
- Render hooks list, script, caption, hashtags, why-it-works inline. Remove the `DetailsDialog`.
- Add an `InspirationBlock` sub-component that fetches the inspiration post (`content_lab_posts` row) when `inspired_by_post_id` is set: shows handle, platform, views, likes, thumbnail, link.
- Show `pattern_tag` (from inspiration post) or `inspiration_source` as a badge above the why-it-works text.

**File: `src/pages/content-lab/RunDetailPage.tsx`**
- Extend `IdeaRow` type: add `inspired_by_post_id`, `inspiration_source`.
- Add both fields to the ideas `select(...)`.
- Switch grid from `lg:grid-cols-3` to `lg:grid-cols-2` so the wider cards have room.

**No DB changes** — `content_lab_ideas.inspired_by_post_id`, `inspiration_source`, and `content_lab_posts.pattern_tag` already exist.

## Out of scope (unless you say otherwise)
- No changes to the ideate edge function — uses whatever inspiration link is already saved.
- No changes to comments, share links, like sync, or the run progress stepper.
- Existing ideas without `hooks[]` still fall back to the single `hook` field.