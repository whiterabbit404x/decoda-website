import Link from 'next/link';
import { IconCommandCenter, IconCounterparty, IconOrchestration } from './icons';
import { IconArrowRight } from './icons';
import { RevealGroup, SectionReveal } from './section-reveal';
import styles from './company.module.css';

/**
 * Directional capability areas. Everything in this section is explicitly
 * labelled as future direction — badged per card and separated from the
 * "available now" panel above it — so nothing here can be read as a shipping
 * feature. No dates or commitments are implied.
 */
const directions = [
  {
    icon: IconOrchestration,
    title: 'Policy orchestration',
    body: 'Express institutional policy once and apply it consistently across systems, entities, and asset classes, with the exceptions recorded rather than lost.',
  },
  {
    icon: IconCounterparty,
    title: 'Counterparty and infrastructure risk',
    body: 'See the custodians, issuers, providers, and infrastructure a program depends on as one connected exposure picture instead of separate reviews.',
  },
  {
    icon: IconCommandCenter,
    title: 'Operational resilience',
    body: 'Give leadership a forward view of concentration, control maturity, and readiness to absorb disruption across digital-finance operations.',
  },
];

export function PlatformVision() {
  return (
    <section className={`${styles.section} ${styles.sectionAlt}`} aria-labelledby="platform-vision">
      <div className="container">
        <SectionReveal className={styles.sectionHead}>
          <p className={styles.eyebrow}>Platform vision</p>
          <h2 id="platform-vision" className={styles.sectionTitle}>
            Decoda is broader than one product — stated plainly.
          </h2>
          <p className={styles.sectionLead}>
            The company&apos;s direction extends across digital-finance security. The areas below
            are where that direction leads. They are not available today, and we would rather say
            so than let a roadmap read like a datasheet.
          </p>
        </SectionReveal>

        <SectionReveal className={styles.availableNow}>
          <div>
            <p className={styles.availableBadge}>Available now</p>
            <h3 className={styles.availableTitle}>Decoda RWA Guard</h3>
            <p className={styles.availableBody}>
              Security operations for tokenized financial infrastructure: monitoring, investigation,
              policy-controlled response, and verifiable evidence. This is the product you can
              evaluate today.
            </p>
          </div>
          <Link href="/solutions/rwa-security" className="button-secondary">
            Solution overview
            <IconArrowRight size={16} />
          </Link>
        </SectionReveal>

        <RevealGroup className={styles.visionGrid}>
          {directions.map(({ icon: Icon, title, body }) => (
            <article key={title} className={styles.visionCard}>
              <div className={styles.visionTop}>
                <span className={styles.visionIcon}>
                  <Icon size={22} />
                </span>
                <span className={styles.visionBadge}>Future direction</span>
              </div>
              <h3 className={styles.visionTitle}>{title}</h3>
              <p className={styles.visionBody}>{body}</p>
            </article>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
