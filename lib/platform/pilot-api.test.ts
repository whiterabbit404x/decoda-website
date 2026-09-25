import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { describe } from 'node:test';
import type { EmailMessage } from '../contact';
import { issueFormToken } from './form-token';
import { handlePilotRequestSubmission, type PilotApiDeps } from './pilot-api';
import { PILOT_FORM_HEADER, PILOT_FORM_HEADER_VALUE, PILOT_HONEYPOT_FIELD } from './pilot-form';
import { dbIt, useTestDatabase } from './testing/database';

const SECRET = 'p'.repeat(48);
const silent = { info: () => undefined, warn: () => undefined, error: () => undefined };

describe('POST /api/pilot-requests', () => {
  const db = useTestDatabase();

  function deps(overrides: Partial<PilotApiDeps> = {}) {
    const sent: EmailMessage[] = [];
    const value: PilotApiDeps = {
      secret: SECRET,
      pool: db().pool,
      sendEmail: async (message) => {
        sent.push(message);
        return { id: 'email_1' };
      },
      emailConfig: { notificationTo: 'hello@decoda.test', from: 'Decoda <noreply@decoda.test>', sendConfirmation: true },
      websiteUrl: 'https://www.decoda.test',
      rateLimit: () => ({ allowed: true, retryAfterSeconds: 0 }),
      logger: silent,
      ...overrides,
    };
    return { value, sent };
  }

  function uniqueEmail() {
    return `applicant.${randomBytes(4).toString('hex')}@institution.test`;
  }

  function body(overrides: Record<string, unknown> = {}) {
    return {
      email: uniqueEmail(),
      fullName: 'Jane Smith',
      company: 'Institution Capital',
      role: 'CISO',
      requestedProducts: ['rwa_guard', 'vault'],
      formToken: issueFormToken(SECRET, Date.now() - 10_000),
      ...overrides,
    };
  }

  function request(payload: unknown, headers: Record<string, string> = {}) {
    return new Request('https://www.decoda.test/api/pilot-requests', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://www.decoda.test',
        host: 'www.decoda.test',
        'x-forwarded-for': `198.51.100.${Math.floor(Math.random() * 200)}`,
        [PILOT_FORM_HEADER]: PILOT_FORM_HEADER_VALUE,
        ...headers,
      },
      body: JSON.stringify(payload),
    });
  }

  async function rowsFor(email: string) {
    const { rows } = await db().pool.query('SELECT status, metadata FROM platform.pilot_requests WHERE email = $1', [email]);
    return rows;
  }

  dbIt('records a pending request, audits it and sends both templated emails — without creating any account', async () => {
    const { value, sent } = deps();
    const payload = body();
    const response = await handlePilotRequestSubmission(request(payload), () => value);
    assert.equal(response.status, 200);
    const json = await response.json();
    assert.equal(json.ok, true);
    assert.match(json.reference, /^req_/);
    const rows = await rowsFor(payload.email as string);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].status, 'pending');
    assert.deepEqual(rows[0].metadata.notifications, { internal: 'sent', confirmation: 'sent' });
    assert.equal(sent.length, 2);
    assert.equal(sent[0]!.to, 'hello@decoda.test');
    assert.equal(sent[0]!.replyTo, payload.email);
    assert.equal(sent[1]!.to, payload.email);
    // The confirmation acknowledges receipt; it never claims approval or access.
    assert.match(sent[1]!.text, /received your request and will review the requested product access/);
    assert.match(sent[1]!.text, /This email does not grant access: if your request is approved/);
    assert.doesNotMatch(sent[1]!.text, /has been approved|you('re| are) approved|access (is|has been) granted|welcome to decoda/i);
    const users = await db().pool.query('SELECT count(*)::int AS n FROM platform.users WHERE email = $1', [payload.email]);
    assert.equal(users.rows[0].n, 0);
    const memberships = await db().pool.query('SELECT count(*)::int AS n FROM platform.organization_memberships');
    assert.equal(memberships.rows[0].n, 0);
  });

  dbIt('a duplicate submission answers identically, stores one row and sends no second email', async () => {
    const { value, sent } = deps();
    const payload = body();
    const first = await (await handlePilotRequestSubmission(request(payload), () => value)).json();
    const second = await handlePilotRequestSubmission(request({ ...payload, formToken: issueFormToken(SECRET, Date.now() - 10_000) }), () => value);
    assert.equal(second.status, 200);
    const secondJson = await second.json();
    assert.equal(secondJson.ok, true);
    assert.deepEqual(Object.keys(secondJson).sort(), Object.keys(first).sort());
    assert.equal((await rowsFor(payload.email as string)).length, 1);
    assert.equal(sent.length, 2);
  });

  dbIt('rejects a cross-origin post and one without the form header (CSRF)', async () => {
    const { value } = deps();
    const crossOrigin = await handlePilotRequestSubmission(request(body(), { origin: 'https://evil.test' }), () => value);
    assert.equal(crossOrigin.status, 403);
    const noHeader = await handlePilotRequestSubmission(request(body(), { [PILOT_FORM_HEADER]: '' }), () => value);
    assert.equal(noHeader.status, 403);
  });

  dbIt('answers 429 when the per-IP limiter trips, before doing any work', async () => {
    const { value } = deps({ rateLimit: () => ({ allowed: false, retryAfterSeconds: 42 }) });
    const payload = body();
    const response = await handlePilotRequestSubmission(request(payload), () => value);
    assert.equal(response.status, 429);
    assert.equal(response.headers.get('retry-after'), '42');
    assert.equal((await rowsFor(payload.email as string)).length, 0);
  });

  dbIt('enforces the durable per-email limit across requests', async () => {
    const { value } = deps();
    const email = uniqueEmail();
    for (let i = 0; i < 3; i += 1) {
      await db().pool.query(
        `INSERT INTO platform.pilot_requests (email, email_domain, full_name, company_name, role, requested_products, request_id, status, reviewed_at)
         VALUES ($1, 'institution.test', 'x', 'x', 'x', ARRAY['vault'], $2, 'rejected', now())`,
        [email, `req_limit_seed_${i}0000`],
      );
    }
    const response = await handlePilotRequestSubmission(request(body({ email })), () => value);
    assert.equal(response.status, 429);
  });

  dbIt('silently discards honeypot and too-fast (bot) submissions', async () => {
    const { value, sent } = deps();
    const honeypot = body({ [PILOT_HONEYPOT_FIELD]: 'call me' });
    const r1 = await handlePilotRequestSubmission(request(honeypot), () => value);
    assert.equal(r1.status, 200);
    assert.equal((await r1.json()).ok, true);
    assert.equal((await rowsFor(honeypot.email as string)).length, 0);

    const fast = body({ formToken: issueFormToken(SECRET, Date.now()) });
    const r2 = await handlePilotRequestSubmission(request(fast), () => value);
    assert.equal(r2.status, 200);
    assert.equal((await rowsFor(fast.email as string)).length, 0);
    assert.equal(sent.length, 0);
  });

  dbIt('refuses a missing or forged form token', async () => {
    const { value } = deps();
    const r1 = await handlePilotRequestSubmission(request(body({ formToken: undefined })), () => value);
    assert.equal(r1.status, 400);
    assert.equal((await r1.json()).error.code, 'PILOT_FORM_EXPIRED');
    const r2 = await handlePilotRequestSubmission(request(body({ formToken: issueFormToken('x'.repeat(40), Date.now() - 10_000) })), () => value);
    assert.equal(r2.status, 400);
  });

  dbIt('returns field errors for invalid input without echoing it', async () => {
    const { value } = deps();
    const response = await handlePilotRequestSubmission(request(body({ email: 'nope', company: '' })), () => value);
    assert.equal(response.status, 400);
    const json = await response.json();
    assert.equal(json.error.code, 'PILOT_VALIDATION_FAILED');
    assert.ok(json.fieldErrors.email);
    assert.ok(json.fieldErrors.company);
    assert.equal(JSON.stringify(json).includes('nope'), false);
  });

  dbIt('refuses non-JSON bodies', async () => {
    const { value } = deps();
    const response = await handlePilotRequestSubmission(request(body(), { 'content-type': 'text/plain' }), () => value);
    assert.equal(response.status, 415);
  });

  dbIt('keeps the request when email delivery fails, and records the failure', async () => {
    const { value } = deps({
      sendEmail: async () => {
        throw Object.assign(new Error('provider down'), { code: 'TRANSPORT_ERROR' });
      },
    });
    const payload = body();
    const response = await handlePilotRequestSubmission(request(payload), () => value);
    assert.equal(response.status, 200);
    const rows = await rowsFor(payload.email as string);
    assert.deepEqual(rows[0].metadata.notifications, { internal: 'failed', confirmation: 'failed' });
  });

  dbIt('fails closed (503) when the platform is not configured', async () => {
    const { PlatformConfigError } = await import('./errors');
    const response = await handlePilotRequestSubmission(request(body()), () => {
      throw new PlatformConfigError(['DECODA_PLATFORM_SECRET']);
    });
    assert.equal(response.status, 503);
    const json = await response.json();
    assert.equal(json.error.code, 'PLATFORM_NOT_CONFIGURED');
    assert.equal(JSON.stringify(json).includes('DECODA_PLATFORM_SECRET'), false);
  });
});
