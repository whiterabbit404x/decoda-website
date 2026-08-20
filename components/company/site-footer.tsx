import Link from 'next/link';
import { DecodaLogo } from './logo';
import { IconArrowRight } from './icons';
import styles from './site-chrome.module.css';

const exploreLinks = [
  { href: '/', label: 'Company' },
  { href: '/solutions/rwa-security', label: 'RWA Security' },
  { href: '/platform', label: 'Platform Vision' },
  { href: '/contact', label: 'Contact' },
];

const pricingLinks = [
  { href: '/pricing', label: 'Pricing Overview' },
  { href: '/pricing', label: 'Plans' },
  { href: '/contact', label: 'Request a Demo' },
];

const legalLinks = [
  { href: '/terms', label: 'Terms of Service' },
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/refund-policy', label: 'Refund Policy' },
];

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.footerTop}>
          <div className={styles.footerBrand}>
            <DecodaLogo className={styles.logo} size={32} />
            <p>
              Security infrastructure for blockchain financial systems. Built for institutions.
              Designed for trust at scale.
            </p>
          </div>

          <div className={styles.footerCol}>
            <h3>Explore</h3>
            <ul>
              {exploreLinks.map((link) => (
                <li key={link.label}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.footerCol}>
            <h3>Pricing</h3>
            <ul>
              {pricingLinks.map((link) => (
                <li key={link.label}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.footerCol}>
            <h3>Legal</h3>
            <ul>
              {legalLinks.map((link) => (
                <li key={link.label}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.footerCta}>
            <h3>Ready to get started?</h3>
            <p>Talk to our team about securing your blockchain financial programs.</p>
            <Link href="/contact" className="button-primary">
              Request a strategy session
              <IconArrowRight size={16} />
            </Link>
          </div>
        </div>

        <div className={styles.footerBottom}>
          <p>© {year} Decoda Security. All rights reserved.</p>
          <p>Security infrastructure for digital finance.</p>
        </div>
      </div>
    </footer>
  );
}
