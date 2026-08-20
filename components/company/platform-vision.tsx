import { IconCommandCenter, IconCounterparty, IconOrchestration } from './icons';
import styles from './company.module.css';

const roadmap = [
  {
    icon: IconOrchestration,
    title: 'Policy and control orchestration',
    body: 'Unify policies, controls, and exceptions across systems, entities, and asset classes.',
    items: ['Central policy library', 'Control mapping & assignments', 'Automated attestation workflows'],
  },
  {
    icon: IconCounterparty,
    title: 'Counterparty risk visibility',
    body: 'Continuously assess counterparties, custodians, issuers, and service providers.',
    items: ['Counterparty scoring', 'Concentration monitoring', 'Document & diligence tracking'],
  },
  {
    icon: IconCommandCenter,
    title: 'Executive resilience command center',
    body: 'Executive-level situational awareness across risk, incidents, and resilience.',
    items: ['Executive dashboards', 'Scenario & impact modeling', 'Resilience posture tracking'],
  },
];

export function PlatformVision() {
  return (
    <section className={styles.section} aria-labelledby="roadmap-preview">
      <div className={styles.sectionHead}>
        <p className={styles.eyebrow}>Roadmap preview</p>
        <h2 id="roadmap-preview" className={styles.sectionTitle}>
          Decoda&apos;s broader platform vision is emerging in phases.
        </h2>
        <p className={styles.sectionLead}>
          RWA Security is the flagship production platform today. Additional company-level security
          capabilities may expand the Decoda platform over time.
        </p>
      </div>

      <div className={styles.roadmapGrid}>
        {roadmap.map(({ icon: Icon, title, body, items }) => (
          <article key={title} className={styles.roadmapCard}>
            <span className={styles.roadmapBadge}>Roadmap</span>
            <span className={styles.roadmapIcon}>
              <Icon size={24} />
            </span>
            <h3 className={styles.roadmapTitle}>{title}</h3>
            <p className={styles.roadmapBody}>{body}</p>
            <ul className={styles.roadmapList}>
              {items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
