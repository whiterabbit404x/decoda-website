import Link from 'next/link';
import { IconArrowRight, IconEvidence, IconEyeLock, IconFingerprint, IconPolicy, IconRadar, IconApproval } from '@/components/company/icons';
import { RevealGroup } from '@/components/motion/reveal';
import { AmbientBackdrop } from '@/components/site/ui';
import { GUARD } from '@/lib/site/products';
import { GuardConsole } from './guard-console';
import styles from './home.module.css';

const VALUE = [
  { icon: IconRadar, text: 'Monitor risk.' },
  { icon: IconPolicy, text: 'Control operations.' },
  { icon: IconEvidence, text: 'Preserve evidence.' },
];

/**
 * Verifiable product principles, standing in for the customer-logo strip a
 * company with public references would show. Each is enforced in code:
 * read-only JSON-RPC and no customer keys (RWA Guard PILOT_EXECUTION_BOUNDARY),
 * human authorization on every plan (entitlements.py), Ed25519-signed evidence
 * packages (EVIDENCE_EXPORTS), one WorkOS identity across products (this repo).
 */
const PRINCIPLES = [
  { icon: IconEyeLock, title: 'Read-only monitoring', body: 'Guard reads chain activity. It never broadcasts transactions.' },
  { icon: IconApproval, title: 'People authorize', body: 'AI and policy recommend. Your team decides.' },
  { icon: IconEvidence, title: 'Verifiable evidence', body: 'Signed packages an auditor can check offline.' },
  { icon: IconFingerprint, title: 'One Decoda identity', body: 'Shared sign-in with MFA across products.' },
];

export function Hero() {
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <AmbientBackdrop indigo />
      <svg className={styles.heroLines} viewBox="0 0 1200 600" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path d="M-20 420 C 240 380, 360 300, 560 310 S 900 220, 1220 120" />
        <path d="M-20 520 C 260 470, 420 420, 640 430 S 960 360, 1220 300" />
      </svg>

      <div className={`container ${styles.heroInner}`}>
        <div className={styles.heroCopy}>
          <Link href={GUARD.href} className={styles.heroPill}>
            <span className={styles.heroPillDot} aria-hidden="true" />
            <span className={styles.heroPillName}>Decoda RWA Guard</span>
            <span className={styles.heroPillSep} aria-hidden="true" />
            <span>{GUARD.status.label}</span>
            <IconArrowRight size={14} />
          </Link>

          <h1 id="hero-title" className={styles.heroTitle}>
            <span className={styles.line} style={{ ['--line' as string]: 0 }}>
              <span>Secure the Future</span>
            </span>{' '}
            <span className={styles.line} style={{ ['--line' as string]: 1 }}>
              <span>
                of <span className={styles.accentText}>Tokenized Finance.</span>
              </span>
            </span>
          </h1>

          <p className={styles.heroLead}>
            Decoda builds security and operational infrastructure for institutions managing tokenized financial assets.
          </p>

          <p className={styles.valueLine}>
            {VALUE.map(({ icon: Icon, text }) => (
              <span key={text} className={styles.valueItem}>
                <Icon size={17} />
                {text}
              </span>
            ))}
          </p>

          <div className={styles.heroActions}>
            <Link href={GUARD.pilotHref} className="button-primary button-lg">
              Request Guard pilot
              <IconArrowRight size={17} />
            </Link>
            <Link href={GUARD.href} className="button-secondary button-lg">
              Explore Decoda Guard
            </Link>
          </div>
        </div>

        <div className={styles.heroVisual}>
          <GuardConsole />
        </div>
      </div>

      <div className="container">
        <RevealGroup as="ul" className={styles.principles} stagger={70} aria-label="Product principles">
          {PRINCIPLES.map(({ icon: Icon, title, body }) => (
            <li key={title} className={styles.principle}>
              <span className={styles.principleIcon}>
                <Icon size={18} />
              </span>
              <span>
                <strong>{title}</strong>
                <span>{body}</span>
              </span>
            </li>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
