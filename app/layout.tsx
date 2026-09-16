import type { Metadata } from 'next';
import './globals.css';
import { DecodaSvgDefs } from '@/components/company/logo';
import { SiteHeader } from '@/components/company/site-header';
import { SiteFooter } from '@/components/company/site-footer';

export const metadata: Metadata = {
  title: 'Decoda Security | Security Infrastructure for Blockchain Financial Systems',
  description:
    'Decoda Security builds the security infrastructure for blockchain financial systems, led by its flagship RWA Security Platform for real-world asset programs.',
};

/**
 * Marks the document as JavaScript-capable before first paint, which is what
 * gates every scroll-reveal / sequence start state in globals.css. Without it
 * the attribute is never set and the whole site renders in its final, fully
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
    <html lang="en">
      <body>
        <script dangerouslySetInnerHTML={{ __html: MARK_JS }} />
        <DecodaSvgDefs />
        <SiteHeader />
        <main className="site-main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
