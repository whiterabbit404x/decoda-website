import { Fragment } from 'react';
import {
  IconArrowRight,
  IconDetect,
  IconInvestigate,
  IconObserve,
  IconProve,
  IconRespond,
} from './icons';
import styles from './company.module.css';

const steps = [
  {
    icon: IconObserve,
    name: 'Observe',
    body: 'Continuously collect signals across on-chain activity, wallets, systems, and users.',
  },
  {
    icon: IconDetect,
    name: 'Detect',
    body: 'Identify anomalies, policy violations, and emerging risk patterns.',
  },
  {
    icon: IconInvestigate,
    name: 'Investigate',
    body: 'Triage alerts, analyze impact, and gather evidence in one workspace.',
  },
  {
    icon: IconRespond,
    name: 'Respond',
    body: 'Execute playbooks, take corrective action, and contain risk under policy controls.',
  },
  {
    icon: IconProve,
    name: 'Prove',
    body: 'Produce audit-ready evidence and reports for stakeholders.',
  },
];

export function SecurityLifecycle() {
  return (
    <section className={styles.section} aria-labelledby="how-it-works">
      <div className={styles.sectionHead}>
        <p className={styles.eyebrow}>How RWA Security works</p>
        <h2 id="how-it-works" className={styles.sectionTitle}>
          One operating lifecycle, from continuous signal to defensible proof.
        </h2>
      </div>

      <div className={styles.lifecycle}>
        {steps.map(({ icon: Icon, name, body }, index) => (
          <Fragment key={name}>
            <div className={styles.step}>
              <div className={styles.stepTop}>
                <span className={styles.stepIcon}>
                  <Icon size={20} />
                </span>
                <h3 className={styles.stepName}>{name}</h3>
              </div>
              <p className={styles.stepBody}>{body}</p>
            </div>
            {index < steps.length - 1 ? (
              <span className={styles.stepArrow} aria-hidden="true">
                <IconArrowRight size={20} />
              </span>
            ) : null}
          </Fragment>
        ))}
      </div>
    </section>
  );
}
