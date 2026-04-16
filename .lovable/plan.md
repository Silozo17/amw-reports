
User wants the PWA `start_url` to be `/login` instead of `/`. This means when users tap the installed app icon, it opens directly at the login page.

Note: `start_url` is relative to `scope`. If I set `start_url: "/login"`, scope should remain `/` so the app can navigate to all routes after login. Auth-gated routes will redirect to login anyway if the user isn't signed in, so this is mostly a small UX refinement.

One consideration: once a user is logged in, opening the app at `/login` will likely redirect them to the dashboard automatically (existing auth guard behaviour). That's fine and matches current web behaviour.

# Plan: Update PWA start URL to /login

## Change

**File: `public/manifest.webmanifest`** — single field change:

```json
"start_url": "/login"
```

Everything else stays the same (`scope: "/"`, icons, theme colours, display mode).

## Why scope stays `/`
`scope` controls which URLs the installed app is allowed to navigate within. Keeping it at `/` means the app can move freely between login → dashboard → clients → settings without falling out of standalone mode.

## Notes
- Logged-in users opening the installed app will hit `/login` and be redirected to the dashboard by the existing auth guard — same as the web flow.
- No code changes, no icon regeneration, no `index.html` changes needed.
- Users who already installed the PWA will pick up the new `start_url` the next time the manifest is re-fetched (usually within 24h, or immediately on reinstall).
