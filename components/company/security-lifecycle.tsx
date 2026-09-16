'use client';

import { Fragment } from 'react';
import {
  IconDetect,
  IconInvestigate,
  IconObserve,
  IconProve,
  IconRespond,
} from './icons';
import { SectionReveal, useInView } from './section-reveal';
import styles from './company.module.css';

const steps = [
  {
    icon: IconObserve,
    name: 'Observe',
    body: 'Collect signals continuously across on-chain activity, infrastructure, systems, and users.',
  },
  {
    icon: IconDetect,
    name: 'Detect',
    body: 'Surface anomalies, policy violations, and emerging risk patterns as they appear.',
  },
  {
    icon: IconInvestigate,
    name: 'Investigate',
    body: 'Triage, correlate related activity, and establish impact in one workspace.',
  },
  {
    icon: IconRespond,
    name: 'Respond',
    body: 'Act through policy-controlled response with defined authority and ownership.',
  },
  {
    icon: IconProve,
    name: 'Prove',
    body: 'Retain verifiable evidence of what happened and what was decided.',
  },
];

/** Each stage lands 450ms after the previous one; the connector between two
 *  stages draws in the gap. The last stage settles at ~2.24s and its verified
 *  state completes at ~2.57s — one pass, never replayed. */
const STEP_STRIDE_MS = 450;
const CONNECTOR_OFFSET_MS = 300;
const VERIFIED_DELAY_MS = (steps.length - 1) * STEP_STRIDE_MS + 350;

export function SecurityLifecycle() {
  // Drives the one-time sequence. The armed (pre-sequence) state lives in CSS
  // behind html[data-js='1'], so it is in place from first paint — there is no
  // hydration flash, and with JS or motion disabled the diagram simply renders
  // in its completed state.
  const { ref, inView } = useInView<HTMLOListElement>({ threshold: 0.25 });

  return (
    <section className={styles.section} aria-labelledby="lifecycle">
      <div className="container">
        <SectionReveal className={styles.sectionHead}>
          <p className={styles.eyebrow}>Security operating lifecycle</p>
          <h2 id="lifecycle" className={styles.sectionTitle}>
            One operating loop, from continuous signal to defensible proof.
          </h2>
          <p className={styles.sectionLead}>
            Each stage hands the next one something it can act on — and the last stage produces the
            record the first four earned.
          </p>
        </SectionReveal>

        <ol ref={ref} className={styles.lifecycle} data-play={inView ? 'on' : undefined}>
          {steps.map(({ icon: Icon, name, body }, index) => (
            <Fragment key={name}>
              {index > 0 ? (
                <li className={styles.connector} aria-hidden="true">
                  <span
                    className={styles.connectorFill}
                    style={{
                      animationDelay: `${(index - 1) * STEP_STRIDE_MS + CONNECTOR_OFFSET_MS}ms`,
                    }}
                  />
                </li>
              ) : null}
              <li
                className={styles.step}
                style={{ animationDelay: `${index * STEP_STRIDE_MS}ms` }}
              >
                <div className={styles.stepTop}>
                  <span className={styles.stepIcon}>
                    <Icon size={20} />
                    {index === steps.length - 1 ? (
                      <span
                        className={styles.stepVerified}
                        style={{ animationDelay: `${VERIFIED_DELAY_MS}ms` }}
                        aria-hidden="true"
                      />
                    ) : null}
                  </span>
                  <h3 className={styles.stepName}>{name}</h3>
                </div>
                <p className={styles.stepBody}>{body}</p>
              </li>
            </Fragment>
          ))}
        </ol>
      </div>
    </section>
  );
}
