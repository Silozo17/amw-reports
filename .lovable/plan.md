

User wants me to drive the preview: open /content-lab, create a test niche, confirm save + appearance. This is a browser interaction task — they explicitly asked me to test in the preview, so browser tools are appropriate.

But wait — I'm in plan mode (read-only). Browser tools aren't listed in my allowed tools here. I need to present a plan, get approval, then in default mode execute it.

Also worth noting: in the recent build (Step 4), `NicheFormPage` was rewritten to a discovery-driven flow — the form now starts with Instagram handle + website + location, then runs "Discover niche & competitors" via the `content-lab-discover` edge function to auto-populate competitors/benchmarks/keywords/hashtags. There's no longer a simple form where you manually type handles/hashtags/keywords as the user described.

So I need to flag this mismatch before testing. Two options:
1. Use the new discovery flow (recommended — it's the current shipped UX)
2. The user may be remembering the old form

I'll plan for the discovery flow but call this out.

Plan:

## Test plan — create a niche end-to-end in /content-lab

### Heads-up before I start
The niche form was rebuilt in Step 4 to a **discovery-driven flow**: you enter Instagram handle + website + location, click "Discover", and Claude auto-fills competitors, benchmarks, keywords and hashtags. There's no longer a manual form for typing handles/hashtags/keywords directly — the user-typed list is gone.

If you want me to test the new discovery flow, here's what I'll do. If you wanted the old manual form back, tell me and I'll stop.

### Steps I'll run in the preview
1. `navigate_to_sandbox` → `/content-lab`
2. Pick the active client and click **"New niche"** (or equivalent CTA)
3. Fill the discover form with test data:
   - Instagram handle: `@nike`
   - Website: `https://nike.com`
   - Location: `Global`
4. Click **"Discover niche & competitors"** — wait for the edge function to populate competitors/benchmarks/keywords/hashtags
5. Review the auto-filled fields, leave defaults for tone/styles/platforms
6. Click **Save**
7. Navigate back to `/content-lab`
8. Confirm the new niche row appears in the list with the right label/handle
9. Screenshot the dashboard showing the saved niche

### What I'll report back
- Pass/fail at each step
- Whether the discover function returned competitors + benchmarks
- Whether the niche persisted and shows in the list
- Any console errors or failed network calls
- A final screenshot

### What I won't do
- Trigger a full pipeline run (that costs Apify + Claude credits — ask separately if you want it)
- Edit any existing niches

Approve and I'll switch to default mode and run it.

