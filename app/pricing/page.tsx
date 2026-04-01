import type { Metadata } from 'next';
import Link from 'next/link';
import { PageSection, PricingCard, PublicPageHero } from '@/components/public-page';

export const metadata: Metadata = {
  title: 'Pricing | Decoda RWA Guard',
  description:
    'Transparent pricing options for Decoda RWA Guard security operations software, from startup teams to enterprise deployments.',
};

export default function PricingPage() {
  return (
    <div className="content-stack">
      <PublicPageHero
        eyebrow="Pricing"
        title="Pricing for Decoda RWA Guard"
        description="Decoda RWA Guard is security operations software for blockchain and tokenized asset programs. Plans are billed as a SaaS subscription and can be tailored for enterprise deployment, governance, and support requirements."
      />

      <section className="card-grid three-up">
        <PricingCard
          plan="Starter"
          audience="For pilot teams"
          price="$2,500"
          cadence="/ month, billed monthly"
          summary="For early production programs that need baseline controls and security visibility."
          items={[
            'Up to 10 users',
            'Core monitoring dashboards and alerting',
            'Weekly governance and risk review exports',
            'Email support during business hours',
          ]}
          primary={{ href: '/contact', label: 'Start evaluation' }}
          secondary={{ href: '/contact', label: 'Request demo' }}
        />
        <PricingCard
          plan="Team"
          audience="For scaling institutions"
          price="$6,500"
          cadence="/ month, billed monthly or annually"
          summary="For cross-functional security, compliance, and operations teams running active RWA programs."
          items={[
            'Up to 35 users',
            'Advanced workflow automation and policy checks',
            'API access for internal systems and reporting',
            'Priority support and onboarding assistance',
          ]}
          primary={{ href: '/contact', label: 'Request demo' }}
          secondary={{ href: '/contact', label: 'Talk to sales' }}
        />
        <PricingCard
          plan="Enterprise"
          audience="For regulated, multi-entity operations"
          price="Custom"
          cadence="annual agreement"
          summary="For organizations requiring bespoke deployment architecture, controls mapping, and security operations support."
          items={[
            'Unlimited users across approved entities',
            'Enterprise integrations, SSO, and role governance',
            'Dedicated security success lead and response planning',
            'Contracted SLAs, onboarding, and training programs',
          ]}
          primary={{ href: '/contact', label: 'Talk to sales' }}
          secondary={{ href: '/contact', label: 'Start evaluation' }}
        />
      </section>

      <section className="feature-banner">
        <div>
          <p className="eyebrow">Billing note</p>
          <h3>Enterprise pricing can be tailored to deployment scope.</h3>
          <p>
            Final pricing may vary by environment complexity, integration needs, support
            coverage, and contractual security requirements.
          </p>
        </div>
        <Link href="/contact" className="button-secondary">
          Discuss deployment scope
        </Link>
      </section>

      <section className="section-grid">
        <div className="section-intro">
          <p className="eyebrow">FAQ</p>
          <h2>Frequently asked questions</h2>
          <p>Answers to common questions from security, compliance, and operations leaders.</p>
        </div>
        <div className="card-grid three-up">
          <PageSection title="Who is Decoda RWA Guard for?">
            <p>
              Decoda RWA Guard is designed for institutions operating blockchain-enabled
              financial programs that need security monitoring, governance workflows, and
              audit-ready reporting across teams and counterparties.
            </p>
          </PageSection>
          <PageSection title="What does deployment and support look like?">
            <p>
              Deployments are led jointly by Decoda and your internal stakeholders, including
              configuration for controls, roles, and integrations. Support levels depend on plan,
              with enhanced onboarding and response planning available for enterprise customers.
            </p>
          </PageSection>
          <PageSection title="How do billing and cancellation work?">
            <p>
              Subscriptions are billed monthly or annually based on contract. You can cancel to
              stop future renewals, and access remains active through the end of the paid term,
              subject to the agreement and refund policy.
            </p>
          </PageSection>
        </div>
      </section>
    </div>
  );
}
