import type { Metadata } from 'next';
import { Hero } from '@/components/home/hero';
import { Problem } from '@/components/home/problem';
import { GuardSection } from '@/components/home/guard-section';
import { WhyDecoda } from '@/components/home/why-decoda';
import { Ecosystem } from '@/components/home/ecosystem';
import { Institutional } from '@/components/home/institutional';
import { PricingPreview } from '@/components/home/pricing-preview';
import { JsonLd, guardJsonLd } from '@/components/site/json-ld';
import { CtaBand } from '@/components/site/ui';
import { pageMetadata } from '@/lib/site/metadata';
import { PRICING_SUMMARY } from '@/lib/site/pricing';
import { SITE_DESCRIPTION } from '@/lib/site/site';

const base = pageMetadata({
  title: 'Security and Operational Infrastructure for Tokenized Finance',
  description: `${SITE_DESCRIPTION} ${PRICING_SUMMARY}`,
  path: '/',
});

// The home page keeps the bare site title rather than "<title> | Decoda Security".
export const metadata: Metadata = {
  ...base,
  title: { absolute: 'Decoda Security — Security and Operational Infrastructure for Tokenized Finance' },
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <Problem />
      <GuardSection />
      <WhyDecoda />
      <Ecosystem />
      <Institutional />
      <PricingPreview />
      <CtaBand
        id="final-cta"
        title="Build Safer Tokenized Finance with Decoda."
        body="Explore a scoped security pilot and help shape the next generation of institutional digital asset infrastructure."
        primary={{ href: '/request-pilot', label: 'Request a pilot' }}
        secondary={{ href: '/contact', label: 'Talk to the team' }}
      />
      <JsonLd data={guardJsonLd()} />
    </>
  );
}
