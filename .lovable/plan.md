
The user wants a PWA. Per project guidance, I must warn about preview iframe issues and offer the simpler "installable manifest only" path vs full PWA with service worker. Before building anything, I need to clarify scope — these are materially different builds.

Key considerations:
- Lovable preview runs in iframe → service workers cause stale content. Must disable in dev + guard registration.
- App already has OAuth callbacks (`/auth/callback`, `/auth/threads/callback`) — these MUST be in `navigateFallbackDenylist` if using a service worker, otherwise OAuth flows break.
- Custom domain is `reports.amwmedia.co.uk` — manifest `start_url` and `scope` should be `/`.
- Branding: AMW dark theme, mascot already exists at `public/mascot.svg`. Need PNG icons (192, 512, maskable) — user must provide or confirm we generate from mascot.
- App is auth-gated; offline support has limited value (most pages need live data). Lean toward installable-only unless user wants offline.

# Plan: Add PWA Support

## Decisions needed before I build

I need two answers first — these change the implementation significantly:

**1. Which level of PWA do you want?**
- **A) Installable only (recommended)** — App can be installed to home screen on iOS/Android/desktop. No offline support, no service worker, no preview-iframe issues. ~5 min setup.
- **B) Full PWA with offline support** — Installable + service worker caches assets so the shell loads offline. More complex, can interfere with the Lovable preview, and has limited value for an auth-gated dashboard that needs live data.

**2. Icons**
- Use the existing `public/mascot.svg` and generate PNG icons (192×192, 512×512, plus a maskable variant) from it? Or will you provide a dedicated square icon (ideally 512×512 PNG)?

## What I'll build (Option A — Installable only)

1. **`public/manifest.webmanifest`** — name "AMW Reports", short_name "AMW", `display: "standalone"`, `theme_color` and `background_color` matching the AMW dark theme, `start_url: "/"`, `scope: "/"`.
2. **`public/icons/`** — `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` generated from the mascot.
3. **`index.html`** — add `<link rel="manifest">`, `<meta name="theme-color">`, Apple touch icon links, and `apple-mobile-web-app-*` meta tags so iOS treats it as a standalone app.
4. **No service worker, no `vite-plugin-pwa`** — avoids all preview/caching problems.

Result: users on iOS (Share → Add to Home Screen) and Android/desktop Chrome (install prompt) get a real installed app icon that opens fullscreen without browser chrome.

## What I'll build (Option B — Full PWA)

Everything in Option A, plus:
1. Install `vite-plugin-pwa` and configure `VitePWA({ registerType: "autoUpdate", devOptions: { enabled: false }, workbox: { navigateFallbackDenylist: [/^\/auth\/callback/, /^\/auth\/threads\/callback/, /^\/portal\//] } })`.
2. Add iframe + preview-host guard in `src/main.tsx` so the service worker never registers inside the Lovable editor (and unregisters any stale one).
3. Caveat I'll flag clearly: offline mode will only work in the published build at `reports.amwmedia.co.uk`, never in the editor preview.

## What I won't touch
- Existing routes, auth flow, OAuth callbacks (only add their paths to denylist if Option B).
- Any business logic, sync code, or dashboard components.
- The favicon (already configured).

Please confirm **A or B** and the **icon source**, then I'll implement.
