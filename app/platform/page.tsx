import Link from 'next/link';
import { CTA, InfoCard, PageHero, SectionIntro } from '@/components/sections';

const roadmapItems = [
  {
    title: 'Policy orchestration',
    body: 'Translate governance requirements into security workflows, approvals, and evidence collection across digital financial operations.',
  },
  {
    title: 'Risk graphing',
    body: 'Map exposure across counterparties, infrastructure vendors, blockchains, and servicing dependencies.',
  },
  {
    title: 'Resilience analytics',
    body: 'Give leaders forward-looking insight into operational concentration, control maturity, and incident readiness.',
  },
];

export default function PlatformPage() {
  return (
    <div className="content-stack">
      <PageHero
        eyebrow="Platform vision"
        title="A future Decoda platform for secure blockchain financial operations."
        body="The platform vision extends beyond today&apos;s flagship solution, but these capabilities remain roadmap concepts until they are launched and validated with customers."
        actions={
          <>
            <Link href="/solutions/rwa-security" className="button-primary">
              Start with Product A
            </Link>
            <Link href="/contact" className="button-secondary">
              Discuss roadmap alignment
            </Link>
          </>
        }
        aside={
          <div className="hero-panel">
            <p className="eyebrow">Current state</p>
            <p>
              Product A is the active flagship. Additional modules are intentionally presented
              as directional roadmap areas rather than launched offerings.
            </p>
          </div>
        }
      />

      <section className="section-grid">
        <SectionIntro
          eyebrow="Roadmap framing"
          title="The platform story should feel credible, focused, and staged."
          description="This page helps Decoda signal long-term ambition without overstating what exists today. It connects future capabilities back to the same institutional security foundation."
        />
        <div className="card-grid three-up">
          {roadmapItems.map((item) => (
            <InfoCard key={item.title} accent="Future module" title={item.title} body={item.body} />
          ))}
        </div>
      </section>

      <section className="section-grid two-column-layout">
        <SectionIntro
          eyebrow="How to position it"
          title="Lead with the problem set, not speculative feature sprawl."
          description="The strongest platform narrative ties future expansion to practical institutional needs: governance, counterparties, resilience, and operational trust."
        />
        <div className="highlight-panel">
          <div className="outcome-grid">
            <div>
              <strong>Focused now</strong>
              <p>Product A solves a pressing RWA security operations problem today.</p>
            </div>
            <div>
              <strong>Expandable later</strong>
              <p>Future capabilities extend the same security operating model across adjacent workflows.</p>
            </div>
            <div>
              <strong>Credible story</strong>
              <p>Roadmap language preserves trust by separating active solutions from future platform areas.</p>
            </div>
          </div>
        </div>
      </section>

      <CTA
        title="Use the platform page to communicate direction without overcommitting."
        body="This route gives Decoda room to show strategic intent while keeping Product A as the concrete offer for current prospects."
        primaryHref="/contact"
        primaryLabel="Book a roadmap conversation"
        secondaryHref="/solutions/rwa-security"
        secondaryLabel="Review flagship solution"
      />
    </div>
  );
}
