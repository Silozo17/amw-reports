

# Fix: OTP Codes Not Delivered — Users Get Verify Button Instead

## Root Cause

The `auth-email-hook` edge function intercepts Supabase signup emails. For signup, the hook:

1. Extracts `token` (the 6-digit OTP) from the payload — this part works
2. **Also** constructs a `confirmation_url` from `token_hash` — this is the problem

The `auth_welcome` template renders **both** the OTP code and a "Or click here to verify" button. When the user clicks the verify button, it consumes the one-time token. Then when they try the OTP code, Supabase returns "One-time token not found" (confirmed in auth logs). The button is a link-based verification flow that conflicts with the OTP flow.

Additionally, if `token` happens to be empty (edge cases in payload parsing), only the verify button shows — no OTP code at all.

## The Fix

Simple and surgical — two changes:

### 1. Auth-email-hook: strip `confirmation_url` for OTP actions

For `signup` and `reauthentication`, **never** pass `confirmation_url` to the template. These actions use OTP codes only. The verify link consumes the token and breaks the OTP flow.

**File:** `supabase/functions/auth-email-hook/index.ts`

In the template data section (~line 166-173), add a guard:
```ts
const templateData: Record<string, unknown> = {
  otp_token: token,
  recipient_name: recipientName,
  device_info: req.headers.get("user-agent") ?? "Unknown device",
  support_email: "support@amwmedia.co.uk",
};

// Only include confirmation_url for link-based actions (recovery, magiclink, email_change, invite)
// For OTP actions (signup, reauthentication), the link consumes the token and breaks OTP verification
if (action !== "signup" && action !== "reauthentication") {
  templateData.confirmation_url = confirmationUrl;
  templateData.token_hash = tokenHash;
}
```

### 2. Auth-welcome template: make OTP the only path

Remove the "Or click here to verify" fallback button from the signup template entirely. If OTP code is missing, show a clear error message instead of a broken link.

**File:** `supabase/functions/send-branded-email/index.ts` (lines 186-208)

```ts
const auth_welcome: TemplateBuilder = (data, b) => {
  const otpCode = data.otp_token as string || "";

  return {
    subject: `Verify your email for ${b.name}`,
    html: wrapEmail(b, [
      heading("Verify your email"),
      para(`Hi ${escapeHtml(data.recipient_name as string || "there")},`),
      para("Enter this 6-digit code to verify your account:"),
      otpCode
        ? `<div style="text-align:center;margin:24px 0;">
            <span style="...">${escapeHtml(otpCode)}</span>
          </div>`
        : para("If you don't see a code above, please request a new one from the app."),
      infoBox("This code expires in 1 hour. If you didn't create an account, you can safely ignore this email.", b),
      smallNote(`Need help? Contact us at ${escapeHtml(data.support_email as string || "support@amwmedia.co.uk")}`),
    ].join("")),
  };
};
```

Key change: No more `confirmation_url` button in this template. OTP is the only verification path for signup.

### 3. Deploy both edge functions

Redeploy `auth-email-hook` and `send-branded-email` so the changes take effect.

## What This Fixes

- Signup emails show **only** the 6-digit OTP code, no verify button
- No more "One-time token not found" errors from users clicking the link before entering the code
- Reauthentication also uses OTP-only
- Recovery, magic link, and email change continue using link-based verification (unchanged)

## Files to Edit

| File | Change |
|---|---|
| `supabase/functions/auth-email-hook/index.ts` | Strip `confirmation_url` from template data for signup/reauth actions |
| `supabase/functions/send-branded-email/index.ts` | Remove verify button from `auth_welcome` template |

