import { IconCheckCircle } from './icons';
import { RevealGroup, SectionReveal } from './section-reveal';
import styles from './company.module.css';

/**
 * Executive framing of the institutional problem. Deliberately calm: the case
 * rests on how digital-asset operations differ structurally from traditional
 * ones, not on incident anecdotes or loss figures.
 */
const positions = [
  {
    title: 'Digital assets create operational risk, not only technology risk',
    body: 'Exposure runs through issuance, custody, servicing, and the people and processes that operate them — not just the code.',
  },
  {
    title: 'A valid transaction is not necessarily an authorized one',
    body: 'Blockchain validity confirms that an action was well formed. It says nothing about whether the institution intended or permitted it.',
  },
  {
    title: 'Security spans four layers at once',
    body: 'Smart contracts, infrastructure, governance, and operational controls are one surface. A gap in any of them is a gap in the whole program.',
  },
  {
    title: 'Oversight asks for policy and evidence, not alerts',
    body: 'Risk, audit, and regulatory functions need to see what was decided, by whom, under which control, and on what basis.',
  },
];

export function WhyThisMatters() {
  return (
    <section className={styles.section} aria-labelledby="why-this-matters">
      <div className="container">
        <div className={styles.whyGrid}>
          <SectionReveal>
            <p className={styles.eyebrow}>Why this matters</p>
            <h2 id="why-this-matters" className={styles.sectionTitle}>
              Blockchain correctness is not the same as institutional control.
            </h2>
            <p className={styles.sectionLead}>
              Digital asset programs settle quickly, run continuously, and cross more internal
              boundaries than the products they sit alongside. That combination changes what an
              institution has to be able to see, decide, and demonstrate — which is the problem
              Decoda is built around.
            </p>
          </SectionReveal>

          <RevealGroup className={styles.controlPanel}>
            {positions.map(({ title, body }) => (
              <div key={title} className={styles.controlItem}>
                <span className={styles.controlCheck}>
                  <IconCheckCircle size={18} />
                </span>
                <div>
                  <h3 className={styles.controlTitle}>{title}</h3>
                  <p className={styles.controlText}>{body}</p>
                </div>
              </div>
            ))}
          </RevealGroup>
        </div>
      </div>
    </section>
  );
}
