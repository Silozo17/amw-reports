
User picked **A** = "£15 / 5 credits + £60 / 25 credits + £200 / 100 credits" (3 tiers).

Need to implement A3 credits top-up. Plan was already approved earlier in principle, but pricing has now changed from my original suggestion (£5/£20) to the cost-justified £15/£60/£200 with 3 tiers. So the build is the same shape, just different numbers and 3 packs instead of 2.

## A3 — Credits top-up via Stripe (final pricing)

**Packs:**
| Pack key | Credits | Price |
|---|---|---|
| `small` | 5 | £15 |
| `medium` | 25 | £60 |
| `large` | 100 | £200 |

### Build steps

1. **Create 3 Stripe products + GBP one-time prices** via `stripe--create_stripe_product_and_price` (no `recurring_interval`). Capture the 3 `price_id`s.

2. **New edge function `create-content-lab-credit-checkout`**
   - Validates JWT, resolves user → `org_id` via `org_members`.
   - Body: `{ pack: 'small' | 'medium' | 'large' }` (Zod-validated).
   - Maps pack → `{ priceId, credits }` constants.
   - Creates Stripe Checkout in `mode: 'payment'` with metadata `{ org_id, credits, type: 'content_lab_credits' }`.
   - Success URL: `/content-lab?credits=success`. Cancel: `/content-lab?credits=cancelled`.
   - Standard CORS + structured logging.

3. **Extend `stripe-webhook/index.ts`**
   - In the existing `checkout.session.completed` branch, check `session.metadata?.type === 'content_lab_credits'`.
   - If so, idempotency check: `select 1 from content_lab_credit_ledger where stripe_payment_id = session.payment_intent`. Skip if exists.
   - Else call `add_content_lab_credits(org_id, credits, payment_intent_id)` RPC.
   - Skip the existing `subscription_activated` email path for credit purchases.

4. **UI on `ContentLabPage.tsx`**
   - "Buy credits" button next to the existing usage badge.
   - Opens a small Dialog showing 3 pack cards with price + per-credit value (highlight Medium as "Best value", Large as "Best deal").
   - On select → `supabase.functions.invoke('create-content-lab-credit-checkout', { body: { pack } })` → `window.open(url, '_blank')`.
   - On mount, if `?credits=success` query param: toast "Credits added", invalidate the credits/usage queries, strip the param via `navigate(pathname, { replace: true })`.
   - On `?credits=cancelled`: toast "Checkout cancelled", strip param.

### Files
- **Create**: `supabase/functions/create-content-lab-credit-checkout/index.ts`
- **Create**: `src/components/content-lab/BuyCreditsDialog.tsx`
- **Edit**: `supabase/functions/stripe-webhook/index.ts` (add credits branch in existing checkout-completed handler)
- **Edit**: `src/pages/content-lab/ContentLabPage.tsx` (button + query-param handler)

### Risks
- **Webhook idempotency**: handled by ledger lookup on `stripe_payment_id`.
- **Org resolution**: user could belong to multiple orgs. Use the same `.limit(1)` pattern as the rest of the webhook for consistency.
- **Currency**: GBP everywhere. Stripe must be configured to accept GBP — assumed yes given existing subscription tiers.
- **No code path tests credits without a real Stripe payment** — I'll add a `add_content_lab_credits` admin-only manual-grant later if you want, but not in this build.
