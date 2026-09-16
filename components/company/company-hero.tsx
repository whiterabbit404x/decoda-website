import Link from 'next/link';
import { IconArrowRight } from './icons';
import { HeroSecurityGraphic } from './hero-security-graphic';
import styles from './company.module.css';

/**
 * The three operating disciplines the platform is built around. This replaces
 * the previous "24/7 / 3 / 1" tiles: those were counts of Decoda's own framing
 * rather than evidence a buyer can weigh, and a hero is the wrong place for a
 * number that cannot be substantiated. No metric is asserted here.
 */
const disciplines = ['Observe', 'Control', 'Prove'];

export function CompanyHero() {
  return (
    <section className={`surface-dark ${styles.hero}`} aria-labelledby="hero-title">
      <div className={`container ${styles.heroInner}`}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Security infrastructure for digital finance</p>
          <h1 id="hero-title" className={styles.heroTitle}>
            Security infrastructure for blockchain financial systems.
          </h1>
          <p className={styles.heroBody}>
            Decoda helps institutions launch and scale digital asset and real-world asset programs
            with the controls, visibility, and resilience required for modern financial
            infrastructure.
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

        <div className={styles.heroPanel}>
          <p className={styles.heroPanelHead}>Enterprise security by design</p>
          <HeroSecurityGraphic />
          <ul className={styles.heroDisciplines}>
            {disciplines.map((discipline) => (
              <li key={discipline}>{discipline}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
