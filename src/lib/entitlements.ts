// Entitlements layer.
// Features are gated by named *capabilities* and *limits*, never by plan name.
// A plan is just a bundle of capabilities + limits, resolved at runtime from the
// account's subscription. Pre-launch there is no billing, so everyone resolves to
// the single 'full' plan — adding tiers later is editing PLANS below, not feature
// code. Only the paying customer/organiser side ever carries a plan; player
// accounts are free and entitlement-light.

export type Capability =
  | 'create_event'
  | 'custom_branding'
  | 'image_uploads'
  | 'public_registration'
  | 'multi_organiser'
  | 'csv_export'
  | 'tv_mode';

export type LimitKey = 'maxEvents' | 'maxActiveEvents' | 'maxPlayersPerEvent';

/** -1 means unlimited. */
export const UNLIMITED = -1;

export interface Plan {
  id: string;
  label: string;
  capabilities: Capability[];
  limits: Record<LimitKey, number>;
}

export const PLANS: Record<string, Plan> = {
  full: {
    id: 'full',
    label: 'Full',
    capabilities: [
      'create_event',
      'custom_branding',
      'image_uploads',
      'public_registration',
      'multi_organiser',
      'csv_export',
      'tv_mode',
    ],
    limits: { maxEvents: UNLIMITED, maxActiveEvents: UNLIMITED, maxPlayersPerEvent: UNLIMITED },
  },
};

/** Everyone is on this plan until billing/tiers are introduced. */
export const DEFAULT_PLAN_ID = 'full';

export function planFor(planId: string | null | undefined): Plan {
  return PLANS[planId ?? DEFAULT_PLAN_ID] ?? PLANS[DEFAULT_PLAN_ID];
}

export function planCan(plan: Plan, cap: Capability): boolean {
  return plan.capabilities.includes(cap);
}

export function planLimit(plan: Plan, key: LimitKey): number {
  return plan.limits[key] ?? UNLIMITED;
}

export function isUnlimited(n: number): boolean {
  return n < 0;
}

/** True when `used` is below the limit (or the limit is unlimited). */
export function withinLimit(limit: number, used: number): boolean {
  return isUnlimited(limit) || used < limit;
}

export interface Entitlements {
  plan: Plan;
  can: (cap: Capability) => boolean;
  limit: (key: LimitKey) => number;
  /** True if another unit may be added given current usage. */
  within: (key: LimitKey, used: number) => boolean;
}

/** Build an entitlements helper for a plan id (pure; the hook lives in store). */
export function entitlementsFor(planId: string | null | undefined): Entitlements {
  const plan = planFor(planId);
  return {
    plan,
    can: (cap) => planCan(plan, cap),
    limit: (key) => planLimit(plan, key),
    within: (key, used) => withinLimit(planLimit(plan, key), used),
  };
}
