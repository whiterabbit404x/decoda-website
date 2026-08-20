import Link from 'next/link';
import { DecodaLogo } from './logo';
import { IconArrowRight } from './icons';
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
    <header className={styles.header}>
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
          <Link href="/contact" className={`button-primary ${styles.demoButtonHeader}`}>
            Request a demo
            <IconArrowRight size={16} />
          </Link>

          <details className={styles.menu}>
            <summary className={styles.menuSummary} aria-label="Open menu">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </summary>
            <div className={styles.menuPanel}>
              {navItems.map((item) => (
                <Link key={item.href} href={item.href} className={styles.navLink}>
                  {item.label}
                </Link>
              ))}
              <Link href="/contact" className={`button-primary ${styles.menuCta}`}>
                Request a demo
                <IconArrowRight size={16} />
              </Link>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
