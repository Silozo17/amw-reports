// Single source of truth for Content Lab add-on pricing.
// Content Lab is a paid add-on, NOT bundled with any AMW Reports plan.
// Prices in £ (GBP). Stripe price IDs created 2026-04-20.

export type ContentLabTierKey = 'starter' | 'growth' | 'scale';

export interface ContentLabTier {
  key: ContentLabTierKey;
  name: string;
  priceMonthly: number;
  runsPerMonth: number;
  priceId: string;
  highlight?: boolean;
}

export const CONTENT_LAB_TIERS: Record<ContentLabTierKey, ContentLabTier> = {
  starter: {
    key: 'starter',
    name: 'Starter',
    priceMonthly: 49,
    runsPerMonth: 3,
    priceId: 'price_1TOPobHCGP7kst5Z1hSGxS82',
  },
  growth: {
    key: 'growth',
    name: 'Growth',
    priceMonthly: 149,
    runsPerMonth: 5,
    priceId: 'price_1TOPocHCGP7kst5ZnFUAQP7a',
    highlight: true,
  },
  scale: {
    key: 'scale',
    name: 'Scale',
    priceMonthly: 299,
    runsPerMonth: 20,
    priceId: 'price_1TOPoeHCGP7kst5ZC3DKF1ma',
  },
};

export const CONTENT_LAB_TIER_LIST: ContentLabTier[] = [
  CONTENT_LAB_TIERS.starter,
  CONTENT_LAB_TIERS.growth,
  CONTENT_LAB_TIERS.scale,
];

export type ContentLabCreditPackKey = 'pack_5' | 'pack_15' | 'pack_25' | 'pack_50' | 'pack_100';

export interface ContentLabCreditPack {
  key: ContentLabCreditPackKey;
  credits: number;
  price: number;
  priceId: string;
  badge?: string;
}

export const CONTENT_LAB_CREDIT_PACKS: Record<ContentLabCreditPackKey, ContentLabCreditPack> = {
  pack_5: {
    key: 'pack_5',
    credits: 5,
    price: 25,
    priceId: 'price_1TOPogHCGP7kst5Zi9ILiaej',
  },
  pack_15: {
    key: 'pack_15',
    credits: 15,
    price: 55,
    priceId: 'price_1TOPogHCGP7kst5ZAEMCE2gL',
    badge: 'Save 27%',
  },
  pack_25: {
    key: 'pack_25',
    credits: 25,
    price: 75,
    priceId: 'price_1TOPohHCGP7kst5Z5BCQOD3X',
    badge: 'Save 40%',
  },
  pack_50: {
    key: 'pack_50',
    credits: 50,
    price: 99,
    priceId: 'price_1TOPoiHCGP7kst5ZrDC0kdza',
    badge: 'Best value',
  },
  pack_100: {
    key: 'pack_100',
    credits: 100,
    price: 149,
    priceId: 'price_1TOPokHCGP7kst5ZFcQyslHt',
    badge: 'Best deal',
  },
};

export const CONTENT_LAB_CREDIT_PACK_LIST: ContentLabCreditPack[] = [
  CONTENT_LAB_CREDIT_PACKS.pack_5,
  CONTENT_LAB_CREDIT_PACKS.pack_15,
  CONTENT_LAB_CREDIT_PACKS.pack_25,
  CONTENT_LAB_CREDIT_PACKS.pack_50,
  CONTENT_LAB_CREDIT_PACKS.pack_100,
];

// Reverse map: Stripe price ID → tier slug. Used by stripe-webhook to set
// org_subscriptions.content_lab_tier when a subscription is created/updated.
export const PRICE_ID_TO_CONTENT_LAB_TIER: Record<string, ContentLabTierKey> = {
  [CONTENT_LAB_TIERS.starter.priceId]: 'starter',
  [CONTENT_LAB_TIERS.growth.priceId]: 'growth',
  [CONTENT_LAB_TIERS.scale.priceId]: 'scale',
};

export const CONTENT_LAB_STARTING_PRICE_LABEL = `From £${CONTENT_LAB_TIERS.starter.priceMonthly}/mo`;

// Tier slug → monthly run quota. Derived from CONTENT_LAB_TIERS so the pricing
// table and the run-limit gate cannot drift. "100% paid" model: no tier = 0 runs.
export const RUN_LIMITS_BY_TIER: Record<string, number> = {
  starter: CONTENT_LAB_TIERS.starter.runsPerMonth,
  growth: CONTENT_LAB_TIERS.growth.runsPerMonth,
  scale: CONTENT_LAB_TIERS.scale.runsPerMonth,
  agency: Number.MAX_SAFE_INTEGER,
};

export const DEFAULT_RUN_LIMIT = 0;

export function runLimitForTier(tier: string | null | undefined): number {
  if (!tier) return DEFAULT_RUN_LIMIT;
  return RUN_LIMITS_BY_TIER[tier.toLowerCase()] ?? DEFAULT_RUN_LIMIT;
}

