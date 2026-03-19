import Link from 'next/link';
import {
  CTA,
  InfoCard,
  PageHero,
  ScreenshotPlaceholder,
  SectionIntro,
  StatCard,
} from '@/components/sections';

const priorities = [
  'Govern governance, wallets, issuers, and servicing workflows from one operating model.',
  'Reduce fragmented controls across legal entities, custodians, and onchain systems.',
  'Give risk, compliance, and engineering teams one shared source of truth.',
];

export default function HomePage() {
  return (
    <div className="content-stack">
      <PageHero
        eyebrow="Decoda company website"
        title="Security infrastructure for blockchain financial systems."
        body="Decoda helps institutions launch and scale digital asset and real-world asset programs with the controls, visibility, and resilience that modern financial infrastructure demands."
        actions={
          <>
            <Link href="/solutions/rwa-security" className="button-primary">
              Explore Product A
            </Link>
            <Link href="/contact" className="button-secondary">
              Request a demo
            </Link>
          </>
        }
        aside={
          <div className="hero-panel">
            <p className="eyebrow">Trusted operating model</p>
            <div className="stat-grid">
              <StatCard value="24/7" label="security monitoring mindset" />
              <StatCard value="3" label="core pillars: policy, posture, response" />
              <StatCard value="1" label="flagship solution live now" />
            </div>
          </div>
        }
      />

      <section className="section-grid">
        <SectionIntro
          eyebrow="What Decoda does"
          title="Builds the security layer between blockchain innovation and institutional trust."
          description="We design company-level security infrastructure for organizations operating at the intersection of tokenized assets, compliance obligations, and always-on financial workflows."
        />
        <div className="card-grid three-up">
          <InfoCard
            accent="Control"
            title="Operational security architecture"
            body="Map governance, access, key workflows, and third-party dependencies into a unified security program."
          />
          <InfoCard
            accent="Visibility"
            title="Risk intelligence for digital finance"
            body="Surface weak points across issuers, treasury, servicing, and blockchain-integrated systems before they become incidents."
          />
          <InfoCard
            accent="Execution"
            title="Institutional-grade rollout support"
            body="Help leadership, security teams, and operators align on a launch-ready model for blockchain financial infrastructure."
          />
        </div>
      </section>

      <section className="section-grid two-column-layout">
        <SectionIntro
          eyebrow="Why this matters"
          title="Blockchain financial infrastructure expands the blast radius of weak controls."
          description="For tokenized assets and digital financial products, security failures are not just technical events—they can trigger operational downtime, regulatory scrutiny, and reputational loss across counterparties and investors."
        />
        <div className="highlight-panel">
          <ul className="priority-list">
            {priorities.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section-grid">
        <SectionIntro
          eyebrow="Flagship solution"
          title="Product A: RWA Security"
          description="Decoda&apos;s current flagship solution gives teams a purpose-built security operating layer for real-world asset programs, covering controls, workflows, and visibility across the lifecycle of issuance and servicing."
        />
        <div className="feature-banner">
          <div>
            <p className="eyebrow">Product A</p>
            <h3>Security operations for tokenized real-world assets.</h3>
            <p>
              Designed for firms that need to coordinate compliance, infrastructure,
              counterparties, and onchain processes without exposing the organization to
              fragmented risk.
            </p>
          </div>
          <div className="cta-actions">
            <Link href="/solutions/rwa-security" className="button-primary">
              View solution page
            </Link>
            <Link href="/contact" className="button-secondary">
              Talk to Decoda
            </Link>
          </div>
        </div>
      </section>

      <section className="section-grid">
        <SectionIntro
          eyebrow="Screenshot placeholders"
          title="Space reserved for product visuals and proof points."
          description="Use these panels to insert actual UI captures, architecture diagrams, or customer-ready solution visuals once Product A assets are finalized."
        />
        <div className="card-grid three-up">
          <ScreenshotPlaceholder
            title="Insert dashboard overview screenshot"
            body="Recommended for a high-level posture, workflow, or controls summary view."
          />
          <ScreenshotPlaceholder
            title="Insert investigation or alert workflow screenshot"
            body="Ideal for showing how analysts move from detection to response inside Product A."
          />
          <ScreenshotPlaceholder
            title="Insert reporting or audit trail screenshot"
            body="Use for board, compliance, or operations reporting proof."
          />
        </div>
      </section>

      <section className="section-grid">
        <SectionIntro
          eyebrow="Roadmap preview"
          title="Decoda&apos;s broader platform vision is emerging in phases."
          description="Today, Product A leads the portfolio. Future platform modules remain roadmap items until they are production-ready and customer-facing."
        />
        <div className="card-grid three-up">
          <InfoCard
            accent="Roadmap"
            title="Policy and control orchestration"
            body="A future layer to translate governance requirements into operational controls across teams and systems."
          />
          <InfoCard
            accent="Roadmap"
            title="Counterparty risk visibility"
            body="A future capability for evaluating vendor, issuer, and servicing dependencies in blockchain financial ecosystems."
          />
          <InfoCard
            accent="Roadmap"
            title="Executive resilience command center"
            body="A future portfolio-level view for leadership teams overseeing digital financial programs."
          />
        </div>
      </section>

      <CTA
        title="Position Decoda as the trusted security partner behind digital finance growth."
        body="Use the public site to frame the company story, showcase Product A, and open conversations with institutions preparing for tokenized asset adoption."
        primaryHref="/contact"
        primaryLabel="Request a demo"
        secondaryHref="/platform"
        secondaryLabel="See platform vision"
      />
    </div>
  );
}
