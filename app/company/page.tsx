import Link from 'next/link';
import { IconArrowRight, IconEvidence, IconFlask, IconMail, IconTarget, IconWorkflow } from '@/components/company/icons';
import { FeatureGrid } from '@/components/site/blocks';
import { CtaBand, PageHero, ProductStatus, SectionHeading, uiStyles as ui } from '@/components/site/ui';
import { pageMetadata } from '@/lib/site/metadata';
import { SITE_PRODUCTS, GUARD } from '@/lib/site/products';
import { CONTACT_EMAIL, POSITIONING } from '@/lib/site/site';
import styles from '@/components/site/pages.module.css';

export const metadata = pageMetadata({
  title: 'Company',
  description: `Decoda Security builds ${POSITIONING.charAt(0).toLowerCase()}${POSITIONING.slice(1)} Learn how we work and where each product stands today.`,
  path: '/company',
});

const HOW_WE_WORK = [
  {
    icon: IconFlask,
    title: 'Pilot-led',
    body: 'We work with institutional teams through scoped pilots, so the product is shaped by real operating requirements.',
  },
  {
    icon: IconTarget,
    title: 'Truthful by default',
    body: 'We separate what ships from what is planned, and we do not publish customer names, metrics or certifications we cannot support.',
  },
  {
    icon: IconWorkflow,
    title: 'Human authority, by design',
    body: 'Our products recommend and record. Decisions — and keys — stay with the people and signers you authorize.',
  },
  {
    icon: IconEvidence,
    title: 'Evidence first',
    body: 'Every important decision should leave a record that an auditor can verify independently.',
  },
];

export default function CompanyPage() {
  return (
    <>
      <PageHero
        eyebrow="Company"
        title="Building the security layer for tokenized finance."
        lead="Decoda Security builds security and operational infrastructure for institutions managing tokenized financial assets. We start where the risk is most concrete — monitoring, investigation and evidence — with Decoda RWA Guard."
        actions={
          <>
            <Link href="/contact" className="button-primary button-lg">
              Talk to the team
              <IconArrowRight size={17} />
            </Link>
            <Link href={GUARD.href} className="button-secondary button-lg">
              Explore Decoda Guard
            </Link>
          </>
        }
      />

      <section className={`${ui.section} ${ui.sectionSoft}`} aria-labelledby="mission-title">
        <div className="container">
          <div className={styles.mission}>
            <p className="eyebrow">Why we exist</p>
            <h2 id="mission-title" className={styles.missionQuote}>
              A tokenized asset can be perfectly valid on-chain and still move without the authority an institution requires. We
              build the controls, visibility and evidence that close that gap.
            </h2>
          </div>
        </div>
      </section>

      <section className={ui.section} aria-labelledby="how-title">
        <div className="container">
          <SectionHeading id="how-title" eyebrow="How we work" title="Principles we hold ourselves to." />
          <FeatureGrid items={HOW_WE_WORK} columns={4} />
        </div>
      </section>

      <section className={`${ui.section} ${ui.sectionSoft}`} aria-labelledby="today-title">
        <div className="container">
          <SectionHeading
            id="today-title"
            eyebrow="Where we are today"
            title="One product in pilot. Two on the roadmap."
            lead="Decoda RWA Guard is our flagship and our commercial focus. Decoda Vault and Decoda Assets are earlier-stage products that run on public testnets."
          />
          <ul className={styles.productRows}>
            {SITE_PRODUCTS.map((product) => (
              <li key={product.key}>
                <div>
                  <h3>
                    <Link href={product.href}>{product.name}</Link>
                  </h3>
                  <p>{product.summary}</p>
                </div>
                <ProductStatus product={product} />
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={ui.section} aria-labelledby="contact-title">
        <div className="container">
          <div className={styles.contactStrip}>
            <div>
              <p className="eyebrow">Get in touch</p>
              <h2 id="contact-title" className={ui.title}>
                Customers, partners, press and investors.
              </h2>
            </div>
            <div className={styles.contactActions}>
              <a href={`mailto:${CONTACT_EMAIL}`} className="button-secondary button-lg">
                <IconMail size={17} />
                {CONTACT_EMAIL}
              </a>
              <Link href="/contact" className="button-primary button-lg">
                Contact form
                <IconArrowRight size={17} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <CtaBand
        title="Build Safer Tokenized Finance with Decoda."
        body="Explore a scoped security pilot and help shape the next generation of institutional digital asset infrastructure."
        primary={{ href: '/request-pilot', label: 'Request a pilot' }}
        secondary={{ href: '/platform', label: 'Explore the platform' }}
      />
    </>
  );
}
