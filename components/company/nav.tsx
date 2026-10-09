'use client';

/**
 * Header navigation: the desktop links with the Ecosystem dropdown, and the
 * mobile menu.
 *
 * Both menus are native <details> disclosures, so they open, close and are
 * announced correctly with no JavaScript at all (as the previous header was).
 * JavaScript adds what a disclosure lacks: Escape and outside-click to close,
 * closing after navigation, a closing animation, hover intent on desktop, and
 * a scroll lock behind the full-screen mobile sheet.
 *
 * The account actions inside the mobile menu are the same AccountAction /
 * PrimaryAction slots the desktop header uses, so signed-in visitors get their
 * account and the launcher here too.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { SITE_PRODUCTS, GUARD, VAULT, ASSETS, type SiteProduct } from '@/lib/site/products';
import { AccountAction, PrimaryAction } from './account-action';
import { IconArrowRight, IconChevronDown, IconLayers, IconToken, IconVault, IconShield } from './icons';
import styles from './site-chrome.module.css';

const CLOSE_MS = 170;

export const NAV_LINKS = [
  { href: '/platform', label: 'Platform' },
  { href: GUARD.href, label: GUARD.navName },
  { href: '/pricing', label: 'Pricing' },
  { href: '/company', label: 'Company' },
] as const;

const PRODUCT_ICON: Record<SiteProduct['key'], (props: { size?: number }) => ReactNode> = {
  rwa_guard: IconShield,
  vault: IconVault,
  assets: IconToken,
};

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isCurrent(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Behaviour shared by both disclosures. `onOpenChange` lets the mobile menu
 * lock page scroll while it is open.
 */
function useDisclosure(onOpenChange?: (open: boolean) => void) {
  const ref = useRef<HTMLDetailsElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();

  const close = useCallback((returnFocus = false) => {
    const details = ref.current;
    if (!details || !details.open || details.dataset.closing) return;
    const finish = () => {
      delete details.dataset.closing;
      details.open = false;
      if (returnFocus) details.querySelector('summary')?.focus();
    };
    if (prefersReducedMotion()) {
      finish();
      return;
    }
    details.dataset.closing = 'true';
    closeTimer.current = setTimeout(finish, CLOSE_MS);
  }, []);

  const open = useCallback(() => {
    const details = ref.current;
    if (!details) return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    delete details.dataset.closing;
    details.open = true;
  }, []);

  useEffect(() => {
    const details = ref.current;
    if (!details) return;

    const onToggle = () => onOpenChange?.(details.open);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && details.open) {
        event.preventDefault();
        close(true);
      }
    };
    const onPointer = (event: PointerEvent) => {
      if (details.open && !details.contains(event.target as Node)) close();
    };
    // Animate the close instead of letting the summary snap it shut.
    const summary = details.querySelector('summary');
    const onSummaryClick = (event: MouseEvent) => {
      if (details.open) {
        event.preventDefault();
        close();
      }
    };

    details.addEventListener('toggle', onToggle);
    summary?.addEventListener('click', onSummaryClick);
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      details.removeEventListener('toggle', onToggle);
      summary?.removeEventListener('click', onSummaryClick);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, [close, onOpenChange]);

  // Any navigation closes the menu.
  useEffect(() => {
    const details = ref.current;
    if (details?.open) {
      delete details.dataset.closing;
      details.open = false;
    }
  }, [pathname]);

  return { ref, open, close, pathname };
}

function EcosystemMenu() {
  const { ref, open, close, pathname } = useDisclosure();
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = [VAULT, ASSETS].some((product) => isCurrent(pathname, product.href));

  // Hover intent for mouse users only; touch and keyboard use the summary.
  const onPointerEnter = (event: ReactPointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(open, 60);
  };
  const onPointerLeave = (event: ReactPointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => close(), 180);
  };

  return (
    <details ref={ref} className={styles.dropdown} onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave}>
      <summary className={styles.navLink} data-active={active ? 'true' : undefined}>
        Ecosystem
        <IconChevronDown className={styles.chevron} size={15} />
      </summary>
      <div className={styles.dropdownPanel}>
        <p className={styles.dropdownLabel}>Decoda ecosystem</p>
        <ul className={styles.dropdownList}>
          {[VAULT, ASSETS].map((product) => {
            const Icon = PRODUCT_ICON[product.key];
            return (
              <li key={product.key}>
                <Link href={product.href} className={styles.dropdownItem} aria-current={isCurrent(pathname, product.href) ? 'page' : undefined}>
                  <span className={styles.dropdownIcon} data-tone={product.status.tone}>
                    <Icon size={18} />
                  </span>
                  <span className={styles.dropdownText}>
                    <span className={styles.dropdownName}>{product.name}</span>
                    <span className={styles.dropdownStatus} data-tone={product.status.tone}>
                      {product.status.label}
                    </span>
                    <span className={styles.dropdownSummary}>{product.summary}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        <Link href="/platform#ecosystem" className={styles.dropdownFooter}>
          <IconLayers size={16} />
          How Assets, Vault and Guard connect
          <IconArrowRight size={15} />
        </Link>
      </div>
    </details>
  );
}

export function PrimaryNav() {
  const pathname = usePathname();
  return (
    <nav className={styles.nav} aria-label="Primary">
      {NAV_LINKS.slice(0, 2).map((item) => (
        <Link key={item.href} href={item.href} className={styles.navLink} aria-current={isCurrent(pathname, item.href) ? 'page' : undefined}>
          {item.label}
        </Link>
      ))}
      <EcosystemMenu />
      {NAV_LINKS.slice(2).map((item) => (
        <Link key={item.href} href={item.href} className={styles.navLink} aria-current={isCurrent(pathname, item.href) ? 'page' : undefined}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function MobileMenu() {
  const lockScroll = useCallback((open: boolean) => {
    document.documentElement.toggleAttribute('data-menu-open', open);
  }, []);
  const { ref, pathname } = useDisclosure(lockScroll);

  useEffect(() => () => document.documentElement.removeAttribute('data-menu-open'), []);

  return (
    <details ref={ref} className={styles.menu}>
      <summary className={styles.menuSummary} aria-label="Menu">
        <span className={styles.menuGlyph} aria-hidden="true">
          <span />
          <span />
        </span>
      </summary>
      <div className={styles.menuSheet}>
        <nav className={styles.menuPanel} aria-label="Primary (mobile)">
          <p className={styles.menuLabel}>Products</p>
          <ul className={styles.menuProducts}>
            {SITE_PRODUCTS.map((product) => {
              const Icon = PRODUCT_ICON[product.key];
              return (
                <li key={product.key}>
                  <Link href={product.href} className={styles.menuProduct} aria-current={isCurrent(pathname, product.href) ? 'page' : undefined}>
                    <span className={styles.dropdownIcon} data-tone={product.status.tone}>
                      <Icon size={18} />
                    </span>
                    <span className={styles.dropdownText}>
                      <span className={styles.dropdownName}>{product.name}</span>
                      <span className={styles.dropdownStatus} data-tone={product.status.tone}>
                        {product.status.label}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className={styles.menuLabel}>Company</p>
          <ul className={styles.menuLinks}>
            {[
              { href: '/platform', label: 'Platform overview' },
              { href: '/pricing', label: 'Pricing' },
              { href: '/company', label: 'Company' },
              { href: '/contact', label: 'Contact' },
            ].map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={styles.menuLink} aria-current={isCurrent(pathname, item.href) ? 'page' : undefined}>
                  {item.label}
                  <IconArrowRight size={16} />
                </Link>
              </li>
            ))}
          </ul>
          <div className={styles.menuActions}>
            <AccountAction className={`button-secondary ${styles.menuAction}`} />
            <PrimaryAction className={`button-primary ${styles.menuAction}`} />
          </div>
        </nav>
      </div>
    </details>
  );
}
