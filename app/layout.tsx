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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <DecodaSvgDefs />
        <SiteHeader />
        <main className="site-main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
