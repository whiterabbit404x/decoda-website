'use client';

/**
 * Decoda RWA Guard's workflow, told as five steps. On wide screens the step
 * nearest the middle of the viewport drives a sticky illustration beside the
 * text, and a rail fills as the reader moves through the sequence. On narrow
 * screens each step simply carries its own illustration.
 *
 * Every claim maps to enforced behaviour in decoda-rwa-guard: typed detections
 * that never report missing data as safe (docs/GO_TO_MARKET_TRUTHFUL_CLAIMS),
 * recommend-only AI triage (docs/AI_TRIAGE_OPENAI), deterministic policy and
 * approval gates, production execution off by default on every plan
 * (entitlements.py), and Ed25519-signed evidence packages (docs/EVIDENCE_EXPORTS).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { IconDetect, IconEvidence, IconInvestigate, IconRespond, IconReview, IconCheck } from '@/components/company/icons';
import { IllustrativeTag } from '@/components/site/ui';
import { DetectVisual, EvidenceVisual, InvestigateVisual, RespondVisual, ReviewVisual } from './guard-visuals';
import styles from './story.module.css';

type Step = {
  key: string;
  label: string;
  icon: (props: { size?: number }) => ReactNode;
  title: string;
  body: string;
  points: string[];
  visual: ReactNode;
};

const STEPS: Step[] = [
  {
    key: 'detect',
    label: 'Detect',
    icon: IconDetect,
    title: 'Continuous monitoring of what you register.',
    body: 'Guard watches the contracts, wallets and privileged roles in your monitoring scope on supported EVM networks, and raises typed detections for privileged activity, suspicious transfers and policy violations.',
    points: ['Privileged-role and admin-change monitoring', 'Severity-based alert routing and escalation', 'Missing data is reported as missing — never as safe'],
    visual: <DetectVisual />,
  },
  {
    key: 'investigate',
    label: 'Investigate',
    icon: IconInvestigate,
    title: 'Context assembled, not hunted for.',
    body: 'Related alerts are correlated into an incident with a forensic timeline. AI-assisted triage can summarize the evidence and suggest predefined runbooks — grounded in the incident record, and unable to act on its own.',
    points: ['Incident case file and timeline', 'AI-assisted summaries, recommend-only', 'Incident playbooks'],
    visual: <InvestigateVisual />,
  },
  {
    key: 'review',
    label: 'Review',
    icon: IconReview,
    title: 'Deterministic policy. Human approval.',
    body: 'Recommended responses are evaluated by a deterministic policy engine and routed to the people with authority to approve them, with each decision recorded against who made it and when.',
    points: ['Rule-based, repeatable policy decisions', 'Approval quorums and step-up MFA', 'Role-based workspace access'],
    visual: <ReviewVisual />,
  },
  {
    key: 'respond',
    label: 'Respond',
    icon: IconRespond,
    title: 'Response stays under your control.',
    body: 'Your team carries out approved actions through its own processes and signers. Production execution is off by default on every plan, pilots are recommend-only, and Decoda never holds customer private keys.',
    points: ['Slack, webhook and email notifications', 'Recommend-only during pilots', 'No custody of customer keys'],
    visual: <RespondVisual />,
  },
  {
    key: 'evidence',
    label: 'Preserve evidence',
    icon: IconEvidence,
    title: 'Evidence an auditor can verify.',
    body: 'Evidence packages bundle the original artifacts with a SHA-256 manifest and an Ed25519 signature, so integrity and authenticity can be checked offline — no Decoda login required. Audit logs are hash-chained.',
    points: ['Tamper-evident evidence packages', 'Offline verification with a public key', 'Hash-chained audit trail'],
    visual: <EvidenceVisual />,
  },
];

export function GuardStory() {
  const [active, setActive] = useState(0);
  const refs = useRef<Array<HTMLLIElement | null>>([]);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    // A thin band across the middle of the viewport: whichever step crosses it is active.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const index = refs.current.indexOf(entry.target as HTMLLIElement);
            if (index >= 0) setActive(index);
          }
        }
      },
      { rootMargin: '-46% 0px -46% 0px' },
    );
    for (const node of refs.current) if (node) observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const progress = active / (STEPS.length - 1);

  return (
    <div className={styles.story}>
      <div className={styles.stepsWrap}>
        <span className={styles.rail} aria-hidden="true">
          <span className={styles.railFill} style={{ transform: `scaleY(${progress})` }} />
        </span>
        <ol className={styles.steps}>
        {STEPS.map(({ key, label, icon: Icon, title, body, points, visual }, index) => (
          <li
            key={key}
            ref={(node) => {
              refs.current[index] = node;
            }}
            className={styles.step}
            data-state={index === active ? 'active' : index < active ? 'done' : 'todo'}
          >
            <span className={styles.node} aria-hidden="true">
              <Icon size={18} />
            </span>
            <p className={styles.kicker}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              {label}
            </p>
            <h3 className={styles.stepTitle}>{title}</h3>
            <p className={styles.stepBody}>{body}</p>
            <ul className={styles.points}>
              {points.map((point) => (
                <li key={point}>
                  <IconCheck size={15} />
                  {point}
                </li>
              ))}
            </ul>
            <div className={styles.inlineVisual} aria-hidden="true">
              {visual}
            </div>
          </li>
        ))}
        </ol>
      </div>

      <div className={styles.stage} aria-hidden="true">
        <div className={styles.stageFrame}>
          <div className={styles.stageTabs}>
            {STEPS.map(({ key, label }, index) => (
              <span key={key} data-state={index === active ? 'active' : index < active ? 'done' : 'todo'}>
                {label}
              </span>
            ))}
          </div>
          <div className={styles.stagePanels}>
            {STEPS.map(({ key, visual }, index) => (
              <div key={key} className={styles.stagePanel} data-active={index === active ? '' : undefined}>
                {visual}
              </div>
            ))}
          </div>
        </div>
        <IllustrativeTag className={styles.stageTag} />
      </div>
    </div>
  );
}
