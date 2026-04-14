
## Plan: Make Facebook count toward the hero stats as Views

### What I found
You were right to call this out.

The current code already makes the **hero Reach KPI** use Facebook `views` instead of Facebook `reach`:
- `src/lib/dashboardCalcs.ts`
  - `totalReach` uses `m.views` when `s.platform === 'facebook'`
  - `prevReach` does the same
  - `reachPlatforms` does the same
  - reach sparkline aggregation does the same

But the current **hero Video Views KPI** does **not** pull Facebook page views. It only sums `metrics_data.video_views`, and the Facebook sync does not save a `video_views` field at all — it saves:
- `views`
- `views_total`

So Facebook is contributing to the hero **Reach** card, not the hero **Video Views** card.

### Minimal fix
Update the hero Video Views aggregation so that:
- for `facebook`, it uses `metrics_data.views`
- for all other organic platforms, it keeps using `metrics_data.video_views`
- `meta_ads` stays excluded from the hero Video Views KPI
- the previous-period comparison, platform badges, and sparkline logic use the same rule

### Files to update
**1. `src/lib/dashboardCalcs.ts`**
Adjust only the Video Views logic:
- `totalVideoViews`
- `prevVideoViews`
- `videoViewsPlatforms`
- `computeSparklines()` → `existing.video_views`

### Intended behavior after the change
- **Hero Reach**: still includes Facebook Views and other platforms’ reach/impressions logic
- **Hero Video Views**: includes Facebook Views instead of ignoring Facebook entirely
- **Meta Ads**: still excluded from hero Video Views
- No backend changes needed

### Important note
This means Facebook Views would appear in **both**:
- the hero **Reach** card
- the hero **Video Views** card

If that is exactly what you want, I can implement it as a very small frontend-only change. If instead you want Facebook Views to move from Reach into Video Views and no longer count in Reach, that would be a different change.
