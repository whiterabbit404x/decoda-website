import Link from 'next/link';
import { ReactNode } from 'react';

export function SectionIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="section-intro">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}

export function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="stat-card">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

export function InfoCard({
  title,
  body,
  accent,
}: {
  title: string;
  body: string;
  accent?: string;
}) {
  return (
    <article className="info-card">
      {accent ? <p className="eyebrow">{accent}</p> : null}
      <h3>{title}</h3>
      <p>{body}</p>
    </article>
  );
}

export function ScreenshotPlaceholder({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="shot-card">
      <div className="shot-frame">
        <div className="shot-header">
          <span />
          <span />
          <span />
        </div>
        <div className="shot-body">
          <div className="shot-chart" />
          <div className="shot-grid">
            <div />
            <div />
            <div />
            <div />
          </div>
        </div>
      </div>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

export function CTA({
  title,
  body,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: {
  title: string;
  body: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <section className="cta-panel">
      <div>
        <p className="eyebrow">Move with confidence</p>
        <h2>{title}</h2>
        <p>{body}</p>
      </div>
      <div className="cta-actions">
        <Link href={primaryHref} className="button-primary">
          {primaryLabel}
        </Link>
        {secondaryHref && secondaryLabel ? (
          <Link href={secondaryHref} className="button-secondary">
            {secondaryLabel}
          </Link>
        ) : null}
      </div>
    </section>
  );
}

export function PageHero({
  eyebrow,
  title,
  body,
  actions,
  aside,
}: {
  eyebrow: string;
  title: string;
  body: string;
  actions?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="hero hero-grid">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="hero-copy">{body}</p>
        {actions ? <div className="hero-actions">{actions}</div> : null}
      </div>
      {aside ? <div className="hero-aside">{aside}</div> : null}
    </section>
  );
}
