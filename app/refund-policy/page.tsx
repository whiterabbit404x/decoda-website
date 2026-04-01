import type { Metadata } from 'next';
import { PageSection, PublicPageHero } from '@/components/public-page';

export const metadata: Metadata = {
  title: 'Refund Policy | Decoda Security',
  description:
    'Refund and cancellation policy for Decoda RWA Guard monthly and annual subscriptions.',
};

export default function RefundPolicyPage() {
  return (
    <div className="content-stack">
      <PublicPageHero
        eyebrow="Legal"
        title="Refund Policy"
        description="This Refund Policy applies to Decoda RWA Guard subscriptions unless a separate signed agreement states different commercial terms."
      />

      <div className="legal-stack">
        <PageSection title="1. Monthly Plans">
          <p>
            Monthly subscriptions are billed at the start of each billing cycle. After a monthly
            billing cycle starts, Decoda does not provide prorated refunds for that cycle.
          </p>
        </PageSection>

        <PageSection title="2. Annual Plans">
          <p>
            For annual subscriptions, refund requests may be considered within 14 calendar days of
            the initial annual charge when platform usage is minimal and implementation services
            have not materially commenced.
          </p>
        </PageSection>

        <PageSection title="3. Cancellation">
          <p>
            You may cancel your subscription to stop future billing. Cancellation prevents
            automatic renewal for the next billing period.
          </p>
        </PageSection>

        <PageSection title="4. Access After Cancellation">
          <p>
            Unless otherwise stated in your agreement, service access continues through the end of
            the already paid billing period, then transitions according to account offboarding
            terms.
          </p>
        </PageSection>

        <PageSection title="5. How to Request a Refund or Cancellation">
          <p>
            To request a refund review or submit cancellation, contact your Decoda account lead or
            send a request to <strong>Founder placeholder: billing@decodasecurity.com</strong> with
            your organization name, contract identifier, and reason for request.
          </p>
        </PageSection>
      </div>
    </div>
  );
}
