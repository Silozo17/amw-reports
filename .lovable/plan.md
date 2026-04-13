

## Plan: Fix Meta Ads Lead Double-Counting

### Problem
The `extractLeads` function (lines 349-360) sums four lead action types:
- `lead` (rolled-up total)
- `onsite_conversion.lead_grouped`
- `offsite_conversion.fb_pixel_lead`
- `onsite_web_lead`

Meta's API often returns `lead` as an aggregate that already includes the sub-types. Summing all of them double-counts leads (2 real leads showing as 4).

### Fix — `supabase/functions/sync-meta-ads/index.ts`

Change `extractLeads` to use a **priority-based approach**:
1. If `lead` action type exists, use it exclusively (it's the rolled-up total)
2. If `lead` is missing, fall back to summing the granular sub-types

```typescript
const extractLeads = (actions: any[]): number => {
  const leadAction = actions.find(a => a.action_type === "lead");
  if (leadAction) return Number(leadAction.value || 0);

  let leads = 0;
  for (const action of actions) {
    if (action.action_type === "onsite_conversion.lead_grouped" ||
        action.action_type === "offsite_conversion.fb_pixel_lead" ||
        action.action_type === "onsite_web_lead") {
      leads += Number(action.value || 0);
    }
  }
  return leads;
};
```

### Files to Change
1. `supabase/functions/sync-meta-ads/index.ts` — update `extractLeads` function (lines 349-360)

### No Database or Frontend Changes
After deploying, a re-sync of April data will produce the correct lead count.

