

## Plan: Fix Settings Tab Navigation + Add Report Language Selector

### Problem 1 — Broken Tab Navigation
The screenshot shows tabs stacking vertically instead of laying out horizontally. The cause is line 51 in `SettingsPage.tsx`:
```
const tabGridClass = `grid-cols-${tabs.length}`;
```
Tailwind CSS purges dynamic class names at build time — `grid-cols-6` (or whatever number) never appears in the source code as a literal string, so it gets stripped. The tabs render as a single column.

**Fix:** Replace the dynamic grid class with `flex` layout on the `TabsList`, which handles any number of tabs without needing a specific grid column count. Each trigger gets `flex-1` to distribute evenly.

**File:** `src/pages/SettingsPage.tsx` — remove `tabGridClass` variable, change `TabsList` className to use `flex w-full`.

---

### Problem 2 — Report Language Selector

**Goal:** Let the agency choose a language for PDF reports. The AI prompts in `generate-report` will include an instruction to write the entire report in that language.

#### 2a. Add `report_language` to report settings
**File:** `src/components/settings/ReportSettingsSection.tsx`
- Add `report_language` to the `ReportSettings` interface (default: `"English"`)
- Add a `<Select>` dropdown with all major languages (English, Spanish, French, German, Italian, Portuguese, Dutch, Polish, Arabic, Chinese, Japanese, Korean, Hindi, Turkish, Russian, Swedish, Norwegian, Danish, Finnish, Czech, Romanian, Hungarian, Greek, Thai, Vietnamese, Indonesian, Malay, Hebrew, Ukrainian, Bengali, Urdu, Swahili, Tagalog — comprehensive list)
- Persisted in `report_settings` JSONB on the `organisations` table — no migration needed

#### 2b. Read language in edge function and inject into AI prompts
**File:** `supabase/functions/generate-report/index.ts`
- Read `reportSettings.report_language` (fallback `"English"`)
- If language is not English, add a line to every AI prompt: `"IMPORTANT: Write the ENTIRE response in ${language}."`
- Also translate static PDF text labels (cover page titles like "Performance Report", "Prepared for", "Table of Contents", "Monthly Summary", "Thank you") by adding an AI translation call at the start when language is not English

#### Files changed (4 total):
1. `src/pages/SettingsPage.tsx` — fix tab layout
2. `src/components/settings/ReportSettingsSection.tsx` — add language selector
3. `supabase/functions/generate-report/index.ts` — read language, inject into AI prompts
4. `src/lib/reports.ts` — no changes needed (language comes from org settings, not the API call)

