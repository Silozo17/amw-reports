

## Update All Platform References Across the Website

### Problem
Multiple pages reference outdated platform counts and lists. The actual platform count is **14** but pages variously say 12 or 13. Several pages are missing LinkedIn Ads, Threads, or both. The onboarding step only shows 10 of 14 platforms.

### Audit Results

| Page / Component | Issue |
|---|---|
| `HomePage.tsx` | PLATFORMS array missing **Threads** and **LinkedIn Ads** |
| `PpcReportingPage.tsx` | PLATFORMS array missing **LinkedIn Ads** |
| `IntegrationsPage.tsx` | Title says "12 Marketing Platforms", body says "13 platforms" — should be **14** |
| `FeaturesPage.tsx` | Title and meta say "13 Platform Integrations" — should be **14** |
| `PricingPage.tsx` | Label says "13 Platform Integrations", FAQ says "12 platforms in total" — should be **14** and include Threads |
| `HowItWorksPage.tsx` | Body text says "12 platforms" — should be **14** |
| `ForFreelancersPage.tsx` | Says "12 platforms" — should be **14** |
| `ForAgenciesPage.tsx` | Says "12 platforms" — should be **14** |
| `PlatformsStep.tsx` (Onboarding) | Missing **tiktok_ads**, **linkedin_ads**, **pinterest**, **threads** (shows 10 of 14) |
| `ClientConnectionsTab.tsx` | CONNECTION_CATEGORIES missing **threads** from Organic Social |

### Changes

**1. `src/pages/HomePage.tsx`** — Add `'Threads'` and `'LinkedIn Ads'` to PLATFORMS array.

**2. `src/pages/PpcReportingPage.tsx`** — Add LinkedIn Ads to PLATFORMS array with its metrics (Spend, Impressions, Clicks, CTR, CPC, CPM, Conversions, Conversion Rate, Cost/Conv., Engagement).

**3. `src/pages/IntegrationsPage.tsx`** — Update meta title and body text from 12/13 to **14**.

**4. `src/pages/FeaturesPage.tsx`** — Update heading, meta description from "13" to **14**.

**5. `src/pages/PricingPage.tsx`** — Update "13 Platform Integrations" label to **14**, update FAQ answer to list all 14 platforms including Threads and LinkedIn Ads.

**6. `src/pages/HowItWorksPage.tsx`** — Change "12 platforms" to "14 platforms" in step 1 body text, add LinkedIn Ads mention.

**7. `src/pages/ForFreelancersPage.tsx`** — Change "12 platforms" to "14 platforms".

**8. `src/pages/ForAgenciesPage.tsx`** — Change "12 platforms" to "14 platforms".

**9. `src/components/onboarding/steps/PlatformsStep.tsx`** — Add `'tiktok_ads'`, `'linkedin_ads'`, `'pinterest'`, `'threads'` to PLATFORM_IDS. Adjust grid to `sm:grid-cols-7` for 14 items.

**10. `src/components/clients/tabs/ClientConnectionsTab.tsx`** — Add `'threads'` to the Organic Social platforms array in CONNECTION_CATEGORIES.

All changes are string/array updates only — no logic changes.

