'use client';

/**
 * The hero's product visualization: one sample incident moving through
 * Detect → Investigate → Review → Respond → Evidence in a Guard-style console.
 *
 * Honesty: every value is sample data, the figure says so on screen, and no
 * metric, customer, address or volume is shown. The flow mirrors what RWA
 * Guard enforces: AI and policy recommend, people authorize, production
 * execution is not automatic, and evidence packages are hashed and signed.
 *
 * Motion: the server renders the COMPLETED workflow (so no-JS and reduced-
 * motion visitors read the whole story). After mount the loop restarts from
 * Detect, behind the hero's entrance fade. It pauses while off screen or in a
 * background tab. Nothing changes size between steps, so there is no layout
 * shift.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { DecodaShield } from '@/components/company/logo';
import {
  IconAlert,
  IconApproval,
  IconCheck,
  IconDetect,
  IconEvidence,
  IconInvestigate,
  IconPolicy,
  IconRespond,
  IconReview,
  IconSpark,
} from '@/components/company/icons';
import styles from './console.module.css';

const STAGES = [
  { key: 'detect', label: 'Detect', icon: IconDetect },
  { key: 'investigate', label: 'Investigate', icon: IconInvestigate },
  { key: 'review', label: 'Review', icon: IconReview },
  { key: 'respond', label: 'Respond', icon: IconRespond },
  { key: 'evidence', label: 'Evidence', icon: IconEvidence },
] as const;

const LAST = STAGES.length - 1;
const STEP_MS = 2800;
const HOLD_MS = 4600;

const SCOPE = [
  { name: 'Treasury token', kind: 'ERC-20', flagged: false },
  { name: 'Mint controller', kind: 'Admin role', flagged: true },
  { name: 'Redemption queue', kind: 'Contract', flagged: false },
  { name: 'Issuer multisig', kind: 'Safe', flagged: false },
];

const TRAIL = [
  { t: '00:00', event: 'alert.created', hash: '7c41…e09a' },
  { t: '00:42', event: 'incident.opened', hash: '19bd…44f1' },
  { t: '01:30', event: 'policy.approval_required', hash: 'a03e…6c12' },
  { t: '03:05', event: 'action.approved', hash: 'd2f8…0b7e' },
  { t: '03:12', event: 'evidence.sealed', hash: '5e9a…c3d4' },
];

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.kv}>
      <span>{label}</span>
      <span>{children}</span>
    </div>
  );
}

function StagePanel({ index }: { index: number }) {
  switch (index) {
    case 0:
      return (
        <>
          <Row label="Signal">
            <code>RoleGranted · Mint controller</code>
          </Row>
          <Row label="Rule">Privileged change outside approved window</Row>
          <Row label="Severity">
            <span className={styles.sevHigh}>High</span>
          </Row>
        </>
      );
    case 1:
      return (
        <>
          <ol className={styles.timeline}>
            <li>
              <time>T+0s</time> Role granted to unrecognized operator
            </li>
            <li>
              <time>T+38s</time> Supply change queued by same operator
            </li>
            <li>
              <time>T+1m</time> Alerts correlated into one incident
            </li>
          </ol>
          <span className={styles.aiChip}>
            <IconSpark size={13} /> AI summary drafted · recommend-only
          </span>
        </>
      );
    case 2:
      return (
        <>
          <Row label="Policy engine">
            <span className={styles.policyChip}>
              <IconPolicy size={13} /> Approval required
            </span>
          </Row>
          <div className={styles.approvers}>
            <span className={styles.approver}>
              <span className={styles.avatar}>SL</span> Security lead <IconCheck size={13} />
            </span>
            <span className={styles.approver}>
              <span className={styles.avatar}>OP</span> Operations lead <IconCheck size={13} />
            </span>
          </div>
          <Row label="Quorum">2 of 2 approved</Row>
        </>
      );
    case 3:
      return (
        <>
          <Row label="Recommended">Revoke role via issuer multisig</Row>
          <Row label="Execution">
            <span className={styles.humanChip}>
              <IconApproval size={13} /> By your signers · not automatic
            </span>
          </Row>
          <Row label="Notified">Slack · Webhook</Row>
        </>
      );
    default:
      return (
        <>
          <Row label="Evidence package">
            <span className={styles.sealChip}>
              <IconCheck size={13} /> Sealed
            </span>
          </Row>
          <Row label="Manifest">
            <code>SHA-256 per artifact</code>
          </Row>
          <Row label="Signature">
            <code>Ed25519 · verifiable offline</code>
          </Row>
        </>
      );
  }
}

export function GuardConsole() {
  const [step, setStep] = useState<number>(LAST);
  const [live, setLive] = useState(false);
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let visible = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let current = 0;

    const schedule = () => {
      if (timer) clearTimeout(timer);
      if (!visible || document.hidden) return;
      timer = setTimeout(
        () => {
          current = current >= LAST ? 0 : current + 1;
          setStep(current);
          schedule();
        },
        current >= LAST ? HOLD_MS : STEP_MS,
      );
    };

    setStep(0);
    setLive(true);
    schedule();

    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(([entry]) => {
            visible = Boolean(entry?.isIntersecting);
            schedule();
          });
    observer?.observe(node);
    const onVisibility = () => schedule();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      if (timer) clearTimeout(timer);
      observer?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <figure ref={ref} className={styles.figure} data-step={step} data-live={live ? '' : undefined}>
      <figcaption className="visually-hidden">
        Illustration with sample data: a Decoda RWA Guard incident moving from detection through investigation, policy review,
        human-authorized response and a sealed evidence package.
      </figcaption>

      <div className={`surface-dark ${styles.frame}`} aria-hidden="true">
        <div className={styles.topbar}>
          <span className={styles.dots}>
            <span />
            <span />
            <span />
          </span>
          <span className={styles.crumbs}>
            <DecodaShield size={14} />
            <strong>RWA Guard</strong>
            <span className={styles.sep}>/</span>
            <span>Incidents</span>
            <span className={styles.sep}>/</span>
            <code>INC-SAMPLE</code>
          </span>
          <span className={styles.monitoring}>
            <span className={styles.pulse} />
            Monitoring
          </span>
        </div>

        <div className={styles.body}>
          <div className={styles.sidebar}>
            <p className={styles.sideLabel}>Monitored scope</p>
            <ul className={styles.scope}>
              {SCOPE.map((item) => (
                <li key={item.name} data-flagged={item.flagged ? '' : undefined}>
                  <span className={styles.scopeDot} />
                  <span className={styles.scopeText}>
                    <span>{item.name}</span>
                    <small>{item.kind}</small>
                  </span>
                </li>
              ))}
            </ul>
            <p className={styles.sideLabel}>Policy</p>
            <div className={styles.policyBox}>
              <span>Privileged changes</span>
              <strong>Approval required</strong>
            </div>
          </div>

          <div className={styles.main}>
            <div className={styles.alert}>
              <span className={styles.alertIcon}>
                <IconAlert size={16} />
              </span>
              <span className={styles.alertText}>
                <strong>Privileged role granted outside change window</strong>
                <small>Mint controller · sample incident</small>
              </span>
              <span className={styles.sevHigh}>High</span>
            </div>

            <div className={styles.stagesWrap}>
              <span className={styles.rail}>
                <span className={styles.railFill} style={{ transform: `scaleX(${step / LAST})` }} />
              </span>
              <ol className={styles.stages}>
                {STAGES.map(({ key, label, icon: Icon }, index) => (
                  <li key={key} data-state={index < step ? 'done' : index === step ? 'active' : 'todo'}>
                    <span className={styles.stageIcon}>
                      <Icon size={14} />
                    </span>
                    <span className={styles.stageLabel}>{label}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className={styles.panels}>
              {STAGES.map(({ key }, index) => (
                <div key={key} className={styles.panel} data-active={index === step ? '' : undefined}>
                  <StagePanel index={index} />
                </div>
              ))}
            </div>

            <div className={styles.trail}>
              <p className={styles.sideLabel}>Audit trail · hash-chained</p>
              <ol>
                {TRAIL.map((entry, index) => (
                  <li key={entry.event} data-shown={index <= step ? '' : undefined}>
                    <time>{entry.t}</time>
                    <span>{entry.event}</span>
                    <code>{entry.hash}</code>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>

      <div className={`${styles.float} ${styles.floatPolicy}`} aria-hidden="true" data-on={step >= 2 ? '' : undefined}>
        <span className={styles.floatIcon}>
          <IconPolicy size={16} />
        </span>
        <span>
          <small>Deterministic policy</small>
          <strong>Approval required · no override</strong>
        </span>
      </div>
      <div className={`${styles.float} ${styles.floatEvidence}`} aria-hidden="true" data-on={step >= LAST ? '' : undefined}>
        <span className={styles.floatIcon}>
          <IconCheck size={16} />
        </span>
        <span>
          <small>Evidence package</small>
          <strong>Signature verified offline</strong>
        </span>
      </div>

      <p className={styles.caption} aria-hidden="true">
        <span className={styles.captionMark} />
        Illustrative interface · sample data
      </p>
    </figure>
  );
}
