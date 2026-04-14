

## Integrate Threads as a New Platform

### Overview
Add Threads (Meta's text-based social platform) as the 14th platform integration. Threads has its own standalone OAuth flow via `graph.threads.net` (separate from Facebook/Instagram Graph API) with dedicated App ID and App Secret from the Meta Developer Console "Threads Use Case."

### Threads API Summary (as of April 2026)

- **OAuth**: Authorization via `https://threads.net/oauth/authorize`, token exchange via `https://graph.threads.net/oauth/access_token`
- **Scopes**: `threads_basic`, `threads_manage_insights`
- **Tokens**: Short-lived (1 hour) → exchanged for long-lived (60 days) → refreshable
- **User Insights** (time-series with `since`/`until`): `views`, `likes`, `replies`, `reposts`, `quotes`, `clicks`, `followers_count`, `follower_demographics`
- **Media Insights** (per-post lifetime): `views`, `likes`, `replies`, `reposts`, `quotes`, `shares`
- **Profile endpoint**: `GET /me?fields=id,username,threads_profile_picture_url,threads_biography`
- **Media listing**: `GET /{user-id}/threads?fields=id,text,timestamp,media_type,permalink,like_count,reply_count`

---

### Changes Required

#### 1. Database Migration — Add `threads` to `platform_type` enum

```sql
ALTER TYPE platform_type ADD VALUE IF NOT EXISTS 'threads';
```

#### 2. Secrets — `THREADS_APP_ID` and `THREADS_APP_SECRET`

These are separate from `META_APP_ID`. The Threads Use Case in the Meta Developer Console provides its own App ID and Secret. Will request these via `add_secret`.

#### 3. New Edge Function: `threads-connect`

OAuth connect function that builds the Threads authorization URL:
- URL: `https://threads.net/oauth/authorize`
- Params: `client_id`, `redirect_uri` (→ `oauth-callback`), `scope=threads_basic,threads_manage_insights`, `response_type=code`, `state` (base64 JSON with `connection_id`, `platform: "threads"`, `redirect_url`)

#### 4. Update `oauth-callback` — Add `handleThreads` handler

- Exchange code for short-lived token via `POST https://graph.threads.net/oauth/access_token` with `client_id`, `client_secret`, `grant_type=authorization_code`, `redirect_uri`, `code`
- Exchange short-lived for long-lived token via `GET https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=...&access_token=...`
- Fetch profile via `GET https://graph.threads.net/v1.0/me?fields=id,username&access_token=...`
- Store encrypted token, set `account_id`, `account_name` (username), `is_connected=true`, `token_expires_at` (60 days)

#### 5. New Edge Function: `sync-threads`

Syncs monthly data using the Threads Insights API:
- **User Insights**: `GET /{user-id}/threads_insights?metric=views,likes,replies,reposts,quotes,clicks,followers_count&since={start}&until={end}`
- **Media listing + insights**: Fetch posts in the date range, then per-post insights for top content
- **Metrics mapped**: `views`, `likes`, `replies` (as comments), `reposts` (as shares), `quotes`, `clicks`, `total_followers` (from `followers_count`), `follower_growth` (delta), `posts_published` (count), `engagement`, `engagement_rate`
- Writes to `monthly_snapshots` with `platform: 'threads'`
- Follows the same pattern as `sync-instagram` (decrypt token, 50s deadline, structured logging)

#### 6. Token refresh in `check-expiring-tokens`

Add Threads long-lived token refresh logic:
- `GET https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=...`
- Tokens are refreshable and valid for 60 days after refresh

#### 7. Frontend Type Updates

**`src/types/database.ts`:**
- Add `'threads'` to `PlatformType` union
- Add `threads: 'Threads'` to `PLATFORM_LABELS`
- Import and add Threads logo to `PLATFORM_LOGOS`
- Add `threads` metrics to `PLATFORM_AVAILABLE_METRICS`:
  ```
  threads: ['total_followers', 'follower_growth', 'views', 'likes', 'comments', 'shares', 'engagement', 'engagement_rate', 'clicks', 'posts_published', 'quotes']
  ```
- Add `'threads'` to `ORGANIC_PLATFORMS`
- Add `'threads'` to the Organic Social category in `PLATFORM_CATEGORIES`
- Add new metric labels: `quotes: 'Quotes'`, `reposts: 'Reposts'`

#### 8. Platform Routing Updates

**`src/lib/platformRouting.ts`:**
- Add `threads: 'threads-connect'` to `CONNECT_FUNCTION_MAP`
- Add `threads: 'sync-threads'` to `SYNC_FUNCTION_MAP`
- Add `'threads'` to `OAUTH_SUPPORTED` and `ALL_PLATFORMS`

#### 9. Logo Asset

Copy the uploaded `threads_logo.webp` to `src/assets/logos/threads.webp` and import it in `database.ts`.

#### 10. Website / Marketing Pages Updates

Add Threads to platform lists on these pages:
- **FeaturesPage.tsx** — Add Threads card with its metrics
- **SocialMediaReportingPage.tsx** — Add Threads to the platforms list and update counts
- **HowItWorksPage.tsx** — Add 'Threads' to `PLATFORMS` array
- **ForCreatorsPage.tsx** — Add 'Threads' to `PLATFORMS` array
- **PricingPage.tsx** — Update "12 Platform Integrations" → "13 Platform Integrations" and mention Threads
- **ForAgenciesPage.tsx**, **ForSmbsPage.tsx**, **ForFreelancersPage.tsx** — Add Threads where other platforms are listed
- **IntegrationsPage.tsx** — Add Threads integration card

#### 11. Dashboard Extras Component

Create `src/components/clients/dashboard/platforms/ThreadsExtras.tsx` — platform-specific dashboard section showing Threads-unique metrics (Quotes, Reposts) and top posts table. Wire it into `PlatformSection.tsx`.

#### 12. Memory Update

Save a `mem://integrations/threads-config` memory documenting the Threads API specifics, OAuth flow, and metric mapping.

---

### Technical Details

- Threads OAuth is completely separate from Facebook/Instagram OAuth (different base URL: `threads.net` and `graph.threads.net`)
- Threads API only supports data from April 13, 2024 onwards (Unix timestamp `1712991600`)
- Long-lived tokens last 60 days and must be refreshed — same pattern as existing `check-expiring-tokens`
- No account picker needed — Threads is tied to the authenticated user's single account

