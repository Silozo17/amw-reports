

## Public landing page: `/content-lab`

A full marketing funnel page on the public site explaining what Content Lab does, how it works, who it's for, what's included, and how to start. Mirrors the look and structure of existing public pages (`/how-it-works`, `/features`, `/pricing`).

### Route + nav

- New route `/content-lab-feature` (the in-app authenticated `/content-lab` already exists, so we use a distinct public path to avoid collision).
- Add it to `PublicNavbar.tsx` under **Solutions → Use Cases** as **"Content Lab (AI Content Engine)"**.
- Add it to `PublicFooter.tsx` features column.
- Lazy-import in `App.tsx` and wrap in `<PublicPageRoute>`.

### Page sections (top to bottom)

```text
1. Hero
   eyebrow: "AI Content Engine"
   H1: "Stop Guessing What to Post.
        Decode What's Working — Then Make It Yours."
   sub: "Content Lab scrapes the last 60 days of viral content in any
         niche, extracts the patterns behind it, and turns them into
         12 ready-to-film ideas every month — with hooks, scripts,
         filming checklists and phone-mockup previews."
   CTAs: [Start Free Trial]  [See Live Demo ↓]
   star decorations + warped grid background

2. Social-proof strip (logos / "Trusted by AMW Media + creators")

3. The problem (3 pain cards)
   • "Spending hours scrolling for inspiration"
   • "Posting and praying — no idea what works"
   • "Burning out on the content treadmill"

4. The 3-step solution (Discover → Decode → Create)
   already exists as a tutorial banner inside the app — we restate
   it for marketing with bigger illustrations + 1-line outcomes:
   • Discover  — pulls own + benchmark + competitor content
   • Decode    — AI extracts hooks, formats, hot topics, mechanisms
   • Create    — 12 ready-to-film ideas with scripts + previews

5. "Inside every run" — feature deep-dive (8 cards in a 4×2 grid)
   • Viral Feed (own / benchmarks / competitors, last 60d)
   • Pattern Insights (formats, topics, sentiment, posting cadence)
   • 12 ready-to-film Ideas every month (+ wildcards 🚀)
   • Hook Library (global, ranked across the platform)
   • Trend Library (live momentum + recommendations)
   • Pipeline Kanban (script → film → edit → posted)
   • Swipe File (save the best ideas across all your runs)
   • Client Sharing (share runs, DOCX export, comments)

6. "What you get per idea" — phone mockup screenshot
   single hero image / mock with annotations:
   hook, 30-sec script, CTA, why-it-works, filming checklist,
   hashtags, performance prediction. Re-uses existing IdeaCard
   stacked layout.

7. Built for (3 audience cards)
   • Solo creators wanting consistent output
   • Freelancers selling content as a service
   • Agencies running content for multiple clients

8. Pricing
   Three tier cards mirroring the in-app structure:
   • Creator  — 1 run / month        — included with free plan
   • Studio   — 3 runs / month       — Most Popular
   • Agency   — 10 runs / month      — full multi-client access
   Plus a "Need more runs?" credit-pack subsection showing the
   £15 / £60 / £200 packs (5 / 25 / 100 credits, never expire),
   pulled verbatim from BuyCreditsDialog so they stay accurate.
   Note: exact tier prices are managed in Stripe today; CTA on
   each card is "Start trial" → /login?view=signup. Final pence
   prices are read from the existing /pricing page if present, or
   left as "From £X/mo · See pricing" with a link to /pricing.

9. How runs work (timeline graphic)
   minute-by-minute: scrape → analyse → ideate → ready
   typical run completes in ~3–5 minutes. Live progress shown
   in the app.

10. FAQ (8 Q&A, expandable)
    • What is Content Lab?
    • What platforms does it scrape?
    • Whose content does it look at?
    • Are ideas unique to me?
    • Can I share runs with clients?
    • What does a credit cost?
    • Do credits expire?
    • Can I cancel anytime?

11. Long-form SEO block
    3–4 paragraphs: "How AI Content Research Saves Marketers 20+
    Hours a Month" — keyword-targeted, mirrors the depth of the
    HowItWorksPage SEO section.

12. Final CTA
    "Stop scrolling. Start shipping."
    [Start Free Trial]  [Book a demo]
```

### Visual + copy guardrails

- Reuses `<StarDecoration>`, `gradient-divider`, `section-light`, `font-heading` (Anton), `font-body`, `text-gradient-purple` — exactly like `HowItWorksPage`.
- Dark theme only (project memory: public pages are dark).
- Phone mockup screenshot: re-use existing `IdeaPreviewInstagram` rendering with a hardcoded sample idea (no live data fetch on a public page).
- All in-app screenshots are referenced as inline component renders, not bitmap exports — so the page is always in sync with the real product.
- `usePageMeta()` for SEO title/description.

### Files

**New (1)**
```
src/pages/ContentLabPublicPage.tsx
```

**Edited (3)**
```
src/App.tsx                                  ← lazy import + route
src/components/landing/PublicNavbar.tsx      ← add to Solutions menu
src/components/landing/PublicFooter.tsx      ← add link
```

No backend, no DB changes, no auth changes. One new public page + navigation wiring.

### Open questions
- **Tier prices**: I haven't found hardcoded Content Lab tier prices in the frontend (managed via Stripe). I'll show tier *features* (1 / 3 / 10 runs per month) with "From £X/mo" placeholders and a "See pricing" link, OR you can confirm the exact monthly prices for **Studio** and **Agency** Content Lab tiers and I'll bake them in. Which do you want?

