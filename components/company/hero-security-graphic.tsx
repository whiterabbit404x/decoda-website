import styles from './company.module.css';

/* --------------------------------------------------------------------------
   Enterprise security architecture diagram for the hero.

   Reads as an infrastructure control diagram, not a Web3 motif: three
   monitored domains feed a central control plane inside a security perimeter,
   and the control plane drives policy and evidence outputs.

   Motion (the site's only looping animation) is a single ~10s ambient cycle
   defined entirely in CSS: link 1 → link 2 → link 3 → verified control state →
   policy → evidence → hold → wind down → repeat. Every animated element pairs
   a dim static base shape with an accent overlay whose opacity (and, for
   connectors, stroke-dashoffset) is animated — nothing moves, nothing flashes,
   and no layout is touched.

   `pathLength="1"` normalises every connector so one stroke-dash rule draws
   paths of different real lengths at the same rate.

   The base (unanimated) state of every overlay is the FINAL verified state, so
   under prefers-reduced-motion — where globals.css disables animation outright
   — the diagram simply renders complete and still.

   Geometry note: the viewBox is kept tight (372×272) so that at mobile widths
   the node labels are still scaled large enough to read.
   -------------------------------------------------------------------------- */

/** Monitored domains feeding the control plane (left column). */
const inputs = [
  { label: 'Monitoring', y: 44, link: 'M130 60 H139 V118 H148', stage: styles.stage1 },
  { label: 'Infrastructure', y: 120, link: 'M130 136 H148', stage: styles.stage2 },
  { label: 'Operations', y: 196, link: 'M130 212 H139 V154 H148', stage: styles.stage3 },
];

/** Control outputs (right column). */
const outputs = [
  { label: 'Policy', y: 82, link: 'M224 118 H233 V98 H242', stage: styles.stage5 },
  { label: 'Evidence', y: 158, link: 'M224 154 H233 V174 H242', stage: styles.stage6 },
];

const NODE_W = 112;
const NODE_H = 32;

export function HeroSecurityGraphic() {
  return (
    <svg
      className={styles.graphic}
      viewBox="0 0 372 272"
      role="img"
      aria-labelledby="hero-graphic-title hero-graphic-desc"
      focusable="false"
    >
      <title id="hero-graphic-title">Decoda security control plane</title>
      <desc id="hero-graphic-desc">
        Monitoring, infrastructure and operations signals feed a central control plane inside a
        security perimeter, which drives policy enforcement and verifiable evidence.
      </desc>

      {/* Security perimeter */}
      <rect className={styles.gPerimeter} x="6" y="6" width="360" height="260" rx="18" />
      <text className={styles.gPerimeterLabel} x="22" y="27">
        SECURITY PERIMETER
      </text>

      {/* Connectors: dim base rail + accent overlay that draws in on its stage */}
      {[...inputs, ...outputs].map(({ label, link, stage }) => (
        <g key={`link-${label}`}>
          <path className={styles.gLinkBase} d={link} />
          <path className={`${styles.gLinkOn} ${stage}`} d={link} pathLength={1} />
        </g>
      ))}

      {/* Input nodes */}
      {inputs.map(({ label, y, stage }) => (
        <g key={label}>
          <rect className={styles.gNodeBase} x="18" y={y} width={NODE_W} height={NODE_H} rx="9" />
          <rect className={`${styles.gNodeOn} ${stage}`} x="18" y={y} width={NODE_W} height={NODE_H} rx="9" />
          <text className={styles.gLabel} x="74" y={y + NODE_H / 2} textAnchor="middle" dominantBaseline="central">
            {label}
          </text>
        </g>
      ))}

      {/* Output nodes */}
      {outputs.map(({ label, y, stage }) => (
        <g key={label}>
          <rect className={styles.gNodeBase} x="242" y={y} width={NODE_W} height={NODE_H} rx="9" />
          <rect className={`${styles.gNodeOn} ${stage}`} x="242" y={y} width={NODE_W} height={NODE_H} rx="9" />
          <text className={styles.gLabel} x="298" y={y + NODE_H / 2} textAnchor="middle" dominantBaseline="central">
            {label}
          </text>
        </g>
      ))}

      {/* Control plane hub */}
      <rect className={styles.gHubBase} x="148" y="94" width="76" height="84" rx="16" />
      <rect className={`${styles.gHubOn} ${styles.stage4}`} x="148" y="94" width="76" height="84" rx="16" />
      <circle className={styles.gRingBase} cx="186" cy="124" r="15" />
      <circle className={`${styles.gRingOn} ${styles.stage4}`} cx="186" cy="124" r="15" />
      <path
        className={`${styles.gCheck} ${styles.stage4}`}
        d="M179 124.5 L184.5 130 L195 118"
        pathLength={1}
      />
      <text className={styles.gCaption} x="186" y="155" textAnchor="middle">
        CONTROL
      </text>
      <text className={styles.gCaption} x="186" y="167" textAnchor="middle">
        PLANE
      </text>
    </svg>
  );
}
