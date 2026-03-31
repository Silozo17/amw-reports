
Problem confirmed: the “invite to connect their own accounts” email flow is still broken, and the current code can falsely report success.

What I found
- The invite button in `src/pages/clients/ClientDetail.tsx` calls the `invite-client-user` backend function.
- That function does generate a magic link and does try to send an email through `send-branded-email`.
- But `send-branded-email` does not contain a `client_invite` template in its template registry at all.
- Result: the email send returns an “Unknown template: client_invite” style failure, but `invite-client-user` ignores that returned error and still returns success to the UI.
- There is also a second issue: once a broken invite creates a `client_users` row, future retries are blocked by “This email has already been invited”, so resending is effectively impossible.

Implementation plan

1. Add the missing client invite email template
- Update `supabase/functions/send-branded-email/index.ts`
- Add a `client_invite` template builder with:
  - subject like “You’ve been invited to manage your accounts for {client_name}”
  - CTA button using `magic_link`
  - fallback copy explaining the recipient can manage their own platform connections
- Register `client_invite` in the `TEMPLATES` map

2. Make invite sending fail loudly instead of pretending success
- Update `supabase/functions/invite-client-user/index.ts`
- After invoking `send-branded-email`, explicitly inspect the returned `error` and response payload
- If email delivery fails:
  - return a non-200 response to the frontend
  - log the exact failure
  - avoid showing “Invitation sent” when no email was actually sent

3. Support resend for previously broken invites
- Update `supabase/functions/invite-client-user/index.ts`
- Replace the current hard stop on existing `client_users` rows with resend-safe logic:
  - if an invite already exists for the same `client_id` + email, reuse that user/invite relationship
  - generate a fresh magic link
  - send the email again
- This avoids manual cleanup for invites that were recorded but never delivered

4. Keep the current auth magic-link flow separate
- No change to the regular client login flow in `src/pages/LandingPage.tsx` unless needed
- That path uses `signInWithOtp` and your auth email hook; this issue is specifically the custom invite flow
- If needed later, I’d do a separate pass on auth email configuration, but it is not the primary bug here

5. Redeploy the updated backend functions
- Redeploy:
  - `send-branded-email`
  - `invite-client-user`

Technical details
- Root cause is not the share-link work.
- Root cause is a mismatch between:
  - `invite-client-user` sending `template_name: "client_invite"`
  - `send-branded-email` only registering templates like `auth_magic_link`, `team_invitation`, `report_delivery`, etc., but not `client_invite`
- There is also an error-handling bug:
  - `supabaseAdmin.functions.invoke(...)` can return `{ error }` without throwing
  - current code only uses `try/catch`, so silent failures slip through
- Best fix is to:
  - add the missing template
  - check the invoke response explicitly
  - allow resend for already-created invite rows

Files to update
- `supabase/functions/send-branded-email/index.ts`
- `supabase/functions/invite-client-user/index.ts`
