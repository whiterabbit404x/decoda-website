/**
 * Decorative product illustrations — one distinct visual language per product.
 * Pure SVG/CSS, aria-hidden, no data. Motion is ambient and stops under
 * reduced motion.
 */
import styles from './art.module.css';

/** Guard: a monitoring radar with a sweep and one flagged signal. */
export function GuardArt({ className }: { className?: string }) {
  return (
    <div className={`${styles.radar} ${className ?? ''}`} aria-hidden="true">
      <div className={styles.radarSweep} />
      <svg viewBox="0 0 200 200" className={styles.radarSvg} focusable="false">
        <circle cx="100" cy="100" r="96" />
        <circle cx="100" cy="100" r="68" />
        <circle cx="100" cy="100" r="40" />
        <path d="M100 4v192M4 100h192" />
      </svg>
      <span className={styles.blip} style={{ left: '30%', top: '36%' }} />
      <span className={styles.blip} style={{ left: '64%', top: '70%', animationDelay: '-1.4s' }} />
      <span className={`${styles.blip} ${styles.blipAlert}`} style={{ left: '70%', top: '28%' }} />
      <span className={styles.radarCore}>
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" focusable="false">
          <path d="M12 3 20 6.5v5C20 16.5 16.5 20.5 12 22 7.5 20.5 4 16.5 4 11.5v-5L12 3Z" />
          <path d="m8.8 12.2 2.2 2.2 4.4-4.6" />
        </svg>
      </span>
    </div>
  );
}

/** Vault: an operation passing through layered approvals before signature. */
export function VaultArt({ className }: { className?: string }) {
  return (
    <div className={`${styles.stack} ${className ?? ''}`} aria-hidden="true">
      <div className={`${styles.layer} ${styles.layer3}`}>
        <span className={styles.layerLabel}>Simulation</span>
      </div>
      <div className={`${styles.layer} ${styles.layer2}`}>
        <span className={styles.layerLabel}>Policy</span>
      </div>
      <div className={`${styles.layer} ${styles.layer1}`}>
        <span className={styles.layerLabel}>Approvals</span>
        <span className={styles.quorum}>
          <span data-on="" />
          <span data-on="" />
          <span />
        </span>
      </div>
    </div>
  );
}

/** Assets: a real-world asset record becoming tokenized units. */
export function AssetsArt({ className }: { className?: string }) {
  return (
    <div className={`${styles.mint} ${className ?? ''}`} aria-hidden="true">
      <div className={styles.doc}>
        <span />
        <span />
        <span />
        <span />
      </div>
      <svg className={styles.mintArrow} viewBox="0 0 60 20" focusable="false">
        <path d="M2 10h50M44 4l8 6-8 6" />
      </svg>
      <div className={styles.coins}>
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
