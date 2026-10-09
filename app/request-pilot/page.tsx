import type { Metadata } from 'next';
import { RequestPilotForm } from '@/components/platform/request-pilot-form';
import { Reveal } from '@/components/motion/reveal';
import { PageHero, ProductStatus } from '@/components/site/ui';
import { requirePlatformSecret } from '@/lib/platform/config';
import { issueFormToken } from '@/lib/platform/form-token';
import { isProductKey } from '@/lib/platform/products';
import { pageMetadata } from '@/lib/site/metadata';
import { SITE_PRODUCTS } from '@/lib/site/products';
import { CONTACT_EMAIL } from '@/lib/site/site';
import styles from '@/components/site/pages.module.css';

// Rendered per request: each visit gets a freshly signed form token.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = pageMetadata({
  title: 'Request a Pilot',
  description:
    'Request a scoped pilot of Decoda RWA Guard, or testnet access to Decoda Vault and Decoda Assets. Decoda is invite-only: every request is reviewed by the Decoda team.',
  path: '/request-pilot',
});

const STEPS = [
  { title: 'You request access', body: 'Tell us who you are and which Decoda products you want to evaluate.' },
  { title: 'Decoda reviews it', body: 'The Decoda team reviews every request. Nothing is provisioned automatically.' },
  { title: 'Your organization is set up', body: 'If approved, we create your organization and enable the products agreed.' },
  { title: 'You accept an invitation', body: 'Your organization admin receives an invitation to create one Decoda account.' },
];

export default async function RequestPilotPage({ searchParams }: { searchParams: Promise<{ product?: string | string[] }> }) {
  const { product } = await searchParams;
  const preselected = (Array.isArray(product) ? product : product ? [product] : []).filter(isProductKey);

  let formToken: string | null = null;
  try {
    formToken = issueFormToken(requirePlatformSecret());
  } catch {
    // Not configured: the form is not offered rather than offered and broken.
    formToken = null;
  }

  return (
    <>
      <PageHero
        eyebrow="Request a pilot"
        title="Evaluate Decoda with your team."
        lead="Decoda is invite-only B2B software. Request pilot access for your organization and the Decoda team will review it."
        actions={
          // A plain link: /sign-in is a route handler that starts sign-in, so it must never be prefetched.
          <a className="button-secondary button-lg" href="/sign-in">
            Already invited? Sign in
          </a>
        }
      />

      <section className={styles.formSection} aria-label="Request a pilot">
        <div className={`container ${styles.formGrid}`}>
          <Reveal className={styles.formAside}>
            <div className={styles.asideBlock}>
              <p className="eyebrow">Product availability</p>
              <ul className={styles.availability}>
                {SITE_PRODUCTS.map((item) => (
                  <li key={item.key}>
                    <strong>{item.name}</strong>
                    <ProductStatus product={item} size="sm" />
                  </li>
                ))}
              </ul>
            </div>
            <div className={styles.asideBlock}>
              <p className="eyebrow">How access works</p>
              <p>
                Submitting this form does not create an account or grant access. Approved organizations receive an invitation to
                a single Decoda identity that works across every product they are enabled for.
              </p>
              <ol className={styles.steps}>
                {STEPS.map((step, index) => (
                  <li key={step.title}>
                    <span className={styles.stepNum} aria-hidden="true">
                      {index + 1}
                    </span>
                    <span>
                      <strong>{step.title}</strong>
                      <span>{step.body}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </Reveal>

          <Reveal variant="scale" delay={120}>
            {formToken ? (
              <RequestPilotForm formToken={formToken} preselected={preselected} />
            ) : (
              <div className="contact-form" role="status">
                <p className="eyebrow">Temporarily unavailable</p>
                <p className="form-note">
                  Pilot requests can&apos;t be submitted online right now. Email{' '}
                  <a href={`mailto:${CONTACT_EMAIL}?subject=Decoda%20pilot%20request`}>{CONTACT_EMAIL}</a> and the team will follow up.
                </p>
              </div>
            )}
          </Reveal>
        </div>
      </section>
    </>
  );
}
