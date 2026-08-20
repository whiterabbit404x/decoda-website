import { IconCheckCircle } from './icons';
import styles from './company.module.css';

const controls = [
  'Govern governance, wallets, issuers, and servicing workflows from one operating model.',
  'Reduce fragmented controls across legal entities, custodians, and on-chain systems.',
  'Give risk, compliance, and engineering teams one shared source of truth.',
];

export function WhyThisMatters() {
  return (
    <section className={styles.section} aria-labelledby="why-this-matters">
      <div className={styles.whyGrid}>
        <div>
          <p className={styles.eyebrow}>Why this matters</p>
          <h2 id="why-this-matters" className={styles.sectionTitle}>
            Blockchain financial infrastructure expands the blast radius of weak controls.
          </h2>
          <p className={styles.sectionLead}>
            In traditional finance, failures impact products, services, or single business lines. In
            blockchain financial systems, security failures can trigger downtime, regulatory
            scrutiny, and reputational loss across counterparties and investors.
          </p>
        </div>

        <div className={styles.controlPanel}>
          {controls.map((statement) => (
            <div key={statement} className={styles.controlItem}>
              <span className={styles.controlCheck}>
                <IconCheckCircle size={18} />
              </span>
              <p className={styles.controlText}>{statement}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
