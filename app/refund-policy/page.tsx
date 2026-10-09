import { LegalPage } from '@/components/site/legal-page';
import { pageMetadata } from '@/lib/site/metadata';
import { CONTACT_EMAIL } from '@/lib/site/site';

export const metadata = pageMetadata({
  title: 'Refund Policy',
  description: 'Refund and cancellation policy for Decoda RWA Guard monthly and annual subscriptions.',
  path: '/refund-policy',
});

export default function RefundPolicyPage() {
  return (
    <LegalPage
      title="Refund Policy"
      intro="This Refund Policy applies to Decoda RWA Guard subscriptions unless a separate signed agreement states different commercial terms."
      sections={[
        {
          title: 'Monthly Plans',
          body: (
            <p>
              Monthly subscriptions are billed at the start of each billing cycle. After a monthly billing cycle starts, Decoda
              does not provide prorated refunds for that cycle.
            </p>
          ),
        },
        {
          title: 'Annual Plans',
          body: (
            <p>
              For annual subscriptions, refund requests may be considered within 14 calendar days of the initial annual charge
              when platform usage is minimal and implementation services have not materially commenced.
            </p>
          ),
        },
        {
          title: 'Cancellation',
          body: (
            <p>
              You may cancel your subscription to stop future billing. Cancellation prevents automatic renewal for the next
              billing period.
            </p>
          ),
        },
        {
          title: 'Access After Cancellation',
          body: (
            <p>
              Unless otherwise stated in your agreement, service access continues through the end of the already paid billing
              period, then transitions according to account offboarding terms.
            </p>
          ),
        },
        {
          title: 'How to Request a Refund or Cancellation',
          body: (
            <p>
              To request a refund review or submit cancellation, contact your Decoda account lead or email{' '}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> with your organization name, contract identifier, and reason
              for request.
            </p>
          ),
        },
      ]}
    />
  );
}
