import { LegalPage } from '@/components/site/legal-page';
import { pageMetadata } from '@/lib/site/metadata';
import { CONTACT_EMAIL } from '@/lib/site/site';

export const metadata = pageMetadata({
  title: 'Terms of Service',
  description: 'Terms of Service governing use of Decoda Security websites and Decoda RWA Guard software.',
  path: '/terms',
});

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro="These Terms of Service govern your access to and use of Decoda Security websites and the Decoda RWA Guard platform, which provides software for security monitoring, governance, alerts, workflows, and reporting."
      sections={[
        {
          title: 'Acceptance of Terms',
          body: (
            <p>
              By accessing or using Decoda services, you agree to be bound by these Terms and our Privacy Policy. If you use the
              services on behalf of an organization, you represent that you have authority to bind that organization.
            </p>
          ),
        },
        {
          title: 'Eligibility',
          body: (
            <p>
              You must be at least 18 years old and legally capable of entering a contract. Our services are intended for
              business and institutional use, not consumer personal use.
            </p>
          ),
        },
        {
          title: 'Account Responsibilities',
          body: (
            <p>
              You are responsible for account credentials, user permissions, and activities carried out through your accounts.
              You must promptly notify Decoda of unauthorized access or suspected security incidents affecting your environment.
            </p>
          ),
        },
        {
          title: 'Acceptable Use',
          body: (
            <p>
              You may use the services only for lawful internal business purposes related to security operations, risk
              governance, incident response, and compliance reporting.
            </p>
          ),
        },
        {
          title: 'Prohibited Conduct',
          body: (
            <ul>
              <li>Attempting to disrupt, probe, or bypass service security controls.</li>
              <li>Using the service to violate law, third-party rights, or contractual duties.</li>
              <li>Reselling, sublicensing, or reverse-engineering the service except as permitted by law.</li>
              <li>Uploading malicious code or data that could impair service operation.</li>
            </ul>
          ),
        },
        {
          title: 'Intellectual Property',
          body: (
            <p>
              Decoda and its licensors retain all rights in the services, software, and related materials. Except for limited
              usage rights granted under your subscription, no rights are transferred.
            </p>
          ),
        },
        {
          title: 'Subscriptions and Billing',
          body: (
            <p>
              Paid features are provided under a subscription order, statement of work, or master services agreement. Fees,
              payment terms, billing frequency, taxes, and renewal terms are defined in the applicable commercial documents.
            </p>
          ),
        },
        {
          title: 'Cancellation and Termination',
          body: (
            <p>
              Either party may terminate as allowed by contract. On cancellation, future billing stops at the next renewal
              boundary unless otherwise agreed. Access may continue through the paid term, after which accounts may be suspended
              or deprovisioned.
            </p>
          ),
        },
        {
          title: 'Disclaimers',
          body: (
            <p>
              The services are provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis except as expressly stated
              in a written agreement. Decoda does not guarantee uninterrupted or error-free operation and does not provide legal,
              tax, investment, or financial advice.
            </p>
          ),
        },
        {
          title: 'Limitation of Liability',
          body: (
            <p>
              To the maximum extent permitted by law, Decoda will not be liable for indirect, incidental, special, consequential,
              or punitive damages, or for lost profits, revenues, data, or goodwill. Total liability is limited to fees paid under
              the applicable order in the 12 months preceding the claim, unless a different limit is stated in contract.
            </p>
          ),
        },
        {
          title: 'Indemnification',
          body: (
            <p>
              You agree to indemnify and hold harmless Decoda from third-party claims arising from your misuse of the services,
              violation of law, or breach of these Terms.
            </p>
          ),
        },
        {
          title: 'Governing Law',
          body: (
            <p>
              The governing law and venue for your use of the services are those set out in the order form, statement of work,
              or master services agreement that applies to it.
            </p>
          ),
        },
        {
          title: 'Contact Information',
          body: (
            <p>
              Notices and questions about these Terms can be sent to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </p>
          ),
        },
      ]}
    />
  );
}
