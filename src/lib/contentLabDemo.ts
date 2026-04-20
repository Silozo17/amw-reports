/**
 * Content Lab paywall demo data.
 *
 * Why a constant rather than an RPC: the AMW Media demo run is curated and
 * stable. Hardcoding the id keeps the paywall instantly renderable on first
 * paint with zero round-trips. Update the constant when a fresher demo run
 * is preferred.
 */
export const AMW_DEMO_ORG_ID = '319ab519-4f9a-470f-b9f7-9d98e90f6d2f';

/** Latest completed AMW Media run as of 2026-04-20. */
export const CONTENT_LAB_DEMO_RUN_ID = '875ea4f0-d893-4005-abd7-a84a01de8205';

/**
 * Active public share-token slug for the AMW demo run.
 * Used by the public marketing pages to render a real read-only sample
 * via the `get_shared_run` RPC (no auth required).
 */
export const AMW_DEMO_SHARE_SLUG = 'd35fb028e66dcf012548ac6f';

/** Subscription tier names that get full Content Lab access. */
export const CONTENT_LAB_PAID_TIERS = ['creator', 'studio', 'agency'] as const;
