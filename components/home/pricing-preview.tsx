import { Reveal } from '@/components/motion/reveal';
import { PlanCards } from '@/components/site/plan-cards';
import { SectionHeading, TextLink, uiStyles as ui } from '@/components/site/ui';
import { EXECUTION_NOTE } from '@/lib/site/pricing';
import styles from './home.module.css';

export function PricingPreview() {
  return (
    <section id="pricing" className={ui.section} aria-labelledby="pricing-title">
      <div className="container">
        <SectionHeading
          id="pricing-title"
          align="center"
          eyebrow="Pricing"
          title="Start with a scoped pilot."
          lead="Evaluate Decoda RWA Guard against your own infrastructure, then move to recurring security operations when you are ready. Every plan is arranged with the Decoda team — there is no automatic checkout."
        />
        <PlanCards compact />
        <Reveal className={styles.pricingFoot}>
          <p>{EXECUTION_NOTE}</p>
          <TextLink href="/pricing">Compare plans in detail</TextLink>
        </Reveal>
      </div>
    </section>
  );
}
