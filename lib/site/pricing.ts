/**
 * Decoda RWA Guard commercial structure — the ONE source for every price,
 * plan name and plan feature the website shows: the pricing page, the homepage
 * pricing section, page metadata and the structured data (JSON-LD).
 *
 * Plans and limits mirror RWA Guard itself, which enforces them:
 *   decoda-rwa-guard services/api/app/entitlements.py      (Pilot / Scale / Enterprise limits)
 *   decoda-rwa-guard apps/web/app/pricing-plans.ts          ("Scale — From $999 / month")
 *   decoda-rwa-guard docs/PILOT_EXECUTION_BOUNDARY.md       (Pilot is recommend-only)
 *
 * Deliberately NOT stated here, because no code or approved configuration
 * supports it: that the Pilot is free, any SLA, any compliance certification,
 * unlimited monitoring coverage, or a self-serve checkout. Every plan is
 * arranged with the Decoda team.
 *
 * To withdraw the published Scale price (for example while contract terms are
 * revised), set SCALE_STARTING_PRICE_USD to null: every surface then shows
 * "Contact sales" instead, and the structured data drops the price.
 */

export const SCALE_STARTING_PRICE_USD: number | null = 999;

export type PlanKey = 'pilot' | 'scale' | 'enterprise';

export interface Plan {
  key: PlanKey;
  name: string;
  /** Short qualifier under the plan name. */
  tagline: string;
  /** Large price slot. */
  price: string;
  /** Small text after the price, e.g. "/ month". */
  priceSuffix: string;
  /** Line under the price. */
  priceNote: string;
  summary: string;
  features: string[];
  cta: { label: string; href: string };
  /** The plan the page recommends starting with. */
  recommended: boolean;
}

function scalePrice(): Pick<Plan, 'price' | 'priceSuffix' | 'priceNote'> {
  if (SCALE_STARTING_PRICE_USD === null) {
    return { price: 'Contact sales', priceSuffix: '', priceNote: 'Pricing based on monitoring scope' };
  }
  return {
    price: `From $${SCALE_STARTING_PRICE_USD.toLocaleString('en-US')}`,
    priceSuffix: '/ month',
    priceNote: 'Final pricing depends on monitoring scope',
  };
}

export const PLANS: readonly Plan[] = [
  {
    key: 'pilot',
    name: 'Pilot',
    tagline: 'Scoped evaluation',
    price: 'Tailored',
    priceSuffix: '',
    priceNote: 'Contact us to scope your evaluation',
    summary: 'Validate Decoda RWA Guard against your own infrastructure with a defined scope and guided onboarding.',
    features: [
      'Defined monitoring scope — 1 workspace, up to 5 monitored contracts',
      'Guided onboarding with the Decoda team',
      'Alerts, incident investigation and evidence workflows',
      'Recommend-only response: no production execution',
      'Feedback sessions and technical validation',
    ],
    cta: { label: 'Request a pilot', href: '/request-pilot?product=rwa_guard' },
    recommended: true,
  },
  {
    key: 'scale',
    name: 'Scale',
    tagline: 'Ongoing security operations',
    ...scalePrice(),
    summary: 'For teams moving beyond pilot evaluation to recurring security operations.',
    features: [
      'Defined limits — 3 workspaces, up to 25 monitored contracts',
      'Continuous monitoring, alerting and incident workflows',
      'Investigation workflows and incident playbooks',
      'Unlimited evidence packages and audit-ready exports',
      'Support scoped to your agreement',
    ],
    cta: { label: 'Talk to sales', href: '/contact' },
    recommended: false,
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    tagline: 'Institutional programs',
    price: 'Custom',
    priceSuffix: '',
    priceNote: 'Custom pricing',
    summary: 'For institutions with a broader monitoring scope and their own security and governance requirements.',
    features: [
      'Tailored workspaces and monitoring scope',
      'Advanced integrations, where supported',
      'Security and governance requirements reviewed with your team',
      'Custom onboarding and support arrangements',
    ],
    cta: { label: 'Contact sales', href: '/contact' },
    recommended: false,
  },
];

/** "Pilot: … Scale: … Enterprise: …" — for metadata descriptions. */
export const PRICING_SUMMARY = (() => {
  const scale = PLANS.find((plan) => plan.key === 'scale')!;
  const scaleText = SCALE_STARTING_PRICE_USD === null ? 'contact sales' : `${scale.price.toLowerCase()} per month`;
  return `Pilot: a scoped evaluation, by request. Scale: ${scaleText}. Enterprise: custom pricing.`;
})();

/** Stated under every plan comparison: how response authority works on all plans. */
export const EXECUTION_NOTE =
  'On every plan, Decoda recommends and your people authorize. Production execution is off by default and is enabled only for an Enterprise tenant through an explicit, audited agreement. Decoda never holds customer private keys.';

/** Rows of the plan comparison table, aligned with PLANS (pilot, scale, enterprise). */
export const COMPARISON: ReadonlyArray<{ label: string; values: [string, string, string] }> = [
  { label: 'Workspaces', values: ['1', '3', 'Tailored'] },
  { label: 'Monitored contracts', values: ['Up to 5', 'Up to 25', 'Tailored'] },
  { label: 'Networks', values: ['Supported EVM networks', 'Supported EVM networks', 'Scoped per agreement'] },
  { label: 'Threat and policy detection', values: ['✓', '✓', '✓'] },
  { label: 'Alerts and incident investigation', values: ['✓', '✓', '✓'] },
  { label: 'Incident playbooks', values: ['During evaluation', '✓', '✓'] },
  { label: 'Evidence packages', values: ['Up to 10', 'Unlimited', 'Unlimited'] },
  // Production execution is off on every plan by default (entitlements.py:
  // automatic_execution = False for pilot, scale and enterprise). It is enabled
  // only through an explicit, audited per-tenant override.
  { label: 'Production response execution', values: ['Recommend only', 'Recommend only', 'Only by explicit agreement'] },
  { label: 'Notifications', values: ['Webhook and Slack', 'Webhook and Slack', 'Advanced integrations, where supported'] },
  { label: 'Onboarding and support', values: ['Guided onboarding', 'Scoped to agreement', 'Custom arrangements'] },
];
