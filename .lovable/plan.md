

## Content Lab — production hardening audit

A read-only audit of every Content Lab edge function, hook, RPC, RLS policy, and gating surface uncovered **15 issues** ranging from cross-tenant data leaks to wrong tier limits to missing entitlement enforcement. Below is the prioritised plan to fix them all in one pass.

---

### 🔴 P0 — Security & data isolation (blocking)

**1. `content-lab-export-docx` is a cross-tenant data leak.**
Uses `SERVICE_ROLE_KEY` with the user's auth header (the auth header is ignored by the service role) and accepts an arbitrary `run_id` / `idea_ids[]`. Any logged-in user can export any org's ideas as a DOCX.
**Fix**: After resolving `run.org_id`, verify caller belongs to that org via `org_members`; if not, 403. Same membership check for `idea_ids` flow (resolve runs, all must belong to caller's orgs).

**2. `content-lab-render-pdf` has no auth at all.**
No `Authorization` check, no membership check. Anyone (even unauthenticated) who knows a `run_id` can trigger a render and write to storage at `{org_id}/{run_id}.pdf`. Currently invoked server-to-server from `content-lab-step-runner` only, but there's no gate stopping public abuse.
**Fix**: Require service-role bearer (compare against `SERVICE_ROLE_KEY`) OR a valid user session with org membership. Default to service-role-only since it's never called from the browser.

**3. `content-lab-resume` accepts any `run_id` from any user.**
Auth is checked but org membership is not. A logged-in attacker could re-trigger another org's run.
**Fix**: Verify `user_belongs_to_org(user.id, run.org_id)`; if not, 403.

**4. `content-lab-link-suggest` has no auth.**
Reveals idea title/hook/caption + recent post URLs for any `ideaId`. Cross-tenant info disclosure.
**Fix**: Require auth + membership check on the run's org.

---

### 🔴 P0 — Entitlement & monetisation correctness

**5. Wrong tier limits in 3 places.** Code still uses old tiers (`creator: 1, studio: 3, agency: 10`) but the new pricing is `starter: 3, growth: 5, scale: 20`.
Files: `content-lab-pipeline/index.ts`, `content-lab-step-runner/index.ts`, `src/hooks/useContentLab.ts`.
**Fix**: Single source of truth — export `RUN_LIMITS_BY_TIER` from `src/lib/contentLabPricing.ts` (frontend) and create a sibling `_shared/contentLabTiers.ts` for edge functions. Both reference the same numbers.

**6. Free tier gives 1 free run per month — violates "100% paid, no free runs".**
`getMonthlyLimit()` falls back to `DEFAULT_RUN_LIMIT = 1` when no `content_lab_tier` is set. So any user without a Content Lab subscription still gets 1 free run.
**Fix**: `DEFAULT_RUN_LIMIT = 0`. Pipeline must reject runs when `content_lab_tier IS NULL` OR `org_subscriptions.status !== 'active'` (no scrape, no usage charge, no credit consume) **unless** the org has a positive credit balance — credits alone shouldn't grant runs either since 1 credit = regen/remix/refresh per spec, not a full run. Decision: **Block all runs when no active CL subscription.** Credits only spend on regen/remix/refresh.

**7. `content-lab-pipeline` doesn't gate on subscription status.**
Even if `content_lab_tier` is set, a `cancelled` or `past_due`-past-grace org can keep generating runs for a full calendar month until usage hits the limit.
**Fix**: Pre-flight: load `content_lab_tier` AND `status` AND `grace_period_end`. If status is `cancelled` or `past_due` past grace, return 402 with "Content Lab subscription is not active. Reactivate to continue."

**8. `stripe-webhook` never clears `content_lab_tier` on cancellation.**
When a Content Lab subscription is deleted/cancelled in Stripe, only the general `status` is synced. `content_lab_tier` stays `starter`/`growth`/`scale` forever. Combined with #7's fix, this is what enforces lockout.
**Fix**: In `customer.subscription.deleted` and `customer.subscription.updated` (status `canceled`/`unpaid`), if the subscription's price ID is in `CONTENT_LAB_PRICE_TO_TIER`, set `content_lab_tier = null` immediately. For `past_due` we keep the tier through grace, then a scheduled job (deferred) could enforce; for v1, gating on `status` in #7 is sufficient.

**9. `content-lab-manual-pool-refresh` charges 3 credits, not 1.**
Spec: "1 credit = … 1 manual pool refresh". Code: `REFRESH_COST_CREDITS = 3`.
**Fix**: `REFRESH_COST_CREDITS = 1`. Also remove the dead "Agency free refresh once per month" path — old tier name (`agency`), not in current spec, and obscures the simple credit model.

---

### 🟠 P1 — Reliability & failure modes

**10. Step-runner `chainNext` can drop a step silently.**
`fetch(...)` to re-invoke runner uses fire-and-forget; if the request fails (transient network, cold-start timeout) the run is left stuck mid-state. The 10-minute stale-run reaper rescues it eventually, but UX shows "ideating" for 10 minutes.
**Fix**: Wrap `chainNext` in a 3-attempt exponential retry (250ms / 1s / 4s). On final failure, write `error_message` on the run + a `step_logs` row noting the chain break, but DO NOT fail the run yet — the reaper still runs as a safety net.

**11. Stale-run reaper window is 10 min, but ideate per platform can legitimately take ~3 min × 3 platforms.**
A slow Anthropic call across 3 platforms could legitimately keep `updated_at` flat for >10 min if the runner is slow to write back between platforms. Risk: false-positive "timed out" failures.
**Fix**: Bump `STALE_RUN_MINUTES` from 10 → 20. Also have step-runner write `updated_at = now()` at the start of every step, not just at status transitions.

**12. Credit refund-on-failure path can lose credits silently.**
In `content-lab-regenerate-idea` and `content-lab-remix-idea`, if `refund_content_lab_credit` itself throws (e.g. DB blip), the credit stays spent and only `console.error` records it. No retry, no admin alert.
**Fix**: Add a `content_lab_refund_failures` log table (or a `step_logs` entry tagged `refund_failed`) so platform admins can reconcile. Add a single retry on the refund call before logging.

**13. `consume_content_lab_credit` and `spend_content_lab_credit` overlap.**
Both exist, both decrement balance, both insert ledger rows — but `consume_content_lab_credit` writes `reason = 'run_consumed'` and is only called from step-runner when monthly cap is hit. Risk: double-consume if both fire. Audit shows only one path uses it, but the duplication is a footgun.
**Fix**: Mark `consume_content_lab_credit` as a thin wrapper that calls `spend_content_lab_credit` with `_reason='run_consumed'`. Single ledger format.

---

### 🟡 P2 — Hygiene & monitoring

**14. No `niche_id` validation in `consume_content_lab_credit` for run-spend ledger linkage.**
When monthly cap is hit and credits are charged in the scrape step, the `run_id` is recorded but if the run is later deleted (it shouldn't be, but cascade rules don't enforce), the ledger orphans.
**Fix**: Already preserved by FK absence — the ledger remains as audit trail. Add a comment in code; no schema change needed.

**15. No platform-admin "Content Lab health" view.**
Stuck runs, credit-refund failures, and webhook tier-sync misses are only visible by SQL. The admin Content Lab analytics page exists but doesn't surface these.
**Fix (stretch — flag, don't build now)**: Add a "Stuck runs (>20min)", "Tier-sync mismatches" and "Refund failures (last 7d)" trio to `AdminContentLab.tsx`. **Out of scope** of this hardening pass; recommend a follow-up ticket.

---

### Files to change (12 edited, 1 new)

**Edge functions (8 edited)**
- `supabase/functions/content-lab-export-docx/index.ts` — add membership check (#1)
- `supabase/functions/content-lab-render-pdf/index.ts` — require service-role bearer (#2)
- `supabase/functions/content-lab-resume/index.ts` — add membership check (#3)
- `supabase/functions/content-lab-link-suggest/index.ts` — add auth + membership check (#4)
- `supabase/functions/content-lab-pipeline/index.ts` — use shared tier limits (#5), gate on tier+status (#6, #7), bump stale window (#11)
- `supabase/functions/content-lab-step-runner/index.ts` — use shared tier limits (#5), default 0 (#6), retry chainNext (#10), touch `updated_at` (#11)
- `supabase/functions/content-lab-manual-pool-refresh/index.ts` — cost = 1, remove free-refresh path (#9)
- `supabase/functions/stripe-webhook/index.ts` — clear `content_lab_tier` on CL subscription cancel/delete (#8)

**Shared (1 new)**
- `supabase/functions/_shared/contentLabTiers.ts` — `RUN_LIMITS_BY_TIER` + `DEFAULT_RUN_LIMIT = 0` exported (#5, #6)

**Frontend (2 edited)**
- `src/lib/contentLabPricing.ts` — derive + export `RUN_LIMITS_BY_TIER` from `CONTENT_LAB_TIERS` (#5)
- `src/hooks/useContentLab.ts` — import shared limits, default 0 (#5, #6)

**DB migration (1 new)**
- `supabase/migrations/<ts>_harden_content_lab.sql` — make `consume_content_lab_credit` a wrapper around `spend_content_lab_credit` (#13). No schema changes, just function body update.

---

### What this delivers

- **Zero cross-tenant leaks** in Content Lab functions (export, render, resume, link-suggest all org-scoped).
- **No free runs ever** — matches the "100% paid" pricing promise.
- **Correct run quotas** (3 / 5 / 20) matching the live Stripe products.
- **Lockout when payment fails** — past-grace cancelled subs cannot generate.
- **Credits cost what they say** — 1 credit per regen / remix / refresh.
- **Self-healing pipeline** — chain-retry + reaper means stuck runs auto-recover or auto-fail with clear messages.
- **Refund failures are auditable** — no silent credit loss.

### Risks & non-goals

- **No data migration** — existing runs continue with their current state; new gating applies prospectively.
- **No new admin UI** — surfacing stuck runs/refund failures in `AdminContentLab.tsx` is flagged for a follow-up.
- **Existing free-run users**: anyone who used their "1 free run" this month before this fix is unaffected (already consumed). Going forward, no free runs.
- **Cancelled subscribers with unused balance left in `content_lab_usage`** are now blocked — by design.

