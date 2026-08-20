import { DecodaShield } from './logo';
import { IconCheck } from './icons';
import styles from './company.module.css';

/* --------------------------------------------------------------------------
   Representative product-UI mocks. These are illustrative interface chrome for
   the RWA Security Platform — not live data and not real customer records.
   -------------------------------------------------------------------------- */

function WindowDots() {
  return (
    <span className={styles.uiDots} aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

function RiskDonut() {
  const r = 8.5;
  const circumference = 2 * Math.PI * r;
  const filled = circumference * (1 - 0.72);
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="3" />
      <circle
        cx="12"
        cy="12"
        r={r}
        fill="none"
        stroke="#f59e0b"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={filled}
        transform="rotate(-90 12 12)"
      />
    </svg>
  );
}

function DashboardMock() {
  return (
    <div className={styles.ui}>
      <div className={styles.uiBar}>
        <DecodaShield size={14} />
        <strong>RWA Security</strong>
        <WindowDots />
      </div>
      <span className={styles.uiLabel}>Overview</span>
      <div className={styles.uiMetrics}>
        <div className={styles.uiMetric}>
          <span className={styles.uiGauge}>
            <RiskDonut />
            <span className={styles.uiMetricValue}>72</span>
          </span>
          <span className={styles.uiMetricLabel}>Risk score</span>
        </div>
        <div className={styles.uiMetric}>
          <span className={styles.uiMetricValue}>18</span>
          <span className={styles.uiMetricLabel}>Alerts</span>
        </div>
        <div className={styles.uiMetric}>
          <span className={styles.uiMetricValue}>7</span>
          <span className={styles.uiMetricLabel}>Open cases</span>
        </div>
        <div className={styles.uiMetric}>
          <span className={styles.uiMetricValue}>96%</span>
          <span className={styles.uiMetricLabel}>Healthy</span>
        </div>
      </div>
      <svg className={styles.uiChart} viewBox="0 0 200 54" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="rwa-chart-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="rgba(59,130,246,0.4)" />
            <stop offset="1" stopColor="rgba(59,130,246,0)" />
          </linearGradient>
        </defs>
        <path d="M0 40 L28 32 L56 36 L84 22 L112 26 L140 14 L168 20 L200 10 L200 54 L0 54 Z" fill="url(#rwa-chart-grad)" />
        <path d="M0 40 L28 32 L56 36 L84 22 L112 26 L140 14 L168 20 L200 10" fill="none" stroke="#60a5fa" strokeWidth="1.5" />
      </svg>
      <div className={styles.uiRows}>
        <div className={styles.uiRow}>
          <span>Privileged access</span>
          <span className={`${styles.chip} ${styles.chipHigh}`}>High</span>
        </div>
        <div className={styles.uiRow}>
          <span>Counterparty concentration</span>
          <span className={`${styles.chip} ${styles.chipMed}`}>Medium</span>
        </div>
      </div>
    </div>
  );
}

function AlertGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 4 21 19H3L12 4Z" />
      <path d="M12 10v4M12 16.5v.5" />
    </svg>
  );
}

function InvestigationMock() {
  return (
    <div className={styles.ui}>
      <div className={styles.uiBar}>
        <strong>Investigations</strong>
        <WindowDots />
      </div>
      <div className={styles.uiAlert}>
        <AlertGlyph />
        <strong>Unusual wallet activity</strong>
        <span className={styles.badgeHigh}>High</span>
      </div>
      <div className={styles.uiRows}>
        <div className={styles.uiRow}>
          <span>Status</span>
          <span>In progress</span>
        </div>
        <div className={styles.uiRow}>
          <span>Detected</span>
          <span>14:32 UTC</span>
        </div>
        <div className={styles.uiRow}>
          <span>Source</span>
          <span>On-chain monitor</span>
        </div>
      </div>
      <span className={styles.uiLabel}>Timeline</span>
      <div className={styles.uiTimeline}>
        <div className={styles.uiEvent}>
          <time>14:32</time>
          <span>Anomaly detected by monitoring</span>
        </div>
        <div className={styles.uiEvent}>
          <time>14:35</time>
          <span>Investigator assigned</span>
        </div>
        <div className={styles.uiEvent}>
          <time>14:41</time>
          <span>Related transactions correlated</span>
        </div>
      </div>
    </div>
  );
}

const auditSections = ['Access reviews', 'Policy changes', 'Key events', 'Control tests'];

function EvidenceMock() {
  return (
    <div className={styles.ui}>
      <div className={styles.uiBar}>
        <strong>Reports</strong>
        <WindowDots />
      </div>
      <div className={styles.uiRow}>
        <strong style={{ color: 'var(--text)' }}>Audit trail report</strong>
        <span className={styles.badgeDone}>Complete</span>
      </div>
      <div className={styles.uiRows}>
        <div className={styles.uiRow}>
          <span>Period</span>
          <span>Last 30 days</span>
        </div>
        <div className={styles.uiRow}>
          <span>Scope</span>
          <span>All systems</span>
        </div>
      </div>
      <div>
        {auditSections.map((section) => (
          <div key={section} className={styles.uiCheckRow}>
            <span>{section}</span>
            <IconCheck className={styles.uiCheckIcon} size={13} />
          </div>
        ))}
      </div>
      <span className={styles.uiButton}>Download report</span>
    </div>
  );
}

const previews = [
  {
    render: <DashboardMock />,
    title: 'Dashboard overview',
    caption: 'Real-time visibility into risk, posture, incidents, alerts, and system health.',
  },
  {
    render: <InvestigationMock />,
    title: 'Investigation / incident workflow',
    caption: 'Triage, investigate, correlate evidence, and understand impact with full context.',
  },
  {
    render: <EvidenceMock />,
    title: 'Evidence / audit trail',
    caption: 'Generate tamper-evident evidence and audit-ready reporting with confidence.',
  },
];

export function RwaSecurityPlatform() {
  return (
    <section className={styles.section} aria-labelledby="flagship-solution">
      <div className={`${styles.sectionHead} ${styles.center}`}>
        <p className={styles.eyebrow}>Flagship solution</p>
        <h2 id="flagship-solution" className={styles.sectionTitle}>
          RWA Security Platform
        </h2>
        <p className={styles.sectionLead}>
          Decoda RWA Security is a real-time RWA security and incident-response platform with
          evidence-grounded AI investigation and policy-controlled automation — a purpose-built
          operating layer designed to reduce risk, strengthen controls, and provide defensible
          operational evidence.
        </p>
      </div>

      <div className={styles.previewGrid}>
        {previews.map((preview) => (
          <article key={preview.title} className={styles.previewCard}>
            <div className={styles.previewFrame}>{preview.render}</div>
            <h3 className={styles.previewCaptionTitle}>{preview.title}</h3>
            <p className={styles.previewCaptionBody}>{preview.caption}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
