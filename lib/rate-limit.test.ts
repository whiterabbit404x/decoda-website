import { test } from 'node:test';
import assert from 'node:assert/strict';
import { __resetRateLimiter, rateLimit } from './rate-limit';

test('rate limiter allows up to the limit then blocks within the window', () => {
  __resetRateLimiter();
  const options = { limit: 3, windowMs: 1000 };
  const t0 = 1_000_000;

  assert.equal(rateLimit('client', options, t0).allowed, true);
  assert.equal(rateLimit('client', options, t0).allowed, true);
  assert.equal(rateLimit('client', options, t0).allowed, true);

  const blocked = rateLimit('client', options, t0);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSeconds >= 1);
});

test('rate limiter resets after the window elapses', () => {
  __resetRateLimiter();
  const options = { limit: 1, windowMs: 1000 };
  const t0 = 2_000_000;

  assert.equal(rateLimit('client', options, t0).allowed, true);
  assert.equal(rateLimit('client', options, t0).allowed, false);
  assert.equal(rateLimit('client', options, t0 + 1001).allowed, true);
});

test('rate limiter tracks keys independently', () => {
  __resetRateLimiter();
  const options = { limit: 1, windowMs: 1000 };
  const t0 = 3_000_000;

  assert.equal(rateLimit('a', options, t0).allowed, true);
  assert.equal(rateLimit('b', options, t0).allowed, true);
  assert.equal(rateLimit('a', options, t0).allowed, false);
});
