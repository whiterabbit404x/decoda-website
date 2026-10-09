import Link from 'next/link';
import {
  IconArrowRight,
  IconBuilding,
  IconEvidence,
  IconExternal,
  IconPolicy,
  IconRoles,
  IconToken,
  IconVault,
} from '@/components/company/icons';
import { BoundaryTable, FeatureGrid, Pipeline, StatusBanner, blockStyles as blocks } from '@/components/site/blocks';
import { CtaBand, PageHero, ProductStatus, SectionHeading, uiStyles as ui } from '@/components/site/ui';
import { pageMetadata } from '@/lib/site/metadata';
import { ASSETS, GUARD, VAULT } from '@/lib/site/products';

export const metadata = pageMetadata({
  title: 'Decoda Assets — Tokenization Infrastructure (Sandbox Prototype)',
  description:
    'Decoda Assets is a sandbox prototype for real-world asset tokenization workflows on public testnets, with synthetic assets and investors. No securities are offered or issued.',
  path: ASSETS.href,
});

/**
 * Verified against decoda-assets (README, docs/COMPLETION_REPORT.md): a
 * feature-complete testnet MVP verified against a local ecosystem sandbox, not
 * usable in production; every asset and investor is synthetic; blockchain
 * state changes are prepared by Assets and executed only through Vault.
 */
const SANDBOX = { label: 'In sandbox', tone: 'sandbox' as const };
const DIRECTION = { label: 'Direction', tone: 'planned' as const };

const CAPABILITIES = [
  {
    icon: IconBuilding,
    title: 'Asset origination workflows',
    body: 'Register a synthetic real-world asset and structure it before anything is tokenized.',
    tag: SANDBOX,
  },
  {
    icon: IconToken,
    title: 'Tokenization',
    body: 'Configure and issue the asset’s token on a public testnet, with issuance prepared for Vault to execute.',
    tag: SANDBOX,
  },
  {
    icon: IconRoles,
    title: 'Ownership and investor management',
    body: 'Synthetic investors and an ownership register, kept in step with the testnet ledger.',
    tag: SANDBOX,
  },
  {
    icon: IconPolicy,
    title: 'Eligibility and compliance workflows',
    body: 'Simulated eligibility checks gate who can hold and receive the asset. No real KYC is performed.',
    tag: SANDBOX,
  },
  {
    icon: IconEvidence,
    title: 'Reporting and administration',
    body: 'Distributions, simulated cash settlement, servicing, revaluation and redemption, with an operations view.',
    tag: SANDBOX,
  },
  {
    icon: IconVault,
    title: 'Integration with Decoda Vault',
    body: 'Assets never holds keys or signs. Every state change is prepared here and executed through Vault’s controls.',
    tag: DIRECTION,
  },
];

const LIFECYCLE = [
  { title: 'Register and structure', detail: 'A synthetic asset is recorded and structured.' },
  { title: 'Configure and issue', detail: 'Token issuance is prepared for Vault.', highlight: true },
  { title: 'Investors and eligibility', detail: 'Simulated eligibility and an ownership register.' },
  { title: 'Distribute and settle', detail: 'Simulated cash; testnet tokens.' },
  { title: 'Service and report', detail: 'Servicing, revaluation and reporting.' },
  { title: 'Redeem', detail: 'The lifecycle closes with redemption.' },
  { title: 'Monitor with Guard', detail: 'Security events reported to RWA Guard — roadmap.', highlight: true },
];

const IS = [
  'A research and demonstration environment for RWA tokenization workflows',
  'Run on public testnets with synthetic assets and investors',
  'Designed to execute only through Vault and report to Guard',
  'Available as sandbox access by request',
];

const IS_NOT = [
  'A securities offering, brokerage or exchange',
  'A custodian or holder of keys',
  'A regulated investment service or live asset issuance',
  'Usable in production today',
];

export default function AssetsPage() {
  return (
    <>
      <PageHero
        eyebrow="Decoda Assets"
        badge={<ProductStatus product={ASSETS} />}
        title="Decoda Assets"
        lead="Tokenization infrastructure for real-world assets — the full lifecycle, from origination to redemption, modelled in a testnet sandbox."
        actions={
          <>
            <Link href={ASSETS.pilotHref} className="button-primary button-lg">
              Request sandbox access
              <IconArrowRight size={17} />
            </Link>
            <a href={ASSETS.appUrl} className="button-secondary button-lg">
              {ASSETS.appHost}
              <IconExternal size={16} />
            </a>
          </>
        }
        aside={<Pipeline label="Decoda Assets lifecycle" steps={LIFECYCLE} />}
      />

      <div className="container">
        <StatusBanner product={ASSETS}>
          Decoda Assets is a sandbox prototype. Every asset and investor is synthetic and every network is a public testnet. No
          securities offering, brokerage, custody, exchange or investment services are provided.
        </StatusBanner>
      </div>

      <section className={ui.section} aria-labelledby="assets-capabilities">
        <div className="container">
          <SectionHeading
            id="assets-capabilities"
            eyebrow="Product direction"
            title="The operating layer for tokenized real-world assets."
            lead="Assets models how an institution would originate, issue, administer and redeem a tokenized asset — with execution delegated to Vault and security events reported to Guard."
          />
          <FeatureGrid items={CAPABILITIES} columns={3} />
        </div>
      </section>

      <section className={`${ui.section} ${ui.sectionSoft}`} aria-labelledby="assets-boundary">
        <div className="container">
          <SectionHeading id="assets-boundary" eyebrow="Boundaries" title="What Assets is — and is not — today." />
          <BoundaryTable allowedTitle="Decoda Assets is" refusedTitle="Decoda Assets is not" allowed={IS} refused={IS_NOT} />
          <p className={blocks.noteCenter}>
            Assets is designed to execute through <Link href={VAULT.href}>{VAULT.name}</Link> and to be monitored by{' '}
            <Link href={GUARD.href}>{GUARD.name}</Link> — the connected lifecycle on Decoda&rsquo;s roadmap.
          </p>
        </div>
      </section>

      <CtaBand
        title="Explore tokenization workflows in the sandbox."
        body="Sandbox access is available by request for teams designing tokenized-asset programs who want to see the full lifecycle end to end."
        primary={{ href: ASSETS.pilotHref, label: 'Request sandbox access' }}
        secondary={{ href: '/platform', label: 'See the ecosystem' }}
      />
    </>
  );
}
