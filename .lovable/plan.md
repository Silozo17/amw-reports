
This is a big phase. User wants to rebuild 4 edge functions + pipeline orchestrator + 2 frontend pages. Let me read the existing v3 implementations first to understand what to preserve vs replace.

I need to check:
- Current discover/scrape/analyse/ideate functions
- Current pipeline orchestrator
- Current ideas view
- Whether vertical thresholds + seed pool are populated yet (per Phase 1, user was supposed to provide CSVs)

Let me also flag the elephant in the room: the seed pool + verticals tables exist but are empty until the user imports the CSV. Sources 2 + 3 (curated seed pool + keyword queries) won't work until that data lands. I should ask whether to gate Phase 2 on that import OR build with graceful empty-state fallbacks.

Also need to check what API keys are available — YouTube Data API isn't in secrets. That's a blocker for Source 4.

Let me investigate before planning.
