// Single source of truth for Content Lab tier → monthly run quota, used by
// edge functions. Mirrors RUN_LIMITS_BY_TIER in src/lib/contentLabPricing.ts.
// "100% paid" model: no tier (i.e. no active Content Lab subscription) = 0 runs.
//
// IMPORTANT: keep these numbers in sync with the frontend pricing module and
// with the Stripe products referenced in PRICE_ID_TO_CONTENT_LAB_TIER.

export const RUN_LIMITS_BY_TIER: Record<string, number> = {
  starter: 3,
  growth: 5,
  scale: 20,
};

export const DEFAULT_RUN_LIMIT = 0;

export function runLimitForTier(tier: string | null | undefined): number {
  if (!tier) return DEFAULT_RUN_LIMIT;
  return RUN_LIMITS_BY_TIER[tier.toLowerCase()] ?? DEFAULT_RUN_LIMIT;
}
