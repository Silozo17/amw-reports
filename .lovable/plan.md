
## Fix: move unlimited credits to AMW Media org

### What went wrong
Last loop I granted 1,000,000 credits to `0645c71e-6611-4a11-9cbc-fb7e4ae87b23` (ReDigital). The actual admin org is `319ab519-4f9a-470f-b9f7-9d98e90f6d2f` (AMW Media). Both orgs are owned by `info@amwmedia.co.uk`, which is why the lookup confused me — I should have filtered by org name, not just by user.

### Two data ops (no schema changes)

**1. Revoke ReDigital grant**
- Set `content_lab_credits.balance = 0` and `lifetime_purchased = 0` for ReDigital
- Insert a ledger entry `delta = -1000000`, reason `admin_grant_revoked_wrong_org` for audit trail

**2. Grant to AMW Media**
- Insert/upsert `content_lab_credits` for `319ab519-4f9a-470f-b9f7-9d98e90f6d2f` with `balance = 1_000_000`
- Insert ledger entry `delta = +1000000`, reason `admin_grant_unlimited`

### Files touched
None. Two SQL operations via the insert tool.

### Side effects
- ReDigital goes back to 0 credits (correct — they were never meant to have any)
- AMW Media (the admin org, where info@/marine@/test@ all sit) gets unlimited
- Manual pool refresh rate limit still 5/30 days — flag if you want that bypassed for AMW Media, separate code change
