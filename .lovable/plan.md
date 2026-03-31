

# Business Context — Draft State with Save Button & Unsaved Warning

## Problem
Every keystroke in the Business Context fields triggers an immediate database update via `onSettingChange`, making text inputs unusable.

## Solution
Convert the Business Context card to use local draft state with an explicit Save button. Add a `beforeunload` warning when there are unsaved changes.

### Changes to `src/components/clients/tabs/ClientSettingsTab.tsx`

1. **Add local draft state** for the 8 business context fields, initialized from `client` props and reset when `client.id` changes.

2. **Track dirty state** by comparing draft values to the original `client` prop values.

3. **Replace `onSettingChange` calls** in the Business Context card with local `setDraft` updates — no database writes on change.

4. **Add a "Save Changes" button** at the bottom of the Business Context card that calls `onSettingChange` for each changed field, then resets dirty state.

5. **Add `beforeunload` listener** when dirty, warning the user if they try to leave with unsaved changes.

6. **Keep all other cards unchanged** — Report Configuration, Email Preferences, and Client Access still use instant `onSettingChange` (they use selects/switches which are fine with instant save).

### Files Changed

| File | Change |
|---|---|
| `src/components/clients/tabs/ClientSettingsTab.tsx` | Add draft state, Save button, and unsaved-changes warning for Business Context card only |

