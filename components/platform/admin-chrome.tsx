import Link from 'next/link';
import type { ReactNode } from 'react';
import styles from './platform.module.css';

const NAV = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/pilot-requests', label: 'Pilot requests' },
  { href: '/admin/organizations', label: 'Organizations' },
  { href: '/admin/audit', label: 'Audit trail' },
];

export function AdminFrame({ current, title, description, children }: { current: string; title: string; description?: string; children: ReactNode }) {
  return (
    <div className="content-stack">
      <div className={styles.page}>
        <header className={styles.pageHeader}>
          <div>
            <p className="eyebrow">Decoda platform admin</p>
            <h1>{title}</h1>
            {description ? <p>{description}</p> : null}
          </div>
          <nav className={styles.adminNav} aria-label="Platform admin">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} aria-current={item.href === current ? 'page' : undefined}>
                {item.label}
              </Link>
            ))}
            <Link href="/launcher">Products</Link>
          </nav>
        </header>
        {children}
      </div>
    </div>
  );
}

export function AdminForbidden() {
  return (
    <div className="content-stack">
      <div className={styles.page}>
        <section className={styles.panel} role="alert">
          <p className="eyebrow">Decoda platform admin</p>
          <h2>You don&rsquo;t have access to this page</h2>
          <p>
            This area is limited to Decoda platform administrators with the required permission. The attempt has been recorded.
          </p>
          <p style={{ marginTop: 14 }}>
            <Link className={styles.linkButton} href="/launcher">
              Back to your products
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}

export function AdminUnavailable() {
  return (
    <div className="content-stack">
      <div className={styles.page}>
        <section className={styles.panel} role="alert">
          <p className="eyebrow">Decoda platform admin</p>
          <h2>The admin console is unavailable</h2>
          <p>The platform could not be reached safely, so nothing is shown. Try again shortly.</p>
        </section>
      </div>
    </div>
  );
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC';
}
