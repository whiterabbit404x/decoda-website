/**
 * The Decoda product catalog and the entitlement decision.
 *
 * The authoritative decision is computed in SQL (`platform_api.product_access_v1`)
 * and read by every product. `evaluateAccess` is the same rule in TypeScript,
 * used where the platform must reason about a change before it is written (the
 * admin console's preview) and cross-checked against the view in tests, so the
 * two can never silently diverge.
 */

export const PRODUCTS = ['rwa_guard', 'vault', 'assets'] as const;
export type ProductKey = (typeof PRODUCTS)[number];

export const ENTITLEMENT_STATUSES = ['enabled', 'disabled', 'pilot', 'suspended'] as const;
export type EntitlementStatus = (typeof ENTITLEMENT_STATUSES)[number];

export const PRODUCT_LABELS: Record<ProductKey, string> = {
  rwa_guard: 'RWA Guard',
  vault: 'Vault',
  assets: 'Assets',
};

export const PRODUCT_DESCRIPTIONS: Record<ProductKey, string> = {
  rwa_guard: 'Continuous security monitoring, detection and incident response for tokenized real-world assets.',
  vault: 'Digital asset operations: prepare, simulate and approve operations under deterministic policy (testnet MVP).',
  assets: 'Tokenized asset lifecycle management. Not yet available.',
};

export function isProductKey(value: unknown): value is ProductKey {
  return typeof value === 'string' && (PRODUCTS as readonly string[]).includes(value);
}

export type AccessState =
  | 'granted'
  | 'no_membership'
  | 'user_inactive'
  | 'organization_inactive'
  | 'membership_inactive'
  | 'product_unavailable'
  | 'not_entitled'
  | 'entitlement_suspended'
  | 'entitlement_not_started'
  | 'entitlement_expired';

export interface AccessFacts {
  userStatus: string;
  organizationStatus: string;
  membershipStatus: string;
  productAvailability: string;
  entitlementStatus: string | null;
  entitlementStartsAt: Date | null;
  entitlementExpiresAt: Date | null;
}

/** TypeScript mirror of the CASE in platform_api.product_access_v1. */
export function evaluateAccess(facts: AccessFacts | null, now: Date = new Date()): AccessState {
  if (!facts) return 'no_membership';
  if (facts.userStatus !== 'active') return 'user_inactive';
  if (facts.organizationStatus !== 'active') return 'organization_inactive';
  if (facts.membershipStatus !== 'active') return 'membership_inactive';
  if (facts.productAvailability !== 'available') return 'product_unavailable';
  if (facts.entitlementStatus === null || facts.entitlementStatus === 'disabled') return 'not_entitled';
  if (facts.entitlementStatus === 'suspended') return 'entitlement_suspended';
  if (facts.entitlementStartsAt && facts.entitlementStartsAt.getTime() > now.getTime()) return 'entitlement_not_started';
  if (facts.entitlementExpiresAt && facts.entitlementExpiresAt.getTime() <= now.getTime()) return 'entitlement_expired';
  if (facts.entitlementStatus === 'enabled' || facts.entitlementStatus === 'pilot') return 'granted';
  return 'not_entitled';
}

/** What the launcher / product switcher shows for a product. */
export type LauncherState = 'open' | 'pilot' | 'not_enabled' | 'coming_soon' | 'suspended' | 'expired';

export const LAUNCHER_LABELS: Record<LauncherState, string> = {
  open: 'Open',
  pilot: 'Pilot',
  not_enabled: 'Not enabled',
  coming_soon: 'Coming soon',
  suspended: 'Suspended',
  expired: 'Pilot ended',
};

export function launcherState(accessState: AccessState, entitlementStatus: string | null): LauncherState {
  switch (accessState) {
    case 'granted':
      return entitlementStatus === 'pilot' ? 'pilot' : 'open';
    case 'product_unavailable':
      return 'coming_soon';
    case 'entitlement_suspended':
    case 'organization_inactive':
      return 'suspended';
    case 'entitlement_expired':
      return 'expired';
    default:
      return 'not_enabled';
  }
}

/** Only these launcher states render an entry link. */
export function launcherStateOpensProduct(state: LauncherState): boolean {
  return state === 'open' || state === 'pilot';
}

/** Customer-facing explanation for a denial (never exposes internal ids). */
export function accessDenialMessage(state: AccessState, productLabel: string): string {
  switch (state) {
    case 'granted':
      return '';
    case 'no_membership':
      return 'Your account is not a member of this organization.';
    case 'user_inactive':
      return 'Your Decoda account is not active. Contact your organization administrator.';
    case 'organization_inactive':
      return 'This organization is suspended. Contact Decoda to restore access.';
    case 'membership_inactive':
      return 'Your membership in this organization is not active yet.';
    case 'product_unavailable':
      return `${productLabel} is not yet available.`;
    case 'entitlement_suspended':
      return `${productLabel} is suspended for your organization.`;
    case 'entitlement_not_started':
      return `${productLabel} access for your organization has not started yet.`;
    case 'entitlement_expired':
      return `${productLabel} access for your organization has ended.`;
    case 'not_entitled':
    default:
      return `${productLabel} is not enabled for your organization.`;
  }
}
