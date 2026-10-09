import { IconCheck, IconEvidence, IconRadar, IconWorkflow, IconShield } from '@/components/company/icons';
import { Reveal, RevealGroup } from '@/components/motion/reveal';
import { SectionHeading, uiStyles as ui } from '@/components/site/ui';
import styles from './home.module.css';

/**
 * Differentiation without disparagement: each established approach is
 * described by what it is designed for and what it *can* leave open — never
 * as categorically lacking a capability.
 */
const APPROACHES = [
  {
    icon: IconEvidence,
    name: 'Smart contract audits',
    designedFor: 'Reviewing code before it is deployed.',
    gap: 'Activity after launch — role changes, upgrades and day-to-day operations that a code review does not observe.',
  },
  {
    icon: IconRadar,
    name: 'Transaction-only monitoring',
    designedFor: 'Flagging on-chain patterns as they happen.',
    gap: 'Whether an action was authorized internally, and what the organization decided to do about it.',
  },
  {
    icon: IconWorkflow,
    name: 'Standalone incident-response tools',
    designedFor: 'Coordinating people once an incident is declared.',
    gap: 'The link back to on-chain evidence and to the policy that applied at the time.',
  },
];

const DECODA = [
  'Monitors ongoing activity across your registered scope',
  'Investigates with on-chain and organizational context together',
  'Routes every response through deterministic policy and human approval',
  'Preserves signed, verifiable evidence of what was decided',
];

export function WhyDecoda() {
  return (
    <section id="why-decoda" className={`${ui.section} ${ui.sectionSoft}`} aria-labelledby="why-title">
      <div className="container">
        <SectionHeading
          id="why-title"
          eyebrow="Why Decoda"
          title="Point-in-time checks leave the operating gap open."
          lead="Audits, transaction monitoring and incident tooling each solve a real problem. Decoda is designed for the layer between them: ongoing operations, judged against your policies, with evidence of every decision."
        />

        <div className={styles.whyGrid}>
          <RevealGroup as="ul" className={styles.whyList} stagger={90}>
            {APPROACHES.map(({ icon: Icon, name, designedFor, gap }) => (
              <li key={name} className={styles.whyCard}>
                <div className={styles.whyCardHead}>
                  <span className={styles.whyIcon}>
                    <Icon size={18} />
                  </span>
                  <h3>{name}</h3>
                </div>
                <dl className={styles.whyDl}>
                  <div>
                    <dt>Designed for</dt>
                    <dd>{designedFor}</dd>
                  </div>
                  <div>
                    <dt>Can leave open</dt>
                    <dd>{gap}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </RevealGroup>

          <Reveal variant="scale" delay={200} className={`surface-dark ${styles.whyDecoda}`}>
            <div className={styles.whyDecodaGlow} aria-hidden="true" />
            <div className={styles.whyCardHead}>
              <span className={`${styles.whyIcon} ${styles.whyIconAccent}`}>
                <IconShield size={18} />
              </span>
              <h3>Decoda&rsquo;s operational approach</h3>
            </div>
            <p className={styles.whyDecodaLead}>Designed for the security of tokenized-asset operations, from first signal to final evidence.</p>
            <ul className={styles.whyChecks}>
              {DECODA.map((item) => (
                <li key={item}>
                  <span>
                    <IconCheck size={14} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <p className={styles.whyFoot}>Decoda complements code audits and existing security tooling — it does not replace them.</p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
