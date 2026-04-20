
## Scope
Analyse the failure end-to-end, fix the real cause, add preflight checks so we do not retry blindly again, and only then attempt one safe resume on the existing run data.

## What I found
1. The current failure is not the API key anymore.
   - The latest `content-lab-ideate` logs show the new key fingerprint (`...kgAA`) was loaded.
   - `content-lab-resume` now fails with:
     `Ideate failed: 502 {"error":"Anthropic (instagram): Claude response had no tool_use ideas"}`
   - So the key is being read, the function is running, and the failure has moved into ideation output handling.

2. The main bug is in `content-lab-ideate`.
   - It calls Anthropic directly and assumes every successful response will contain `content[].type === "tool_use"`.
   - If Anthropic returns a normal text block, a refusal, or any non-tool structured success response, the code throws the generic error `"Claude response had no tool_use ideas"`.
   - That means the code is not capturing the real 200-response body, so it is still partially guessing.

3. The prompt contract is internally inconsistent.
   - `_shared/contentLabPrompts.ts` requires “3 hook variants” with labelled mechanisms.
   - But `content-lab-ideate/index.ts` only accepts a single `hook: string` in the tool schema and DB row shape.
   - This contradiction can make the model ignore the tool contract or respond in an unexpected format.

4. Setup is not fully guarded.
   - `NicheFormPage` can persist `platforms_to_scrape`, and old/edit data can still contain TikTok/Facebook.
   - But `content-lab-scrape` currently only gathers Instagram posts.
   - `content-lab-resume` does not validate that the run actually has source posts for every target platform before re-ideating.

5. There is a separate admin UI bug, but it is not the run failure.
   - `Badge` is a plain function component, not `forwardRef`.
   - Radix components in `RunDetailDrawer` are trying to attach refs through it, causing the console warning.

## Implementation plan

### 1) Fix the ideation contract first
Update:
- `supabase/functions/_shared/contentLabPrompts.ts`
- `supabase/functions/content-lab-ideate/index.ts`

Changes:
- Make the prompt match the schema exactly.
- Remove the “3 hook variants” requirement unless we also redesign the DB/UI to store them.
- Keep one canonical `hook` per idea, since that matches the current DB and UI.
- Tighten the tool schema so the model has one unambiguous output shape.

### 2) Make Anthropic response handling diagnostic instead of guessy
Update:
- `supabase/functions/content-lab-ideate/index.ts`

Changes:
- Log request id and a safe preview of successful 200 responses when no `tool_use` is returned.
- Preserve the actual response type/body summary in the returned error.
- Validate the tool payload before insert and report exactly what field is missing.
- If Anthropic returns text instead of tool output, surface that exact text preview into step logs and `content_lab_runs.error_message`.

Result:
- Next failure, if any, will be concrete, not “no tool_use ideas”.

### 3) Add preflight guards before any retry
Update:
- `supabase/functions/content-lab-resume/index.ts`
- `supabase/functions/content-lab-ideate/index.ts`
- `src/pages/content-lab/NicheFormPage.tsx`

Changes:
- Before re-ideating, verify the run still has posts and group them by platform.
- Verify `platforms_to_scrape` is compatible with the actual available source posts.
- If the run only has Instagram posts, ideation should either:
  - restrict itself to Instagram, or
  - fail early with a clear setup error before calling AI.
- Prevent unsupported platform combinations from being saved from the niche form until scrape support exists.

Result:
- No more retries against impossible platform setups.

### 4) Clean up the noisy admin warning
Update:
- `src/components/ui/badge.tsx`

Changes:
- Convert `Badge` to `React.forwardRef` so Radix wrappers stop throwing ref warnings in `RunDetailDrawer`.

This is not the run failure, but it removes misleading noise while debugging.

### 5) Verify before the next retry, then do one controlled resume
After implementing:
1. Confirm prompt/schema alignment.
2. Confirm ideate logs now capture non-tool 200 responses.
3. Confirm run platform preflight passes for the existing run.
4. Redeploy affected functions.
5. Trigger a single `content-lab-resume` on the existing run so it reuses the already-scraped posts and does not spend another scrape credit.

## Technical details
Files to change:
- `supabase/functions/content-lab-ideate/index.ts`
- `supabase/functions/_shared/contentLabPrompts.ts`
- `supabase/functions/content-lab-resume/index.ts`
- `src/pages/content-lab/NicheFormPage.tsx`
- `src/components/ui/badge.tsx`

No database migration is required.

## Expected result
After this fix:
- we stop guessing
- retry only runs when setup is valid
- ideation either completes successfully from the existing posts or shows the exact AI response/problem
- admin debugging no longer shows the `Badge` ref warning
