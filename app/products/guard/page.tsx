import Link from 'next/link';
import {
  IconAlert,
  IconApproval,
  IconArrowRight,
  IconBuilding,
  IconDetect,
  IconEvidence,
  IconExternal,
  IconEyeLock,
  IconInvestigate,
  IconLayers,
  IconLock,
  IconPolicy,
  IconRadar,
  IconRespond,
  IconReview,
  IconSpark,
  IconUserKey,
  IconTarget,
} from '@/components/company/icons';
import { GuardConsole } from '@/components/home/guard-console';
import { BoundaryTable, Faq, FeatureGrid, Timeline } from '@/components/site/blocks';
import { JsonLd, guardJsonLd } from '@/components/site/json-ld';
import { PlanCards } from '@/components/site/plan-cards';
import { CtaBand, PageHero, ProductStatus, SectionHeading, TextLink, uiStyles as ui } from '@/components/site/ui';
import { pageMetadata } from '@/lib/site/metadata';
import { EXECUTION_NOTE, PRICING_SUMMARY } from '@/lib/site/pricing';
import { GUARD } from '@/lib/site/products';

export const metadata = pageMetadata({
  title: 'Decoda RWA Guard — Security Operations for Tokenized Assets',
  description: `${GUARD.summary} Available for pilot evaluation. ${PRICING_SUMMARY}`,
  path: GUARD.href,
});

const CAPABILITIES = [
  {
    icon: IconRadar,
    title: 'Continuous monitoring',
    body: 'Watches the contracts, wallets and roles in your monitoring scope on supported EVM networks.',
  },
  {
    icon: IconUserKey,
    title: 'Privileged-activity monitoring',
    body: 'Role grants, admin changes, upgrades and other privileged actions are detected and raised for review.',
  },
  {
    icon: IconAlert,
    title: 'Alerts and incidents',
    body: 'Severity-based routing and escalation; related alerts are correlated into one incident with a timeline.',
  },
  {
    icon: IconSpark,
    title: 'AI-assisted triage',
    body: 'Evidence-grounded summaries and runbook suggestions. Recommend-only: AI never takes an action itself.',
  },
  {
    icon: IconPolicy,
    title: 'Deterministic policies',
    body: 'A rule-based policy engine evaluates every recommended response. The same input gets the same decision.',
  },
  {
    icon: IconApproval,
    title: 'Human-controlled response',
    body: 'Approval quorums and step-up MFA. Production execution is off by default on every plan.',
  },
  {
    icon: IconEvidence,
    title: 'Verifiable evidence',
    body: 'Evidence packages signed with Ed25519 over a SHA-256 manifest, verifiable offline. Audit logs are hash-chained.',
  },
  {
    icon: IconBuilding,
    title: 'Institutional security operations',
    body: 'Workspaces, role-based access, a shared Decoda identity with MFA, and workspace-scoped data.',
  },
];

const STEPS = [
  { icon: IconDetect, title: 'Detect', body: 'Typed detections for privileged activity, suspicious transfers and policy violations.' },
  { icon: IconInvestigate, title: 'Investigate', body: 'Incidents with forensic timelines and AI-assisted, recommend-only summaries.' },
  { icon: IconReview, title: 'Review', body: 'Deterministic policy decides what needs approval; the right people approve.' },
  { icon: IconRespond, title: 'Respond', body: 'Your team acts through its own processes and signers. Nothing runs automatically.' },
  { icon: IconEvidence, title: 'Preserve evidence', body: 'Signed evidence packages and a hash-chained audit trail of every decision.' },
];

/** decoda-rwa-guard docs/PILOT_EXECUTION_BOUNDARY.md §1. */
const PILOT_ALLOWED = [
  'Observe blockchain activity and monitor contracts',
  'Detect threats and create alerts and incidents',
  'Run investigations, including AI-assisted triage',
  'Simulate policies and playbooks',
  'Approve or reject recommendations',
  'Export evidence and review audit logs',
  'Send Slack, webhook and email notifications',
];

const PILOT_REFUSED = [
  'Sign or broadcast a transaction',
  'Execute a state-changing contract call',
  'Pause or unpause a contract; freeze an asset',
  'Move funds, mint or burn',
  'Change ownership or admin roles',
  'Run automated remediation',
  'Use a customer wallet private key or signer',
];

const ARCHITECTURE = [
  {
    icon: IconEyeLock,
    title: 'Read-only chain access',
    body: 'Guard’s JSON-RPC access is read-only: it never calls a signing or transaction-sending method.',
  },
  {
    icon: IconLock,
    title: 'No customer keys',
    body: 'Decoda does not hold customer wallet private keys or seed phrases, and refuses submissions that look like them.',
  },
  {
    icon: IconLayers,
    title: 'Workspace isolation',
    body: 'Monitoring, telemetry, alerts, incidents and evidence are scoped to a workspace end to end.',
  },
  {
    icon: IconTarget,
    title: 'Truthful monitoring states',
    body: 'Missing or degraded data is shown as missing or degraded. No alert is never presented as proof of safety.',
  },
];

const FAQ = [
  {
    q: 'What does a Guard pilot include?',
    a: (
      <p>
        A defined monitoring scope — one workspace and up to five monitored contracts — with guided onboarding, alerts, incident
        investigation and evidence workflows. Pilots are recommend-only: Guard cannot execute production changes during a
        pilot. Scope and terms are agreed with your team before the evaluation starts.
      </p>
    ),
  },
  {
    q: 'Can Guard execute responses on-chain?',
    a: <p>{EXECUTION_NOTE}</p>,
  },
  {
    q: 'Which networks are supported?',
    a: (
      <p>
        Guard monitors supported EVM networks. Tell us which networks and contracts you need covered and we will confirm
        before your pilot is scoped.
      </p>
    ),
  },
  {
    q: 'How is AI used?',
    a: (
      <p>
        AI-assisted triage summarizes incidents, builds evidence-linked timelines and suggests predefined runbooks. It has no
        tools that act on-chain, and every recommendation needs human approval. Policy decisions are made by a deterministic
        engine, not by a model.
      </p>
    ),
  },
  {
    q: 'Does Decoda hold security certifications such as SOC 2 or ISO 27001?',
    a: (
      <p>
        Not today, and we do not claim them. We are happy to walk your security team through Guard&rsquo;s architecture,
        controls and evidence model — <Link href="/contact">contact us</Link>.
      </p>
    ),
  },
];

export default function GuardPage() {
  return (
    <>
      <PageHero
        eyebrow="Decoda RWA Guard"
        badge={<ProductStatus product={GUARD} />}
        title="Decoda RWA Guard"
        lead="Security monitoring, investigation, and controlled response for tokenized financial infrastructure — with evidence your auditors can verify."
        actions={
          <>
            <Link href={GUARD.pilotHref} className="button-primary button-lg">
              Request Guard pilot
              <IconArrowRight size={17} />
            </Link>
            <a href={GUARD.appUrl} className="button-secondary button-lg">
              {GUARD.appHost}
              <IconExternal size={16} />
            </a>
          </>
        }
        aside={<GuardConsole />}
      />

      <section className={`${ui.section} ${ui.sectionSoft}`} aria-labelledby="capabilities-title">
        <div className="container">
          <SectionHeading
            id="capabilities-title"
            eyebrow="Capabilities"
            title="Everything a security team needs to run tokenized-asset operations."
            lead="From the first signal to the evidence package, Guard keeps detection, investigation, decisions and proof in one place."
          />
          <FeatureGrid items={CAPABILITIES} columns={4} />
        </div>
      </section>

      <section className={ui.section} aria-labelledby="workflow-title">
        <div className="container">
          <SectionHeading
            id="workflow-title"
            eyebrow="How Guard works"
            title="Detect → Investigate → Review → Respond → Preserve evidence."
            lead="AI recommends, a deterministic policy engine decides what needs approval, and people authorize. Every step leaves a record."
          />
          <Timeline steps={STEPS} />
        </div>
      </section>

      <section className={`${ui.section} ${ui.sectionSoft}`} aria-labelledby="boundary-title">
        <div className="container">
          <SectionHeading
            id="boundary-title"
            eyebrow="The pilot boundary"
            title="What a pilot can — and cannot — do."
            lead="Pilots keep the full security workflow and lose exactly one capability: production execution. The boundary is enforced server-side, before any provider call, and every refusal is written to the audit log."
          />
          <BoundaryTable allowedTitle="During a pilot, your team can" refusedTitle="Guard will refuse to" allowed={PILOT_ALLOWED} refused={PILOT_REFUSED} />
        </div>
      </section>

      <section className={ui.section} aria-labelledby="architecture-title">
        <div className="container">
          <SectionHeading
            id="architecture-title"
            eyebrow="Security architecture"
            title="Designed to observe and record — not to hold your keys."
          />
          <FeatureGrid items={ARCHITECTURE} columns={4} />
        </div>
      </section>

      <section className={`${ui.section} ${ui.sectionSoft}`} aria-labelledby="plans-title">
        <div className="container">
          <SectionHeading id="plans-title" align="center" eyebrow="Plans" title="Pilot, Scale and Enterprise." lead={PRICING_SUMMARY} />
          <PlanCards compact />
          <p style={{ textAlign: 'center', marginTop: 32 }}>
            <TextLink href="/pricing">Compare plans in detail</TextLink>
          </p>
        </div>
      </section>

      <section className={ui.section} aria-labelledby="guard-faq-title">
        <div className="container">
          <SectionHeading id="guard-faq-title" align="center" eyebrow="FAQ" title="Questions security teams ask." />
          <Faq items={FAQ} />
        </div>
      </section>

      <CtaBand
        title="Evaluate Guard against your own infrastructure."
        body="Request a scoped pilot. The Decoda team reviews every request and agrees the monitoring scope with you before anything is provisioned."
        primary={{ href: GUARD.pilotHref, label: 'Request Guard pilot' }}
        secondary={{ href: '/contact', label: 'Talk to the team' }}
      />
      <JsonLd data={guardJsonLd()} />
    </>
  );
}
