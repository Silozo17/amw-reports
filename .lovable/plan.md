

# Hide Account IDs in Account Picker — Show Names Only

## Summary
Remove all `ID: ...` subtitle lines from the account picker dialog. Only show account names. For Google Ads, if the name is a generic fallback (e.g. `Google Ads (123)`), still show it as-is (the ID is embedded in the name as a fallback already).

## Changes

### File: `src/components/clients/AccountPickerDialog.tsx`

**1. Meta Ads Step 1 — Ad Account list (line 250)**
- Remove `<p className="text-xs text-muted-foreground">ID: {acct.id}</p>` (line 250)

**2. Non-meta single-step account list (lines 418-420)**
- Remove the entire `<p>` that shows `Account ID: ...` or `ID: ...`
- Remove the `isGenericName` variable (line 396) and associated warning text (lines 421-423) — the fallback name already contains the ID so no extra warning is needed

### Files to modify
1. `src/components/clients/AccountPickerDialog.tsx` — remove ID display lines at lines 250, 418-423

