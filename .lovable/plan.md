
The user said "continue" after I built Phase 1 of v3 (DB foundation + pool refresh function + discover/scrape/pipeline updates + UI for limits). They previously asked about two follow-ups: credits top-up flow and benchmark quality badge.

Before I propose more, I should look at what's actually deployed and whether the pool refresh has been tested, because the user was burned by the last "discovery is failing" issue. Let me check current state.

I'll keep this tight — the user is fatigued. Propose the two next-step items I flagged + one critical reliability item (verify the pool refresh actually works end-to-end against a real niche), then ask which to tackle first.

## What's left from v3 to ship

I built the foundation last turn (DB tables, pool refresh function, discover/scrape/pipeline updates, run-limit UI). Here's what remains, ordered by impact:

### 1. Verify the pool actually fills (critical — do first)
We've never run `content-lab-pool-refresh` end-to-end against a real niche. Before building UI on top of it, I need to:
- Trigger it manually for one niche (e.g. your own AMW niche tag)
- Check it returns ≥10 verified handles
- Check Apify cost stays under £0.50 per pool build
- Fix any actor-input bugs before users hit them

If this fails, every v3 change is dead on arrival. Should be 1 invocation + log review, not a build.

### 2. Benchmark Quality badge on Run Detail
Small, high-trust UI win. Reads `content_lab_benchmark_pool` count for the run's `niche_tag` and shows Strong (15+) / Good (10-14) / Limited (5-9) / Building. Sets expectations and surfaces the new pooling system.

### 3. Pool status on the Niche Form
After Save, show "Building benchmark pool — 7/10 verified" with a poll. Disables the Run button until ≥5 verified handles exist. Prevents users running against an empty pool and getting bad results.

### 4. Credits top-up via Stripe
Flow: Stripe Checkout → webhook → `add_content_lab_credits` RPC. Needs a price decision (suggest £5 = 5 credits, £20 = 25 credits). One new edge function (`create-credit-checkout`) + extending the existing `stripe-webhook` to handle `content_lab_credit` line items + a "Buy credits" button on the Content Lab page.

### Out of scope (logged for later)
- Trend verification via Google Trends
- Trending-audio lookup for TikTok ideas
- Swipe file / content calendar
- Per-idea regenerate (depends on credits shipping first)

## What I need from you

Pick one to start (or "all in order"):

**A.** Verify pool refresh works end-to-end (item 1) — recommended first.
**B.** Build Benchmark Quality badge + pool status on niche form (items 2 + 3).
**C.** Build credits top-up (item 4) — needs you to confirm pricing.
**D.** All of the above, in order A → B → C.

If **C or D**: confirm credit pack pricing. My suggestion: **£5 = 5 credits, £20 = 25 credits (£0.80/credit, 20% bulk discount)**. Each credit = 1 extra Content Lab run beyond monthly allowance.
