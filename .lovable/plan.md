

## Two fixes — slow/non-loading pages + language not respected by AI/voice/PDF

### Issue 1 — Settings (and other authed pages) load slowly or not at all on some browsers

**Root cause (high-confidence).** `src/hooks/use-mobile.tsx` returns `false` on the very first render (because the `useState` initial value is `undefined` and `!!undefined === false`). `AppLayout` then picks the **desktop** branch, mounts the full sidebar + page, and immediately the `useEffect` fires, sets `isMobile = true`, and React **unmounts the entire desktop tree and remounts the mobile tree**. Every page that lives under `AppLayout` (Settings, Dashboard, Clients, Reports, Logs, Connections) pays this cost once on entry. On slower browsers (Safari iOS, older Android Chrome, low-power laptops) this double-mount happens **before** the lazy chunk for the page has finished evaluating, which is what users perceive as "page doesn't load" or "spinner forever".

A second contributor: `useIsMobile` returns `boolean` but starts as `undefined`, so SSR-style checks elsewhere can branch wrong on first paint.

**Fix (small, safe, no behaviour change on desktop).**
1. `src/hooks/use-mobile.tsx`: initialise state synchronously from `window.innerWidth` (guarded for SSR) so the **first render already returns the correct value**. No double-mount, no layout flash.
2. `src/components/layout/AppLayout.tsx`: while `isMobile` is still resolving on the very first frame in environments where `window` is unavailable, render a neutral shell that doesn't mount either sidebar tree, then upgrade. (Only needed if step 1 can't run synchronously — usually it can.)
3. `src/components/layout/AdminLayout.tsx`: same hook, so it inherits the fix automatically.

Files touched: `src/hooks/use-mobile.tsx` (1 file, ~5 lines). No API, no DB, no design changes.

### Issue 2 — Client `report_language` only affects the PDF, not AI analysis or voice briefing

Today only `supabase/functions/generate-report/index.ts` reads `client.report_language` (lines 1409–1411 use a `TRANSLATIONS` map). The other three AI-facing functions ignore it and always reply in English:

- `supabase/functions/analyze-client/index.ts` (the "AI Analysis" dialog on the client dashboard)
- `supabase/functions/voice-briefing/index.ts` (the spoken briefing)
- `supabase/functions/chat-with-data/index.ts` ("Ask AI" chat drawer)

The languages already supported by the UI (`ClientSettingsTab.tsx`) are: `en, fr, de, es, it, nl, pt, pl, da`.

**Fix (small, surgical, one place each).**

1. **`analyze-client/index.ts`**
   - Add `report_language` to the `clients` SELECT.
   - Map the code to a language name (small lookup table: `{ en: 'English', fr: 'French', de: 'German', ... }`).
   - Append a single rule to the prompt: `"Write the entire response in <Language>. All headings, highlights, and recommendations must be in <Language>."`
   - Keep tool-calling schema unchanged; the model fills the same string fields, just in the target language.

2. **`voice-briefing/index.ts`**
   - Add `report_language` to the `clients` SELECT.
   - Map code → language name.
   - Replace the hard-coded `"Here's your marketing update for ${MONTH_NAMES[month]}."` opener with a language-aware version, and add `"Write the script entirely in <Language>. Speak naturally as a native <Language> speaker."` to the prompt.
   - **Note (flagged risk):** the ElevenLabs voice (`JBFqnCBsd6RMkjVDRZzb` = "George", multilingual) already speaks all 9 supported languages via `eleven_turbo_v2_5`, so no voice/model change is needed. If pronunciation feels off for a specific language later, we can add a per-language voice map — out of scope for this fix.

3. **`chat-with-data/index.ts`**
   - Add `report_language` to the `clients` SELECT.
   - Map code → language name.
   - Append to `systemPrompt`: `"Always respond in <Language>, regardless of the user's input language, unless the user explicitly asks for another language."`

4. **`generate-report/index.ts`** — already correct, no change.

5. **No frontend changes.** The selector in `ClientSettingsTab` already writes `client.report_language`, the dashboard already sends `client_id`, and the edge functions resolve the language server-side from the DB. Nothing in the UI needs to know.

### Out of scope
- No new languages added.
- No voice-per-language mapping.
- No translations of UI chrome (button labels, headings) — those stay in English. Only the AI-generated content and PDF body honour the client language.
- Issue 1 is purely the mount/flash bug; we are not redesigning the sidebar or layout.

### Verification after merge
- Issue 1: open Settings on Safari iOS, Chrome desktop, and Firefox — page paints once with the correct layout, no spinner, no flash.
- Issue 2: set a client's Report Language to e.g. French; open AI Analysis → returns French; play Voice Briefing → spoken French; ask AI in chat → French replies; generate PDF → French (already worked).

