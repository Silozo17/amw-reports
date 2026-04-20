
## Phase 3a — Locked Plan

Six deliverables. Schema-first, then edge functions, then frontend. One reviewable chunk.

### 1. Schema migration (single migration, additive only)

```sql
-- Track regen/remix activity per idea
ALTER TABLE public.content_lab_ideas
  ADD COLUMN regen_count integer NOT NULL DEFAULT 0,
  ADD COLUMN remix_count integer NOT NULL DEFAULT 0,
  ADD COLUMN last_modified_via text;

-- Webhook idempotency (event-level, not payment-level)
ALTER TABLE public.content_lab_credit_ledger
  ADD COLUMN stripe_event_id text UNIQUE;
CREATE INDEX idx_content_lab_credit_ledger_event
  ON public.content_lab_credit_ledger(stripe_event_id);

-- Manual pool refresh tracking (rate limit lookup)
-- content_lab_pool_refresh_jobs already exists; just add an index
CREATE INDEX IF NOT EXISTS idx_pool_refresh_org_created
  ON public.content_lab_pool_refresh_jobs(triggered_by_org_id, created_at DESC);

-- Atomic credit spend with rollback support
CREATE OR REPLACE FUNCTION public.spend_content_lab_credit(
  _org_id uuid,
  _amount integer,
  _reason text,
  _run_id uuid DEFAULT NULL
) RETURNS uuid  -- returns ledger_id for refund reference
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _ledger_id uuid;
  _new_balance integer;
BEGIN
  INSERT INTO content_lab_credits (org_id, balance) VALUES (_org_id, 0)
  ON CONFLICT (org_id) DO NOTHING;

  UPDATE content_lab_credits
  SET balance = balance - _amount,
      lifetime_used = lifetime_used + _amount,
      updated_at = now()
  WHERE org_id = _org_id AND balance >= _amount
  RETURNING balance INTO _new_balance;

  IF _new_balance IS NULL THEN
    RAISE EXCEPTION 'INSUFFICIENT_CREDITS';
  END IF;

  INSERT INTO content_lab_credit_ledger (org_id, delta, reason, run_id)
  VALUES (_org_id, -_amount, _reason, _run_id)
  RETURNING id INTO _ledger_id;

  RETURN _ledger_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_content_lab_credit(
  _ledger_id uuid,
  _refund_reason text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _org_id uuid;
  _delta integer;
BEGIN
  SELECT org_id, -delta INTO _org_id, _delta
  FROM content_lab_credit_ledger
  WHERE id = _ledger_id;

  IF _org_id IS NULL THEN RAISE EXCEPTION 'Ledger entry not found'; END IF;

  UPDATE content_lab_credits
  SET balance = balance + _delta,
      lifetime_used = lifetime_used - _delta,
      updated_at = now()
  WHERE org_id = _org_id;

  INSERT INTO content_lab_credit_ledger (org_id, delta, reason)
  VALUES (_org_id, _delta, _refund_reason);
END;
$$;
```

**Note**: I'm splitting spend + refund into two RPCs rather than one wrapper because the Claude call happens in the edge function (Deno), not Postgres. The edge function calls `spend_*` first, runs Claude, then either does nothing (success) or calls `refund_*` (failure). This is the only sane pattern — Postgres can't await an HTTP call.

### 2. `content-lab-regenerate-idea` edge function

- JWT auth, Zod body: `{ ideaId, shift: 'angle' | 'cluster' | 'hook' }`
- Verify caller belongs to the org that owns the idea's run
- Call `spend_content_lab_credit(org_id, 1, 'idea_regenerate', run_id)` → get `ledger_id`
- If `INSUFFICIENT_CREDITS` → return 402 with `{ needsCredits: true, currentBalance }`
- Fetch source post + existing idea + niche brief for context
- Claude Sonnet call with shift-specific prompt (3 prompt variants)
- On success: UPDATE the idea row, increment `regen_count`, set `last_modified_via = 'regenerate'`
- On Claude failure: call `refund_content_lab_credit(ledger_id, 'idea_regenerate_refund')` and return 502
- Structured logging throughout

### 3. `content-lab-remix-idea` edge function

Same shape as regenerate. Body: `{ ideaId, remixType: 'shorter' | 'punchier' | 'emotional' | 'b2b' | 'platform', targetPlatform? }`.

Updates only the targeted script field (script_full or platform-specific), increments `remix_count`, sets `last_modified_via = 'remix'`.

### 4. `content-lab-manual-pool-refresh` edge function

- Body: `{ nicheId }`
- Verify caller is in the org that owns the niche
- Look up org's `content_lab_tier`
- **Rate limit check**: count `content_lab_pool_refresh_jobs` where `triggered_by_org_id = org` AND `created_at > now() - interval '30 days'`. If `>= 5`, return 429.
- **Free-tier check (Agency only)**: count refreshes this calendar month for this org. If Agency tier AND count = 0, skip credit charge. Otherwise charge **3 credits**.
- Insert `content_lab_pool_refresh_jobs` row with status='pending'
- Trigger the existing `content-lab-pool-refresh` function async (fire-and-forget with the job id)
- Return job id immediately so frontend can poll

If Apify fails inside `content-lab-pool-refresh`, that function updates the job to `failed`. We don't auto-refund — the user did get *attempted* work. We log clearly so support can manually refund if needed. (Flagging this — alternative is to refund on `failed` status. Lean toward no-refund since Apify is paid by us regardless.)

### 5. Stripe webhook hardening (extend existing `stripe-webhook/index.ts`)

Already does sig verification + credit-pack idempotency via `stripe_payment_id`. Additions:

- Switch credit-pack idempotency check from `stripe_payment_id` to `stripe_event_id` (the new column). Keep writing `stripe_payment_id` for traceability.
- Handle `customer.subscription.updated` for `content_lab_tier` changes specifically — sync new tier into `org_subscriptions.content_lab_tier` (currently only handles general `status`).
- On `invoice.payment_failed`: check if invoice is for a content_lab subscription (via metadata or product ID lookup). If yes, set 7-day grace via `org_subscriptions.grace_period_end` and trigger `send-branded-email` with new template `content_lab_payment_failed` (template body added in 3b — for now reuse existing `payment_failed` and flag TODO).
- After 7 days with no successful payment, downgrade `content_lab_tier` to NULL. **This downgrade lives in 3b's monthly cron** — for now the grace period is just *set*, not enforced.

### 6. Frontend (RunDetailPage.tsx ideas section)

- New shared component `src/components/content-lab/CreditCostBadge.tsx` — pill showing "1 credit" with tooltip "Your balance: X credits"
- New `src/components/content-lab/IdeaActionButtons.tsx` — Regenerate dropdown (3 shifts) + Remix dropdown (5 types) + cost badge
- Exhausted state: when balance = 0, button text becomes "Buy credits" → opens existing `BuyCreditsDialog`
- New hook `src/hooks/useContentLabCredits.ts` — exposes balance via TanStack Query, invalidated after spend
- Edit `RunDetailPage.tsx` ideas list: render `<IdeaActionButtons>` per idea card. Optimistic update on success.

**Will NOT touch**: discovery/scrape/analyse/ideate functions, billing page, cron, banners — all 3b.

### Files created (3a)
- `supabase/migrations/<ts>_phase3a_credits.sql`
- `supabase/functions/content-lab-regenerate-idea/index.ts`
- `supabase/functions/content-lab-remix-idea/index.ts`
- `supabase/functions/content-lab-manual-pool-refresh/index.ts`
- `src/components/content-lab/CreditCostBadge.tsx`
- `src/components/content-lab/IdeaActionButtons.tsx`
- `src/hooks/useContentLabCredits.ts`

### Files modified (3a)
- `supabase/functions/stripe-webhook/index.ts` (add event_id idempotency + content_lab_tier handling + grace period set)
- `src/pages/content-lab/RunDetailPage.tsx` (wire IdeaActionButtons into ideas list)

### Open question I need answered before writing code

**One thing**: the manual pool refresh "Agency-tier free monthly refresh" — counted by **calendar month** (resets on the 1st) or **rolling 30 days from first refresh**? Calendar month is simpler and matches how the run allowance resets. Rolling is fairer but harder to explain in the UI. Recommend calendar month. Confirm.

Once you confirm, I'll write the migration first (your approval gates that), then the rest in parallel.
