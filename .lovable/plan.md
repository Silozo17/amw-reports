

## Plan: Fix LinkedIn Sync Bug + Redesign Admin Sync Dialog

### Issue 1: LinkedIn sync crashes — `timeGranularity is not defined`

The previous edit added a `granularity` return value to `buildMonthlyRange` and destructured it as `timeGranularity` in the main handler (line 424). However, three helper functions reference `timeGranularity` directly without receiving it as a parameter:

- `getFollowerGains` (line 118)
- `getShareStatistics` (line 157)
- `getPageStatistics` (lines 193, 203)

Since these are standalone functions, `timeGranularity` is not in their scope → `ReferenceError` → sync fails every time.

**Fix**: Add a `granularity: string` parameter to all three functions and pass `timeGranularity` from the call sites in the main handler.

| Function | Signature change | Call site (line ~) |
|---|---|---|
| `getFollowerGains` | Add 5th param `granularity: string` | 435 |
| `getShareStatistics` | Add 5th param `granularity: string` | 429 |
| `getPageStatistics` | Add 6th param `granularity: string` | 430 |

Each function's internal `buildTimeIntervals(startMs, endMs, timeGranularity)` becomes `buildTimeIntervals(startMs, endMs, granularity)`.

### Issue 2: Admin Sync Dialog UI — fields disappear, not intuitive

The current dialog uses conditional rendering that makes sections appear/disappear as you change options. This is confusing.

**Redesign approach — always show all relevant sections, disable rather than hide**:

1. **Step 1 — Scope**: Keep radio group (Single Channel, Single Client, Whole Org, Whole Platform). Always visible.

2. **Step 2 — Target selection**: Always render the client/channel/platform dropdowns but show a contextual placeholder. When scope is "Whole Organisation", show a simple "All X connections" summary instead of hiding the section entirely.

3. **Step 3 — Channel filter** (only for client/org/platform scopes): Always show the "All channels" / "Select specific" toggle. When scope is "channel", skip this step with a clear visual indicator.

4. **Step 4 — Time range**: Always visible. Show month/year pickers inline beneath the selected option (not conditionally mounted — just visually collapsed with CSS).

5. **Summary bar**: Always visible at the bottom, updates reactively. Shows "Select a scope to continue" when nothing is ready yet.

**Key UI improvements**:
- Use a stepped card layout with numbered sections that stay mounted
- Disabled/greyed sections instead of disappearing ones
- Clear summary line always visible
- Pinterest 3-month cap warning shown whenever Pinterest connections are in the target set (not just on "full" mode)

### Files changed

| File | Change |
|---|---|
| `supabase/functions/sync-linkedin/index.ts` | Add `granularity` param to 3 functions, pass from call sites |
| `src/components/admin/AdminSyncDialog.tsx` | Rewrite UI to use stable layout with no disappearing sections |

### No other changes
- `admin-sync` edge function is correct — the sequential queue logic works fine
- No database changes needed
