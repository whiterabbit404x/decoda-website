import Link from 'next/link';
import {
  IconApproval,
  IconArrowRight,
  IconBuilding,
  IconEvidence,
  IconFingerprint,
  IconLayers,
  IconLock,
  IconTarget,
  IconWorkflow,
} from '@/components/company/icons';
import { Ecosystem } from '@/components/home/ecosystem';
import { FeatureGrid } from '@/components/site/blocks';
import { CtaBand, PageHero, ProductStatus, SectionHeading, uiStyles as ui } from '@/components/site/ui';
import { pageMetadata } from '@/lib/site/metadata';
import { GUARD, SITE_PRODUCTS } from '@/lib/site/products';
import styles from '@/components/site/pages.module.css';

export const metadata = pageMetadata({
  title: 'Platform — The Decoda Ecosystem',
  description:
    'One Decoda identity and organization model across Decoda RWA Guard (available for pilot evaluation), Decoda Vault (in development, testnet) and Decoda Assets (sandbox prototype).',
  path: '/platform',
});

/** The shared platform layer implemented in this repository (docs/identity/MIGRATION_PLAN.md). */
const FOUNDATION = [
  {
    icon: IconFingerprint,
    title: 'One Decoda account',
    body: 'A single identity across products, with multi-factor authentication and support for organization SSO.',
  },
  {
    icon: IconBuilding,
    title: 'Organization-level access',
    body: 'Which products an organization can use is decided centrally by its Decoda agreement, through one entitlement model the products share.',
  },
  {
    icon: IconLayers,
    title: 'One product launcher',
    body: 'Signed-in teams see every product their organization is enabled for, and open each one without signing in again.',
  },
  {
    icon: IconWorkflow,
    title: 'Reviewed, invite-only onboarding',
    body: 'Pilot requests are reviewed by the Decoda team. Nothing is provisioned automatically and there is no public sign-up.',
  },
];

const PRINCIPLES = [
  {
    icon: IconApproval,
    title: 'AI recommends. Policy decides. People authorize.',
    body: 'Authority is split on purpose, and no model can approve or execute an action on its own.',
  },
  {
    icon: IconLock,
    title: 'Decoda never holds your keys.',
    body: 'Signing stays with your own signers and wallets. Our products observe, prepare and record.',
  },
  {
    icon: IconEvidence,
    title: 'Evidence over assertion.',
    body: 'Decisions leave signed, verifiable records that stand up without trusting a dashboard badge.',
  },
  {
    icon: IconTarget,
    title: 'Truthful status, always.',
    body: 'Missing data is shown as missing, never as safe — and roadmap is labelled as roadmap.',
  },
];

const TODAY: Record<string, string> = {
  rwa_guard: 'Scoped pilot evaluation, by request',
  vault: 'Testnet pilots, by request',
  assets: 'Sandbox access, by request',
};

export default function PlatformPage() {
  return (
    <>
      <PageHero
        eyebrow="Platform"
        title="One platform for tokenized-asset security and operations."
        lead="Decoda's products share one identity, one organization model and one set of principles — so security can travel with an asset through its whole lifecycle."
        actions={
          <>
            <Link href={GUARD.pilotHref} className="button-primary button-lg">
              Request Guard pilot
              <IconArrowRight size={17} />
            </Link>
            <Link href="#ecosystem" className="button-secondary button-lg">
              See how the products connect
            </Link>
          </>
        }
        aside={
          <div className={styles.statusCard}>
            <p className={styles.statusCardTitle}>Where each product is today</p>
            <ul>
              {SITE_PRODUCTS.map((product) => (
                <li key={product.key}>
                  <div>
                    <Link href={product.href}>{product.name}</Link>
                    <span>{TODAY[product.key]}</span>
                  </div>
                  <ProductStatus product={product} size="sm" />
                </li>
              ))}
            </ul>
          </div>
        }
      />

      <Ecosystem headingId="platform-ecosystem-title" />

      <section className={`${ui.section} ${ui.sectionSoft}`} aria-labelledby="foundation-title">
        <div className="container">
          <SectionHeading
            id="foundation-title"
            eyebrow="Shared foundation"
            title="Built on one identity and one organization model."
            lead="One identity and one entitlement model, designed to be shared by every Decoda product: how teams sign in, how access is granted, and how each product decides who can use it."
          />
          <FeatureGrid items={FOUNDATION} columns={4} />
        </div>
      </section>

      <section className={ui.section} aria-labelledby="principles-title">
        <div className="container">
          <SectionHeading id="principles-title" eyebrow="Principles" title="The rules every Decoda product follows." />
          <FeatureGrid items={PRINCIPLES} columns={2} />
        </div>
      </section>

      <CtaBand
        title="Start where the risk is most concrete."
        body="Decoda RWA Guard is available for pilot evaluation today. Vault and Assets testnet access is available by request."
        primary={{ href: '/request-pilot', label: 'Request a pilot' }}
        secondary={{ href: '/pricing', label: 'View pricing' }}
      />
    </>
  );
}
