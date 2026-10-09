/**
 * The Decoda product catalog as the public website presents it.
 *
 * Every page that names a product, its status or its link reads it from here,
 * so a status can never say "In development" on one page and "Available" on
 * another. Statuses were checked against each product's own repository:
 *
 *   RWA Guard  pilot plan, entitlements and execution boundary enforced in
 *              decoda-rwa-guard (services/api/app/entitlements.py,
 *              docs/PILOT_EXECUTION_BOUNDARY.md).
 *   Vault      "Status: testnet MVP" — public testnets only, holds no keys,
 *              contains no signing code (decoda-vault README).
 *   Assets     "feature-complete testnet MVP, verified end to end against the
 *              local ecosystem sandbox. Not yet usable in production" — every
 *              asset and investor is synthetic (decoda-assets docs).
 *
 * The connected lifecycle (Assets → Vault → Guard) is the product roadmap, not
 * a claim of complete production integration today.
 */
import type { ProductKey } from '@/lib/platform/products';

export type ProductStatusTone = 'available' | 'development' | 'sandbox';

export interface SiteProduct {
  /** Matches the platform product key, so pilot links can preselect it. */
  key: ProductKey;
  /** Full product name. */
  name: string;
  /** Name used in navigation and compact UI. */
  navName: string;
  /** What the product is, in a few words. */
  category: string;
  status: {
    /** The status line shown on badges everywhere. */
    label: string;
    tone: ProductStatusTone;
    /** One sentence that qualifies the status. */
    detail: string;
  };
  /** One-sentence description for cards and navigation. */
  summary: string;
  /** Lifecycle role in the ecosystem narrative. */
  lifecycle: { verb: string; phrase: string };
  /** Page on this website. */
  href: string;
  /** The product application. */
  appUrl: string;
  appHost: string;
  /** Request Pilot, preselecting this product. */
  pilotHref: string;
}

export const GUARD: SiteProduct = {
  key: 'rwa_guard',
  name: 'Decoda RWA Guard',
  navName: 'Decoda Guard',
  category: 'Flagship security platform',
  status: {
    label: 'Available for pilot evaluation',
    tone: 'available',
    detail: 'Scoped pilots run against the monitoring scope agreed with each team.',
  },
  summary:
    'Security monitoring, investigation and controlled response for tokenized financial infrastructure.',
  lifecycle: { verb: 'Monitor & secure', phrase: 'Monitor and secure with Guard' },
  href: '/products/guard',
  appUrl: 'https://rwa.decodasecurity.com/',
  appHost: 'rwa.decodasecurity.com',
  pilotHref: '/request-pilot?product=rwa_guard',
};

export const VAULT: SiteProduct = {
  key: 'vault',
  name: 'Decoda Vault',
  navName: 'Decoda Vault',
  category: 'Digital asset operations',
  status: {
    label: 'In development · Testnet',
    tone: 'development',
    detail: 'Runs on public testnets only. Not a custodian; never holds private keys.',
  },
  summary:
    'Prepare, simulate and approve digital asset operations under deterministic policy before anyone signs.',
  lifecycle: { verb: 'Operate', phrase: 'Operate with Vault' },
  href: '/products/vault',
  appUrl: 'https://vault.decodasecurity.com/',
  appHost: 'vault.decodasecurity.com',
  pilotHref: '/request-pilot?product=vault',
};

export const ASSETS: SiteProduct = {
  key: 'assets',
  name: 'Decoda Assets',
  navName: 'Decoda Assets',
  category: 'Tokenization infrastructure',
  status: {
    label: 'Sandbox prototype · Testnet',
    tone: 'sandbox',
    detail: 'Synthetic assets and investors on public testnets. No securities are offered or issued.',
  },
  summary:
    'Model the lifecycle of a tokenized real-world asset — from origination to servicing — in a testnet sandbox.',
  lifecycle: { verb: 'Tokenize', phrase: 'Tokenize with Assets' },
  href: '/products/assets',
  appUrl: 'https://assets.decodasecurity.com/',
  appHost: 'assets.decodasecurity.com',
  pilotHref: '/request-pilot?product=assets',
};

/** Navigation and catalog order: the flagship first. */
export const SITE_PRODUCTS: readonly SiteProduct[] = [GUARD, VAULT, ASSETS];

/** Lifecycle order: tokenize → operate → monitor and secure. */
export const LIFECYCLE_ORDER: readonly SiteProduct[] = [ASSETS, VAULT, GUARD];
