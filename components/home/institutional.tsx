import {
  IconApproval,
  IconEvidence,
  IconEyeLock,
  IconFingerprint,
  IconLayers,
  IconNetwork,
  IconPlug,
  IconPolicy,
  IconReview,
  IconRoles,
} from '@/components/company/icons';
import { Reveal, RevealGroup } from '@/components/motion/reveal';
import { StatusBadge, uiStyles as ui } from '@/components/site/ui';
import styles from './home.module.css';

/**
 * Controls, split by what exists today and what is planned.
 *
 * Implemented — verified in code: workspace RBAC and Vault product roles,
 * WorkOS shared identity with MFA (this repository + products' SHARED_IDENTITY
 * docs), read-only JSON-RPC and no customer keys, approval quorums and step-up
 * MFA, the deterministic execution gate, Ed25519-signed evidence and a
 * hash-chained audit log, workspace-scoped tenancy.
 *
 * Planned — declared in RWA Guard's plan table but NOT enforced by any code
 * path yet (entitlements.py UNENFORCED_FEATURES): multi-network deployment,
 * custom evidence templates, custom integrations.
 */
const IMPLEMENTED = [
  {
    icon: IconRoles,
    title: 'Role-based access control',
    body: 'Workspace roles in Guard — owner, admin, analyst, viewer — with separation of duties in Vault’s product roles.',
  },
  {
    icon: IconFingerprint,
    title: 'MFA and shared Decoda identity',
    body: 'One Decoda account across products, with multi-factor authentication and support for organization SSO.',
  },
  {
    icon: IconEyeLock,
    title: 'Read-only monitoring',
    body: 'Guard’s chain access is read-only: it never broadcasts transactions and never holds customer keys.',
  },
  {
    icon: IconApproval,
    title: 'Human-controlled approvals',
    body: 'Approval quorums and step-up MFA before a response proceeds. Production execution is off by default.',
  },
  {
    icon: IconPolicy,
    title: 'Deterministic security policies',
    body: 'Policy decisions are rule-based and repeatable — never delegated to an AI model.',
  },
  {
    icon: IconEvidence,
    title: 'Evidence exports and auditability',
    body: 'Signed evidence packages, verifiable offline, and a hash-chained audit log of every action.',
  },
  {
    icon: IconLayers,
    title: 'Tenant isolation',
    body: 'Monitoring, alerts, incidents and evidence are scoped to your workspace.',
  },
];

const PLANNED = [
  { icon: IconNetwork, title: 'Multi-network deployments' },
  { icon: IconReview, title: 'Custom evidence templates' },
  { icon: IconPlug, title: 'Advanced enterprise integrations' },
];

export function Institutional() {
  return (
    <section id="controls" className={`${ui.section} ${ui.sectionSoft}`} aria-labelledby="controls-title">
      <div className="container">
        <div className={styles.controlsGrid}>
          <Reveal className={styles.controlsIntro}>
            <p className="eyebrow">Built for institutional workflows</p>
            <h2 id="controls-title" className={ui.title}>
              Controls your security, risk and audit teams can rely on.
            </h2>
            <p className={ui.lead}>
              What is implemented today is labelled as implemented. What is planned is labelled as planned — not implied.
            </p>
            <div className={styles.legend}>
              <StatusBadge tone="implemented" size="sm">
                Implemented
              </StatusBadge>
              <StatusBadge tone="planned" size="sm">
                Planned
              </StatusBadge>
            </div>
          </Reveal>

          <div className={styles.controlsLists}>
            <RevealGroup as="ul" className={styles.controlList} stagger={60}>
              {IMPLEMENTED.map(({ icon: Icon, title, body }) => (
                <li key={title} className={styles.controlRow}>
                  <span className={styles.controlIcon}>
                    <Icon size={18} />
                  </span>
                  <div>
                    <h3>{title}</h3>
                    <p>{body}</p>
                  </div>
                  <StatusBadge tone="implemented" size="sm" className={styles.controlBadge}>
                    Implemented
                  </StatusBadge>
                </li>
              ))}
            </RevealGroup>

            <Reveal className={styles.plannedBox}>
              <p className={styles.plannedTitle}>On the roadmap</p>
              <ul className={styles.plannedList}>
                {PLANNED.map(({ icon: Icon, title }) => (
                  <li key={title}>
                    <Icon size={16} />
                    <span>{title}</span>
                    <StatusBadge tone="planned" size="sm">
                      Planned
                    </StatusBadge>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
