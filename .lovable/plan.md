
Goal: make Facebook Reach behave like a true organic metric by deriving it from reliable inputs instead of trusting Meta’s missing/ambiguous “organic” flag.

What’s wrong now:
- In `supabase/functions/sync-facebook-page/index.ts`, the Reach parser for `page_total_media_view_unique` still treats rows without a clean `is_from_ads` flag as organic.
- That inflates `metrics_data.reach`, which is why you can see numbers like 26.9k even when true organic activity is much lower.

Solution:
1. Change Facebook Reach to a subtraction model
   - Keep fetching the total reach metric: `page_total_media_view_unique`
   - Also fetch the same metric with `breakdown=is_from_ads`
   - From the breakdown response, count only rows explicitly marked paid (`is_from_ads = 1/true`) as paid reach
   - Compute:
     - `reach_total = totalReach`
     - `reach = Math.max(0, totalReach - paidReach)`
   - This “total - paid = organic” approach matches the safe logic you want.

2. Remove the unsafe organic fallback
   - Stop treating missing/unknown `is_from_ads` values as organic for Reach
   - Stop using the breakdown response alone to build organic reach
   - Only use the breakdown to identify paid rows, then subtract from total

3. Keep Views untouched unless needed
   - Leave the current Views logic as-is since you’ve confirmed it is now showing the correct organic number
   - Only update Reach logic so this stays a minimal fix

4. Store the corrected snapshot values
   - Continue writing:
     - `metrics_data.reach` = organic inferred via subtraction
     - `metrics_data.reach_total` = total
   - No database or frontend changes needed because the dashboard already reads `metrics_data.reach`

5. Re-sync affected months
   - Existing March data is already wrong in stored snapshots
   - After the code fix, re-sync the affected Facebook months so the corrected organic reach replaces the inflated value

Files to change:
- `supabase/functions/sync-facebook-page/index.ts`

Technical detail:
```text
totalReach = sum(page_total_media_view_unique)
paidReach = sum(breakdown rows where is_from_ads is explicitly true/1)
organicReach = max(0, totalReach - paidReach)

metrics_data.reach = organicReach
metrics_data.reach_total = totalReach
```

Expected result:
- Facebook Reach will stop showing paid + organic mixed together
- The platform card will show inferred organic reach only
- If Meta returns bad breakdown data, Reach will still stay safe because paid is only counted when explicitly flagged
