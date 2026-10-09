import Link from 'next/link';
import type { ReactNode } from 'react';
import { DecodaShield } from '@/components/company/logo';
import { IconArrowRight } from '@/components/company/icons';
import { Reveal } from '@/components/motion/reveal';
import type { ProductStatusTone, SiteProduct } from '@/lib/site/products';
import styles from './ui.module.css';

export { styles as uiStyles };

/* ------------------------------- Headings -------------------------------- */

export function SectionHeading({
  eyebrow,
  title,
  lead,
  id,
  align = 'start',
  className,
  children,
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  id?: string;
  align?: 'start' | 'center';
  className?: string;
  children?: ReactNode;
}) {
  const classes = [styles.head, align === 'center' ? styles.headCenter : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <Reveal className={classes}>
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h2 id={id} className={styles.title}>
        {title}
      </h2>
      {lead ? <p className={styles.lead}>{lead}</p> : null}
      {children}
    </Reveal>
  );
}

/* --------------------------------- Badges -------------------------------- */

export type BadgeTone = ProductStatusTone | 'implemented' | 'planned' | 'neutral';

export function StatusBadge({ tone, children, size = 'md', className }: { tone: BadgeTone; children: ReactNode; size?: 'sm' | 'md'; className?: string }) {
  const classes = [styles.badge, size === 'sm' ? styles.badgeSm : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <span className={classes} data-tone={tone}>
      {children}
    </span>
  );
}

/** A product's status, worded identically on every page. */
export function ProductStatus({ product, size, className }: { product: SiteProduct; size?: 'sm' | 'md'; className?: string }) {
  return (
    <StatusBadge tone={product.status.tone} size={size} className={className}>
      {product.status.label}
    </StatusBadge>
  );
}

/** Marks a visual as an illustration with sample data, never live product data. */
export function IllustrativeTag({ children = 'Illustrative · sample data', className }: { children?: ReactNode; className?: string }) {
  return <span className={className ? `${styles.illustrative} ${className}` : styles.illustrative}>{children}</span>;
}

export function TextLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  const classes = className ? `${styles.textLink} ${className}` : styles.textLink;
  const external = /^https?:/.test(href);
  if (external) {
    return (
      <a href={href} className={classes}>
        {children}
        <IconArrowRight size={16} />
      </a>
    );
  }
  return (
    <Link href={href} className={classes}>
      {children}
      <IconArrowRight size={16} />
    </Link>
  );
}

/* ------------------------------- Backdrops ------------------------------- */

/** Grid texture plus slow ambient light, behind a hero. Purely decorative. */
export function AmbientBackdrop({ indigo = false }: { indigo?: boolean }) {
  return (
    <div className={styles.backdrop} aria-hidden="true">
      <div className={styles.grid} />
      <div className={`${styles.glow} ${styles.glowTeal}`} />
      <div className={`${styles.glow} ${styles.glowCyan}`} />
      {indigo ? <div className={`${styles.glow} ${styles.glowIndigo}`} /> : null}
    </div>
  );
}

/* ------------------------------- Page hero ------------------------------- */

/** The hero for every inner page: light, textured, staggered on load. */
export function PageHero({
  eyebrow,
  title,
  lead,
  badge,
  actions,
  aside,
  titleId = 'page-title',
}: {
  eyebrow: string;
  title: ReactNode;
  lead: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  aside?: ReactNode;
  titleId?: string;
}) {
  return (
    <section className={styles.pageHero} aria-labelledby={titleId}>
      <AmbientBackdrop />
      <div className={`container ${styles.pageHeroInner} ${aside ? '' : styles.pageHeroInnerSolo}`}>
        <div className={`${styles.pageHeroCopy} ${styles.enter}`}>
          {badge ? <div className={styles.pageHeroBadge}>{badge}</div> : <p className="eyebrow">{eyebrow}</p>}
          <h1 id={titleId} className={styles.pageHeroTitle}>
            {title}
          </h1>
          <p className={styles.pageHeroLead}>{lead}</p>
          {actions ? <div className={styles.pageHeroActions}>{actions}</div> : null}
        </div>
        {aside ? <div className={`${styles.pageHeroAside} ${styles.enterAside}`}>{aside}</div> : null}
      </div>
    </section>
  );
}

/* -------------------------------- CTA band ------------------------------- */

type Action = { href: string; label: string };

function ActionLink({ action, primary }: { action: Action; primary: boolean }) {
  const className = primary ? 'button-primary button-lg' : 'button-secondary button-lg';
  return (
    <Link href={action.href} className={className}>
      {action.label}
      {primary ? <IconArrowRight size={17} /> : null}
    </Link>
  );
}

/** The dark closing call to action used at the end of every page. */
export function CtaBand({
  title,
  body,
  primary,
  secondary,
  id = 'closing-cta',
}: {
  title: ReactNode;
  body: ReactNode;
  primary: Action;
  secondary?: Action;
  id?: string;
}) {
  return (
    <section className={styles.ctaWrap} aria-labelledby={id}>
      <div className="container">
        <Reveal variant="scale" className={`surface-dark ${styles.cta}`}>
          <div className={styles.ctaGrid} aria-hidden="true" />
          <div className={styles.ctaOrbit} aria-hidden="true">
            <div className={styles.ctaSweep} />
          </div>
          <div>
            <DecodaShield size={44} strong />
            <h2 id={id} className={styles.ctaTitle} style={{ marginTop: 22 }}>
              {title}
            </h2>
            <p className={styles.ctaBody}>{body}</p>
          </div>
          <div className={styles.ctaActions}>
            <ActionLink action={primary} primary />
            {secondary ? <ActionLink action={secondary} primary={false} /> : null}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
