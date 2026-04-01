import type { Metadata } from 'next';
import { PageSection, PublicPageHero } from '@/components/public-page';

export const metadata: Metadata = {
  title: 'Privacy Policy | Decoda Security',
  description:
    'Privacy Policy describing how Decoda Security collects, uses, stores, and protects information for its website and Decoda RWA Guard platform.',
};

export default function PrivacyPage() {
  return (
    <div className="content-stack">
      <PublicPageHero
        eyebrow="Legal"
        title="Privacy Policy"
        description="This Privacy Policy explains how Decoda Security collects and handles information when you visit our website, interact with our team, or use Decoda RWA Guard."
      />

      <div className="legal-stack">
        <PageSection title="1. Information We Collect">
          <p>
            We collect information you provide directly, information generated through use of our
            website and platform, and limited information from trusted service providers.
          </p>
        </PageSection>

        <PageSection title="2. Account and Contact Details">
          <p>
            This may include names, business email addresses, organization details, roles,
            billing contacts, and communications submitted through forms, email, or support.
          </p>
        </PageSection>

        <PageSection title="3. Usage, Device, and Log Data">
          <p>
            We may collect IP address, browser type, operating system, referring URLs, pages
            viewed, timestamps, feature usage, and diagnostic logs to operate and secure services.
          </p>
        </PageSection>

        <PageSection title="4. Cookies and Analytics">
          <p>
            We use cookies and similar technologies for session management, performance, and
            aggregate analytics. You can manage cookies through browser settings, though some
            service functionality may be affected.
          </p>
        </PageSection>

        <PageSection title="5. How We Use Information">
          <ul className="compact-list">
            <li>Provide, maintain, and improve our website and platform.</li>
            <li>Authenticate users and secure customer environments.</li>
            <li>Respond to inquiries, onboarding needs, and support requests.</li>
            <li>Generate operational reporting and service performance insights.</li>
            <li>Comply with legal obligations and enforce contractual rights.</li>
          </ul>
        </PageSection>

        <PageSection title="6. Sharing and Service Providers">
          <p>
            We do not sell personal information. We may share information with infrastructure,
            analytics, support, and payment providers under contractual confidentiality and
            security obligations, or when required by law.
          </p>
        </PageSection>

        <PageSection title="7. Retention">
          <p>
            We retain information for as long as needed to provide services, fulfill legitimate
            business purposes, and meet legal, accounting, or contractual requirements.
          </p>
        </PageSection>

        <PageSection title="8. Security">
          <p>
            We use administrative, technical, and organizational safeguards designed for a B2B SaaS
            environment. No system is completely secure, and customers remain responsible for their
            own endpoint and credential hygiene.
          </p>
        </PageSection>

        <PageSection title="9. International Transfers">
          <p>
            <strong>Founder placeholder:</strong> Confirm where data is stored and processed, then
            specify transfer mechanisms (for example, SCCs) if customer data is transferred across
            jurisdictions.
          </p>
        </PageSection>

        <PageSection title="10. User Rights and Contact">
          <p>
            Depending on your jurisdiction, you may have rights to access, correct, delete, or
            restrict processing of personal information. To make a request or ask privacy
            questions, contact:
            <strong> Founder placeholder: privacy@decodasecurity.com and business address.</strong>
          </p>
        </PageSection>
      </div>
    </div>
  );
}
