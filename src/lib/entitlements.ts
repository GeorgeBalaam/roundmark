// Entitlements layer.
// Features are gated by named *capabilities* and *limits*, never by plan name.
// Pricing model: build for free, pay to go LIVE. Capabilities resolve from two
// sources — the account's plan (subscription) AND per-event passes (a pass
// unlocks go-live for one specific event). So a check is "does the plan allow it,
// OR does this event have a pass that does." Stripe slots in later by granting a
// plan or an event pass; nothing else changes.
//
// Launch tiers: free (build & preview, can't go live), pass (one event live,
// one-off), annual (unlimited live + premium org features). `full` is the
// legacy/admin bundle (everything) so existing accounts are grandfathered.

export type Capability =
  | 'go_live'            // publish / take an event live (the paywall)
  | 'custom_branding'    // colours + logo on the live event
  | 'image_uploads'
  | 'public_registration'
  | 'multi_organiser'    // co-organisers (annual)
  | 'leagues'            // multi-event series / season standings (annual)
  | 'remove_branding'    // white-label, hide "Powered by Roundmark" (annual)
  | 'csv_export'
  | 'tv_mode';

export type LimitKey = 'maxLiveEvents' | 'maxPlayersPerEvent';

/** -1 means unlimited. */
export const UNLIMITED = -1;

export interface Plan {
  id: string;
  label: string;
  capabilities: Capability[];
  limits: Record<LimitKey, number>;
}

// Things anyone can do while building/previewing a draft, for free.
const BUILD_CAPS: Capability[] = ['custom_branding', 'image_uploads', 'public_registration', 'tv_mode', 'csv_export'];

export const PLANS: Record<string, Plan> = {
  free: {
    id: 'free',
    label: 'Free',
    capabilities: [...BUILD_CAPS],
    limits: { maxLiveEvents: 0, maxPlayersPerEvent: UNLIMITED },
  },
  annual: {
    id: 'annual',
    label: 'Annual',
    capabilities: [...BUILD_CAPS, 'go_live', 'multi_organiser', 'leagues', 'remove_branding'],
    limits: { maxLiveEvents: UNLIMITED, maxPlayersPerEvent: UNLIMITED },
  },
  // Legacy/admin: everything. Existing accounts keep this so nothing breaks.
  full: {
    id: 'full',
    label: 'Full',
    capabilities: [...BUILD_CAPS, 'go_live', 'multi_organiser', 'leagues', 'remove_branding'],
    limits: { maxLiveEvents: UNLIMITED, maxPlayersPerEvent: UNLIMITED },
  },
};

/** New accounts start here — build for free, pay to go live. */
export const DEFAULT_PLAN_ID = 'free';

/** What a single-event pass unlocks (a fully-featured one-off event, incl. branding). */
export const PASS_CAPABILITIES: Capability[] = ['go_live', 'custom_branding'];

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

export function withinLimit(limit: number, used: number): boolean {
  return isUnlimited(limit) || used < limit;
}

export interface Entitlements {
  plan: Plan;
  can: (cap: Capability) => boolean;
  limit: (key: LimitKey) => number;
  within: (key: LimitKey, used: number) => boolean;
}

/** Account-level entitlements for a plan id (pure; the hook lives in store). */
export function entitlementsFor(planId: string | null | undefined): Entitlements {
  const plan = planFor(planId);
  return {
    plan,
    can: (cap) => planCan(plan, cap),
    limit: (key) => planLimit(plan, key),
    within: (key, used) => withinLimit(planLimit(plan, key), used),
  };
}

/** Resolve a capability for a specific event: account plan OR a pass on this event. */
export function eventCan(planId: string | null | undefined, hasPass: boolean, cap: Capability): boolean {
  if (planCan(planFor(planId), cap)) return true;
  return hasPass && PASS_CAPABILITIES.includes(cap);
}

/** Can this event be taken live? (annual/full plan, or a pass bought for it.) */
export function canGoLive(planId: string | null | undefined, hasPass: boolean): boolean {
  return eventCan(planId, hasPass, 'go_live');
}
