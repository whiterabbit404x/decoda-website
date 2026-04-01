import type { Metadata } from 'next';
import { PageSection, PublicPageHero } from '@/components/public-page';

export const metadata: Metadata = {
  title: 'Terms of Service | Decoda Security',
  description:
    'Terms of Service governing use of Decoda Security websites and Decoda RWA Guard software.',
};

export default function TermsPage() {
  return (
    <div className="content-stack">
      <PublicPageHero
        eyebrow="Legal"
        title="Terms of Service"
        description="These Terms of Service govern your access to and use of Decoda Security websites and the Decoda RWA Guard platform, which provides software for security monitoring, governance, alerts, workflows, and reporting."
      />

      <div className="legal-stack">
        <PageSection title="1. Acceptance of Terms">
          <p>
            By accessing or using Decoda services, you agree to be bound by these Terms and our
            Privacy Policy. If you use the services on behalf of an organization, you represent
            that you have authority to bind that organization.
          </p>
        </PageSection>

        <PageSection title="2. Eligibility">
          <p>
            You must be at least 18 years old and legally capable of entering a contract. Our
            services are intended for business and institutional use, not consumer personal use.
          </p>
        </PageSection>

        <PageSection title="3. Account Responsibilities">
          <p>
            You are responsible for account credentials, user permissions, and activities carried
            out through your accounts. You must promptly notify Decoda of unauthorized access or
            suspected security incidents affecting your environment.
          </p>
        </PageSection>

        <PageSection title="4. Acceptable Use">
          <p>
            You may use the services only for lawful internal business purposes related to
            security operations, risk governance, incident response, and compliance reporting.
          </p>
        </PageSection>

        <PageSection title="5. Prohibited Conduct">
          <ul className="compact-list">
            <li>Attempting to disrupt, probe, or bypass service security controls.</li>
            <li>Using the service to violate law, third-party rights, or contractual duties.</li>
            <li>Reselling, sublicensing, or reverse-engineering the service except as permitted by law.</li>
            <li>Uploading malicious code or data that could impair service operation.</li>
          </ul>
        </PageSection>

        <PageSection title="6. Intellectual Property">
          <p>
            Decoda and its licensors retain all rights in the services, software, and related
            materials. Except for limited usage rights granted under your subscription, no rights
            are transferred.
          </p>
        </PageSection>

        <PageSection title="7. Subscriptions and Billing">
          <p>
            Paid features are provided under a subscription order, statement of work, or master
            services agreement. Fees, payment terms, billing frequency, taxes, and renewal terms
            are defined in the applicable commercial documents.
          </p>
        </PageSection>

        <PageSection title="8. Cancellation and Termination">
          <p>
            Either party may terminate as allowed by contract. On cancellation, future billing
            stops at the next renewal boundary unless otherwise agreed. Access may continue through
            the paid term, after which accounts may be suspended or deprovisioned.
          </p>
        </PageSection>

        <PageSection title="9. Disclaimers">
          <p>
            The services are provided on an "as is" and "as available" basis except as expressly
            stated in a written agreement. Decoda does not guarantee uninterrupted or error-free
            operation and does not provide legal, tax, investment, or financial advice.
          </p>
        </PageSection>

        <PageSection title="10. Limitation of Liability">
          <p>
            To the maximum extent permitted by law, Decoda will not be liable for indirect,
            incidental, special, consequential, or punitive damages, or for lost profits, revenues,
            data, or goodwill. Total liability is limited to fees paid under the applicable order
            in the 12 months preceding the claim, unless a different limit is stated in contract.
          </p>
        </PageSection>

        <PageSection title="11. Indemnification">
          <p>
            You agree to indemnify and hold harmless Decoda from third-party claims arising from
            your misuse of the services, violation of law, or breach of these Terms.
          </p>
        </PageSection>

        <PageSection title="12. Governing Law">
          <p>
            <strong>Founder placeholder:</strong> Insert governing law and venue (for example,
            State of Delaware, United States) based on your counsel&apos;s direction.
          </p>
        </PageSection>

        <PageSection title="13. Contact Information">
          <p>
            <strong>Founder placeholder:</strong> Insert legal contact email and business mailing
            address for notices and terms inquiries.
          </p>
        </PageSection>
      </div>
    </div>
  );
}
