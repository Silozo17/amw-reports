

# Fix: OTP Verification Codes Not Delivered

## Root Cause

The `auth-email-hook` intercepts ALL Supabase Auth emails — including signup confirmation. When it handles a `signup` event, it maps it to the `auth_welcome` template, which sends a **"Welcome to [org]"** email with a "Complete Your Profile" button. The actual **OTP code is never included** in the email.

Since Supabase considers the email "handled" after the hook returns 200, it does **not** send its default OTP email either. Users are told "Check your email for a verification code" but receive a welcome email with no code.

Specifically:

1. **`auth-email-hook/index.ts` line 39**: Extracts `confirmation_url` from the payload, but **never extracts `token`** (the 6-digit OTP code that Supabase provides in the hook payload).
2. **`auth_welcome` template (lines 186-200)**: Does not display the OTP code or the confirmation URL. It shows a generic welcome message with a "Complete Your Profile" button pointing to a profile page.
3. The app's signup flow (`LandingPage.tsx` line 106) expects users to enter a 6-digit OTP via `verifyOtp({ type: 'signup' })`, but that code was never emailed to them.

## Fix

### 1. Update `auth-email-hook/index.ts` — Extract the OTP token from the payload

The Supabase Send Email Hook payload includes `token` (the 6-digit OTP) and `token_hash`. The hook must extract and pass these to the template.

```ts
// Add after line 39
const otpToken = payload.token ?? payload.email_data?.token ?? "";
```

Then add `otp_token` to `templateData`:
```ts
templateData.otp_token = otpToken;
```

### 2. Replace `auth_welcome` template with a proper signup confirmation template

Change it from a generic "Welcome" email to one that prominently displays the OTP code and includes the confirmation URL as a fallback link:

- Large, styled 6-digit OTP code display (monospace, spaced, easy to read)
- Clear instruction: "Enter this code to verify your account"
- Confirmation URL button as fallback ("Or click here to verify")
- Keep the welcome tone but make the code the primary content
- "This code expires in 1 hour" note

### 3. No frontend changes needed

The `LandingPage.tsx` OTP verification flow is already correct — it just needs the email to actually contain the code.

## Files to Edit

| File | Change |
|---|---|
| `supabase/functions/auth-email-hook/index.ts` | Extract `token` from hook payload, pass as `otp_token` in template data |
| `supabase/functions/send-branded-email/index.ts` | Update `auth_welcome` template to display OTP code prominently + include confirmation URL |

## Why This Fixes It

After this change:
1. User signs up → Supabase triggers the hook with `token` (6-digit code)
2. Hook extracts the token and passes it to `auth_welcome`
3. Template renders the OTP code prominently in a branded email
4. User enters the code on the OTP screen → account verified

