import Link from 'next/link';
import { POSITIONING, CONTACT_EMAIL } from '@/lib/site/site';
import { SITE_PRODUCTS } from '@/lib/site/products';
import { DecodaLogo } from './logo';
import styles from './site-chrome.module.css';

const columns = [
  {
    title: 'Products',
    links: SITE_PRODUCTS.map((product) => ({ href: product.href, label: product.name })),
  },
  {
    title: 'Platform',
    links: [
      { href: '/platform', label: 'Platform overview' },
      { href: '/pricing', label: 'Pricing' },
      { href: '/request-pilot', label: 'Request a pilot' },
      { href: '/sign-in', label: 'Sign in' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/company', label: 'About Decoda' },
      { href: '/contact', label: 'Contact' },
      { href: `mailto:${CONTACT_EMAIL}`, label: CONTACT_EMAIL },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/privacy', label: 'Privacy Policy' },
      { href: '/terms', label: 'Terms of Service' },
      { href: '/refund-policy', label: 'Refund Policy' },
    ],
  },
];

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.footerTop}>
          <div className={styles.footerBrand}>
            <DecodaLogo className={styles.logo} size={30} />
            <p>{POSITIONING}</p>
            <ul className={styles.footerStatus} aria-label="Product status">
              {SITE_PRODUCTS.map((product) => (
                <li key={product.key}>
                  <span className={styles.footerDot} data-tone={product.status.tone} aria-hidden="true" />
                  <span>
                    <strong>{product.navName}</strong> — {product.status.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {columns.map((column) => (
            <div key={column.title} className={styles.footerCol}>
              <h2>{column.title}</h2>
              <ul>
                {column.links.map((link) => (
                  <li key={link.href}>
                    {link.href.startsWith('mailto:') || link.href === '/sign-in' ? (
                      <a href={link.href}>{link.label}</a>
                    ) : (
                      <Link href={link.href}>{link.label}</Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className={styles.footerBottom}>
          <p>© {year} Decoda Security. All rights reserved.</p>
          <p>Product interfaces shown on this site are illustrations with sample data unless stated otherwise.</p>
        </div>
      </div>
    </footer>
  );
}
