

## Plan: Fix Post Metrics Display

The table currently shows a single "Engagement" column with the total. The data already has `likes`, `comments`, `shares`, and `reach` as separate fields on each post — they just need their own columns.

### Changes to `src/components/clients/ClientDashboard.tsx`

**Update the table header** (lines 1182-1189) to show individual metric columns:
- Post | Reach | Likes & Reactions | Comments | Shares | Eng. Rate | Link

**Update the table body** (lines 1230-1238) to render each metric in its own column:
- `post.reach` — formatted with `toLocaleString()`
- `post.likes` — likes/reactions count
- `post.comments` — comments count
- `post.shares` — shares count
- Engagement rate calculated as `(total_engagement / reach) * 100`

This replaces the single "Engagement" column with granular breakdowns matching what the sync stores per post.

### Files to modify
1. `src/components/clients/ClientDashboard.tsx` — table header + body columns

