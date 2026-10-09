import Link from 'next/link';
import { IconArrowRight, IconMail } from '@/components/company/icons';
import { ContactForm } from '@/components/company/contact-form';
import { Reveal } from '@/components/motion/reveal';
import { PageHero } from '@/components/site/ui';
import { pageMetadata } from '@/lib/site/metadata';
import { GUARD } from '@/lib/site/products';
import { CONTACT_EMAIL } from '@/lib/site/site';
import styles from '@/components/site/pages.module.css';

export const metadata = pageMetadata({
  title: 'Contact',
  description:
    'Talk to the Decoda Security team about Decoda RWA Guard, pricing, the ecosystem roadmap, partnerships, press or investor conversations.',
  path: '/contact',
});

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Talk to the Decoda team."
        lead="Questions about Decoda RWA Guard, pricing, the ecosystem roadmap, partnerships or press — tell us what you're evaluating and we'll route it to the right person."
      />

      <section className={styles.formSection} aria-label="Contact Decoda">
        <div className={`container ${styles.formGrid}`}>
          <Reveal className={styles.formAside}>
            <div className={styles.asideBlock}>
              <p className="eyebrow">Email</p>
              <a href={`mailto:${CONTACT_EMAIL}`} className={styles.asideEmail}>
                <IconMail size={18} />
                {CONTACT_EMAIL}
              </a>
            </div>
            <div className={styles.asideBlock}>
              <p className="eyebrow">This inbox handles</p>
              <p>Product questions and demos, pricing, partnerships, media requests and investor conversations.</p>
            </div>
            <div className={`${styles.asideBlock} ${styles.asideHighlight}`}>
              <p className="eyebrow">Ready to evaluate Guard?</p>
              <p>Pilot requests go straight to review by the Decoda team.</p>
              <Link href={GUARD.pilotHref} className={styles.inlineLink}>
                Request a pilot <IconArrowRight size={14} />
              </Link>
            </div>
          </Reveal>

          <Reveal variant="scale" delay={120}>
            <ContactForm />
          </Reveal>
        </div>
      </section>
    </>
  );
}
