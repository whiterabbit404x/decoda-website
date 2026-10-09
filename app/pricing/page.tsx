import Link from 'next/link';
import { IconApproval, IconCheck, IconInvestigate, IconMail, IconWorkflow, IconArrowRight } from '@/components/company/icons';
import { Reveal } from '@/components/motion/reveal';
import { Faq, Timeline } from '@/components/site/blocks';
import { JsonLd, guardJsonLd } from '@/components/site/json-ld';
import { PlanCards } from '@/components/site/plan-cards';
import { CtaBand, PageHero, SectionHeading, uiStyles as ui } from '@/components/site/ui';
import { pageMetadata } from '@/lib/site/metadata';
import { COMPARISON, EXECUTION_NOTE, PLANS, PRICING_SUMMARY, SCALE_STARTING_PRICE_USD } from '@/lib/site/pricing';
import { GUARD } from '@/lib/site/products';
import styles from '@/components/site/pages.module.css';

export const metadata = pageMetadata({
  title: 'Pricing — Decoda RWA Guard',
  description: `Plans for Decoda RWA Guard. ${PRICING_SUMMARY} Every plan is arranged with the Decoda team.`,
  path: '/pricing',
});

/** The steps of app/request-pilot — Decoda is invite-only. */
const PILOT_STEPS = [
  { icon: IconMail, title: 'You request a pilot', body: 'Tell us about your team, your program and what you want to monitor.' },
  { icon: IconInvestigate, title: 'We review and scope it', body: 'The Decoda team reviews every request and agrees the monitoring scope with you.' },
  { icon: IconWorkflow, title: 'Your organization is set up', body: 'If approved, we create your organization and enable Guard for the pilot.' },
  { icon: IconApproval, title: 'You accept an invitation', body: 'Your admin receives an invitation to one Decoda account with MFA.' },
  { icon: IconCheck, title: 'You evaluate and decide', body: 'Validate Guard against your infrastructure, then choose whether to continue on Scale.' },
];

function scaleAnswer() {
  if (SCALE_STARTING_PRICE_USD === null) {
    return 'Scale pricing depends on your monitoring scope. Contact us for a quote.';
  }
  const scale = PLANS.find((plan) => plan.key === 'scale')!;
  return `Scale starts at $${SCALE_STARTING_PRICE_USD.toLocaleString('en-US')} per month for a defined scope — up to 3 workspaces and 25 monitored contracts. ${scale.priceNote} and the support arrangements in your agreement.`;
}

const FAQ = [
  {
    q: 'How is a pilot priced?',
    a: (
      <p>
        Pilot scope and terms are agreed with each team before the evaluation starts. <Link href="/contact">Contact us</Link>{' '}
        or <Link href={GUARD.pilotHref}>request a pilot</Link> to discuss yours.
      </p>
    ),
  },
  { q: 'What does the Scale price include?', a: <p>{scaleAnswer()}</p> },
  {
    q: 'Can I buy a plan online?',
    a: <p>No. Every plan is arranged with the Decoda team, and the commercial terms are set out in your order or agreement.</p>,
  },
  { q: 'Can Decoda execute transactions on our behalf?', a: <p>{EXECUTION_NOTE}</p> },
  {
    q: 'Are Decoda Vault and Decoda Assets included?',
    a: (
      <p>
        Not yet. Vault and Assets are earlier-stage products on public testnets and are not commercially available. Testnet
        access is available by request.
      </p>
    ),
  },
  {
    q: 'What happens to our data when a pilot ends?',
    a: (
      <p>
        Nothing is deleted when an evaluation ends: your data stays readable, while new monitoring and investigations stop
        until you continue on a plan. Data handling is described in our <Link href="/privacy">Privacy Policy</Link>.
      </p>
    ),
  },
  {
    q: 'How do billing and cancellation work?',
    a: (
      <p>
        Billing frequency, renewal and cancellation follow your agreement. See the <Link href="/terms">Terms of Service</Link>{' '}
        and <Link href="/refund-policy">Refund Policy</Link>.
      </p>
    ),
  },
];

export default function PricingPage() {
  return (
    <>
      <PageHero
        eyebrow="Pricing"
        title="Start with a scoped pilot. Scale when you're ready."
        lead="Pricing for Decoda RWA Guard. Evaluate against your own infrastructure first, then move to recurring security operations — every plan is arranged with the Decoda team."
      />

      <section className={styles.pricingPlans} aria-label="Plans">
        <div className="container">
          <PlanCards headingLevel={2} />
          <Reveal className={styles.pricingNote}>
            <p>{EXECUTION_NOTE}</p>
          </Reveal>
        </div>
      </section>

      <section className={`${ui.section} ${ui.sectionSoft}`} aria-labelledby="compare-title">
        <div className="container">
          <SectionHeading id="compare-title" eyebrow="Compare plans" title="What each plan includes." />
          <Reveal className={styles.tableWrap}>
            <table className={styles.compare}>
              <caption className="visually-hidden">Decoda RWA Guard plan comparison</caption>
              <thead>
                <tr>
                  <th scope="col">
                    <span className="visually-hidden">Capability</span>
                  </th>
                  {PLANS.map((plan) => (
                    <th key={plan.key} scope="col" data-recommended={plan.recommended ? '' : undefined}>
                      <span className={styles.compareName}>{plan.name}</span>
                      <span className={styles.comparePrice}>
                        {plan.price}
                        {plan.priceSuffix ? ` ${plan.priceSuffix}` : ''}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    {row.values.map((value, index) => (
                      <td key={PLANS[index]!.key} data-recommended={PLANS[index]!.recommended ? '' : undefined}>
                        {value === '✓' ? (
                          <span className={styles.compareCheck}>
                            <IconCheck size={14} />
                            <span className="visually-hidden">Included</span>
                          </span>
                        ) : (
                          value
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Reveal>
          <p className={styles.tableFoot}>
            Limits reflect the plan entitlements Decoda RWA Guard enforces. Enterprise scope is agreed per organization. No plan
            includes an SLA or compliance certification unless it is set out in your agreement.
          </p>
        </div>
      </section>

      <section className={ui.section} aria-labelledby="pilot-steps-title">
        <div className="container">
          <SectionHeading
            id="pilot-steps-title"
            eyebrow="How a pilot works"
            title="From request to evaluation."
            lead="Decoda is invite-only. Requesting a pilot never creates an account on its own."
          />
          <PilotTimeline />
        </div>
      </section>

      <section className={`${ui.section} ${ui.sectionSoft}`} aria-labelledby="pricing-faq-title">
        <div className="container">
          <SectionHeading id="pricing-faq-title" align="center" eyebrow="FAQ" title="Pricing questions." />
          <Faq items={FAQ} />
        </div>
      </section>

      <CtaBand
        title="Scope a pilot with the Decoda team."
        body="Tell us what you need to monitor. We will review your request and agree the scope before anything is provisioned."
        primary={{ href: GUARD.pilotHref, label: 'Request a pilot' }}
        secondary={{ href: '/contact', label: 'Talk to sales' }}
      />
      <JsonLd data={guardJsonLd()} />
    </>
  );
}

function PilotTimeline() {
  return (
    <>
      <Timeline steps={PILOT_STEPS} />
      <p className={styles.tableFoot} style={{ marginTop: 40 }}>
        Ready to start?{' '}
        <Link href={GUARD.pilotHref} className={styles.inlineLink}>
          Request a pilot <IconArrowRight size={14} />
        </Link>
      </p>
    </>
  );
}
