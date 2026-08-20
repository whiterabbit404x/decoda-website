import Link from 'next/link';
import { IconArrowRight, IconFlagship, IconPillars, IconShieldPulse } from './icons';
import styles from './company.module.css';

const stats = [
  { icon: IconShieldPulse, value: '24/7', label: 'security monitoring mindset' },
  { icon: IconPillars, value: '3', label: 'core pillars: policy, posture, response' },
  { icon: IconFlagship, value: '1', label: 'flagship solution live now' },
];

/** Decorative network/chip motif under the enterprise panel — pure SVG, no data. */
function NetworkVisual() {
  return (
    <svg className={styles.panelVisual} viewBox="0 0 320 92" fill="none" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      <g stroke="currentColor" strokeWidth="1" opacity="0.5">
        <path d="M40 20 160 46 40 72M280 20 160 46 280 72M160 8v76M100 14v64M220 14v64" />
      </g>
      <g fill="currentColor">
        {[
          [40, 20], [40, 72], [280, 20], [280, 72], [100, 14], [100, 78], [220, 14], [220, 78], [160, 8], [160, 84],
        ].map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.6" opacity="0.85" />
        ))}
      </g>
      <rect x="146" y="32" width="28" height="28" rx="6" fill="rgba(37,99,235,0.35)" stroke="currentColor" strokeWidth="1.2" />
      <rect x="153" y="39" width="14" height="14" rx="2" fill="currentColor" opacity="0.9" />
    </svg>
  );
}

export function CompanyHero() {
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={styles.heroInner}>
        <div>
          <p className={styles.eyebrow}>Security infrastructure for digital finance</p>
          <h1 id="hero-title" className={styles.heroTitle}>
            Security infrastructure for blockchain financial systems.
          </h1>
          <p className={styles.heroBody}>
            Decoda helps institutions launch and scale digital asset and real-world asset programs
            with the controls, visibility, and resilience that modern financial infrastructure
            demands.
          </p>
          <div className={styles.heroActions}>
            <Link href="/solutions/rwa-security" className="button-primary">
              Explore RWA Security
              <IconArrowRight size={17} />
            </Link>
            <Link href="/contact" className="button-secondary">
              Request a demo
            </Link>
          </div>
        </div>

        <div className={styles.panel}>
          <p className={styles.panelHead}>Enterprise security by design</p>
          <div className={styles.panelStats}>
            {stats.map(({ icon: Icon, value, label }) => (
              <div key={value} className={styles.panelStat}>
                <Icon className={styles.panelStatIcon} size={22} />
                <span className={styles.panelStatValue}>{value}</span>
                <span className={styles.panelStatLabel}>{label}</span>
              </div>
            ))}
          </div>
          <NetworkVisual />
        </div>
      </div>
    </section>
  );
}
