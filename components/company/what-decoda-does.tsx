import { IconAnalytics, IconArchitecture, IconTeam } from './icons';
import { RevealGroup, SectionReveal } from './section-reveal';
import styles from './company.module.css';

/**
 * Three capability pillars, each stated as the outcome an institution gets
 * rather than as a feature list. Scoped deliberately to what Decoda builds —
 * no training, certification, or standing advisory claims.
 */
const capabilities = [
  {
    icon: IconArchitecture,
    title: 'Operational security architecture',
    body: 'Design the monitoring, policy, response, and evidence controls that sit around digital-financial infrastructure, so security is part of how the system operates rather than a layer added afterwards.',
  },
  {
    icon: IconAnalytics,
    title: 'Risk intelligence',
    body: 'Turn blockchain, operational, and infrastructure signals into security context a team can act on — what changed, what it affects, and what it warrants.',
  },
  {
    icon: IconTeam,
    title: 'Institutional rollout support',
    body: 'Help teams introduce digital-asset systems with clearer controls, defined ownership, and the operational discipline institutional programs are held to.',
  },
];

export function WhatDecodaDoes() {
  return (
    <section className={styles.section} aria-labelledby="what-decoda-does">
      <div className="container">
        <SectionReveal className={styles.sectionHead}>
          <p className={styles.eyebrow}>What Decoda does</p>
          <h2 id="what-decoda-does" className={styles.sectionTitle}>
            The security layer between blockchain infrastructure and institutional trust.
          </h2>
          <p className={styles.sectionLead}>
            Institutions adopting digital assets inherit a new operating surface. Decoda builds the
            controls, visibility, and evidence that surface needs to be run responsibly.
          </p>
        </SectionReveal>

        <RevealGroup className={styles.cardGrid3}>
          {capabilities.map(({ icon: Icon, title, body }) => (
            <article key={title} className={styles.card}>
              <span className={styles.cardIcon}>
                <Icon size={22} />
              </span>
              <h3 className={styles.cardTitle}>{title}</h3>
              <p className={styles.cardBody}>{body}</p>
            </article>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
