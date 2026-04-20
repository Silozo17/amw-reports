

## Scope
Re-architect the Content Lab pipeline so ideas are world-class: benchmark-led, never derivative of underperforming own content, with sharper prompts, a tightened discovery flow, and a re-ordered Run Detail UI.

## What I found
1. `content-lab-discover` currently asks AI to generate competitor handles loosely — no hard ranking by performance, no "top 10 benchmarks" concept, output mixed into `top_competitors` and `top_global_benchmarks` arrays.
2. `content-lab-ideate` already references competitor posts but does **not** filter to top performers, does **not** compare own performance vs benchmarks, and currently uses competitor + own posts equally as inspiration — which is exactly the problem you flagged.
3. Run Detail tabs today: **Viral Feed | 12 Ideas** (no "Your latest content" tab; "12 Ideas" label is wrong).
4. Viral Feed sort today: `engagement_rate DESC` — not views/likes/comments as you want.
5. NicheForm discovery step is a single text box for "tell us about you" — too loose for the quality bar you want.
6. The system persona in `_shared/contentLabPrompts.ts` is "senior short-form strategist" — solid but not the "Head of Creative Direction" framing you want.

## Plan

### 1) Top-10 benchmark-led ideation (the core change)
**`content-lab-discover`**
- Tighten the prompt to return exactly **10 benchmark accounts** (the global best in this niche, ranked by typical reel views — not engagement rate, not vibes), plus up to 5 local/contextual competitors as a separate list.
- Output schema: `{ top_10_benchmarks: [{handle, why_top, est_avg_views}], local_competitors: [{handle, why_relevant}] }`.
- Persist `top_10_benchmarks` to `content_lab_niches.top_global_benchmarks` (already exists).

**`content-lab-scrape`**
- Continue scraping all sources (own + benchmarks + competitors).
- Tag each post `source = 'benchmark' | 'competitor' | 'own'` (already supported).

**`content-lab-ideate` — the rules you asked for, hard-enforced:**
- Pull the **top 30 benchmark posts** sorted by `views DESC, likes DESC, comments DESC` from `source = 'benchmark'` — this is the inspiration pool.
- Pull own posts and compute `own_avg_views`.
- Compute `benchmark_p50_views` (median of top 30).
- Apply this rule in the prompt and in code:
  - Default: ideas reference **only benchmark posts** via `based_on_handle`.
  - Exception: if `own_avg_views >= benchmark_p50_views`, then own posts are eligible inspiration too. Otherwise, **own posts are explicitly listed as "what NOT to repeat"** in the prompt context.
- Hard validation in the response handler: any idea with `based_on_handle` matching `niche.own_handle` AND own_avg_views < benchmark_p50_views → rejected and regenerated.

### 2) Sharper persona + tighter prompts (`_shared/contentLabPrompts.ts`)
- New system persona: **"Head of Creative Direction at a top-tier social agency, 12+ years scaling brands on Instagram/TikTok/Facebook to 8-figure accounts. You've reverse-engineered the playbooks of the top creators in every vertical (Alex Hormozi, MrBeast's content team, Gary Vee's agency, Marie Forleo, Mark Rober, Casey Neistat). You only ship ideas that would pass a senior creative review at Wieden+Kennedy or Ogilvy. {{current_year}} best practice only — no 2019 advice."**
- Add a new `BENCHMARK_FIRST_RULES` block to enforce:
  - "Every idea must be reverse-engineered from a specific top-10 benchmark post. Cite it via `based_on_handle` + a 1-line breakdown of the *mechanic* (not just the topic) you're borrowing."
  - "Never copy the topic verbatim. Borrow the *structural pattern* (hook mechanism, pacing, reveal) and apply it to the brand's niche."
  - "If the producer can't film it in one working day with a phone, reject."
- Strengthen HARD_RULES: ban the additional cliché generation patterns ("You need to hear this", "Wait until the end", "Nobody talks about this") — these are now 2024/25 fatigued.

### 3) UI: tabs + sort (`RunDetailPage.tsx`)
- New tab order: **Your Latest Content | Viral Feed | Ideas** (drop the "12" — count varies, label is misleading).
- "Your Latest Content" tab: filter `content_lab_posts.source = 'own'`, sorted by `posted_at DESC`, with the same `ViralPostCard` and a small header showing `own_avg_views vs benchmark_p50_views` so the user immediately sees where they stand.
- "Viral Feed" tab: filter `source IN ('benchmark', 'competitor')`, sorted **`views DESC, likes DESC, comments DESC`** — exactly as you asked.
- "Ideas" tab: rename, no count in label.

### 4) Tighter discovery form (`NicheFormPage.tsx`)
Replace the loose "tell us about you" with a structured 4-block form (single page, no extra steps):
- **Brand DNA**: niche/category (free text, with autosuggest from common verticals), one-line positioning, 3 specific things you sell/do.
- **Audience**: who they are (1 line), the single problem they have, where they hang out online.
- **Voice & constraints**: tone (chips: witty, expert, warm, blunt, playful, premium — pick max 2), 5 things you'll never say/do, the producer (founder / team / studio).
- **Goal**: pick one — awareness, leads, sales, community. Drives the CTA style downstream.

This becomes the structured context fed into every prompt, replacing the freeform paragraph.

### 5) Validation + observability
- After ideate, run a validator that rejects any idea where:
  - `based_on_handle` is null or doesn't match a known scraped handle in this run, OR
  - `based_on_handle = own_handle` while own underperforms, OR
  - `hook` matches `caption` of the source post (lazy paraphrase).
- Log rejection reasons in `content_lab_step_logs` so we can see WHY ideas were filtered.

## Files to touch
- `supabase/functions/_shared/contentLabPrompts.ts` — new persona, BENCHMARK_FIRST_RULES, expanded HARD_RULES
- `supabase/functions/content-lab-discover/index.ts` — top-10 benchmarks schema + prompt tightening
- `supabase/functions/content-lab-ideate/index.ts` — top-30 benchmark inspiration pool, own-vs-benchmark gating, response validator
- `src/pages/content-lab/RunDetailPage.tsx` — new tab order, new "Your Latest Content" tab, viral feed sort by views/likes/comments
- `src/pages/content-lab/NicheFormPage.tsx` — restructured discovery form (Brand DNA / Audience / Voice / Goal)
- `src/hooks/useContentLab.ts` — surface new niche fields if needed

No DB migration required — existing columns cover this (`top_global_benchmarks`, `source`, etc.).

## Risks / trade-offs
- The new gating rule means users with weak own performance will get **zero ideas inspired by their own work** — that's intentional and correct, but I'll surface a one-line banner explaining it on the Ideas tab.
- The structured discovery form is a behaviour change for existing niches; old niches keep their freeform `niche_description` and we'll fall back to it when the new structured fields are empty.
- Benchmark scraping cost is unchanged — same Apify call, just a stricter list.

## Expected result
- Ideas are reverse-engineered from the proven top-10 in your niche, with a cited source post for every one.
- Your own underperforming posts are explicitly used as anti-examples, not inspiration.
- The Run Detail page leads with **Your Latest Content** so you see your baseline first, then the **Viral Feed** sorted by raw views, then the **Ideas**.
- Discovery captures the brand brief in 4 tight blocks instead of one paragraph.
- Persona + rules upgrade pushes idea quality toward agency-grade output.

