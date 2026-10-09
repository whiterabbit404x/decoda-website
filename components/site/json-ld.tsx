/**
 * Structured data (schema.org JSON-LD). Prices and plan names come from
 * lib/site/pricing.ts so search results can never quote a price the pricing
 * page does not.
 */
import { PLANS, SCALE_STARTING_PRICE_USD } from '@/lib/site/pricing';
import { GUARD } from '@/lib/site/products';
import { CONTACT_EMAIL, POSITIONING, SITE_NAME, SITE_URL } from '@/lib/site/site';

type Json = Record<string, unknown>;

export function JsonLd({ data }: { data: Json }) {
  // Escape "<" so a value can never close the script element.
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

export function organizationJsonLd(): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    description: POSITIONING,
    email: CONTACT_EMAIL,
    contactPoint: { '@type': 'ContactPoint', contactType: 'sales', email: CONTACT_EMAIL },
  };
}

/** Decoda RWA Guard as a business application, with its published plans. */
export function guardJsonLd(): Json {
  const offers = PLANS.map((plan) => {
    const offer: Json = {
      '@type': 'Offer',
      name: `${GUARD.name} — ${plan.name}`,
      description: plan.summary,
      url: `${SITE_URL}/pricing`,
    };
    if (plan.key === 'scale' && SCALE_STARTING_PRICE_USD !== null) {
      offer.priceSpecification = {
        '@type': 'UnitPriceSpecification',
        price: SCALE_STARTING_PRICE_USD,
        priceCurrency: 'USD',
        unitText: 'MONTH',
        description: 'Starting price; final pricing depends on monitoring scope.',
      };
    }
    return offer;
  });

  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: GUARD.name,
    applicationCategory: 'SecurityApplication',
    operatingSystem: 'Web',
    url: `${SITE_URL}${GUARD.href}`,
    description: GUARD.summary,
    publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
    offers,
  };
}
