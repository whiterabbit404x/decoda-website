import Link from 'next/link';
import { LAUNCHER_LABELS, type LauncherState } from '@/lib/platform/products';
import type { LauncherProduct } from '@/lib/platform/launcher';
import styles from './platform.module.css';

const TONE: Record<LauncherState, string | undefined> = {
  open: 'open',
  pilot: 'pilot',
  not_enabled: undefined,
  coming_soon: undefined,
  suspended: 'danger',
  expired: 'warn',
};

export function StateBadge({ state }: { state: LauncherState }) {
  return (
    <span className={styles.badge} data-tone={TONE[state]}>
      {LAUNCHER_LABELS[state]}
    </span>
  );
}

export function ProductCard({ product }: { product: LauncherProduct }) {
  return (
    <article className={styles.productCard} data-state={product.state} aria-labelledby={`product-${product.product}`}>
      <div className={styles.productCardHead}>
        <h3 id={`product-${product.product}`}>{product.label}</h3>
        <StateBadge state={product.state} />
      </div>
      <p>{product.description}</p>
      {product.state === 'pilot' && product.expiresAt ? (
        <p className={styles.muted}>Pilot access until {new Date(product.expiresAt).toLocaleDateString('en-US', { dateStyle: 'medium' })}.</p>
      ) : null}
      <div className={styles.productCardAction}>
        {product.url ? (
          <a className="button-primary" href={product.url}>
            Open {product.label}
          </a>
        ) : product.requestAccessUrl ? (
          <Link className={styles.linkButton} href={product.requestAccessUrl}>
            Request access
          </Link>
        ) : (
          <span className={styles.disabledAction}>
            {product.state === 'coming_soon' ? 'Not yet available' : 'Contact your organization administrator'}
          </span>
        )}
      </div>
    </article>
  );
}
