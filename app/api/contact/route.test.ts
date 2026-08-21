import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POST } from './route';
import { __resetRateLimiter } from '@/lib/rate-limit';

function makeRequest(ip: string, body: unknown, raw?: string): Request {
  return new Request('http://localhost/api/contact', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: raw !== undefined ? raw : JSON.stringify(body),
  });
}

const invalidBody = { name: '', email: '', interestArea: '', message: '' };

test('malformed JSON is rejected with a controlled 400', async () => {
  __resetRateLimiter();
  const res = await POST(makeRequest('10.0.0.1', undefined, '{ not json'));
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.error, 'invalid_request');
});

test('an invalid submission returns 400 with field errors (no send attempted)', async () => {
  __resetRateLimiter();
  const res = await POST(makeRequest('10.0.0.2', { ...invalidBody, email: 'bad' }));
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.error, 'validation');
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
  assert.equal(data.error, 'rate_limited');
  assert.ok(blocked.headers.get('retry-after'));
});
