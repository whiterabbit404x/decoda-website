import { IconAnalytics, IconArchitecture, IconTeam } from './icons';
import styles from './company.module.css';

const capabilities = [
  {
    icon: IconArchitecture,
    title: 'Operational security architecture',
    body: 'We design and implement security frameworks that align with institutional processes and regulatory expectations.',
  },
  {
    icon: IconAnalytics,
    title: 'Risk intelligence for digital finance',
    body: 'Detect, prioritize, and contextualize risks across on-chain activity, counterparties, and operational workflows.',
  },
  {
    icon: IconTeam,
    title: 'Institutional-grade rollout support',
    body: 'We help institutions adopt security with structured onboarding, training, and ongoing advisory support.',
  },
];

export function WhatDecodaDoes() {
  return (
    <section className={styles.section} aria-labelledby="what-decoda-does">
      <div className={styles.sectionHead}>
        <p className={styles.eyebrow}>What Decoda does</p>
        <h2 id="what-decoda-does" className={styles.sectionTitle}>
          Builds the security layer between blockchain innovation and institutional trust.
        </h2>
      </div>
      <div className={styles.cardGrid3}>
        {capabilities.map(({ icon: Icon, title, body }) => (
          <article key={title} className={styles.card}>
            <span className={styles.cardIcon}>
              <Icon size={24} />
            </span>
            <h3 className={styles.cardTitle}>{title}</h3>
            <p className={styles.cardBody}>{body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
