
What I checked:
- `supabase/functions/auth-email-hook/index.ts`
- `supabase/functions/send-branded-email/index.ts`
- `src/pages/LandingPage.tsx`
- recent auth and edge-function logs

What the evidence shows:
- The signup form is not the main problem. `LandingPage.tsx` already does the right thing: sign up, then `verifyOtp(...)` with a 6-digit code.
- The backend is the break point:
  - signup requests return `200`
  - the auth hook runs
  - then `send-branded-email` returns `400`
- The resend `429` entries are secondary. Users are retrying because the first email path is already broken.
- The current auth hook is still not aligned with the real auth email payload:
  - it relies on `type/event_type` instead of prioritising `email_action_type`
  - it assumes `confirmation_url` already exists
  - logs show empty user/email in some hook executions
  - logs also show `Unhandled auth event type: invite`
- Result: the hook swallows auth mail, but fails to build/send valid emails for some actions, so users receive nothing usable.

Root cause:
This project is using a custom auth email pipeline, and that pipeline is parsing the auth webhook too loosely. It is not treating the auth email payload as the source of truth, and it is not handling all auth actions consistently. OTP/signup, magic link, recovery, and invite/email-change flows are therefore unreliable.

Fix plan:
1. Rebuild the auth hook around the real auth payload
- Update `supabase/functions/auth-email-hook/index.ts`
- Parse auth action from:
  - `payload.email_action_type`
  - then `payload.email_data?.email_action_type`
  - then legacy fallbacks
- Extract email, token, token hash, redirect target, and any new-email fields from all valid payload locations
- Add strict validation so the hook fails loudly if required auth fields are missing instead of pretending the event succeeded

2. Generate auth links explicitly instead of hoping `confirmation_url` exists
- Add a small helper in the auth hook to build the verification/reset/magic-link URL from the auth payload when needed
- Use OTP as the primary path for signup/reauthentication
- Use full action links for magic link, recovery, and email-change flows
- This removes the current “maybe there is a confirmation URL, maybe not” failure mode

3. Audit and cover every auth email type end-to-end
- Support these actions explicitly:
  - signup
  - magiclink
  - recovery
  - email_change
  - reauthentication
  - invite
- Stop returning success for unsupported auth actions
- Either map each action to a real template or return a hard error during development so nothing is silently swallowed

4. Clean up the branded auth templates so each action matches the app flow
- Update `supabase/functions/send-branded-email/index.ts`
- Keep signup as OTP-first
- Ensure magic-link and recovery templates require a valid action URL
- Ensure email-change handles old/new email correctly
- Add validation for auth templates similar to the invite validation already added, so broken auth emails cannot be sent with empty links or empty recipients

5. Improve resend behavior on the OTP screen
- Update `src/pages/LandingPage.tsx`
- Show a resend cooldown / clearer message when auth returns rate-limit errors
- Prevent users from hammering resend and hitting 429 immediately
- This is not the root fix, but it removes the confusing “still broken” symptom after the backend is repaired

Files to update:
- `supabase/functions/auth-email-hook/index.ts`
- `supabase/functions/send-branded-email/index.ts`
- `src/pages/LandingPage.tsx`

What I will verify after the fix:
- New signup for `biuro@timmy-studio.com` sends a real OTP email
- OTP code matches the 6-digit code expected by `verifyOtp(...)`
- “Resend code” works and shows sensible cooldown feedback
- Password reset sends a valid reset link
- Magic link sends a valid sign-in link
- Email-change emails still work
- No auth hook logs with:
  - `Unhandled auth event type`
  - empty recipient email
  - `send-branded-email` 400s

Why this is the proper fix:
This does not guess at one template. It fixes the auth email contract at the source: webhook payload parsing, action mapping, OTP/link construction, template validation, and resend handling. That is the only reliable way to stop signup users from getting stuck again.
