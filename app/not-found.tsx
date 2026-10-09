import type { Metadata } from 'next';
import Link from 'next/link';
import { IconArrowRight } from '@/components/company/icons';
import { PageHero } from '@/components/site/ui';
import { GUARD } from '@/lib/site/products';

export const metadata: Metadata = { title: 'Page not found', robots: { index: false, follow: true } };

export default function NotFound() {
  return (
    <PageHero
      eyebrow="404"
      title="This page isn't here."
      lead="The link may be out of date, or the page may have moved. Start from one of these instead."
      actions={
        <>
          <Link href="/" className="button-primary button-lg">
            Go to the homepage
            <IconArrowRight size={17} />
          </Link>
          <Link href={GUARD.href} className="button-secondary button-lg">
            Explore Decoda Guard
          </Link>
        </>
      }
    />
  );
}
