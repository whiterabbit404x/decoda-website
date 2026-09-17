import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildNotificationEmail,
  CONTACT_RATE_LIMITED,
  CONTACT_SEND_FAILED,
  CONTACT_VALIDATION_FAILED,
  DEFAULT_CONTACT_FROM_EMAIL,
  DEFAULT_CONTACT_TO_EMAIL,
  describeSendFailure,
  EmailDeliveryError,
  extractSenderDomain,
  handleContactSubmission,
  interpretContactResponse,
  readEnvValue,
  redactSecrets,
  type EmailMessage,
  type HandleContactOptions,
  validateContactSubmission,
} from './contact';

const validBody = {
  name: 'Jane Smith',
  email: 'jane@institution.com',
  company: 'Institution',
  interestArea: 'RWA Security demo',
  message: 'We are evaluating custody controls for an RWA program.',
};

function recordingSender() {
  const calls: EmailMessage[] = [];
  const sendEmail = async (message: EmailMessage) => {
    calls.push(message);
    return { id: 'test-id' };
  };
  return { sendEmail, calls };
}

function baseOptions(sendEmail: HandleContactOptions['sendEmail']): HandleContactOptions {
  return {
    sendEmail,
    toEmail: DEFAULT_CONTACT_TO_EMAIL,
    fromEmail: DEFAULT_CONTACT_FROM_EMAIL,
    now: () => new Date('2026-08-21T12:00:00.000Z'),
    logger: { error: () => {} },
  };
}

// --- Successful request -----------------------------------------------------

test('valid submission delivers the notification to the Decoda inbox', async () => {
  const { sendEmail, calls } = recordingSender();
  const result = await handleContactSubmission(validBody, baseOptions(sendEmail));

  assert.deepEqual(result, { ok: true, status: 200 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].to, 'hello@decodasecurity.com');
  assert.equal(calls[0].from, DEFAULT_CONTACT_FROM_EMAIL);
  assert.equal(calls[0].replyTo, 'jane@institution.com');
  assert.equal(calls[0].subject, 'New Decoda Website Inquiry');
  assert.match(calls[0].text, /Name: Jane Smith/);
  assert.match(calls[0].text, /decodasecurity\.com\/contact/);
});

// --- Validation failure -----------------------------------------------------

test('invalid email does not send mail', async () => {
  const { sendEmail, calls } = recordingSender();
  const result = await handleContactSubmission(
    { ...validBody, email: 'not-an-email' },
    baseOptions(sendEmail),
  );

  assert.equal(result.ok, false);
  assert.equal(result.status, 400);
  assert.ok(!result.ok && result.status === 400 && result.fieldErrors.email);
  assert.equal(calls.length, 0);
});

test('missing required fields does not send mail', async () => {
  const { sendEmail, calls } = recordingSender();
  const result = await handleContactSubmission(
    { name: '', email: '', interestArea: '', message: '' },
    baseOptions(sendEmail),
  );

  assert.equal(result.ok, false);
  assert.equal(result.status, 400);
  assert.equal(calls.length, 0);
});

test('interest area outside the allowlist is rejected without sending', async () => {
  const { sendEmail, calls } = recordingSender();
  const result = await handleContactSubmission(
    { ...validBody, interestArea: 'Something not offered' },
    baseOptions(sendEmail),
  );

  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.status === 400 && result.fieldErrors.interestArea);
  assert.equal(calls.length, 0);
});

// --- Provider failure -------------------------------------------------------

test('provider failure returns a controlled 502 and never throws or leaks details', async () => {
  const sendEmail = async () => {
    throw new Error('resend exploded: sensitive provider detail');
  };
  const result = await handleContactSubmission(validBody, baseOptions(sendEmail));

  assert.equal(result.ok, false);
  assert.equal(result.status, 502);
  assert.ok(!result.ok && result.status === 502 && result.error === CONTACT_SEND_FAILED);
  // The generic code is all the browser ever receives.
  assert.equal(JSON.stringify(result).includes('sensitive provider detail'), false);
});

test('a missing API key is logged as an actionable config failure, not a generic one', async () => {
  const logged: unknown[] = [];
  const sendEmail = async () => {
    throw new EmailDeliveryError('RESEND_API_KEY is not set in this environment', {
      reason: 'config',
      code: 'MISSING_API_KEY',
    });
  };

  const result = await handleContactSubmission(validBody, {
    ...baseOptions(sendEmail),
    logger: { error: (...args: unknown[]) => logged.push(args) },
  });

  assert.equal(result.ok, false);
  const details = (logged[0] as unknown[])[1] as Record<string, unknown>;
  assert.equal(details.reason, 'config');
  assert.equal(details.code, 'MISSING_API_KEY');
});

test('an unverified sending domain is logged with the provider explanation', async () => {
  const logged: unknown[] = [];
  const sendEmail = async () => {
    throw new EmailDeliveryError('Resend rejected the send', {
      reason: 'config',
      code: 'validation_error',
      statusCode: 403,
      providerMessage: 'The decodasecurity.com domain is not verified.',
    });
  };

  await handleContactSubmission(validBody, {
    ...baseOptions(sendEmail),
    logger: { error: (...args: unknown[]) => logged.push(args) },
  });

  const details = (logged[0] as unknown[])[1] as Record<string, unknown>;
  assert.equal(details.statusCode, 403);
  assert.match(String(details.providerMessage), /not verified/);
});

test('provider credentials are redacted before anything is logged', () => {
  const described = describeSendFailure(
    new Error('auth failed for key re_AbC123SuperSecretValue using Bearer re_AbC123SuperSecretValue'),
  );
  const serialized = JSON.stringify(described);

  assert.equal(serialized.includes('re_AbC123SuperSecretValue'), false);
  assert.match(serialized, /re_\[redacted\]/);
  assert.equal(redactSecrets('plain text with no secret'), 'plain text with no secret');
});

// --- Recipient protection ---------------------------------------------------

test('client input can never change the destination recipient', async () => {
  const { sendEmail, calls } = recordingSender();
  const hostile = {
    ...validBody,
    to: 'attacker@evil.com',
    toEmail: 'attacker@evil.com',
    recipient: 'attacker@evil.com',
    from: 'attacker@evil.com',
  };
  const result = await handleContactSubmission(hostile, baseOptions(sendEmail));

  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].to, 'hello@decodasecurity.com');
  assert.equal(calls[0].from, DEFAULT_CONTACT_FROM_EMAIL);
});

// --- Spam protection --------------------------------------------------------

test('honeypot submissions are silently accepted without sending', async () => {
  const { sendEmail, calls } = recordingSender();
  const result = await handleContactSubmission(
    { ...validBody, company_website: 'http://spam.example' },
    baseOptions(sendEmail),
  );

  assert.deepEqual(result, { ok: true, status: 200 });
  assert.equal(calls.length, 0);
});

// --- Optional confirmation --------------------------------------------------

test('confirmation goes to the visitor while the notification goes to Decoda', async () => {
  const { sendEmail, calls } = recordingSender();
  await handleContactSubmission(validBody, {
    ...baseOptions(sendEmail),
    sendConfirmation: true,
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].to, 'hello@decodasecurity.com');
  assert.equal(calls[1].to, 'jane@institution.com');
  assert.equal(calls[1].subject, "We've received your Decoda Security inquiry");
});

test('a failed confirmation email never fails the primary submission', async () => {
  let call = 0;
  const sendEmail = async (_message: EmailMessage) => {
    call += 1;
    if (call === 2) {
      throw new Error('confirmation send failed');
    }
    return { id: 'ok' };
  };
  const result = await handleContactSubmission(validBody, {
    ...baseOptions(sendEmail),
    sendConfirmation: true,
  });

  assert.deepEqual(result, { ok: true, status: 200 });
  assert.equal(call, 2);
});

// --- Validation / sanitization details --------------------------------------

test('input is trimmed and message newlines are preserved', () => {
  const result = validateContactSubmission({
    ...validBody,
    name: '  Jane Smith  ',
    message: 'line one\nline two',
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.name, 'Jane Smith');
    assert.equal(result.data.message, 'line one\nline two');
  }
});

test('over-length message is rejected', () => {
  const result = validateContactSubmission({ ...validBody, message: 'x'.repeat(4001) });
  assert.equal(result.success, false);
  assert.ok(!result.success && result.fieldErrors.message);
});

test('company is optional', () => {
  const result = validateContactSubmission({ ...validBody, company: '' });
  assert.equal(result.success, true);
});

test('email header injection attempt (CRLF) is rejected', () => {
  const result = validateContactSubmission({
    ...validBody,
    email: 'jane@institution.com\r\nBcc: victim@example.com',
  });
  assert.equal(result.success, false);
  assert.ok(!result.success && result.fieldErrors.email);
});

// --- Email content safety ---------------------------------------------------

test('notification HTML escapes user-supplied markup', () => {
  const built = buildNotificationEmail(
    {
      name: '<script>alert(1)</script>',
      email: 'a@b.com',
      company: '',
      interestArea: 'RWA Security demo',
      message: '<img src=x onerror=alert(1)>',
    },
    new Date('2026-08-21T12:00:00.000Z'),
  );

  assert.ok(!built.html.includes('<script>'));
  assert.ok(!built.html.includes('<img src=x'));
  assert.match(built.html, /&lt;script&gt;/);
});


// --- Client response contract ----------------------------------------------
//
// These cover the rule that caused the production failure to be indistinguishable
// from a success: the browser must never treat a bare 2xx as delivery.

test('success is reported only when the body confirms ok: true', () => {
  assert.deepEqual(interpretContactResponse(200, { ok: true }), { kind: 'success' });
});

test('a 2xx response without ok:true is treated as a failure, not a success', () => {
  assert.equal(interpretContactResponse(200, { ok: false }).kind, 'failed');
  assert.equal(interpretContactResponse(200, {}).kind, 'failed');
  assert.equal(interpretContactResponse(200, null).kind, 'failed');
  assert.equal(interpretContactResponse(204, 'not json at all').kind, 'failed');
});

test('a 502 send failure maps to the generic failure state', () => {
  const outcome = interpretContactResponse(502, { ok: false, error: CONTACT_SEND_FAILED });
  assert.equal(outcome.kind, 'failed');
});

test('validation errors are surfaced against their fields', () => {
  const outcome = interpretContactResponse(400, {
    ok: false,
    error: CONTACT_VALIDATION_FAILED,
    fieldErrors: { email: 'Please enter a valid email address.' },
  });

  assert.equal(outcome.kind, 'validation');
  assert.equal(
    outcome.kind === 'validation' ? outcome.fieldErrors.email : undefined,
    'Please enter a valid email address.',
  );
});

test('rate limiting maps to its own state', () => {
  assert.equal(interpretContactResponse(429, { ok: false, error: CONTACT_RATE_LIMITED }).kind,
    'rate_limited');
});

test('a 404 from a missing/undeployed route is a failure, never a success', () => {
  // A 404 returns an HTML body, so JSON parsing yields null upstream.
  assert.equal(interpretContactResponse(404, null).kind, 'failed');
});

// --- Environment value normalization ----------------------------------------
// A hosting dashboard stores what is pasted, quotes and all. `.env.example`
// documents CONTACT_FROM_EMAIL wrapped in double quotes, so this is the most
// likely way a correct-looking production config still fails every send.

test('readEnvValue strips a surrounding pair of double quotes', () => {
  assert.equal(
    readEnvValue('"Decoda Website <noreply@decodasecurity.com>"'),
    'Decoda Website <noreply@decodasecurity.com>',
  );
});

test('readEnvValue strips a surrounding pair of single quotes', () => {
  assert.equal(readEnvValue("'hello@decodasecurity.com'"), 'hello@decodasecurity.com');
});

test('readEnvValue trims surrounding whitespace and newlines', () => {
  assert.equal(readEnvValue('  re_example_key \n'), 're_example_key');
});

test('readEnvValue leaves an unquoted value untouched', () => {
  assert.equal(
    readEnvValue('Decoda Website <noreply@decodasecurity.com>'),
    'Decoda Website <noreply@decodasecurity.com>',
  );
});

test('readEnvValue does not strip unbalanced or interior quotes', () => {
  assert.equal(readEnvValue('"Decoda Website" <noreply@decodasecurity.com>'),
    '"Decoda Website" <noreply@decodasecurity.com>');
  assert.equal(readEnvValue('"unterminated'), '"unterminated');
});

test('readEnvValue never invents a value for a missing variable', () => {
  assert.equal(readEnvValue(undefined), '');
  assert.equal(readEnvValue(null), '');
  assert.equal(readEnvValue(''), '');
  assert.equal(readEnvValue('   '), '');
  assert.equal(readEnvValue('""'), '');
});

// --- Sender domain extraction -----------------------------------------------

test('extractSenderDomain reads the domain from a display-name address', () => {
  assert.equal(
    extractSenderDomain('Decoda Website <noreply@decodasecurity.com>'),
    'decodasecurity.com',
  );
});

test('extractSenderDomain reads the domain from a bare address', () => {
  assert.equal(extractSenderDomain('noreply@decodasecurity.com'), 'decodasecurity.com');
});

test('readEnvValue + extractSenderDomain recover the domain from the paste hazard', () => {
  // `"Decoda Website <noreply@decodasecurity.com>"` is what a hosting dashboard
  // stores when .env.example is pasted verbatim. readEnvValue strips the quotes
  // before the value is ever used as a From header, which is what keeps the
  // provider from rejecting the send.
  const pasted = '"Decoda Website <noreply@decodasecurity.com>"';
  const normalized = readEnvValue(pasted);
  assert.equal(normalized, 'Decoda Website <noreply@decodasecurity.com>');
  assert.equal(extractSenderDomain(normalized), 'decodasecurity.com');
});

test('extractSenderDomain reads the bracketed address even around stray text', () => {
  // Lenient on purpose: this feeds the operator diagnostic, so naming the
  // domain to verify is more useful than refusing to parse.
  assert.equal(extractSenderDomain('Decoda <noreply@decodasecurity.com> '), 'decodasecurity.com');
});

test('extractSenderDomain returns null for a malformed sender', () => {
  assert.equal(extractSenderDomain('not-an-address'), null);
  assert.equal(extractSenderDomain('@decodasecurity.com'), null);
  assert.equal(extractSenderDomain('noreply@'), null);
  assert.equal(extractSenderDomain(''), null);
});
