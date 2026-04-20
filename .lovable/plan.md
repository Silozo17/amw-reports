
User wants A2 (Benchmark Quality badge + niche-form polling) and A3 (credits top-up Stripe flow). Stripe pieces I established earlier: tables (`content_lab_credits`, `content_lab_credit_ledger`), RPC (`add_content_lab_credits`), existing `stripe-webhook` function. Need pricing decision — I suggested £5/5 credits and £20/25 credits previously but user never confirmed. I should confirm before creating Stripe products. Keep plan tight.

## A2 — Benchmark Quality + pool status visibility

**1. Pool status on Niche Form (`NicheFormPage.tsx`)**
After save, redirect to a new poll view that reads `content_lab_niches.pool_status` + counts rows in `content_lab_benchmark_pool` matching the niche's `niche_tag` and `platforms_to_scrape`. Polls every 5s until ≥5 verified handles exist or 3 min elapses. Shows "Building benchmark pool — 7/10 verified".

**2. Run-button gating (`ContentLabPage.tsx`)**
Disable "Run report now" until that niche's pool has ≥5 verified handles. Tooltip: "Pool building — X/5 verified".

**3. Benchmark Quality badge (`RunDetailPage.tsx`)**
Read pool size for the run's `niche_tag`. Render badge:
- Strong (15+) — emerald
- Good (10–14) — primary
- Limited (5–9) — amber
- Building (<5) — muted

New shared hook `useBenchmarkPoolStatus(nicheTag, platforms)` returning `{ verifiedCount, status, lastRefreshedAt }`. Used by all three surfaces.

## A3 — Credits top-up via Stripe

**Pricing — needs your confirmation.** My suggestion:
- **5 credits = £5** (£1.00/credit)
- **25 credits = £20** (£0.80/credit, 20% bulk discount)

Each credit = 1 extra Content Lab run beyond the monthly allowance. If you want different pack sizes/prices say so before I create the Stripe products.

**Implementation (assuming pricing approved):**

1. Create 2 Stripe one-time products + prices (`stripe--create_stripe_product_and_price`). Store the resulting `price_id`s as constants in a new edge function.
2. New edge function `create-content-lab-credit-checkout`:
   - Authenticates user, resolves their `org_id`.
   - Accepts `{ pack: 'small' | 'large' }`.
   - Creates Stripe Checkout session in `mode: 'payment'` with metadata `{ org_id, credits, type: 'content_lab_credits' }`.
   - Returns `{ url }`.
3. Extend existing `stripe-webhook/index.ts` — add a branch for `checkout.session.completed` where `metadata.type === 'content_lab_credits'`. Calls `add_content_lab_credits(org_id, credits, payment_intent_id)` RPC.
4. UI — `ContentLabPage.tsx`:
   - "Buy credits" button next to the usage badge → opens a small dialog with the two packs.
   - On click → invokes `create-content-lab-credit-checkout` → opens Stripe URL in new tab.
   - On `?credits=success` query param after redirect → toast "Credits added" + invalidates `content-lab-usage` query.

Success/cancel URLs: `/content-lab?credits=success` and `/content-lab?credits=cancelled`.

## Build order
1. Confirm pricing (or accept my suggestion).
2. Create Stripe products + prices.
3. Build A2 (pool hook + 3 UI surfaces) — independent, ships even if Stripe is delayed.
4. Build A3 (checkout function + webhook branch + dialog).

## Risks
- **Pool can be empty for brand-new niches** even after refresh job (e.g. extremely narrow B2B niche). Building badge persists. UX needs an explicit "Pool couldn't fill — try broader hashtags" state if `pool_status='completed'` AND verified count <5. I'll include this.
- **Webhook idempotency**: if Stripe retries, we'd double-credit. I'll check `stripe_payment_id` exists in `content_lab_credit_ledger` before adding.
- **No frontend auth gate on credit purchase** beyond standard Supabase auth — fine since the function resolves org_id server-side.

## Question before I build
**Confirm pricing: £5/5 credits + £20/25 credits, or specify your own packs.**
