import Link from 'next/link';
import {
  IconApproval,
  IconArrowRight,
  IconEvidence,
  IconExternal,
  IconFlask,
  IconPolicy,
  IconRoles,
  IconSpark,
  IconTransfer,
  IconVault,
} from '@/components/company/icons';
import { BoundaryTable, FeatureGrid, Pipeline, StatusBanner, blockStyles as blocks } from '@/components/site/blocks';
import { CtaBand, PageHero, ProductStatus, SectionHeading, uiStyles as ui } from '@/components/site/ui';
import { pageMetadata } from '@/lib/site/metadata';
import { VAULT, GUARD } from '@/lib/site/products';

export const metadata = pageMetadata({
  title: 'Decoda Vault — Digital Asset Operations (In Development)',
  description:
    'Decoda Vault is digital asset operations infrastructure in development: transaction preparation, simulation, deterministic policy and multi-step approvals. Testnet only; not a custodian.',
  path: VAULT.href,
});

/**
 * Verified against decoda-vault (README, docs/POLICY_ENGINE.md,
 * docs/SHARED_IDENTITY.md). "In testnet MVP" marks what the MVP implements;
 * "Direction" marks intent only.
 */
const MVP = { label: 'In testnet MVP', tone: 'development' as const };
const DIRECTION = { label: 'Direction', tone: 'planned' as const };

const CAPABILITIES = [
  {
    icon: IconTransfer,
    title: 'Transaction preparation and simulation',
    body: 'Drafts can be previewed as a dry run. Simulation reports predicted balance, allowance and supply changes — and never authorizes execution.',
    tag: MVP,
  },
  {
    icon: IconPolicy,
    title: 'Policy enforcement and allowlists',
    body: 'A deterministic policy engine with destination and contract allowlists. A policy block is final: no role, flag or AI command overrides it.',
    tag: MVP,
  },
  {
    icon: IconApproval,
    title: 'Multi-step approvals',
    body: 'Approval quorums bound to the exact payload, with additional security review for higher-risk operations.',
    tag: MVP,
  },
  {
    icon: IconRoles,
    title: 'Role-based access controls',
    body: 'Product roles such as Treasury Operator, Approver, Security Reviewer, Signer and Auditor, with separation-of-duties rules.',
    tag: MVP,
  },
  {
    icon: IconEvidence,
    title: 'Audit trails',
    body: 'Every step of the control pipeline is a separate, audited state change in a hash-chained audit trail.',
    tag: MVP,
  },
  {
    icon: IconVault,
    title: 'Institutional wallet and treasury workflows',
    body: 'Wallet operations and treasury workflows for institutional and RWA teams, run on public testnets today.',
    tag: MVP,
  },
  {
    icon: IconSpark,
    title: 'AI-assisted workflows',
    body: 'AI that helps prepare and explain operations, while execution authority stays with policy and authorized signers.',
    tag: DIRECTION,
  },
  {
    icon: IconFlask,
    title: 'Guard risk evaluation',
    body: 'Security evaluation from Decoda RWA Guard as a step in the pipeline — part of the connected-ecosystem roadmap.',
    tag: DIRECTION,
  },
];

const PIPELINE = [
  { title: 'Draft', detail: 'Prepared by a treasury operator; previewable as a dry run.' },
  { title: 'Simulation', detail: 'Predicted effects of the exact payload. Never authorizes execution.' },
  { title: 'Policy evaluation', detail: 'Deterministic rules. A block is final.', highlight: true },
  { title: 'Security evaluation', detail: 'Additional review for higher-risk operations.' },
  { title: 'Approvals', detail: 'Quorum bound to the exact payload.', highlight: true },
  { title: 'Signature', detail: 'An authorized signer signs in their own wallet.' },
  { title: 'Broadcast and monitor', detail: 'Hash verified on chain; receipt monitored.' },
];

const IS = [
  'An operations and control layer for digital asset teams',
  'Testnet only, with sample organizations and data',
  'A place where AI can recommend and prepare — not execute',
  'Available for testnet pilots by request',
];

const IS_NOT = [
  'A custodian, broker-dealer, exchange or investment platform',
  'Holding, generating or receiving private keys',
  'Executing on mainnet or handling live customer funds',
  'Commercially available today',
];

export default function VaultPage() {
  return (
    <>
      <PageHero
        eyebrow="Decoda Vault"
        badge={<ProductStatus product={VAULT} />}
        title="Decoda Vault"
        lead="Digital asset operations infrastructure: prepare, simulate and approve operations under deterministic policy — before an authorized signer signs in their own wallet."
        actions={
          <>
            <Link href={VAULT.pilotHref} className="button-primary button-lg">
              Request testnet access
              <IconArrowRight size={17} />
            </Link>
            <a href={VAULT.appUrl} className="button-secondary button-lg">
              {VAULT.appHost}
              <IconExternal size={16} />
            </a>
          </>
        }
        aside={<Pipeline label="Decoda Vault control pipeline" steps={PIPELINE} />}
      />

      <div className="container">
        <StatusBanner product={VAULT}>
          Decoda Vault is in development and runs on public testnets only. It is not a custodian, never holds private keys, and
          contains no transaction-signing code. Features below describe the testnet MVP and the product direction.
        </StatusBanner>
      </div>

      <section className={ui.section} aria-labelledby="vault-capabilities">
        <div className="container">
          <SectionHeading
            id="vault-capabilities"
            eyebrow="Product direction"
            title="Operational control before anyone signs."
            lead="Every operation — transfer, allowance change, contract call, mint or burn — moves through the same audited control pipeline."
          />
          <FeatureGrid items={CAPABILITIES} columns={4} />
        </div>
      </section>

      <section className={`${ui.section} ${ui.sectionSoft}`} aria-labelledby="vault-boundary">
        <div className="container">
          <SectionHeading id="vault-boundary" eyebrow="Boundaries" title="What Vault is — and is not — today." />
          <BoundaryTable allowedTitle="Decoda Vault is" refusedTitle="Decoda Vault is not" allowed={IS} refused={IS_NOT} />
          <p className={blocks.noteCenter}>
            Vault is designed to work alongside <Link href={GUARD.href}>{GUARD.name}</Link> as part of the Decoda ecosystem
            roadmap.
          </p>
        </div>
      </section>

      <CtaBand
        title="Shape Decoda Vault with us."
        body="Testnet pilots are available by request for teams that want to influence how institutional digital asset operations are controlled."
        primary={{ href: VAULT.pilotHref, label: 'Request testnet access' }}
        secondary={{ href: '/platform', label: 'See the ecosystem' }}
      />
    </>
  );
}
