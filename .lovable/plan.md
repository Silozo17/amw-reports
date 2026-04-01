

# Fix Org Invitations for New Users + Fix Shared Link Period (3rd attempt)

## Bug 1: Org Invite Link Broken for New Users

**Root cause:** The `InviteDialog` in `OrganisationSection.tsx` sends a `team_invitation` email but does NOT pass `invite_url` in the email data. The email template falls back to `#` for the button link — so the recipient has nowhere to click.

The `handle_new_user` database trigger already auto-links invited users on signup (it runs `UPDATE org_members SET user_id = NEW.id WHERE invited_email = NEW.email`). So the backend is fine — the problem is purely that the invite email has no working link.

Additionally, invited users who sign up should skip onboarding and go straight to the dashboard.

### Changes

**`src/components/settings/OrganisationSection.tsx`** — Pass `invite_url` in email data:
```ts
sendBrandedEmail({
  templateName: 'team_invitation',
  recipientEmail: email.trim().toLowerCase(),
  orgId,
  data: {
    invited_email: email.trim().toLowerCase(),
    role: inviteRole,
    inviter_name: profile?.full_name ?? 'A team member',
    invite_url: `${window.location.origin}/login?view=signup&invited_email=${encodeURIComponent(email.trim().toLowerCase())}`,
  },
});
```

**`src/pages/LandingPage.tsx`** — Pre-fill email from `invited_email` query param:
- Read `invited_email` from URL search params on mount
- If present, pre-fill the signup email field and switch to signup view
- Store a flag (`isInvitedSignup`) so we know to skip onboarding

**`src/pages/LandingPage.tsx`** — After OTP verification, redirect invited users to `/dashboard` instead of `/onboarding`:
```ts
// In handleVerifyOtp:
if (isInvitedSignup) {
  navigate('/dashboard');
} else {
  navigate('/onboarding');
}
```

**`src/components/admin/AdminOrgMembers.tsx`** — Same fix for the admin invite flow (no invite_url currently passed either).

---

## Bug 2: Shared Portal Links Still Ignore `?period=`

**Root cause analysis:** The previous fix added an early return in `autoDetectPeriod` and correct `hasAutoDetected` initialization. The logic *should* work, but it hasn't. After extensive code tracing, the most likely cause is a stale closure: `autoDetectPeriod` is a plain function (not memoized) that captures `initialMonth`/`initialYear` from the current render, but `fetchSnapshots` is a `useCallback` that may capture a stale version of `autoDetectPeriod` where those values are undefined during an intermediate render.

### Fix: Make it bulletproof with a ref

**`src/hooks/useClientDashboard.ts`** — Three changes:

1. **Store initial period in a ref** so it can never be lost:
```ts
const initialPeriodRef = useRef({ month: initialMonth, year: initialYear });
```

2. **Guard autoDetectPeriod using the ref** instead of closure variables:
```ts
const autoDetectPeriod = (currentSnapshots, allTrendData) => {
  if (initialPeriodRef.current.month && initialPeriodRef.current.year) return;
  // ... rest unchanged
};
```

3. **Remove `hasAutoDetected` from `fetchSnapshots` dependencies.** It's only used inside `autoDetectPeriod` and doesn't affect what data is fetched — only whether auto-detect runs. This prevents unnecessary re-fetches:
```ts
const fetchSnapshots = useCallback(async () => {
  // ...
}, [clientId, selectedPeriod, isPortal, portalToken]); // removed hasAutoDetected
```

4. **Move autoDetect out of fetchSnapshots** into a separate effect that runs after data is set, preventing stale closures entirely.

---

## Files to edit

| File | Change |
|---|---|
| `src/components/settings/OrganisationSection.tsx` | Pass `invite_url` and `inviter_name` in email data |
| `src/pages/LandingPage.tsx` | Read `invited_email` param, pre-fill signup, skip onboarding for invited users |
| `src/components/admin/AdminOrgMembers.tsx` | Pass `invite_url` in admin invite email data |
| `src/hooks/useClientDashboard.ts` | Use ref for initial period, decouple autoDetect from fetchSnapshots |

