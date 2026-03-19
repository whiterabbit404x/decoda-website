import Link from 'next/link';
import { CTA, InfoCard, PageHero, ScreenshotPlaceholder, SectionIntro } from '@/components/sections';

const capabilities = [
  {
    title: 'Control design',
    body: 'Define operating controls for issuers, servicing teams, treasury operators, and external partners involved in RWA programs.',
  },
  {
    title: 'Workflow visibility',
    body: 'Track critical security and operational dependencies across wallets, approvals, counterparties, and offchain servicing processes.',
  },
  {
    title: 'Incident readiness',
    body: 'Prepare teams with clearer ownership, escalation paths, and response coordination for issues affecting tokenized asset operations.',
  },
  {
    title: 'Audit support',
    body: 'Create a foundation for security evidence, oversight reporting, and institutional stakeholder communication.',
  },
];

export default function RwaSecurityPage() {
  return (
    <div className="content-stack">
      <PageHero
        eyebrow="Flagship solution"
        title="Product A: RWA Security"
        body="A purpose-built security operating layer for institutions managing real-world asset infrastructure on blockchain rails."
        actions={
          <>
            <Link href="/contact" className="button-primary">
              Request a Product A demo
            </Link>
            <Link href="/platform" className="button-secondary">
              View platform roadmap
            </Link>
          </>
        }
        aside={
          <div className="hero-panel">
            <p className="eyebrow">Who it supports</p>
            <ul className="compact-list">
              <li>Tokenized asset issuers</li>
              <li>Digital asset operations teams</li>
              <li>Security and risk leaders</li>
              <li>Compliance-conscious infrastructure operators</li>
            </ul>
          </div>
        }
      />

      <section className="section-grid">
        <SectionIntro
          eyebrow="Solution overview"
          title="Built for the security demands of real-world asset programs."
          description="Product A helps organizations move beyond generic tooling by centering on the specific control, coordination, and reporting needs of tokenized asset businesses."
        />
        <div className="card-grid four-up">
          {capabilities.map((capability) => (
            <InfoCard key={capability.title} title={capability.title} body={capability.body} />
          ))}
        </div>
      </section>

      <section className="section-grid two-column-layout">
        <SectionIntro
          eyebrow="Operating outcomes"
          title="Reduce risk from fragmented ownership and opaque workflows."
          description="RWA programs frequently span legal, operational, and technical boundaries. Product A is positioned as the connective security layer for these environments."
        />
        <div className="highlight-panel">
          <div className="outcome-grid">
            <div>
              <strong>1.</strong>
              <p>Clarify who owns critical controls across internal teams and external partners.</p>
            </div>
            <div>
              <strong>2.</strong>
              <p>Gain visibility into the workflows that impact asset integrity, compliance, and customer trust.</p>
            </div>
            <div>
              <strong>3.</strong>
              <p>Prepare for incidents with a more disciplined operational and escalation model.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section-grid">
        <SectionIntro
          eyebrow="Visual placeholders"
          title="Reserve these modules for Product A screenshots."
          description="Swap these placeholders with approved visuals once the product interface, diagrams, and customer-safe imagery are available."
        />
        <div className="card-grid two-up">
          <ScreenshotPlaceholder
            title="Insert Product A command center screenshot"
            body="Recommended placement for the primary hero visual on this page."
          />
          <ScreenshotPlaceholder
            title="Insert Product A workflow detail screenshot"
            body="Recommended placement for a deeper control or response workflow visual."
          />
        </div>
      </section>

      <CTA
        title="Show Product A in the context of Decoda&apos;s broader company mission."
        body="Use this page as the flagship solution narrative while keeping additional platform elements framed as future roadmap modules."
        primaryHref="/contact"
        primaryLabel="Talk to Decoda"
        secondaryHref="/"
        secondaryLabel="Back to company overview"
      />
    </div>
  );
}
