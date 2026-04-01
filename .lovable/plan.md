
Fix only the org invite flow first.

What I found:
- The current source already adds `invite_url` in both invite entry points:
  - `src/components/settings/OrganisationSection.tsx`
  - `src/components/admin/AdminOrgMembers.tsx`
- The email template in `supabase/functions/send-branded-email/index.ts` renders the CTA from `data.invite_url`.
- Your screenshot shows Apple Mail trying to open `x-webdoc://...#`, which is what happens when the email button link is effectively `href="#"`.
- So the real problem is not just “add invite_url in the UI” anymore. The system is still allowing a `team_invitation` email to be sent without a valid URL, and then silently falls back to `#`.

Plan:
1. Harden the email sender so broken invites cannot be sent
- Update `supabase/functions/send-branded-email/index.ts`
- For `team_invitation`, require a real absolute `invite_url`
- Remove the `"#"` fallback for the Accept Invitation button
- If `invite_url` is missing/invalid, return an error instead of sending a dead email

2. Centralise invite creation + invite email sending in one backend function
- Add a dedicated backend function for org invites
- This function will:
  - validate the caller can invite members
  - create/update the pending `org_members` row
  - generate the final invite URL in one place
  - send the `team_invitation` email
  - fail atomically if the email payload is invalid
- This avoids relying on browser-side invite assembly in multiple places

3. Update both invite UIs to use the same backend invite flow
- `src/components/settings/OrganisationSection.tsx`
- `src/components/admin/AdminOrgMembers.tsx`
- Replace the current “insert row + send email from browser” pattern with one shared backend call
- Only show success if the invite row and email both succeed
- Show a visible error if invite sending fails, instead of silently creating a broken invite

4. Keep the current invited-signup behavior
- Preserve the existing invited signup flow in `src/pages/LandingPage.tsx`
- Keep:
  - prefilled `invited_email`
  - signup for new users
  - redirect to dashboard after verification
  - automatic org linking via `handle_new_user`

Files involved:
- `supabase/functions/send-branded-email/index.ts`
- new backend invite function under `supabase/functions/...`
- `src/components/settings/OrganisationSection.tsx`
- `src/components/admin/AdminOrgMembers.tsx`
- possibly `src/lib/sendBrandedEmail.ts` only if shared validation/types are needed

Why this approach:
- It fixes the actual failure mode shown in the screenshot
- It keeps your current setup intact
- It prevents future dead-link invites instead of masking them
- It removes duplicate invite logic from two separate UI surfaces

QA after implementation:
- Re-send invite to `marine@amwmedia.co.uk`
- Confirm the email button opens a normal `https://.../login?view=signup&invited_email=...` URL, not `x-webdoc://...#`
- Test a brand-new invited user:
  - click invite
  - create account
  - verify email
  - land on dashboard
  - confirm they are joined to the org
- Test inviting from both team settings and admin org members, since both currently send invites
