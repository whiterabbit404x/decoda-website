import styles from './platform.module.css';

/** Shown when the platform cannot answer safely (configuration or database). Grants nothing. */
export function PlatformUnavailable() {
  return (
    <div className="content-stack">
      <div className={styles.page}>
        <section className={styles.panel} role="alert">
          <p className="eyebrow">Decoda</p>
          <h2>Decoda is temporarily unavailable</h2>
          <p>
            We couldn&rsquo;t load your organization and product access, so nothing is shown rather than something inaccurate.
            Try again in a few minutes, or contact <a href="mailto:hello@decodasecurity.com">hello@decodasecurity.com</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
