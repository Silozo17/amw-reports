

# Sophisticated Onboarding Flow

## Overview

After OTP verification, instead of navigating directly to `/dashboard`, redirect to `/onboarding` — a multi-step, animated onboarding wizard. Answers are stored in a new `onboarding_responses` table, visible to AMW admins in the org detail panel. After completion, show an animated welcome screen with guided setup or free exploration options.

## Database

### New table: `onboarding_responses`

```sql
CREATE TABLE public.onboarding_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL,
  account_type text NOT NULL,          -- 'creator', 'business', 'agency'
  platforms_used text[] DEFAULT '{}',   -- ['google_ads', 'instagram', ...]
  client_count text,                    -- '1-5', '6-20', '21-50', '50+'
  primary_reason text,                  -- 'reporting', 'time_saving', 'client_retention', 'growth'
  referral_source text,                 -- 'google', 'social', 'referral', 'other'
  biggest_challenge text,              -- free text or preset
  completed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.onboarding_responses ENABLE ROW LEVEL SECURITY;

-- Users can insert/view their own
CREATE POLICY "Users can insert own onboarding" ON public.onboarding_responses
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own onboarding" ON public.onboarding_responses
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Platform admins can view all
CREATE POLICY "Platform admins can view all onboarding" ON public.onboarding_responses
  FOR SELECT TO authenticated USING (is_platform_admin(auth.uid()));
```

### Add `onboarding_completed` flag to `profiles`

```sql
ALTER TABLE public.profiles ADD COLUMN onboarding_completed boolean DEFAULT false;
```

## New Route

| Route | Component | Purpose |
|-------|-----------|---------|
| `/onboarding` | `OnboardingPage.tsx` | Multi-step wizard, protected, only accessible if `onboarding_completed = false` |

## Onboarding Steps (5 steps + welcome)

### Step 1: Account Type
"How would you describe yourself?" — Three large selectable cards:
- **Creator** — icon + description ("I manage my own brand and content")
- **Business** — ("I run a business and need marketing insights")
- **Agency** — ("I manage marketing for multiple clients")

### Step 2: Platforms Used
"Which platforms do you use?" — Grid of platform cards with logos (reuse `PLATFORM_LOGOS` from `database.ts`). Multi-select with visual toggle state. All 10 platforms shown.

### Step 3: Scale (conditional)
- If **Agency**: "How many clients do you manage?" — selectable pills: 1-5, 6-20, 21-50, 50+
- If **Business/Creator**: Skip this step automatically

### Step 4: Primary Reason
"What's your main reason for using AMW Reports?" — Selectable cards:
- Save time on reporting
- Impress clients with branded reports
- Track performance across platforms
- Retain and grow client base

### Step 5: How Did You Hear About Us
"How did you find AMW Reports?" — Simple selection:
- Google search, Social media, Referral, Event/conference, Other (free text)

### Step 6: Animated Welcome Screen
Full-screen animated transition: "Welcome to AMW Reports, [First Name]!" with the mascot, subtle particle/confetti effect using CSS animations. Two CTAs:
- **"Guide me through setup"** — navigates to `/dashboard` with a `?guided=true` query param that triggers a step-by-step tooltip overlay prompting: create first client → connect a platform
- **"I'll explore on my own"** — navigates to `/dashboard` directly

## UI/UX Design

- Dark premium background (`bg-amw-dark`) consistent with brand
- Progress indicator (dots or thin progress bar) at top
- Smooth transitions between steps (slide/fade)
- Each step is a centered card (max-w-2xl) with large, clickable option cards
- Back button on steps 2+, skip not available (all required except step 3 for non-agencies)
- "Continue" button activates only when a selection is made

## Flow Integration

### `LandingPage.tsx`
After OTP verification and org creation, navigate to `/onboarding` instead of `/dashboard`.

### `App.tsx`
Add `/onboarding` as a protected route.

### `Index.tsx` (Dashboard)
On mount, check `profile.onboarding_completed`. If `false`, redirect to `/onboarding`. This prevents skipping.

### Profile update
After onboarding completes, set `profiles.onboarding_completed = true`.

## Admin Panel Integration

### `AdminOrgDetail.tsx`
Add a new tab or section: **"Onboarding Data"** — displays the onboarding responses for each org member in a clean table format:
- Account type, platforms, client count, reason, referral source
- Submitted date

## Files to Create

| File | Purpose |
|------|---------|
| `src/pages/OnboardingPage.tsx` | Multi-step onboarding wizard with all steps + welcome screen |

## Files to Modify

| File | Change |
|------|--------|
| `src/App.tsx` | Add `/onboarding` protected route |
| `src/pages/LandingPage.tsx` | Change post-OTP navigate from `/dashboard` to `/onboarding` |
| `src/pages/Index.tsx` | Add redirect to `/onboarding` if `onboarding_completed` is false |
| `src/pages/admin/AdminOrgDetail.tsx` | Add onboarding responses section/tab |
| Database migration | Create `onboarding_responses` table + add `onboarding_completed` column to profiles |

