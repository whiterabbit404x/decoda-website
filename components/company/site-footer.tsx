import Link from 'next/link';
import { DecodaLogo } from './logo';
import { IconArrowRight } from './icons';
import styles from './site-chrome.module.css';

const companyLinks = [
  { href: '/', label: 'Company' },
  { href: '/solutions/rwa-security', label: 'RWA Security' },
  { href: '/platform', label: 'Platform Vision' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/contact', label: 'Contact' },
];

const legalLinks = [
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/terms', label: 'Terms of Service' },
  { href: '/refund-policy', label: 'Refund Policy' },
];

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className={`surface-dark ${styles.footer}`}>
      <div className={styles.footerInner}>
        <div className={styles.footerTop}>
          <div className={styles.footerBrand}>
            <DecodaLogo className={styles.logo} size={32} />
            <p>Security infrastructure for blockchain financial systems.</p>
          </div>

          <div className={styles.footerCol}>
            <h2>Company</h2>
            <ul>
              {companyLinks.map((link) => (
                <li key={link.label}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.footerCol}>
            <h2>Legal</h2>
            <ul>
              {legalLinks.map((link) => (
                <li key={link.label}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.footerCta}>
            <h2>Talk to our team</h2>
            <p>Discuss the controls and evidence your digital asset program needs.</p>
            <Link href="/contact" className="button-primary">
              Request a demo
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
