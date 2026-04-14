

## Three Fixes: Hero KPIs, Missing Platform on Website, AI Platform Coverage

### Issue 1: Hero KPIs Missing Platform-Specific Metrics

**Problem**: GBP metrics (phone calls, avg rating, direction requests), ad platform leads, and other unique metrics never appear as Hero KPI cards. The `computeKpis` function in `dashboardCalcs.ts` has a fixed list of ~15 aggregate KPIs but omits platform-specific ones.

**Fix** — Add new Hero KPI entries in `src/lib/dashboardCalcs.ts`:
- **Phone Calls** (`gbp_calls`) — sum across GBP snapshots
- **Direction Requests** (`gbp_direction_requests`) — sum across GBP snapshots
- **Avg. Rating** (`gbp_average_rating`) — latest value (not sum), flagged as `isDecimal`
- **Leads** (`leads`) — sum across ad platforms (Meta Ads, Google Ads)

Also add corresponding sparkline entries in `computeSparklines` for the new metrics. Import additional icons (e.g. `Phone`, `MapPin`, `Star`) from lucide-react.

Add accent colors for the new metrics in `HeroKPIs.tsx` ACCENT_COLORS map.

**Files**: `src/lib/dashboardCalcs.ts`, `src/components/clients/dashboard/HeroKPIs.tsx`

---

### Issue 2: IntegrationsPage Shows 12 Platforms, Missing LinkedIn Ads

**Problem**: The `PLATFORMS` array in `IntegrationsPage.tsx` has 12 entries. LinkedIn Ads is missing.

**Fix** — Add LinkedIn Ads entry:
```
{ name: 'LinkedIn Ads', category: 'Ads', metrics: ['Spend', 'Impressions', 'Clicks', 'CTR', 'CPC', 'CPM', 'Conversions', 'Conversion Rate', 'Cost/Conv.', 'Engagement'], link: '/ppc-reporting' }
```

**File**: `src/pages/IntegrationsPage.tsx`

---

### Issue 3: AI Functions Missing LinkedIn Ads from Platform Categories

**Problem**: The `analyze-client` edge function defines its own `PLATFORM_CATEGORIES` that excludes `linkedin_ads` from the "Paid Advertising" category. This means LinkedIn Ads data is never included in the AI analysis prompt.

The `chat-with-data` and `voice-briefing` functions pass all snapshots without filtering by platform category — so they already include all 13 platforms. No change needed there.

**Fix** — In `supabase/functions/analyze-client/index.ts`, add `"linkedin_ads"` to the `"Paid Advertising"` array:
```typescript
"Paid Advertising": ["google_ads", "meta_ads", "tiktok_ads", "linkedin_ads"],
```

**File**: `supabase/functions/analyze-client/index.ts`

---

### Summary of Changes

| File | Change |
|---|---|
| `src/lib/dashboardCalcs.ts` | Add GBP calls, direction requests, avg rating, leads to Hero KPIs + sparklines |
| `src/components/clients/dashboard/HeroKPIs.tsx` | Add accent colors for new metric keys |
| `src/pages/IntegrationsPage.tsx` | Add LinkedIn Ads platform entry |
| `supabase/functions/analyze-client/index.ts` | Add `linkedin_ads` to PLATFORM_CATEGORIES |

### Risk
- Hero KPIs are capped at 8 cards (`kpis.slice(0, 8)`). With more KPIs added, some may not display. The existing ordering prioritizes spend/reach/clicks first, so new GBP/leads cards will appear when those primary metrics have no data, or when a specific platform filter is active.
- No database migration needed.

