/**
 * POST /api/pilot-requests — the public Request Pilot submission.
 *
 * Controls, in order:
 *   * same-origin Origin header + the custom `X-Decoda-Form` header (a
 *     cross-site page cannot send it without a CORS preflight this route never
 *     approves) — CSRF protection for an unauthenticated form;
 *   * per-IP in-memory rate limit (best effort) before any work;
 *   * JSON only, size-capped;
 *   * honeypot and signed form token: a filled honeypot or a submission faster
 *     than a person can type is answered like a success and NOT stored, so a
 *     bot learns nothing; a missing/forged/expired token is refused;
 *   * server-side validation and normalisation;
 *   * durable per-email and per-IP-hash limits in the database;
 *   * persistence + audit in one transaction; duplicates are idempotent;
 *   * best-effort templated emails AFTER commit, outcome recorded.
 * Responses carry a correlation id and never echo input or provider errors.
 */
import type { Pool } from 'pg';
import type { EmailMessage } from '../contact';
import type { PilotEmailConfig } from './config';
import { isSameOrigin } from './csrf';
import { withTransaction } from './db';
import { pilotConfirmationEmail, pilotInternalNotificationEmail } from './email-templates';
import { forbidden, PlatformError } from './errors';
import { checkFormToken } from './form-token';
import { errorResponse, json, readJsonBody } from './http';
import { PILOT_FORM_HEADER, PILOT_FORM_HEADER_VALUE } from './pilot-form';
import {
  PILOT_HONEYPOT_FIELD,
  recordNotificationOutcome,
  submitPilotRequest,
  validatePilotRequest,
  type PilotSubmission,
} from './pilot-requests';
import { clientIp, hashIp, requestIdFor } from './request-context';


export interface PilotApiDeps {
  secret: string;
  pool: Pool;
  sendEmail: (message: EmailMessage) => Promise<{ id?: string }>;
  emailConfig: PilotEmailConfig;
  websiteUrl: string;
  rateLimit: (key: string) => { allowed: boolean; retryAfterSeconds: number };
  now?: () => number;
  logger?: Pick<Console, 'info' | 'warn' | 'error'>;
}

async function deliverNotifications(deps: PilotApiDeps, data: PilotSubmission, pilotRequestId: string, requestId: string) {
  const logger = deps.logger ?? console;
  const outcome: { internal: 'sent' | 'failed' | 'skipped'; confirmation: 'sent' | 'failed' | 'skipped' } = {
    internal: 'failed',
    confirmation: deps.emailConfig.sendConfirmation ? 'failed' : 'skipped',
  };
  const internal = pilotInternalNotificationEmail(data, {
    pilotRequestId,
    requestId,
    reviewUrl: `${deps.websiteUrl}/admin/pilot-requests/${pilotRequestId}`,
    submittedAt: new Date(deps.now?.() ?? Date.now()),
  });
  try {
    await deps.sendEmail({ from: deps.emailConfig.from, to: deps.emailConfig.notificationTo, replyTo: data.email, ...internal });
    outcome.internal = 'sent';
  } catch (error) {
    logger.error('[pilot] internal notification failed', { request_id: requestId, code: (error as { code?: string }).code ?? 'unknown' });
  }
  if (deps.emailConfig.sendConfirmation) {
    try {
      await deps.sendEmail({ from: deps.emailConfig.from, to: data.email, replyTo: deps.emailConfig.notificationTo, ...pilotConfirmationEmail(data) });
      outcome.confirmation = 'sent';
    } catch (error) {
      logger.warn('[pilot] confirmation email failed', { request_id: requestId, code: (error as { code?: string }).code ?? 'unknown' });
    }
  }
  await withTransaction((client) => recordNotificationOutcome(client, pilotRequestId, outcome), deps.pool).catch(() => undefined);
}

export async function handlePilotRequestSubmission(request: Request, loadDeps: () => PilotApiDeps | Promise<PilotApiDeps>): Promise<Response> {
  const requestId = requestIdFor(request);
  let logger: Pick<Console, 'info' | 'warn' | 'error'> = console;
  try {
    const deps = await loadDeps();
    logger = deps.logger ?? console;
    if (!isSameOrigin(request) || request.headers.get(PILOT_FORM_HEADER) !== PILOT_FORM_HEADER_VALUE) {
      throw forbidden('ORIGIN_REJECTED', 'Submit the request from the Decoda website.');
    }
    const ip = clientIp(request);
    const limit = deps.rateLimit(`pilot:${ip}`);
    if (!limit.allowed) {
      return json({ ok: false, error: { code: 'PILOT_RATE_LIMITED', message: 'Too many requests. Please try again later.', request_id: requestId } }, 429, {
        'retry-after': String(limit.retryAfterSeconds),
      });
    }
    const body = await readJsonBody(request, 16 * 1024);

    const honeypot = typeof body[PILOT_HONEYPOT_FIELD] === 'string' && (body[PILOT_HONEYPOT_FIELD] as string).trim() !== '';
    const token = checkFormToken(body.formToken, deps.secret, deps.now?.() ?? Date.now());
    if (honeypot || token === 'too_fast') {
      // Indistinguishable from success; nothing is stored or sent.
      logger.warn('[pilot] automated submission discarded', { request_id: requestId, reason: honeypot ? 'honeypot' : 'too_fast' });
      return json({ ok: true, reference: requestId });
    }
    if (token !== 'ok') {
      throw new PlatformError(400, 'PILOT_FORM_EXPIRED', 'This form has expired. Refresh the page and submit it again.');
    }

    const validation = validatePilotRequest(body);
    if (!validation.success) {
      return json(
        { ok: false, error: { code: 'PILOT_VALIDATION_FAILED', message: 'Check the highlighted fields.', request_id: requestId }, fieldErrors: validation.fieldErrors },
        400,
      );
    }

    const ipHash = hashIp(ip, deps.secret);
    const outcome = await withTransaction(
      (client) => submitPilotRequest(client, validation.data, { requestId, ipHash, source: 'website' }),
      deps.pool,
    );
    logger.info('[pilot] request recorded', { request_id: requestId, outcome: outcome.kind, products: validation.data.requestedProducts });
    if (outcome.kind === 'created') {
      await deliverNotifications(deps, validation.data, outcome.id, requestId);
    }
    // Same answer for a new and a duplicate submission: no enumeration.
    return json({ ok: true, reference: requestId });
  } catch (error) {
    return errorResponse(error, requestId, logger);
  }
}
