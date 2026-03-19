import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Decoda | Security Infrastructure for Blockchain Financial Systems',
  description:
    'Decoda is the parent company building security infrastructure for blockchain financial systems, led by its flagship solution for RWA security operations.',
};

const navigation = [
  { href: '/', label: 'Company' },
  { href: '/solutions/rwa-security', label: 'RWA Security' },
  { href: '/platform', label: 'Platform Vision' },
  { href: '/contact', label: 'Contact' },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="page-shell">
          <header className="site-header">
            <Link href="/" className="brand-mark">
              <span className="brand-dot" />
              <div>
                <strong>Decoda</strong>
                <span>Security infrastructure for digital finance</span>
              </div>
            </Link>
            <nav>
              {navigation.map((item) => (
                <Link key={item.href} href={item.href} className="nav-link">
                  {item.label}
                </Link>
              ))}
            </nav>
          </header>
          <main>{children}</main>
          <footer className="site-footer">
            <div>
              <p className="eyebrow">Decoda</p>
              <p>
                Parent company for institutional-grade blockchain financial infrastructure
                security.
              </p>
            </div>
            <div>
              <p className="eyebrow">Current flagship</p>
              <p>Product A: Real-world asset security operations and controls.</p>
            </div>
            <div>
              <p className="eyebrow">Next step</p>
              <Link href="/contact" className="footer-link">
                Request a strategy session
              </Link>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
