import Link from 'next/link';
import { DecodaShield } from './logo';
import { IconArrowRight } from './icons';
import styles from './company.module.css';

export function CompanyCta() {
  return (
    <section className={styles.cta} aria-labelledby="company-cta">
      <div className={styles.ctaInner}>
        <span className={styles.ctaShield} aria-hidden="true">
          <DecodaShield size={92} strong />
        </span>
        <div className={styles.ctaText}>
          <h2 id="company-cta" className={styles.ctaTitle}>
            Position Decoda as the trusted security partner behind digital finance growth.
          </h2>
          <p className={styles.ctaBody}>
            From day one, we build security into blockchain financial systems so institutions can
            innovate with confidence and scale with trust.
          </p>
        </div>
        <div className={styles.ctaActions}>
          <Link href="/contact" className="button-primary">
            Request a demo
            <IconArrowRight size={17} />
          </Link>
          <Link href="/platform" className="button-secondary">
            See platform vision
          </Link>
        </div>
      </div>
    </section>
  );
}
