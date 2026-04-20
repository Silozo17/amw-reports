

## Updated Content Lab pricing — final spec

Replaces the previous tier and credit pack figures. Everything else in the prior plan (positioning as a paid add-on, removing "included" claims, new subscription checkout function, gating, site-wide copy fixes) stays the same.

### Subscription tiers (monthly, no free trial)

| Tier    | Price     | Runs / month |
|---------|-----------|--------------|
| Starter | £49 / mo  | 3            |
| Growth  | £149 / mo | 5            |
| Scale   | £299 / mo | 20           |

### Credit packs (one-off, never expire)

1 credit = 1 idea regeneration **OR** 1 remix **OR** 1 manual pool refresh.

| Pack | Credits | Price | £/credit |
|------|---------|-------|----------|
| 1    | 5       | £25   | £5.00    |
| 2    | 15      | £55   | £3.67 (Save 27%) |
| 3    | 25      | £75   | £3.00 (Save 40%) |
| 4    | 50      | £99   | £1.98 (Save 60%) |
| 5    | 100     | £149  | £1.49 (Save 70%) |

Five packs (not three). The badging row will highlight pack 4 (50/£99) as **"Best value"** and pack 5 (100/£149) as **"Best deal"** based on per-credit price.

### Stripe — products to create / archive

**Archive** (obsolete, kept in Stripe for invoice history):
- "Content Lab Credits — 5 Pack" (£15 / 5)
- "Content Lab Credits — 25 Pack" (£60 / 25)
- "Content Lab Credits — 100 Pack" (£200 / 100)

**Create 8 new products**:

Subscriptions (3, monthly recurring):
- Content Lab — Starter — £49.00
- Content Lab — Growth — £149.00
- Content Lab — Scale — £299.00

Credit packs (5, one-off):
- Content Lab Credits — 5 Pack — £25.00
- Content Lab Credits — 15 Pack — £55.00
- Content Lab Credits — 25 Pack — £75.00
- Content Lab Credits — 50 Pack — £99.00
- Content Lab Credits — 100 Pack — £149.00

All 8 new price IDs land in `src/lib/contentLabPricing.ts`:

```ts
export const CONTENT_LAB_TIERS = {
  starter: { name: 'Starter', priceMonthly: 49,  runsPerMonth: 3,  priceId: 'price_xxx' },
  growth:  { name: 'Growth',  priceMonthly: 149, runsPerMonth: 5,  priceId: 'price_xxx', highlight: true },
  scale:   { name: 'Scale',   priceMonthly: 299, runsPerMonth: 20, priceId: 'price_xxx' },
} as const;

export const CONTENT_LAB_CREDIT_PACKS = {
  pack_5:   { credits: 5,   price: 25,  priceId: 'price_xxx' },
  pack_15:  { credits: 15,  price: 55,  priceId: 'price_xxx', badge: 'Save 27%' },
  pack_25:  { credits: 25,  price: 75,  priceId: 'price_xxx', badge: 'Save 40%' },
  pack_50:  { credits: 50,  price: 99,  priceId: 'price_xxx', badge: 'Best value' },
  pack_100: { credits: 100, price: 149, priceId: 'price_xxx', badge: 'Best deal' },
} as const;
```

### Edge functions

- **New** `create-content-lab-subscription-checkout` — accepts `{ tier: 'starter' | 'growth' | 'scale' }`, looks up price ID server-side, creates Stripe Checkout session in `mode: 'subscription'`. Auth required.
- **Updated** `create-content-lab-credit-checkout` — pack keys become `pack_5 | pack_15 | pack_25 | pack_50 | pack_100`, mapped to the new price IDs.
- **Updated** `stripe-webhook` — recognise the 3 new subscription price IDs and map to `content_lab_tier` (`starter` / `growth` / `scale`). Credit-pack metadata flow stays the same (the `add_content_lab_credits` RPC still handles balance + ledger).

No DB migration required.

### Public site copy fixes (unchanged from previous plan)

Same files as before — `PricingPage.tsx`, `FeaturesPage.tsx`, `HomePage.tsx`, `HowItWorksPage.tsx`, `ForCreatorsPage.tsx`, `ForFreelancersPage.tsx`, `ForAgenciesPage.tsx`, `ContentLabPublicPage.tsx`. All "included with every plan" wording is replaced with "Paid add-on. From £49/mo." and tiers/packs read from the constants file.

### `BuyCreditsDialog.tsx`

Renders all 5 packs in a responsive grid (2 cols mobile, 5 cols `lg+`) reading from `CONTENT_LAB_CREDIT_PACKS`. Pack 4 visually highlighted via the `Best value` badge.

### Files

**New (3)**: `src/lib/contentLabPricing.ts`, `supabase/functions/create-content-lab-subscription-checkout/index.ts`, plus `deno.json` if needed for parity.

**Edited (10)**: `supabase/functions/create-content-lab-credit-checkout/index.ts`, `supabase/functions/stripe-webhook/index.ts`, `src/components/content-lab/BuyCreditsDialog.tsx`, `src/pages/ContentLabPublicPage.tsx`, `src/pages/PricingPage.tsx`, `src/pages/FeaturesPage.tsx`, `src/pages/HomePage.tsx`, `src/pages/HowItWorksPage.tsx`, `src/pages/ForCreatorsPage.tsx`, `src/pages/ForFreelancersPage.tsx`, `src/pages/ForAgenciesPage.tsx`.

**Stripe operations** (build mode): archive 3 obsolete products, create 8 new products + prices, capture price IDs into the constants file.

### Risks (unchanged)

- Existing subscribers on old products keep their current Stripe subscription until they cancel/upgrade — no auto-migration.
- Existing unused credits in `content_lab_credits.balance` are unchanged; their *meaning* shifts to "regen / remix / pool refresh" only. Strict enforcement of credit-spend rules across `content-lab-regenerate-idea`, `content-lab-remix-idea`, and `content-lab-manual-pool-refresh` is **out of scope** of this task — flagging.
- Webhook price-ID → tier-slug map is the only fragile bit. Single source of truth in `contentLabPricing.ts` keeps it manageable.

