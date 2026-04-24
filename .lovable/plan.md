# Content Lab Hardening + Navigation + Admin Plans

## Why this plan exists

Two AMW Media runs failed in the last hour. Money was spent on Apify scrapes and AI calls but the user got nothing usable. Root cause is two narrow bugs in the pipeline — both fixable, both preventable. While we're in there, restructure the client view so Content Lab sits next to Dashboard, fix the sidebar order, gate features by the paid Content Lab tier, and give admins the controls they need to manage tiers and credits.

---

## 1. Fix the failing runs (root causes)

Diagnosed from `content_lab_runs` history:

| Time | `error_message` | Bug |
|---|---|---|
| 18:13 | `Insert ideas failed … content_lab_ideas_best_fit_platform_check` | `content-lab-ideate` lets the AI return `"any"` as `best_fit_platform`, but the DB CHECK only allows `instagram / tiktok / facebook`. |
| 18:01 | `persistPosts: invalid input syntax for type integer: "42.281"` | Apify returned a float for `video_duration_seconds`. (`toInt` is now in place — verify it covers every numeric column.) |

**Fixes (all in `supabase/functions/`):**

- `content-lab-ideate/index.ts`
  - Drop `"any"` from the JSON-schema enum for `best_fit_platform`.
  - Tighten the system prompt: "best_fit_platform MUST be exactly one of: instagram, tiktok, facebook."
  - Before insert, normalise: lower-case, map `"reels" → "instagram"`, `"shorts" → "tiktok"`, anything else → fall back to the post's source platform or `"instagram"`. Never insert an unknown value.
- `content-lab-run/index.ts`
  - Confirm `toInt()` is applied to every integer column (`likes`, `comments`, `shares`, `views`, `author_followers`, `video_duration_seconds`) — already done, just add a unit-style assertion log if a coerced value differs from the input.
  - Wrap each phase (`discover`, `scrape`, `persistPosts`, `analyse`, `ideate`) in its own try/catch that logs the failing phase + first 200 chars of payload to `content_lab_run_progress` before re-throwing. Today everything bubbles up as `pipeline failed`, which makes debugging slow.
  - Already refunds the credit on failure via `refund_content_lab_credit` — verify the `ledgerId` is set before the throw path. Add a structured log line `[content-lab-run] refunded ledger=<id>` so we can grep success in edge logs.

**Outcome:** the AMW Media run that failed at 18:13 would now insert ideas successfully (or fall back to `instagram`); the 18:01 run would not have failed in the first place.

---

## 2. Restructure the client view tabs

Current order: `Dashboard | Connections | Upsells | Content Lab | Reports | Settings`

New order: `Dashboard | Content Lab | Upsells | Reports | Connections | Settings`

(Content Lab moves to position 2, right of Dashboard. Connections moves between Reports and Settings.)

File: `src/pages/clients/ClientDetail.tsx` — reorder `TabsTrigger` and `TabsContent` blocks. No logic changes.

---

## 3. Gate Content Lab by the paid add-on (already wired — verify)

`useContentLabAccess()` already returns `hasAccess` (tier set) and `canGenerate` (tier set + active). The sidebar already hides Content Lab when `!hasAccess`. Add the same gate to the per-client tab so an org without a tier can't see "Content Lab" on the client page either.

In `ClientDetail.tsx`:
- The `hasContentLabAccess && <TabsTrigger>` guard is already there — verify it uses `useContentLabAccess`. If `canGenerate` is false but `hasAccess` is true, show the tab in read-only mode (no "New Run" button) — this matches existing sidebar behaviour and means paused subs still see their history.

---

## 4. Admin: manage Content Lab tiers and credits

New section in `src/pages/admin/AdminContentLab.tsx` (currently 48 lines, just shows runs). Add two cards:

### A. Per-org tier management
- Table of orgs with columns: org name, current `content_lab_tier`, `status`, runs this month, credits balance.
- Inline `Select` to change tier (`null / starter / growth / scale`) — writes to `org_subscriptions.content_lab_tier`.
- Inline button "Grant credits" → modal with amount input → calls `add_content_lab_credits(_org_id, _amount, null)` (already exists).
- Inline button "Revoke credits" → modal → directly inserts a negative row into `content_lab_credit_ledger` and decrements `content_lab_credits.balance` via a new `admin_adjust_content_lab_credits` SECURITY DEFINER function (admin-only via `is_platform_admin`).

### B. Tier definitions reference (read-only for now)
- Render the tiers from `src/lib/contentLabPricing.ts` so admins can see what each tier includes (price, runs/month, Stripe price ID).
- Note: the actual tier prices live in Stripe and `contentLabPricing.ts`. Editing them is a code change, not a runtime knob — that's intentional. If you want a fully runtime-editable tier table later, that's a separate plan (would need a `content_lab_tier_config` table). I'll flag it but not build it.

### Required migration
```sql
create or replace function public.admin_adjust_content_lab_credits(
  _org_id uuid, _delta int, _reason text
) returns int
language plpgsql security definer set search_path = public as $$
declare _new int;
begin
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'forbidden';
  end if;
  insert into public.content_lab_credits(org_id, balance) values (_org_id, 0)
    on conflict (org_id) do nothing;
  update public.content_lab_credits
    set balance = greatest(balance + _delta, 0), updated_at = now()
    where org_id = _org_id
    returning balance into _new;
  insert into public.content_lab_credit_ledger(org_id, delta, reason)
    values (_org_id, _delta, coalesce(_reason, 'admin_adjust'));
  return _new;
end $$;
```

---

## 5. Out of scope (intentionally)

- Rebuilding the pipeline phase UI (already done in last loop).
- Stripe price changes (live IDs, not safe to touch without explicit approval).
- A runtime-editable tier table (see §4 note).

---

## Files touched

```text
supabase/functions/content-lab-ideate/index.ts   # enum + normaliser
supabase/functions/content-lab-run/index.ts      # per-phase try/catch + log
supabase/migrations/<new>.sql                    # admin_adjust_content_lab_credits
src/pages/clients/ClientDetail.tsx               # tab reorder
src/pages/admin/AdminContentLab.tsx              # tier + credits panel
src/hooks/useAdminContentLab.ts                  # add mutations for tier/credits
```

## Verification after implementation

1. Trigger a fresh run for AMW Media — confirm it completes through `discover → scrape → analyse → ideate → completed`.
2. Force an ideate failure (mock invalid platform) — confirm credit is refunded and `content_lab_run_progress` logs the phase.
3. As platform admin, change one org's tier from `null → starter` and grant 5 credits — confirm the org sees Content Lab unlock and credits appear in the header.
4. Confirm the client view tab order on `/clients/:id` matches §2.
