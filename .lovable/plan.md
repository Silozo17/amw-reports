## Three changes

### 1. Live search in `CompetitorPicker`
- Drop the "Search" button.
- Debounce input (350ms). Fire `google-places-lookup` automatically once the query is ≥ 2 chars.
- Open the popover as soon as the user starts typing; show "Searching…" while a request is in flight; show results live.
- Cancel stale requests (latest-wins) so fast typing doesn't show outdated results.
- Keep the URL-paste flow exactly as it is.

### 2. New edge function `firecrawl-find-socials`
- POST `{ url }` → `{ instagram?, tiktok?, facebook?, source: 'firecrawl' | 'none' }`.
- Calls Firecrawl `/v2/scrape` with `formats: ['links']`, `onlyMainContent: false` (header/footer needed). One credit per call, fast.
- Filters returned links for `instagram.com/<handle>`, `tiktok.com/@<handle>`, `facebook.com/<handle>`. Strips junk paths (`/share`, `/p`, `/explore`, `/intent`, etc.) and validates handle format.
- Returns the first valid handle per platform.
- Auth: accepts a user JWT or the service-role key (so the orchestrator can call it).
- On any failure (no key, Firecrawl error, no links found) returns `{ source: 'none' }` with HTTP 200 — never throws — so the caller can fall back cleanly.

### 3. Wire into `content-lab-run` discover phase
- For every competitor with a `website` in `clients.competitors`, call `firecrawl-find-socials` (parallel, max 5 at a time) **before** the AI discovery step.
- Build a "known competitors" string that includes the real `instagram` / `tiktok` handles found via Firecrawl.
- Inject this into the AI discover prompt as **verified facts**, telling the AI: use these as-is, only add MORE competitors to fill the list to 10. This guarantees real handles win and AI only fills in gaps (the existing fallback behaviour).
- Log which competitors had socials found via Firecrawl vs needed AI assistance, into `content_lab_run_progress` for transparency.

No DB / type changes. No new secrets — `FIRECRAWL_API_KEY` is already configured.

## Files touched

- `src/components/clients/CompetitorPicker.tsx` — debounced live search.
- `supabase/functions/firecrawl-find-socials/index.ts` — new function (created).
- `supabase/functions/content-lab-run/index.ts` — augment `phaseDiscover` with Firecrawl-resolved socials before calling the AI.
- Deploy `firecrawl-find-socials` and `content-lab-run`.