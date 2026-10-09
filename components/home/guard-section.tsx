import Link from 'next/link';
import { IconArrowRight } from '@/components/company/icons';
import { Reveal } from '@/components/motion/reveal';
import { ProductStatus, uiStyles as ui } from '@/components/site/ui';
import { GUARD } from '@/lib/site/products';
import { GuardStory } from './guard-story';
import styles from './home.module.css';

export function GuardSection() {
  return (
    <section id="guard" className={ui.section} aria-labelledby="guard-title">
      <div className="container">
        <Reveal className={styles.guardHead}>
          <div>
            <div className={styles.guardBadges}>
              <p className="eyebrow">Flagship product</p>
              <ProductStatus product={GUARD} size="sm" />
            </div>
            <h2 id="guard-title" className={ui.title}>
              Meet Decoda RWA Guard.
            </h2>
            <p className={ui.lead}>Security monitoring, investigation, and controlled response for tokenized financial infrastructure.</p>
          </div>
          <div className={styles.guardActions}>
            <Link href={GUARD.href} className="button-secondary">
              Explore Decoda Guard
              <IconArrowRight size={16} />
            </Link>
            <Link href={GUARD.pilotHref} className="button-primary">
              Request Guard pilot
              <IconArrowRight size={16} />
            </Link>
          </div>
        </Reveal>

        <GuardStory />
      </div>
    </section>
  );
}
