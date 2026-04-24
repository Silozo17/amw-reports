## Goal

Add a dedicated **"Content Lab Settings"** section to the client Settings tab that exposes every field the Content Lab pipeline reads, in one place, so users can prep a client for a run without hunting around.

## What Content Lab actually consumes

From `content-lab-run`'s `ClientRow` and the launchpad readiness checks:

| Field | Used for | Already editable? |
|---|---|---|
| `industry` | AI niche prompts, viral pool | Yes (Business Context) |
| `location` | Local competitor discovery | **No — missing from UI** |
| `website` | AI grounding | Yes (basic info) |
| `social_handles.instagram` / `.tiktok` / `.facebook` | Own-account scrape (hard requirement) | **No — missing from UI** |
| `competitors` | Seed list for discover phase | Yes (CompetitorPicker) |
| `brand_voice` | Idea tone | Yes |
| `target_audience` | Idea targeting | Yes |
| `business_goals` | Idea CTA framing | Yes |
| `unique_selling_points` | Idea differentiation | Yes |

The two gaps (`location`, `social_handles`) are exactly what causes the launchpad to show "Not set" and block the run today.

## Plan

### 1. New section: `ContentLabSettingsCard` (in Settings tab)

A single card titled **"Content Lab Settings"** placed directly under Business Context. It reuses the same draft/Save pattern already in `ClientSettingsTab.tsx` (so it batches into the existing "unsaved changes" save bar).

Fields, grouped:

- **Audience & niche** (read-only mirror with link "Edit in Business Context")
  - Industry, Target audience, Brand voice
  - Just shows current values + a one-click jump to scroll to the existing card. Avoids duplicating inputs.

- **Location** (new editable input)
  - `client.location` — text input, placeholder "e.g. Manchester, UK"
  - Helper: "Used to find local competitors."

- **Social handles for scraping** (new editable inputs)
  - Three inputs: Instagram, TikTok, Facebook (handle only, `@` stripped on save)
  - Stored as `social_handles` jsonb (`{ instagram, tiktok, facebook }`)
  - Helper under each: link to the public profile when present
  - Inline note: "Instagram or TikTok required to run."

- **Competitors** (existing `CompetitorPicker`, moved/duplicated here)
  - Same chip picker already in Business Context. Show it here too with a small note "Shared with Business Context."
  - Single source of truth: same `competitors` text column, same draft key — editing in either place reflects in both.

- **Run preferences** (small, optional)
  - Read-only summary of credit balance + a "Buy credits" link
  - Read-only summary of current month's run count

### 2. Wiring

- Extend `BUSINESS_CONTEXT_KEYS` in `ClientSettingsTab.tsx` to include `location` so it goes through the same draft/Save flow.
- Add a new `social_handles` draft slice (object, not string) with its own `isDirty` check; on Save call `onSettingChange('social_handles', draftHandles)`.
- Confirm `onSettingChange` in `ClientDetail.tsx` already accepts arbitrary fields → if not, broaden the type signature to `(field: keyof Client, value: unknown)`.

### 3. Launchpad sync

- `ClientContentLabTab.tsx`'s existing `onEditClient` already switches to Settings — no change needed.
- After this card lands, the readiness checklist's "Add Instagram or TikTok handle in Settings" hint becomes actionable in one click.

### 4. Out of scope (flagged)

- No new DB columns. `location` and `social_handles` already exist on `clients`.
- No changes to `ClientForm.tsx` (creation flow). We can add these fields there in a follow-up if you want the wizard to capture them upfront — say the word.
- No changes to `content-lab-run` edge function — it already reads all these fields.

## Files touched

- `src/components/clients/tabs/ClientSettingsTab.tsx` — add `ContentLabSettingsCard` section, extend draft to include `location` + `social_handles`.
- `src/pages/clients/ClientDetail.tsx` — only if `onSettingChange` signature needs broadening.

That's it. Single card, no new routes, no schema changes.