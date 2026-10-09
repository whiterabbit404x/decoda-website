import Link from 'next/link';
import { IconArrowRight, IconExternal } from '@/components/company/icons';
import { Reveal, RevealGroup } from '@/components/motion/reveal';
import { ProductStatus, SectionHeading, uiStyles as ui } from '@/components/site/ui';
import { ASSETS, GUARD, LIFECYCLE_ORDER, VAULT } from '@/lib/site/products';
import { AssetsArt, GuardArt, VaultArt } from './product-art';
import styles from './home.module.css';

const GUARD_POINTS = ['Continuous monitoring and alerts', 'Investigation and AI-assisted triage', 'Policy-gated, human-authorized response', 'Signed, verifiable evidence'];

/**
 * The three products and the lifecycle that connects them. Guard is the
 * flagship and gets the full-width card; the connected lifecycle is labelled
 * as the roadmap it is.
 */
export function Ecosystem({ headingId = 'ecosystem-title' }: { headingId?: string }) {
  return (
    <section id="ecosystem" className={ui.section} aria-labelledby={headingId}>
      <div className="container">
        <SectionHeading
          id={headingId}
          align="center"
          eyebrow="The Decoda ecosystem"
          title="One lifecycle for tokenized assets."
          lead="Tokenize with Assets. Operate with Vault. Monitor and secure with Guard. Guard is available for pilot evaluation today; Vault and Assets are earlier-stage products that show where the platform is heading."
        />

        <Reveal className={styles.lifecycle} aria-label="Product lifecycle (roadmap)" role="group">
          {LIFECYCLE_ORDER.map((product, index) => (
            <div key={product.key} className={styles.lifecycleStep} style={{ ['--n' as string]: index }}>
              {index > 0 ? <span className={styles.lifecycleLink} aria-hidden="true" /> : null}
              <Link href={product.href} className={styles.lifecycleNode} data-tone={product.status.tone}>
                <span className={styles.lifecycleVerb}>{product.lifecycle.verb}</span>
                <span className={styles.lifecycleName}>{product.navName}</span>
              </Link>
            </div>
          ))}
        </Reveal>

        <Reveal variant="scale" className={`surface-dark ${styles.flagship}`} data-art-host="">
          <div className={styles.flagshipGlow} aria-hidden="true" />
          <div className={styles.flagshipCopy}>
            <div className={styles.flagshipBadges}>
              <span className={styles.flagshipKicker}>Flagship security platform</span>
              <ProductStatus product={GUARD} size="sm" />
            </div>
            <h3 className={styles.flagshipTitle}>{GUARD.name}</h3>
            <p className={styles.flagshipBody}>{GUARD.summary}</p>
            <ul className={styles.flagshipPoints}>
              {GUARD_POINTS.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
            <div className={styles.flagshipActions}>
              <Link href={GUARD.href} className="button-primary">
                Explore Decoda Guard
                <IconArrowRight size={16} />
              </Link>
              <a href={GUARD.appUrl} className="button-secondary">
                {GUARD.appHost}
                <IconExternal size={15} />
              </a>
            </div>
          </div>
          <div className={styles.flagshipArt}>
            <GuardArt />
          </div>
        </Reveal>

        <RevealGroup className={styles.roadmapGrid} stagger={120}>
          {[
            { product: VAULT, Art: VaultArt },
            { product: ASSETS, Art: AssetsArt },
          ].map(({ product, Art }) => (
            <article key={product.key} className={styles.roadmapCard} data-art-host="" data-tone={product.status.tone}>
              <div className={styles.roadmapArt}>
                <Art />
              </div>
              <div className={styles.roadmapBody}>
                <div className={styles.roadmapMeta}>
                  <span className={styles.roadmapCategory}>{product.category}</span>
                  <ProductStatus product={product} size="sm" />
                </div>
                <h3 className={styles.roadmapTitle}>{product.name}</h3>
                <p>{product.summary}</p>
                <p className={styles.roadmapDetail}>{product.status.detail}</p>
                <Link href={product.href} className={styles.roadmapLink}>
                  Learn about {product.navName}
                  <IconArrowRight size={15} />
                </Link>
              </div>
            </article>
          ))}
        </RevealGroup>

        <Reveal as="aside" className={styles.roadmapNote}>
          <strong>Roadmap, stated plainly.</strong> The connected lifecycle is Decoda&rsquo;s product direction, not a production
          integration today. Vault and Assets run on public testnets with sample data and are not commercially available.
        </Reveal>
      </div>
    </section>
  );
}
