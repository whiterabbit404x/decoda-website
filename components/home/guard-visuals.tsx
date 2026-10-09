/**
 * Small illustrative Guard interface fragments, one per workflow step. Sample
 * data only — no metrics, addresses or customer names — and every place that
 * shows them carries an "Illustrative · sample data" label.
 *
 * The evidence package layout mirrors decoda-rwa-guard docs/EVIDENCE_EXPORTS.md.
 */
import { IconAlert, IconApproval, IconCheck, IconEvidence, IconPolicy, IconSpark } from '@/components/company/icons';
import type { ReactNode } from 'react';
import styles from './story.module.css';

function Card({ title, tag, children }: { title: string; tag?: string; children: ReactNode }) {
  return (
    <div className={styles.vCard}>
      <div className={styles.vHead}>
        <strong>{title}</strong>
        {tag ? <span className={styles.vTag}>{tag}</span> : null}
      </div>
      {children}
    </div>
  );
}

export function DetectVisual() {
  const rows = [
    { name: 'Treasury token', kind: 'ERC-20', alert: false },
    { name: 'Mint controller', kind: 'Admin role', alert: true },
    { name: 'Redemption queue', kind: 'Contract', alert: false },
    { name: 'Issuer multisig', kind: 'Safe', alert: false },
  ];
  return (
    <Card title="Monitored scope" tag="Workspace · sample">
      <ul className={styles.vRows}>
        {rows.map((row) => (
          <li key={row.name} data-alert={row.alert ? '' : undefined}>
            <span className={styles.vDot} />
            <span className={styles.vName}>
              {row.name}
              <small>{row.kind}</small>
            </span>
            <span className={styles.vState}>{row.alert ? 'Alert' : 'Monitoring'}</span>
          </li>
        ))}
      </ul>
      <div className={styles.vToast}>
        <IconAlert size={15} />
        <span>
          <strong>Privileged role change</strong>
          <small>Outside approved change window</small>
        </span>
        <span className={styles.vHigh}>High</span>
      </div>
    </Card>
  );
}

export function InvestigateVisual() {
  const events = [
    ['T+0s', 'Role granted to unrecognized operator'],
    ['T+38s', 'Supply change queued by same operator'],
    ['T+1m', 'Alerts correlated into one incident'],
    ['T+2m', 'Investigator assigned'],
  ];
  return (
    <Card title="INC-SAMPLE · Case file" tag="Investigating">
      <ol className={styles.vTimeline}>
        {events.map(([time, text]) => (
          <li key={time}>
            <time>{time}</time>
            <span>{text}</span>
          </li>
        ))}
      </ol>
      <div className={styles.vAi}>
        <p>
          <IconSpark size={14} /> AI-assisted summary <span>Draft · recommend-only</span>
        </p>
        <span className={styles.vSkel} style={{ width: '92%' }} />
        <span className={styles.vSkel} style={{ width: '78%' }} />
        <span className={styles.vSkel} style={{ width: '54%' }} />
      </div>
    </Card>
  );
}

export function ReviewVisual() {
  return (
    <Card title="Policy decision" tag="Deterministic">
      <dl className={styles.vKv}>
        <div>
          <dt>Rule matched</dt>
          <dd>
            <code>privileged_change.requires_approval</code>
          </dd>
        </div>
        <div>
          <dt>Decision</dt>
          <dd>
            <span className={styles.vChipWarn}>
              <IconPolicy size={13} /> Approval required
            </span>
          </dd>
        </div>
      </dl>
      <p className={styles.vSub}>Approvals · 2 of 2</p>
      <ul className={styles.vApprovers}>
        <li>
          <span className={styles.vAvatar}>SL</span>
          <span>
            Security lead <small>Step-up MFA verified</small>
          </span>
          <IconCheck size={15} />
        </li>
        <li>
          <span className={styles.vAvatar}>OP</span>
          <span>
            Operations lead <small>Approved</small>
          </span>
          <IconCheck size={15} />
        </li>
      </ul>
    </Card>
  );
}

export function RespondVisual() {
  return (
    <Card title="Response" tag="Human-controlled">
      <dl className={styles.vKv}>
        <div>
          <dt>Recommended</dt>
          <dd>Revoke role via issuer multisig</dd>
        </div>
        <div>
          <dt>Decision</dt>
          <dd>
            <span className={styles.vChipOk}>
              <IconApproval size={13} /> Approved by your team
            </span>
          </dd>
        </div>
        <div>
          <dt>Execution</dt>
          <dd>By your own signers</dd>
        </div>
        <div>
          <dt>Automatic execution</dt>
          <dd>
            <span className={styles.vChipMuted}>Off by default</span>
          </dd>
        </div>
      </dl>
      <div className={styles.vNotify}>
        <span>Notified</span>
        <span className={styles.vPill}>Slack</span>
        <span className={styles.vPill}>Webhook</span>
        <span className={styles.vPill}>Email</span>
      </div>
    </Card>
  );
}

export function EvidenceVisual() {
  const files = ['manifest.json', 'manifest.sig', 'VERIFY.md', 'artifacts/on-chain/…', 'artifacts/policy/…', 'artifacts/human-actions/…'];
  return (
    <Card title="Evidence package" tag="Sealed">
      <ul className={styles.vFiles}>
        <li className={styles.vFolder}>
          <IconEvidence size={14} /> EV-SAMPLE/
        </li>
        {files.map((file) => (
          <li key={file}>
            <code>{file}</code>
          </li>
        ))}
      </ul>
      <div className={styles.vVerify}>
        <span>
          <IconCheck size={14} /> Integrity <code>SHA-256</code>
        </span>
        <span>
          <IconCheck size={14} /> Authenticity <code>Ed25519</code>
        </span>
      </div>
    </Card>
  );
}
