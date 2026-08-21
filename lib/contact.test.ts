import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildNotificationEmail,
  DEFAULT_CONTACT_FROM_EMAIL,
  DEFAULT_CONTACT_TO_EMAIL,
  handleContactSubmission,
  validateContactSubmission,
  type EmailMessage,
  type HandleContactOptions,
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
  assert.ok(!result.ok && result.status === 502 && result.error === 'send_failed');
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
