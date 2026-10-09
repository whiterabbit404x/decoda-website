import Link from 'next/link';
import { IconArrowRight, IconCheck } from '@/components/company/icons';
import { RevealGroup } from '@/components/motion/reveal';
import { PLANS } from '@/lib/site/pricing';
import styles from './plans.module.css';

/**
 * The three Decoda RWA Guard plans, rendered from lib/site/pricing.ts — the
 * same data the pricing page, the homepage and the structured data read.
 */
export function PlanCards({ compact = false, headingLevel = 3 }: { compact?: boolean; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <RevealGroup className={`${styles.grid} ${compact ? styles.compact : ''}`} stagger={100}>
      {PLANS.map((plan) => (
        <article key={plan.key} className={styles.card} data-recommended={plan.recommended ? '' : undefined} aria-labelledby={`plan-${plan.key}`}>
          {plan.recommended ? <span className={styles.ribbon}>Recommended starting point</span> : null}
          <div className={styles.top}>
            <p className={styles.tagline}>{plan.tagline}</p>
            <Heading id={`plan-${plan.key}`} className={styles.name}>
              {plan.name}
            </Heading>
            <p className={styles.price}>
              <span className={styles.amount}>{plan.price}</span>
              {plan.priceSuffix ? <span className={styles.suffix}>{plan.priceSuffix}</span> : null}
            </p>
            <p className={styles.priceNote}>{plan.priceNote}</p>
            <p className={styles.summary}>{plan.summary}</p>
          </div>
          <ul className={styles.features}>
            {plan.features.map((feature) => (
              <li key={feature}>
                <span className={styles.check}>
                  <IconCheck size={13} />
                </span>
                {feature}
              </li>
            ))}
          </ul>
          <Link href={plan.cta.href} className={plan.recommended ? `button-primary ${styles.cta}` : `button-secondary ${styles.cta}`}>
            {plan.cta.label}
            <IconArrowRight size={16} />
          </Link>
        </article>
      ))}
    </RevealGroup>
  );
}
