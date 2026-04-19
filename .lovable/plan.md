

Looking at the edge function logs:

```
Insert posts failed: {
  code: "22003",
  details: "A field with precision 6, scale 4 must round to an absolute value less than 10^2.",
  message: "numeric field overflow"
}
```

Scrape is actually working — it pulled 20 own + 121 competitor + 100 benchmark + 141 legacy posts. It's the **insert** that fails.

Cause: `content_lab_posts.engagement_rate` is `NUMERIC(6,4)` (max value < 100). The scrape function calculates:

```ts
engagement_rate: p.views > 0
  ? (p.likes + p.comments) / p.views
  : (p.likes + p.comments) / 1000,
```

When `views = 0` and `likes + comments > 100,000` (very common on Nike, Apple, etc. via the legacy bucket), the fallback `/1000` produces values > 100 → overflow → entire batch insert fails → pipeline marks run as failed.

Also worth noting: there's a runtime error `Component is not a function` on `/admin/content-lab` — likely the `forwardRef` wrapping done last step broke the lazy import default export. I'll check.

## Plan — fix scrape insert failure

### 1. Cap engagement_rate at the source
In `content-lab-scrape/index.ts`, clamp the computed rate so it can never overflow `NUMERIC(6,4)`:

```ts
const raw = p.views > 0
  ? (p.likes + p.comments) / p.views
  : (p.likes + p.comments) / Math.max(p.likes + p.comments + 1000, 1000);
engagement_rate: Math.min(Math.max(raw, 0), 99.9999),
```

The fallback heuristic `/1000` is also wrong for high-volume accounts — switch to a normalised formula that scales with reach so a celebrity post doesn't produce rates of 500+. Clamp is the safety net.

### 2. Widen the column as defence in depth
Migration: `ALTER TABLE content_lab_posts ALTER COLUMN engagement_rate TYPE NUMERIC(8,4)` (max < 10,000). Cheap, irreversible-safe, and means a future calculation bug can't kill a whole run.

### 3. Insert in chunks, don't fail the whole batch
Right now one bad row kills all 380 inserts. Switch the insert to chunks of 50 with `{ count: 'exact' }` and continue on per-chunk error, logging which chunk failed to `summary.scrape_errors`. Run still completes with whatever data we got.

### 4. Fix the runtime error on /admin/content-lab
`Component is not a function` on this route points to the `forwardRef` change to `AppLayout` or `RunDetailPage`. I'll check both — likely `AppLayout` was wrapped but is consumed as `<AppLayout>{children}</AppLayout>` not via ref, and the wrap broke its default export. Revert the `forwardRef` if it isn't actually needed (the original warning was cosmetic; breaking the page is worse).

### Build order
1. Migration — widen `engagement_rate` to `NUMERIC(8,4)`
2. Patch `content-lab-scrape`: clamp rate + chunked insert with per-chunk error capture
3. Inspect & fix `AppLayout` / `RunDetailPage` forwardRef regression
4. Stop and ask you to re-run the niche

### Out of scope
- Re-tuning the engagement rate formula beyond the clamp (current heuristic is fine for ranking).
- Adding TikTok/Facebook scrapers.

Approve and I'll start with the migration.

