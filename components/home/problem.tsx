import { IconAlert, IconCheck, IconEvidence, IconPolicy, IconQuestion, IconSettings, IconTransfer, IconUserKey } from '@/components/company/icons';
import { Reveal, RevealGroup } from '@/components/motion/reveal';
import { IllustrativeTag, uiStyles as ui } from '@/components/site/ui';
import styles from './home.module.css';

const VALID = ['Signature verified', 'Executed without revert', 'Finalized on-chain'];
const UNKNOWN = ['Approved by the required people?', 'Within operational policy and limits?', 'Expected by treasury operations?'];

/**
 * The institutional risk areas. Deliberately free of loss figures or incident
 * counts: the case rests on how on-chain validity differs from authorization.
 */
const RISKS = [
  {
    icon: IconUserKey,
    title: 'Privileged access abuse',
    body: 'Admin keys and privileged roles can be used in perfectly valid transactions while acting outside the authority they were granted.',
  },
  {
    icon: IconSettings,
    title: 'Unauthorized administrative changes',
    body: 'Role grants, upgrades, pauses and parameter changes can take effect without the approvals your governance requires.',
  },
  {
    icon: IconTransfer,
    title: 'Suspicious asset transfers',
    body: 'Mints, burns and transfers can settle exactly as written and still fall outside expected operations.',
  },
  {
    icon: IconPolicy,
    title: 'Operational policy violations',
    body: 'Limits, allowlists and change windows live in policy documents — not in the contract that executes the transaction.',
  },
  {
    icon: IconEvidence,
    title: 'Investigation and evidence gaps',
    body: 'After an incident, teams must reconstruct what happened and who decided what — and then show it to auditors and oversight.',
  },
];

export function Problem() {
  return (
    <section id="problem" className={`${ui.section} ${ui.sectionSoft}`} aria-labelledby="problem-title">
      <div className="container">
        <div className={styles.problemGrid}>
          <Reveal className={styles.problemCopy}>
            <p className="eyebrow">The problem</p>
            <h2 id="problem-title" className={ui.title}>
              Blockchain Validity Doesn&rsquo;t Guarantee Operational Authorization.
            </h2>
            <p className={ui.lead}>
              A transaction can be correctly signed, executed and final — and still violate the approvals, operational policies
              and risk limits an institution runs under. The chain verifies the transaction. It cannot verify your authority.
            </p>
            <p className={styles.problemNote}>
              Tokenized assets settle continuously and cross more internal boundaries than the systems around them. Security
              teams need to see what changed, judge it against policy, and show what was decided.
            </p>
          </Reveal>

          <Reveal variant="scale" className={styles.validity} delay={120}>
            <div className={styles.validityHead}>
              <span className="mono">Sample admin transaction</span>
              <IllustrativeTag>Illustration</IllustrativeTag>
            </div>
            <div className={styles.validityBlock}>
              <p className={styles.validityLabel}>Valid on-chain</p>
              <ul className={styles.validityList}>
                {VALID.map((item) => (
                  <li key={item} data-kind="ok">
                    <span className={styles.validityIcon}>
                      <IconCheck size={14} />
                    </span>
                    {item}
                    <span className={styles.validityState}>Yes</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className={styles.validityDivider}>
              <span>But was it authorized?</span>
            </div>
            <div className={styles.validityBlock}>
              <p className={styles.validityLabel}>Authorized by your institution</p>
              <ul className={styles.validityList}>
                {UNKNOWN.map((item) => (
                  <li key={item} data-kind="unknown">
                    <span className={styles.validityIcon}>
                      <IconQuestion size={14} />
                    </span>
                    {item}
                    <span className={styles.validityState}>Unknown</span>
                  </li>
                ))}
              </ul>
            </div>
            <p className={styles.validityFoot}>
              <IconAlert size={14} />
              The ledger records what happened — not whether it should have.
            </p>
          </Reveal>
        </div>

        <RevealGroup as="ul" className={styles.riskGrid} stagger={70}>
          {RISKS.map(({ icon: Icon, title, body }) => (
            <li key={title} className={styles.riskCard}>
              <span className={styles.riskIcon}>
                <Icon size={20} />
              </span>
              <h3>{title}</h3>
              <p>{body}</p>
            </li>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
