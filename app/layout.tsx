import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { DecodaSvgDefs } from '@/components/company/logo';
import { SiteHeader } from '@/components/company/site-header';
import { SiteFooter } from '@/components/company/site-footer';
import { JsonLd, organizationJsonLd } from '@/components/site/json-ld';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site/site';

// Inter's optical-size axis gives the display headings a true display cut.
const inter = Inter({ subsets: ['latin'], axes: ['opsz'], variable: '--font-inter', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono-src', display: 'swap' });

const DEFAULT_TITLE = 'Decoda Security — Security and Operational Infrastructure for Tokenized Finance';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: DEFAULT_TITLE, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    locale: 'en_US',
    url: '/',
    title: DEFAULT_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: { card: 'summary_large_image', title: DEFAULT_TITLE, description: SITE_DESCRIPTION },
  formatDetection: { telephone: false, address: false, email: false },
};

export const viewport: Viewport = {
  themeColor: '#ffffff',
  colorScheme: 'light',
};

/**
 * Marks the document as JavaScript-capable before first paint, which is what
 * gates every reveal / sequence start state in globals.css. Without it the
 * attribute is never set and the whole site renders in its final, fully
 * visible state — so a failed or disabled JS bundle degrades to a static page
 * rather than to invisible content. Running it as the first child of <body>
 * means the attribute is in place before any section is painted: no flash of
 * revealed content, and no layout shift.
 */
const MARK_JS = "document.documentElement.setAttribute('data-js','1')";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: MARK_JS adds data-js to <html> before React
    // hydrates. It applies to this element's own attributes only.
    <html lang="en" className={`${inter.variable} ${mono.variable}`} suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: MARK_JS }} />
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <DecodaSvgDefs />
        <SiteHeader />
        <main id="main" className="site-main" tabIndex={-1}>
          {children}
        </main>
        <SiteFooter />
        <JsonLd data={organizationJsonLd()} />
      </body>
    </html>
  );
}
