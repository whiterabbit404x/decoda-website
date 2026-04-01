import Link from 'next/link';
import { ReactNode } from 'react';

export function PublicPageHero({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section className="hero public-page-hero">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="hero-copy">{description}</p>
    </section>
  );
}

export function PageSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="legal-section">
      <h2>{title}</h2>
      <div>{children}</div>
    </section>
  );
}

export function PricingCard({
  plan,
  audience,
  price,
  cadence,
  summary,
  items,
  primary,
  secondary,
}: {
  plan: string;
  audience: string;
  price: string;
  cadence: string;
  summary: string;
  items: string[];
  primary: { href: string; label: string };
  secondary: { href: string; label: string };
}) {
  return (
    <article className="pricing-card">
      <p className="eyebrow">{audience}</p>
      <h2>{plan}</h2>
      <p className="pricing-price">
        {price} <span>{cadence}</span>
      </p>
      <p>{summary}</p>
      <ul className="compact-list">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <div className="cta-actions">
        <Link href={primary.href} className="button-primary">
          {primary.label}
        </Link>
        <Link href={secondary.href} className="button-secondary">
          {secondary.label}
        </Link>
      </div>
    </article>
  );
}
