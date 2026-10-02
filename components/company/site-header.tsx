import Link from 'next/link';
import { AccountAction } from './account-action';
import { DecodaLogo } from './logo';
import styles from './site-chrome.module.css';

const navItems = [
  { href: '/', label: 'Company' },
  { href: '/solutions/rwa-security', label: 'RWA Security' },
  { href: '/platform', label: 'Platform Vision' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/contact', label: 'Contact' },
];

export function SiteHeader() {
  return (
    <header className={`surface-dark ${styles.header}`}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand} aria-label="Decoda Security — home">
          <DecodaLogo className={styles.logo} size={32} />
        </Link>

        <nav className={styles.nav} aria-label="Primary">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className={styles.navLink}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className={styles.actions}>
          <AccountAction
            className={styles.signIn}
            launcherClassName={styles.signIn}
            requestClassName={`button-primary ${styles.demoButtonHeader}`}
          />

          {/* Disclosure-based mobile menu: native expanded/collapsed semantics
              and keyboard support, with no client JavaScript. */}
          <details className={styles.menu}>
            <summary className={styles.menuSummary} aria-label="Menu">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </summary>
            <nav className={styles.menuPanel} aria-label="Primary (mobile)">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href} className={styles.navLink}>
                  {item.label}
                </Link>
              ))}
              <AccountAction
                className={styles.navLink}
                launcherClassName={styles.navLink}
                requestClassName={`button-primary ${styles.menuCta}`}
              />
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
