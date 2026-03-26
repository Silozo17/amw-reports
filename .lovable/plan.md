

# Fix White Buttons & Restructure Pricing Plans

## Problem Summary

1. **White buttons on public pages**: The `PublicLayout` uses `bg-amw-black` but doesn't apply the `dark` class. The `outline` button variant uses `bg-background` which resolves to light cream (`32 44% 92%`) in light mode, making buttons appear as solid white blocks on dark backgrounds.

2. **Plan restructure needed**: Rename and reprice plans per user requirements.

3. **White-label access gating**: Only the top-tier plan should access branding/custom domain settings.

4. **Connection allocation anti-gaming**: Prevent buying extra clients just for cheap connections.

---

## Part 1: Fix White Buttons

**File: `src/components/landing/PublicLayout.tsx`**
- Add `dark` class to the root div: `className="min-h-screen flex flex-col bg-amw-black text-amw-offwhite dark"`
- This makes all shadcn components (buttons, cards, etc.) inside public pages use dark mode CSS variables, fixing the white `bg-background` issue on outline buttons.

**File: `src/pages/PricingPage.tsx`**
- Remove the manual override class on non-highlighted buttons (`border-sidebar-border text-amw-offwhite hover:bg-sidebar-accent/50`) since the dark class fix will handle proper styling.

**File: `src/pages/HomePage.tsx`** (line 73)
- The "See Features" button uses inline classes to fake a transparent button. Replace with `variant="outline"` since dark mode will now work correctly.

---

## Part 2: Restructure Plans

### New plan structure:

| | Starter | Freelance (was Agency) | Agency (was Custom) |
|---|---|---|---|
| Price | Free | £49.99/mo | £69.99/mo |
| Clients | 1 | 5 | 5 |
| Connections | 5 | 25 | 25 |
| White-Label | No | No | Yes |
| Custom Domain | No | No | Yes |
| Add-on Clients | No | Yes (£9.99/client, includes 5 connections) | Yes (£9.99/client, includes 5 connections) |
| Add-on Connections | No | Yes (£4.99/connection) | Yes (£4.99/connection) |

### Database migration:
- Rename existing `agency` plan to `freelance` (name: "Freelance", base_price: 49.99)
- Insert new `agency` plan (name: "Agency", slug: "agency", base_price: 69.99, included_clients: 5, included_connections: 25)
- Add `has_whitelabel` boolean column to `subscription_plans` (default false, set true only for new agency plan)

### Files to update:

**`src/pages/PricingPage.tsx`** — Update PLANS array, COMPARISON_ROWS, and FAQs:
- Starter stays the same
- Freelance: £49.99/mo, 5 clients, 25 connections, no white-label
- Agency: £69.99/mo, 5 clients, 25 connections, full white-label branding, custom domain
- Both Freelance and Agency support add-on clients (£9.99 each with 5 connections) and add-on connections (£4.99 each)
- Update comparison table with 4 columns (Starter, Freelance, Agency)
- Add FAQ about connection allocation (3 locked + 2 flexible per client)

**`src/components/settings/BillingSection.tsx`** — Update STRIPE_PLANS to reflect new names and add a new Stripe price for Agency at £69.99. Need a new Stripe product/price for the Agency plan.

---

## Part 3: Gate White-Label Access

**`src/pages/SettingsPage.tsx`** — Conditionally show/hide the "White Label" tab based on the subscription plan's `has_whitelabel` flag. Use `useEntitlements()` to check.

**`src/hooks/useEntitlements.ts`** — Add `hasWhitelabel` boolean to the returned entitlements, derived from the subscription plan's `has_whitelabel` column.

---

## Part 4: Connection Allocation Logic

The anti-gaming rule: each additional client comes with 5 connections, but 3 of those are locked to that specific client and only 2 can be used on any client.

This is primarily an **entitlement/enforcement concern** — when a user tries to add a connection to a client, the system should check:
1. Does this client have fewer than 3 connections? → Always allowed (locked slots)
2. Does the org have remaining "flexible" pool connections? → Allowed

**`src/hooks/useEntitlements.ts`** — Update connection counting logic:
- Total connections = plan included + (additional_clients × 5) + (additional_connections × 1)
- Locked connections = clients_count × 3 (reserved per client)
- Flexible pool = total - locked
- `canAddConnectionForClient(clientConnectionCount)`: if client has < 3, yes; else check flexible pool availability

**`src/components/clients/ConnectionDialog.tsx`** — Use updated entitlements to block adding connections when limits are exceeded, with a descriptive message.

**Update FAQ** on pricing page to explain: "Each additional client account includes 5 connections — 3 are reserved exclusively for that client, and 2 are added to your flexible pool that can be used across any client."

---

## Part 5: Stripe Product

Create a new Stripe product and price for the Agency plan at £69.99/month using the Stripe tool, then reference the new price ID in `BillingSection.tsx`.

---

## Files to Create/Modify

| File | Action |
|---|---|
| `src/components/landing/PublicLayout.tsx` | Add `dark` class |
| `src/pages/PricingPage.tsx` | Full restructure of plans, comparison, FAQs |
| `src/pages/HomePage.tsx` | Fix "See Features" button variant |
| `src/components/settings/BillingSection.tsx` | Update plan names, prices, add Agency tier |
| `src/hooks/useEntitlements.ts` | Add `hasWhitelabel`, connection allocation logic |
| `src/pages/SettingsPage.tsx` | Gate white-label tab behind entitlement |
| DB migration | Rename agency→freelance, add new agency plan with `has_whitelabel` |
| Stripe | Create new product/price for Agency £69.99/mo |

