

## Reset TikTok Secrets and Verify Integration

The code is already correctly built for TikTok Login Kit v2 (organic content, not ads). The connect function, OAuth callback, and sync logic are all aligned. We just need to replace the secrets with your new Login Kit credentials.

### Steps

1. **Update `TIKTOK_APP_ID`** — Replace with your new Login Kit **Client Key**
2. **Update `TIKTOK_APP_SECRET`** — Replace with your new Login Kit **Client Secret**

### What you need from the TikTok Developer Portal

From your **new Login Kit app** (not the Business app):
- **Client Key** → stored as `TIKTOK_APP_ID`
- **Client Secret** → stored as `TIKTOK_APP_SECRET`
- **Redirect URI** must be set to: `https://kcdixfmjiifpnbtplodv.supabase.co/functions/v1/oauth-callback`

### Checklist for your TikTok app configuration
- App type: **Content** (not Commerce/Ads)
- Product enabled: **Login Kit**
- Redirect URI added in Login Kit settings
- Required scopes requested: `user.info.basic`, `user.info.profile`, `user.info.stats`, `video.list`
- Optional enhanced scopes: `user.insights`, `video.insights`, `comment.list`
- If app is in sandbox/development mode: your TikTok account must be added as a test user

No code changes needed — the integration is ready. Just the two secrets need updating.

