

# Update LinkedIn Organic Secrets

## What needs to happen
Two existing secrets need to be updated with new values:

1. **LINKEDIN_CLIENT_ID** — your new LinkedIn app's Client ID
2. **LINKEDIN_CLIENT_SECRET** — your new LinkedIn app's Primary Client Secret

## How it works
- I'll use the `add_secret` tool to prompt you to securely enter each value (this overwrites the existing secret)
- No code changes are needed — the edge functions (`linkedin-connect` and `sync-linkedin`) already reference these secret names
- After updating, you'll need to **reconnect** the LinkedIn organic connection on any client to use the new credentials

## Steps
1. Prompt you to enter the new `LINKEDIN_CLIENT_ID`
2. Prompt you to enter the new `LINKEDIN_CLIENT_SECRET`
3. Confirm both are saved

No files will be modified.

