import type { Metadata } from 'next';
import Link from 'next/link';
import { RequestPilotForm } from '@/components/platform/request-pilot-form';
import { PageHero, SectionIntro } from '@/components/sections';
import { requirePlatformSecret } from '@/lib/platform/config';
import { issueFormToken } from '@/lib/platform/form-token';
import { isProductKey } from '@/lib/platform/products';

// Rendered per request: each visit gets a freshly signed form token.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Request a Pilot | Decoda Security',
  description:
    'Request pilot access to Decoda RWA Guard and Decoda Vault. Decoda is invite-only: every request is reviewed by the Decoda team.',
};

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
    <div className="content-stack">
      <PageHero
        eyebrow="Request a pilot"
        title="Evaluate Decoda with your team."
        body="Decoda is invite-only B2B software. Request pilot access for your organization and the Decoda team will review it."
        actions={
          <Link className="button-secondary" href="/sign-in">
            Already invited? Sign in
          </Link>
        }
        aside={
          <div className="hero-panel">
            <p className="eyebrow">Product availability</p>
            <ul className="compact-list">
              <li>RWA Guard — available for pilots</li>
              <li>Decoda Vault — testnet pilot only</li>
              <li>Decoda Assets — coming soon</li>
            </ul>
          </div>
        }
      />

      <section className="section-grid contact-grid">
        <div>
          <SectionIntro
            eyebrow="How access works"
            title="One reviewed request. One Decoda account."
            description="Submitting this form does not create an account or grant access. Approved organizations receive an invitation to a single Decoda identity that works across every product they are enabled for."
          />
          <ol className="contact-details" style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 14 }}>
            {STEPS.map((step) => (
              <li key={step.title}>
                <strong>{step.title}</strong>
                <p style={{ margin: '4px 0 0' }}>{step.body}</p>
              </li>
            ))}
          </ol>
        </div>

        {formToken ? (
          <RequestPilotForm formToken={formToken} preselected={preselected} />
        ) : (
          <div className="contact-form" role="status">
            <p className="eyebrow">Temporarily unavailable</p>
            <p className="form-note">
              Pilot requests can&apos;t be submitted online right now. Email{' '}
              <a href="mailto:hello@decodasecurity.com?subject=Decoda%20pilot%20request">hello@decodasecurity.com</a> and the
              team will follow up.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
