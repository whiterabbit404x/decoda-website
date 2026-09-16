import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POST } from './route';
import {
  CONTACT_INVALID_REQUEST,
  CONTACT_RATE_LIMITED,
  CONTACT_SEND_FAILED,
  CONTACT_VALIDATION_FAILED,
  HONEYPOT_FIELD,
} from '@/lib/contact';
import { __resetRateLimiter } from '@/lib/rate-limit';

function makeRequest(ip: string, body: unknown, raw?: string): Request {
  return new Request('http://localhost/api/contact', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: raw !== undefined ? raw : JSON.stringify(body),
  });
}

const invalidBody = { name: '', email: '', interestArea: '', message: '' };

const validBody = {
  name: 'Jane Smith',
  email: 'jane@institution.com',
  company: 'Institution',
  interestArea: 'RWA Security demo',
  message: 'We are evaluating custody controls for an RWA program.',
};

/**
 * Run `fn` with no provider credentials and with server logging captured, so the
 * unconfigured-production path can be exercised without network access or noise.
 */
async function withoutCredentials<T>(fn: () => Promise<T>): Promise<{ result: T; logs: unknown[] }> {
  const previousKey = process.env.RESEND_API_KEY;
  const originalError = console.error;
  const logs: unknown[] = [];
  delete process.env.RESEND_API_KEY;
  console.error = (...args: unknown[]) => logs.push(args);
  try {
    return { result: await fn(), logs };
  } finally {
    console.error = originalError;
    if (previousKey !== undefined) {
      process.env.RESEND_API_KEY = previousKey;
    }
  }
}

test('malformed JSON is rejected with a controlled 400', async () => {
  __resetRateLimiter();
  const res = await POST(makeRequest('10.0.0.1', undefined, '{ not json'));
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.error, CONTACT_INVALID_REQUEST);
  assert.equal(data.ok, false);
});

test('an invalid submission returns 400 with field errors (no send attempted)', async () => {
  __resetRateLimiter();
  const res = await POST(makeRequest('10.0.0.2', { ...invalidBody, email: 'bad' }));
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.error, CONTACT_VALIDATION_FAILED);
  assert.ok(data.fieldErrors.email);
});

test('repeated submissions from one IP are rate limited with a Retry-After header', async () => {
  __resetRateLimiter();
  const ip = '10.0.0.3';
  for (let i = 0; i < 5; i += 1) {
    const res = await POST(makeRequest(ip, invalidBody));
    assert.equal(res.status, 400); // validation failures still count toward the limit
  }
  const blocked = await POST(makeRequest(ip, invalidBody));
  assert.equal(blocked.status, 429);
  const data = await blocked.json();
  assert.equal(data.error, CONTACT_RATE_LIMITED);
  assert.ok(blocked.headers.get('retry-after'));
});

// --- The production failure this change was written for ----------------------

test('an unconfigured provider returns {ok:false, CONTACT_SEND_FAILED} — never a false success', async () => {
  __resetRateLimiter();
  const { result: res, logs } = await withoutCredentials(() =>
    POST(makeRequest('10.0.0.4', validBody)),
  );

  assert.equal(res.status, 502);
  const data = await res.json();
  assert.deepEqual(data, { ok: false, error: CONTACT_SEND_FAILED });

  // The operator gets an actionable reason in the server log...
  const details = (logs[0] as unknown[])[1] as Record<string, unknown>;
  assert.equal(details.reason, 'config');
  assert.equal(details.code, 'MISSING_API_KEY');
  // ...while the browser gets nothing beyond the generic code.
  assert.equal(JSON.stringify(data).includes('MISSING_API_KEY'), false);
});

test('a failed submission never returns a stack trace or provider internals', async () => {
  __resetRateLimiter();
  const { result: res } = await withoutCredentials(() =>
    POST(makeRequest('10.0.0.5', validBody)),
  );

  const raw = await res.text();
  assert.equal(raw.includes('at '), false);
  assert.equal(raw.toLowerCase().includes('resend'), false);
  assert.equal(Object.keys(JSON.parse(raw)).sort().join(','), 'error,ok');
});

// --- Spam handling -----------------------------------------------------------

test('a honeypot submission is accepted without contacting the provider', async () => {
  __resetRateLimiter();
  // No credentials are configured, so reaching the provider would 502. A 200
  // proves the honeypot short-circuited before any send was attempted.
  const { result: res } = await withoutCredentials(() =>
    POST(makeRequest('10.0.0.6', { ...validBody, [HONEYPOT_FIELD]: 'http://spam.example' })),
  );

  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
});

// --- Response hygiene --------------------------------------------------------

test('submission outcomes are never cached', async () => {
  __resetRateLimiter();
  const res = await POST(makeRequest('10.0.0.7', invalidBody));
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.match(res.headers.get('content-type') ?? '', /application\/json/);
});
