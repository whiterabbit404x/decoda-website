import Link from 'next/link';
import { AccountAction, PrimaryAction } from './account-action';
import { DecodaLogo } from './logo';
import { MobileMenu, PrimaryNav } from './nav';
import styles from './site-chrome.module.css';

/**
 * Site header. Pages stay static: the account slots ("Sign in" / "Request
 * pilot", or the signed-in person's account / "Open launcher") are decided in
 * the browser by AccountAction / PrimaryAction, desktop first, then the same
 * two slots inside the mobile menu. tests/http/site-header.test.ts holds that
 * order and asserts no other header link points at those four destinations.
 */
export function SiteHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand} aria-label="Decoda Security — home">
          <DecodaLogo className={styles.logo} size={30} />
        </Link>

        <PrimaryNav />

        <div className={styles.actions}>
          <AccountAction className={styles.signIn} />
          <PrimaryAction className={`button-primary ${styles.headerCta}`} />
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
