

# Add Client Business Context Fields for Better AI Insights

## Problem
The AI analysis, chat, and voice briefing functions only know the client's company name and metrics data. They lack business context (industry, target audience, service areas, goals) that would make recommendations far more relevant and actionable.

## Plan

### 1. Database Migration — Add columns to `clients` table

```sql
ALTER TABLE public.clients
  ADD COLUMN industry text,
  ADD COLUMN target_audience text,
  ADD COLUMN service_area_type text NOT NULL DEFAULT 'local',
  ADD COLUMN service_areas text,
  ADD COLUMN business_goals text,
  ADD COLUMN competitors text,
  ADD COLUMN unique_selling_points text,
  ADD COLUMN brand_voice text;
```

- `industry` — e.g. "Real Estate", "Fitness", "SaaS", "Hospitality"
- `target_audience` — free text, e.g. "First-time homebuyers aged 25-40 in London"
- `service_area_type` — one of: `local`, `national`, `international`, `worldwide`
- `service_areas` — free text for specifics, e.g. "Greater Manchester, Leeds, Liverpool"
- `business_goals` — free text, e.g. "Increase leads by 30%, grow Instagram following"
- `competitors` — free text, e.g. "Competitor A, Competitor B"
- `unique_selling_points` — free text, e.g. "24/7 support, free consultations"
- `brand_voice` — free text, e.g. "Professional but friendly, avoid jargon"

### 2. Update `Client` interface in `src/types/database.ts`

Add all 8 new fields as optional strings.

### 3. Add "Business Context" card to `ClientSettingsTab`

New card section with:
- **Industry** — Select dropdown with common industries + "Other" free text
- **Target Audience** — Textarea
- **Service Area** — Select (`Local`, `National`, `International`, `Worldwide`) + Textarea for specifics
- **Business Goals** — Textarea
- **Competitors** — Textarea
- **Unique Selling Points** — Textarea
- **Brand Voice** — Textarea

All fields use the existing `onSettingChange` callback.

### 4. Add fields to `ClientForm.tsx` (new client creation)

Add a collapsible "Business Context (Optional)" section with the same fields, so context can be provided at creation time.

### 5. Feed context into AI functions

**`analyze-client/index.ts`** — Expand the client select to include the new fields. Add a `business_context` object to the `dataContext` JSON and update the system prompt to reference industry, audience, goals, and service area when making recommendations.

**`chat-with-data/index.ts`** — Expand the client select and add business context to the system prompt so conversational answers are tailored.

**`voice-briefing/index.ts`** — Same pattern: fetch and inject business context.

**`generate-report/index.ts`** — Pass business context to the AI executive summary prompt so report insights are industry-aware.

## Files Changed

| File | Change |
|---|---|
| Database migration | Add 8 columns to `clients` |
| `src/types/database.ts` | Add 8 fields to `Client` interface |
| `src/components/clients/tabs/ClientSettingsTab.tsx` | Add "Business Context" card |
| `src/pages/clients/ClientForm.tsx` | Add optional business context section |
| `supabase/functions/analyze-client/index.ts` | Include business context in AI prompt |
| `supabase/functions/chat-with-data/index.ts` | Include business context in system prompt |
| `supabase/functions/voice-briefing/index.ts` | Include business context in prompt |
| `supabase/functions/generate-report/index.ts` | Include business context in AI summary prompt |

