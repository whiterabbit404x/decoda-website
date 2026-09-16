import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readResendEnvelope, sendEmailViaResend } from './email';
import { EmailDeliveryError } from './contact';

const message = {
  to: 'hello@decodasecurity.com',
  from: 'Decoda Website <noreply@decodasecurity.com>',
  subject: 'New Decoda Website Inquiry',
  text: 'body',
};

// --- Configuration failures -------------------------------------------------

test('a missing RESEND_API_KEY fails as a config error before any network call', async () => {
  const previous = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  try {
    await assert.rejects(
      () => sendEmailViaResend(message),
      (error: unknown) => {
        assert.ok(error instanceof EmailDeliveryError);
        assert.equal(error.reason, 'config');
        assert.equal(error.code, 'MISSING_API_KEY');
        // The thrown message must never echo credential material.
        assert.equal(/re_[A-Za-z0-9]/.test(error.message), false);
        return true;
      },
    );
  } finally {
    if (previous !== undefined) {
      process.env.RESEND_API_KEY = previous;
    }
  }
});

test('an unverified sending domain is classified as a config failure', () => {
  assert.throws(
    () =>
      readResendEnvelope({
        data: null,
        error: {
          name: 'validation_error',
          statusCode: 403,
          message:
            'The decodasecurity.com domain is not verified. Please, add and verify your domain.',
        },
      }),
    (error: unknown) => {
      assert.ok(error instanceof EmailDeliveryError);
      assert.equal(error.reason, 'config');
      assert.equal(error.statusCode, 403);
      assert.match(String(error.providerMessage), /not verified/);
      return true;
    },
  );
});

test('an invalid API key is classified as a config failure', () => {
  assert.throws(
    () =>
      readResendEnvelope({
        data: null,
        error: { name: 'validation_error', statusCode: 401, message: 'API key is invalid' },
      }),
    (error: unknown) => error instanceof EmailDeliveryError && error.reason === 'config',
  );
});

// --- Transient provider failures --------------------------------------------

test('a provider outage is classified as retryable, not a config problem', () => {
  assert.throws(
    () =>
      readResendEnvelope({
        data: null,
        error: { name: 'application_error', statusCode: 500, message: 'Internal server error.' },
      }),
    (error: unknown) => error instanceof EmailDeliveryError && error.reason === 'provider',
  );
});

test('provider text is redacted before it can reach a log', () => {
  assert.throws(
    () =>
      readResendEnvelope({
        data: null,
        error: { name: 'validation_error', statusCode: 401, message: 'key re_LiveSecret123 denied' },
      }),
    (error: unknown) => {
      assert.ok(error instanceof EmailDeliveryError);
      assert.equal(String(error.providerMessage).includes('re_LiveSecret123'), false);
      assert.match(String(error.providerMessage), /re_\[redacted\]/);
      return true;
    },
  );
});

// --- Successful delivery ----------------------------------------------------

test('a successful provider response returns the delivery id', () => {
  const result = readResendEnvelope({ data: { id: 'abc-123' }, error: null });
  assert.deepEqual(result, { id: 'abc-123' });
});

test('an accepted response with no delivery id is NOT reported as success', () => {
  assert.throws(
    () => readResendEnvelope({ data: null, error: null }),
    (error: unknown) => error instanceof EmailDeliveryError && error.code === 'NO_DELIVERY_ID',
  );
});
