import Link from 'next/link';
import { DecodaShield } from './logo';
import { IconArrowRight } from './icons';
import styles from './company.module.css';

export function CompanyCta() {
  return (
    <section className={`surface-dark ${styles.cta}`} aria-labelledby="company-cta">
      <div className={`container ${styles.ctaInner}`}>
        <span className={styles.ctaShield} aria-hidden="true">
          <DecodaShield size={64} strong />
        </span>
        <div className={styles.ctaText}>
          <h2 id="company-cta" className={styles.ctaTitle}>
            Build digital-finance infrastructure with security controls designed in from the start.
          </h2>
          <p className={styles.ctaBody}>
            Talk to the Decoda team about the controls, visibility, and evidence your digital asset
            program needs.
          </p>
        </div>
        <div className={styles.ctaActions}>
          <Link href="/contact" className="button-primary">
            Request a demo
            <IconArrowRight size={17} />
          </Link>
          <Link href="/solutions/rwa-security" className="button-secondary">
            Explore RWA Security
          </Link>
        </div>
      </div>
    </section>
  );
}
