
## Plan: Grant unlimited credits to info@amwmedia.co.uk

### What "unlimited" means here
Postgres `integer` max is ~2.1B. I'll grant **1,000,000 credits** as a practical "unlimited" — at 1 credit per regenerate/remix, that's lifetime-untouchable. Avoids using a sentinel value (e.g. -1) which would break the existing `spend_content_lab_credit` RPC's `balance >= _amount` check.

Why not modify the spend RPC to recognise an "unlimited" flag? Because that's a code change with new branches to test, and the user just asked for unlimited credits on one admin account — KISS.

### Single action (data change, no schema change)
Insert a `content_lab_credits` row for org `0645c71e-6611-4a11-9cbc-fb7e4ae87b23` with `balance = 1_000_000`, and write a matching `content_lab_credit_ledger` entry with reason `admin_grant` so the audit trail is clean.

```sql
INSERT INTO content_lab_credits (org_id, balance, lifetime_purchased)
VALUES ('0645c71e-6611-4a11-9cbc-fb7e4ae87b23', 1000000, 1000000)
ON CONFLICT (org_id) DO UPDATE
  SET balance = 1000000,
      lifetime_purchased = content_lab_credits.lifetime_purchased + (1000000 - content_lab_credits.balance),
      updated_at = now();

INSERT INTO content_lab_credit_ledger (org_id, delta, reason)
VALUES ('0645c71e-6611-4a11-9cbc-fb7e4ae87b23', 1000000, 'admin_grant_unlimited');
```

### Side effects to flag
- This grants credits at the **org level** (ReDigital), not the user level. Any other member of the ReDigital org will also have access to this balance. Confirmed acceptable since this is the AMW admin org.
- The manual pool refresh **rate limit (5 per 30 days)** still applies regardless of credit balance — credits don't bypass that ceiling. If you want unlimited refreshes too, that's a separate code change to the rate-limit check in `content-lab-manual-pool-refresh`. Flag if you want it included.
- If the ReDigital org ever burns through 1M credits (it won't), I'd top up again.

### Files touched
None — pure data insert via the insert tool.

Approve and I'll run the insert. Confirm whether to also bypass the manual pool refresh rate limit for this org.
