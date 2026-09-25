import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkFormToken, FORM_TOKEN_MAX_AGE_MS, issueFormToken } from './form-token';
import { interpretPilotResponse } from './pilot-form';
import { normalizeWebsite, normalizeWorkEmail, validatePilotRequest } from './pilot-requests';
import { looksLikeSecret } from './secret-detector';

const valid = {
  email: '  Jane.Smith@Institution.COM ',
  fullName: 'Jane Smith',
  company: 'Institution Capital',
  role: 'Head of Digital Assets',
  companyWebsite: 'institution.com',
  requestedProducts: ['vault', 'rwa_guard'],
  useCase: 'Tokenized treasury monitoring',
  teamSize: '6-20',
  notes: '',
};

describe('Request Pilot validation', () => {
  it('normalises a valid submission', () => {
    const result = validatePilotRequest(valid);
    assert.equal(result.success, true);
    if (!result.success) return;
    assert.equal(result.data.email, 'jane.smith@institution.com');
    assert.equal(result.data.emailDomain, 'institution.com');
    assert.equal(result.data.freeMailDomain, false);
    assert.equal(result.data.companyWebsite, 'https://institution.com');
    assert.deepEqual(result.data.requestedProducts, ['rwa_guard', 'vault']);
    assert.equal(result.data.notes, null);
  });

  it('requires email, name, company, role and at least one product', () => {
    const result = validatePilotRequest({});
    assert.equal(result.success, false);
    if (result.success) return;
    assert.deepEqual(Object.keys(result.fieldErrors).sort(), ['company', 'email', 'fullName', 'requestedProducts', 'role']);
  });

  it('rejects malformed and header-injection email addresses', () => {
    for (const email of ['not-an-email', 'a@b', 'a@@b.com', 'a b@c.com', 'x@y.com\r\nBcc: z@w.com', 'a@-bad-.com']) {
      assert.equal(normalizeWorkEmail(email), null, email);
    }
    assert.deepEqual(normalizeWorkEmail('Ops@Example.org'), { email: 'ops@example.org', domain: 'example.org' });
  });

  it('flags consumer mailbox domains for the reviewer without blocking', () => {
    const result = validatePilotRequest({ ...valid, email: 'jane@gmail.com' });
    assert.equal(result.success, true);
    if (result.success) assert.equal(result.data.freeMailDomain, true);
  });

  it('rejects unknown products instead of silently dropping them', () => {
    const result = validatePilotRequest({ ...valid, requestedProducts: ['vault', 'custody'] });
    assert.equal(result.success, false);
    if (!result.success) assert.ok(result.fieldErrors.requestedProducts);
  });

  it('accepts Assets as registered interest', () => {
    const result = validatePilotRequest({ ...valid, requestedProducts: ['assets'] });
    assert.equal(result.success, true);
  });

  it('normalises websites and refuses non-web schemes', () => {
    assert.deepEqual(normalizeWebsite('https://www.acme.com/'), { ok: true, value: 'https://www.acme.com' });
    assert.deepEqual(normalizeWebsite('acme.com/about'), { ok: true, value: 'https://acme.com/about' });
    assert.deepEqual(normalizeWebsite(''), { ok: true, value: null });
    assert.deepEqual(normalizeWebsite('javascript:alert(1)'), { ok: false });
    assert.deepEqual(normalizeWebsite('https://user:pass@acme.com'), { ok: false });
    assert.deepEqual(normalizeWebsite('localhost'), { ok: false });
  });

  it('refuses credential-shaped input in free-text fields', () => {
    const key = `0x${'ab'.repeat(32)}`;
    const result = validatePilotRequest({ ...valid, notes: `our signer key is ${key}` });
    assert.equal(result.success, false);
    if (!result.success) assert.match(result.fieldErrors.notes ?? '', /private key/);
    const mnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access accident';
    assert.equal(validatePilotRequest({ ...valid, useCase: mnemonic }).success, false);
  });

  it('does not treat ordinary prose as a secret', () => {
    assert.equal(looksLikeSecret('We run a tokenized money market fund with twelve operators across three regions'), false);
    assert.equal(looksLikeSecret('-----BEGIN RSA PRIVATE KEY-----'), true);
    assert.equal(looksLikeSecret('sk_live_0123456789abcdefABCDEF'), true);
  });

  it('caps field lengths', () => {
    const result = validatePilotRequest({ ...valid, notes: 'x'.repeat(4001) });
    assert.equal(result.success, false);
  });
});

describe('Request Pilot form token', () => {
  const secret = 'f'.repeat(40);
  it('accepts a token of normal age', () => {
    const now = 1_700_000_000_000;
    assert.equal(checkFormToken(issueFormToken(secret, now), secret, now + 10_000), 'ok');
  });
  it('flags a submission faster than a person can type', () => {
    const now = 1_700_000_000_000;
    assert.equal(checkFormToken(issueFormToken(secret, now), secret, now + 500), 'too_fast');
  });
  it('rejects missing, forged, expired and future tokens', () => {
    const now = 1_700_000_000_000;
    const token = issueFormToken(secret, now);
    assert.equal(checkFormToken(undefined, secret, now), 'missing');
    assert.equal(checkFormToken(token, 'g'.repeat(40), now + 10_000), 'invalid');
    assert.equal(checkFormToken(token.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A')), secret, now + 10_000), 'invalid');
    assert.equal(checkFormToken(token, secret, now + FORM_TOKEN_MAX_AGE_MS + 1), 'expired');
    assert.equal(checkFormToken(token, secret, now - 1000), 'invalid');
  });
});

describe('Request Pilot client outcome', () => {
  it('treats only an explicit ok:true as success', () => {
    assert.deepEqual(interpretPilotResponse(200, { ok: true, reference: 'req_x' }), { kind: 'success', reference: 'req_x' });
    assert.equal(interpretPilotResponse(200, {}).kind, 'failed');
    assert.equal(interpretPilotResponse(200, '<html>').kind, 'failed');
    assert.equal(interpretPilotResponse(400, { error: { code: 'PILOT_FORM_EXPIRED' } }).kind, 'expired');
    assert.equal(interpretPilotResponse(429, {}).kind, 'rate_limited');
    assert.deepEqual(interpretPilotResponse(400, { error: { code: 'PILOT_VALIDATION_FAILED' }, fieldErrors: { email: 'x' } }), {
      kind: 'validation',
      fieldErrors: { email: 'x' },
    });
  });
});
