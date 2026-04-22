

## Cap AMW Media's agency tier at 10 runs/month, then spend credits

### What you have today
- AMW Media is **already on the highest tier** (`agency`) — no upgrade needed.
- `agency` is currently set to **unlimited** (`Number.MAX_SAFE_INTEGER`), which is why the badge showed `5 / 9007199254740991 runs`.
- Step-runner already prefers monthly quota first and falls back to credits — but the pipeline gate currently **blocks** any run once the monthly cap is hit instead of letting credits cover it.

### What you want
- Agency tier gets **10 monthly runs**.
- Badge shows `5 / 10 runs this month · {credits} credits`.
- Once monthly runs are used up, **credits start being spent** (one credit per run) until they're gone.
- When both monthly runs and credits are gone, the next run is blocked with a top-up prompt.

### Changes (3 files, no schema changes)

**1. `src/lib/contentLabPricing.ts`** — set the agency cap
- Change `RUN_LIMITS_BY_TIER.agency` from `Number.MAX_SAFE_INTEGER` to `10`.

**2. `supabase/functions/_shared/contentLabTiers.ts`** — keep the edge mirror in sync
- Change `RUN_LIMITS_BY_TIER.agency` from `Number.MAX_SAFE_INTEGER` to `10`.

**3. `supabase/functions/content-lab-pipeline/index.ts`** — let credits cover overflow runs
- Today: when `used >= ent.monthlyLimit`, the request is rejected with 429 and the comment "Credits do NOT grant runs".
- New: when `used >= ent.monthlyLimit`, check `creditBalance`. If `>= 1`, allow the run (the step-runner already spends a credit instead of incrementing usage). If `0`, return the existing 429 with the top-up prompt.
- No double-charge risk: charging is already idempotent per run via `summary.usage_consumed`, and the step-runner already routes to `consume_content_lab_credit` when `used >= limit`.

### Frontend display
The `ContentLabPage` badge fix from the previous task already reads `runsThisMonth / runsLimit` correctly. With the cap at 10, AMW will now naturally show **`5 / 10 runs this month · 1,000,000 credits`**, and once 10 is reached, credits will tick down one-per-run on the next runs.

### Out of scope
- No Stripe/product changes. Agency-tier pricing & billing untouched.
- No change to credit packs, ledger, or refund logic.
- No change to the dialog hint copy beyond what naturally follows from the new finite limit (the "Unlimited monthly runs" branch becomes dead code for agency and can be removed in a follow-up if you want — flag it and I'll do it then).

### Verification
- AMW Media badge: `5 / 10 runs this month · 1,000,000 credits`.
- Trigger 5 more runs → badge: `10 / 10 runs · 1,000,000 credits`.
- Trigger an 11th run → succeeds, badge: `10 / 10 runs · 999,999 credits`, ledger shows a `-1 run_consumed` entry.
- Drain credits to 0 with monthly cap exhausted → next run is blocked with the existing "buy credits" toast.

