

# Plan: AI-Powered Dashboard Experience — Chat, Voice, Health Score, Alerts

This is a multi-feature build that transforms the AI analysis from a wall of text into four distinct, user-friendly features that no other reporting platform offers.

---

## Feature 1 — AI Chat With Your Data ("Ask Your Report Anything")

A chat drawer that slides open from the dashboard where clients can ask natural-language questions about their marketing data. The AI has full context of their connected platform data and answers with specific numbers.

### New files
- `src/components/clients/dashboard/AiChatDrawer.tsx` — Sheet/drawer component with chat UI, message list, input field, markdown rendering of responses
- `supabase/functions/chat-with-data/index.ts` — Edge function that receives `{ client_id, month, year, messages }`, fetches the client's snapshot data, builds a system prompt with their actual metrics, and streams responses via SSE from Lovable AI gateway

### Changes
- `src/components/clients/ClientDashboard.tsx` — Add a "Ask AI" button (MessageCircle icon) in the header controls, toggle the AiChatDrawer
- `src/hooks/useClientDashboard.ts` — Expose `snapshots` data (already exposed) for passing to the chat

### How it works
1. User clicks "Ask AI" button on dashboard
2. A Sheet opens from the right with a chat interface
3. User types a question like "Why did my reach drop?"
4. Frontend sends `{ client_id, month, year, messages: [...history] }` to `chat-with-data` edge function
5. Edge function fetches client snapshots + previous month data, builds system prompt with all their metrics as context
6. Streams response back via SSE, rendered token-by-token with markdown support
7. Conversation history is maintained in-memory (session only, no DB persistence needed)

---

## Feature 2 — Marketing Health Score (0-100)

A single number displayed prominently on the dashboard, like a credit score. Computed deterministically from existing metrics (no AI call needed).

### New files
- `src/components/clients/dashboard/HealthScore.tsx` — Circular gauge component showing the overall score (0-100) with colour coding (green/amber/red) and sub-score breakdown cards
- `src/lib/healthScore.ts` — Pure function that takes current + previous snapshots and returns `{ overall: number, subScores: { paidPerformance, organicSocial, seoStrength, contentHealth, websiteExperience } }`

### Changes
- `src/components/clients/ClientDashboard.tsx` — Render `HealthScore` component between HeroKPIs and PerformanceOverview

### Scoring logic (deterministic, no AI)
- **Paid Performance** (0-100): CTR health (>2% = good), CPC efficiency vs benchmark, conversion rate, spend ROI
- **Organic Social** (0-100): Engagement rate trend, follower growth, reach trend, post frequency
- **SEO Strength** (0-100): Search impressions trend, CTR, avg position improvement, clicks growth
- **Content Health** (0-100): Top content engagement rates, posting consistency
- **Website Experience** (0-100): Session trends, bounce rate (if available), pages per session
- **Overall** = weighted average of active sub-scores (only categories with data contribute)

Colour coding: ≥75 green, 50-74 amber, <50 red. Each sub-score shows a small trend arrow vs last month.

---

## Feature 3 — Voice Briefing ("Your Marketing Update")

A play button that generates and plays a 1-2 minute audio summary of the client's marketing performance. Uses ElevenLabs TTS.

### New files
- `src/components/clients/dashboard/VoiceBriefing.tsx` — Button + audio player component with play/pause/progress bar
- `supabase/functions/voice-briefing/index.ts` — Edge function that: (1) fetches client data, (2) generates a conversational script via Lovable AI, (3) sends script to ElevenLabs TTS API, (4) returns audio bytes

### Changes
- `src/components/clients/ClientDashboard.tsx` — Add "Listen to Briefing" button (Headphones icon) near the AI controls

### Prerequisites
- Need `ELEVENLABS_API_KEY` secret — will prompt you to add it
- Uses a professional voice (e.g. "George" - `JBFqnCBsd6RMkjVDRZzb`)

### How it works
1. User clicks "Listen to Briefing"
2. Edge function generates a natural script from their data (plain English, conversational tone, 200-300 words)
3. Script sent to ElevenLabs TTS, audio returned as MP3
4. Client-side plays via `<audio>` element with custom play/pause UI
5. Audio is not persisted — generated on demand

---

## Feature 4 — Proactive Opportunity Alerts

Smart alerts surfaced at the top of the dashboard highlighting opportunities and things to watch, computed from the data.

### New files
- `src/components/clients/dashboard/OpportunityAlerts.tsx` — Horizontal scrollable card row showing 2-4 alert cards with icons, short title, and one-liner description
- `src/lib/opportunityAlerts.ts` — Pure function that analyses current vs previous snapshots and returns alert objects. Rules-based (deterministic), not AI.

### Changes
- `src/components/clients/ClientDashboard.tsx` — Render `OpportunityAlerts` between the AI summary card and HeroKPIs

### Alert rules (examples)
- **CPC Drop**: "Your Google Ads CPC dropped 18% — good time to increase budget"
- **Engagement Spike**: "Instagram engagement up 45% — your content is resonating"
- **Reach Decline**: "Facebook reach down 30% — consider boosting your top post"
- **CTR Below Threshold**: "Google Ads CTR below 2% — headline copy may need refreshing"
- **Top Content Trending**: "Your top post got X engagement — share it on other platforms"
- **Conversion Improvement**: "Cost per lead dropped to £X — lowest in the data window"

Each alert has a type (opportunity/warning/win), icon, and colour coding.

---

## Also: Redesign AI Analysis Display

Replace the wall-of-text analysis dialog with a structured card-based layout.

### Changes to `src/components/clients/ClientDashboard.tsx`
- Replace the full analysis dialog's raw markdown dump with sectioned cards:
  - Overall Summary card at top with key takeaway highlighted
  - Tabbed or accordion sections for each category (Paid, Organic, SEO)
  - Each section shows bullet-point highlights, not paragraphs
- Update the inline category AI cards to use bullet points instead of paragraphs

### Changes to `supabase/functions/analyze-client/index.ts`
- Update the prompt to request structured output: bullet points, not paragraphs
- Request a "key_takeaway" one-liner for the overall summary
- Request "highlights" (3-4 bullets) and one "recommendation" per category
- Use tool calling to get structured JSON instead of markdown (more reliable parsing)

---

## Files Summary

| File | Action |
|---|---|
| `src/components/clients/dashboard/AiChatDrawer.tsx` | New — chat interface |
| `src/components/clients/dashboard/HealthScore.tsx` | New — circular gauge + sub-scores |
| `src/components/clients/dashboard/VoiceBriefing.tsx` | New — audio briefing player |
| `src/components/clients/dashboard/OpportunityAlerts.tsx` | New — smart alert cards |
| `src/lib/healthScore.ts` | New — deterministic scoring logic |
| `src/lib/opportunityAlerts.ts` | New — deterministic alert rules |
| `supabase/functions/chat-with-data/index.ts` | New — streaming AI chat with data context |
| `supabase/functions/voice-briefing/index.ts` | New — generate TTS audio from data |
| `src/components/clients/ClientDashboard.tsx` | Add all 4 features to dashboard layout |
| `src/hooks/useClientDashboard.ts` | Minor — expose any missing data for chat |
| `supabase/functions/analyze-client/index.ts` | Restructure prompt for bullet-point output |

## Prerequisite from you

- **ElevenLabs API Key**: You will need to provide an ElevenLabs API key for the voice briefing feature. Do you have one, or should I skip voice briefings for now?

## Implementation order

1. Health Score (pure frontend, no API calls)
2. Opportunity Alerts (pure frontend, no API calls)
3. Redesign AI Analysis display (prompt + UI changes)
4. AI Chat With Your Data (new edge function + chat UI)
5. Voice Briefing (needs ElevenLabs key)

