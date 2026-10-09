import { LegalPage } from '@/components/site/legal-page';
import { pageMetadata } from '@/lib/site/metadata';
import { CONTACT_EMAIL } from '@/lib/site/site';

export const metadata = pageMetadata({
  title: 'Privacy Policy',
  description:
    'Privacy Policy describing how Decoda Security collects, uses, stores, and protects information for its website and Decoda RWA Guard platform.',
  path: '/privacy',
});

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="This Privacy Policy explains how Decoda Security collects and handles information when you visit our website, interact with our team, or use Decoda RWA Guard."
      sections={[
        {
          title: 'Information We Collect',
          body: (
            <p>
              We collect information you provide directly, information generated through use of our website and platform, and
              limited information from trusted service providers.
            </p>
          ),
        },
        {
          title: 'Account and Contact Details',
          body: (
            <p>
              This may include names, business email addresses, organization details, roles, billing contacts, and
              communications submitted through forms, email, or support.
            </p>
          ),
        },
        {
          title: 'Usage, Device, and Log Data',
          body: (
            <p>
              We may collect IP address, browser type, operating system, referring URLs, pages viewed, timestamps, feature usage,
              and diagnostic logs to operate and secure services.
            </p>
          ),
        },
        {
          title: 'Cookies and Analytics',
          body: (
            <p>
              We use cookies and similar technologies for session management, performance, and aggregate analytics. You can
              manage cookies through browser settings, though some service functionality may be affected.
            </p>
          ),
        },
        {
          title: 'How We Use Information',
          body: (
            <ul>
              <li>Provide, maintain, and improve our website and platform.</li>
              <li>Authenticate users and secure customer environments.</li>
              <li>Respond to inquiries, onboarding needs, and support requests.</li>
              <li>Generate operational reporting and service performance insights.</li>
              <li>Comply with legal obligations and enforce contractual rights.</li>
            </ul>
          ),
        },
        {
          title: 'Sharing and Service Providers',
          body: (
            <p>
              We do not sell personal information. We may share information with infrastructure, analytics, support, and payment
              providers under contractual confidentiality and security obligations, or when required by law.
            </p>
          ),
        },
        {
          title: 'Retention',
          body: (
            <p>
              We retain information for as long as needed to provide services, fulfill legitimate business purposes, and meet
              legal, accounting, or contractual requirements.
            </p>
          ),
        },
        {
          title: 'Security',
          body: (
            <p>
              We use administrative, technical, and organizational safeguards designed for a B2B SaaS environment. No system is
              completely secure, and customers remain responsible for their own endpoint and credential hygiene.
            </p>
          ),
        },
        {
          title: 'International Transfers',
          body: (
            <p>
              Our service providers may process information in countries other than the one in which you are located. To learn
              where information is processed, contact us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </p>
          ),
        },
        {
          title: 'User Rights and Contact',
          body: (
            <p>
              Depending on your jurisdiction, you may have rights to access, correct, delete, or restrict processing of personal
              information. To make a request or ask privacy questions, contact us at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </p>
          ),
        },
      ]}
    />
  );
}
