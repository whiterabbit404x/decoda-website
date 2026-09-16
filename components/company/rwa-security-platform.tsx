import Link from 'next/link';
import { DecodaShield } from './logo';
import { IconCheck, IconExternal } from './icons';
import { RevealGroup, SectionReveal } from './section-reveal';
import styles from './company.module.css';

const RWA_APP_URL = 'https://rwa.decodasecurity.com/';

/* --------------------------------------------------------------------------
   Representative product-UI views for Decoda RWA Guard. These are illustrative
   interface chrome — not live data, not customer records, and not a claim
   about any specific figure shown. The "Representative interface" note under
   each frame says so on the page itself.
   -------------------------------------------------------------------------- */

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
        <strong>RWA Guard</strong>
        <span className={styles.uiTag}>Overview</span>
      </div>
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
          <span className={styles.uiMetricLabel}>Controls healthy</span>
        </div>
      </div>
      <svg className={styles.uiChart} viewBox="0 0 200 54" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="rwa-chart-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="rgba(59,130,246,0.35)" />
            <stop offset="1" stopColor="rgba(59,130,246,0)" />
          </linearGradient>
        </defs>
        <path d="M0 40 L28 32 L56 36 L84 22 L112 26 L140 14 L168 20 L200 10 L200 54 L0 54 Z" fill="url(#rwa-chart-grad)" />
        <path d="M0 40 L28 32 L56 36 L84 22 L112 26 L140 14 L168 20 L200 10" fill="none" stroke="#60a5fa" strokeWidth="1.5" />
      </svg>
      <div className={styles.uiRows}>
        <div className={styles.uiRow}>
          <span>Privileged access change</span>
          <span className={`${styles.chip} ${styles.chipHigh}`}>High</span>
        </div>
        <div className={styles.uiRow}>
          <span>Counterparty concentration</span>
          <span className={`${styles.chip} ${styles.chipMed}`}>Medium</span>
        </div>
        <div className={styles.uiRow}>
          <span>Policy attestation due</span>
          <span className={`${styles.chip} ${styles.chipLow}`}>Low</span>
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
        <span className={styles.uiTag}>Case</span>
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
        <strong>Evidence</strong>
        <span className={styles.uiTag}>Report</span>
      </div>
      <div className={styles.uiRow}>
        <strong className={styles.uiRowTitle}>Audit trail report</strong>
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
      <span className={styles.uiButton}>Export report</span>
    </div>
  );
}

/**
 * Enterprise application frame: light browser chrome with the product's own
 * dark interface inside. The viewport carries `surface-dark` so the mock's
 * tokens resolve to their navy values while the surrounding card stays light.
 * `aspect-ratio` on the viewport reserves the height before paint, so the
 * preview cannot shift layout as the section loads.
 */
function AppFrame({
  children,
  label,
  wide = false,
}: {
  children: React.ReactNode;
  label: string;
  wide?: boolean;
}) {
  return (
    <div className={`${styles.appFrame} ${wide ? styles.appFrameWide : ''}`}>
      <div className={styles.appChrome}>
        <span className={styles.appDots} aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span className={styles.appUrl}>rwa.decodasecurity.com</span>
      </div>
      <div className={`surface-dark ${styles.appViewport}`} role="img" aria-label={label}>
        {children}
      </div>
    </div>
  );
}

const outcomes = [
  'Monitor risk across the program continuously, not at review time.',
  'Investigate activity with the surrounding context already assembled.',
  'Respond through policy-controlled actions with defined authority.',
  'Preserve verifiable evidence of what happened and what was decided.',
];

const supportingViews = [
  {
    render: <InvestigationMock />,
    title: 'Investigation workflow',
    caption: 'Triage an alert, correlate related activity, and record the decision trail.',
    label: 'Decoda RWA Guard investigation workflow',
  },
  {
    render: <EvidenceMock />,
    title: 'Evidence and audit trail',
    caption: 'Assemble control evidence and audit-ready reporting for oversight functions.',
    label: 'Decoda RWA Guard evidence and audit trail report',
  },
];

export function RwaSecurityPlatform() {
  return (
    <section className={`${styles.section} ${styles.sectionAlt}`} aria-labelledby="flagship-solution">
      <div className="container">
        <div className={styles.flagshipGrid}>
          <SectionReveal>
            <p className={styles.eyebrow}>Flagship solution</p>
            <h2 id="flagship-solution" className={styles.sectionTitle}>
              Security operations for tokenized financial infrastructure.
            </h2>
            <p className={styles.sectionLead}>
              Decoda RWA Guard is the platform available today. It monitors risk across a
              real-world asset program, supports investigation of activity in context, carries out
              response under policy control, and preserves verifiable evidence of what was done.
            </p>
            <ul className={styles.outcomeList}>
              {outcomes.map((outcome) => (
                <li key={outcome}>
                  <IconCheck className={styles.outcomeIcon} size={16} />
                  <span>{outcome}</span>
                </li>
              ))}
            </ul>
            <div className={styles.flagshipActions}>
              <a href={RWA_APP_URL} className="button-primary">
                Explore RWA Security
                <IconExternal size={16} />
              </a>
              <Link href="/solutions/rwa-security" className="button-secondary">
                Solution overview
              </Link>
            </div>
          </SectionReveal>

          <SectionReveal className="reveal-rise">
            <AppFrame wide label="Decoda RWA Guard dashboard overview">
              <DashboardMock />
            </AppFrame>
            <p className={styles.previewNote}>
              Representative interface. Values shown are illustrative.
            </p>
          </SectionReveal>
        </div>

        <RevealGroup className={styles.supportingGrid}>
          {supportingViews.map((view) => (
            <article key={view.title} className={styles.supportingCard}>
              <AppFrame label={view.label}>{view.render}</AppFrame>
              <h3 className={styles.supportingTitle}>{view.title}</h3>
              <p className={styles.supportingBody}>{view.caption}</p>
            </article>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
