/**
 * Content blocks for the inner pages: feature grids, the product status
 * banner, animated pipelines and timelines, the allowed/refused boundary
 * table, and the FAQ accordion.
 */
import type { ReactNode } from 'react';
import { IconCheck, IconMinus, IconPlus } from '@/components/company/icons';
import { Reveal, RevealGroup } from '@/components/motion/reveal';
import type { SiteProduct } from '@/lib/site/products';
import { ProductStatus, StatusBadge, type BadgeTone } from './ui';
import styles from './blocks.module.css';

type IconType = (props: { size?: number }) => ReactNode;

export interface Feature {
  icon: IconType;
  title: string;
  body: string;
  /** Optional status label, e.g. "In testnet MVP" or "Direction". */
  tag?: { label: string; tone: BadgeTone };
}

export function FeatureGrid({ items, columns = 3 }: { items: Feature[]; columns?: 2 | 3 | 4 }) {
  return (
    <RevealGroup as="ul" className={`${styles.features} ${styles[`cols${columns}`]}`} stagger={70}>
      {items.map(({ icon: Icon, title, body, tag }) => (
        <li key={title} className={styles.feature}>
          <div className={styles.featureTop}>
            <span className={styles.featureIcon}>
              <Icon size={20} />
            </span>
            {tag ? (
              <StatusBadge tone={tag.tone} size="sm">
                {tag.label}
              </StatusBadge>
            ) : null}
          </div>
          <h3>{title}</h3>
          <p>{body}</p>
        </li>
      ))}
    </RevealGroup>
  );
}

/** The product's status and its qualifying boundary, stated up front. */
export function StatusBanner({ product, children }: { product: SiteProduct; children: ReactNode }) {
  return (
    <Reveal className={styles.banner} data-tone={product.status.tone}>
      <ProductStatus product={product} />
      <p>{children}</p>
    </Reveal>
  );
}

/** A vertical sequence whose connecting line draws in as it reveals. */
export function Pipeline({ steps, label }: { steps: Array<{ title: string; detail: string; highlight?: boolean }>; label: string }) {
  return (
    <Reveal className={styles.pipeline} aria-label={label} role="group">
      <ol>
        {steps.map((step, index) => (
          <li key={step.title} style={{ ['--n' as string]: index }} data-highlight={step.highlight ? '' : undefined}>
            <span className={styles.pipelineDot} aria-hidden="true" />
            <span className={styles.pipelineText}>
              <strong>{step.title}</strong>
              <span>{step.detail}</span>
            </span>
          </li>
        ))}
      </ol>
    </Reveal>
  );
}

/** A horizontal step sequence: nodes light up in order and the rail draws between them. */
export function Timeline({ steps }: { steps: Array<{ icon: IconType; title: string; body: string }> }) {
  return (
    <Reveal as="ol" className={styles.timeline}>
      {steps.map(({ icon: Icon, title, body }, index) => (
        <li key={title} style={{ ['--n' as string]: index }}>
          <span className={styles.timelineNode} aria-hidden="true">
            <Icon size={18} />
          </span>
          <span className={styles.timelineIndex}>{String(index + 1).padStart(2, '0')}</span>
          <h3>{title}</h3>
          <p>{body}</p>
        </li>
      ))}
    </Reveal>
  );
}

export function BoundaryTable({
  allowedTitle,
  refusedTitle,
  allowed,
  refused,
}: {
  allowedTitle: string;
  refusedTitle: string;
  allowed: string[];
  refused: string[];
}) {
  return (
    <RevealGroup className={styles.boundary} stagger={140}>
      <div className={styles.boundaryCol} data-kind="allowed">
        <h3>{allowedTitle}</h3>
        <ul>
          {allowed.map((item) => (
            <li key={item}>
              <span>
                <IconCheck size={13} />
              </span>
              {item}
            </li>
          ))}
        </ul>
      </div>
      <div className={styles.boundaryCol} data-kind="refused">
        <h3>{refusedTitle}</h3>
        <ul>
          {refused.map((item) => (
            <li key={item}>
              <span>
                <IconMinus size={13} />
              </span>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </RevealGroup>
  );
}

/** Native disclosure accordion: keyboard and screen-reader support for free. */
export function Faq({ items }: { items: Array<{ q: string; a: ReactNode }> }) {
  return (
    <RevealGroup className={styles.faq} stagger={50}>
      {items.map(({ q, a }) => (
        <details key={q} className={styles.faqItem}>
          <summary>
            <span>{q}</span>
            <span className={styles.faqIcon} aria-hidden="true">
              <IconPlus size={16} />
            </span>
          </summary>
          <div className={styles.faqAnswer}>{a}</div>
        </details>
      ))}
    </RevealGroup>
  );
}

/** Two columns: a heading block and supporting content. */
export function Split({ intro, children, reverse = false }: { intro: ReactNode; children: ReactNode; reverse?: boolean }) {
  return (
    <div className={`${styles.split} ${reverse ? styles.splitReverse : ''}`}>
      <Reveal className={styles.splitIntro}>{intro}</Reveal>
      <div className={styles.splitBody}>{children}</div>
    </div>
  );
}

export { styles as blockStyles };
