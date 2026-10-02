/**
 * The site header's session check (GET /api/session), black-box (see ./harness.ts).
 *
 * Regression for the header showing "Sign in" to a signed-in person: pages are
 * static, so the header asks /api/session after load and shows the account
 * action when — and only when — the AuthKit session is valid.
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertNoSecretsInOutput, parseSetCookie, startApp, type App, type Reply, type TestUser } from './harness';

const TONY: TestUser = { id: 'user_01HTTPTESTTONY', email: 'tony.pham@decoda.example', firstName: 'Tony', lastName: 'Pham' };

let app: App;

before(async () => {
  app = await startApp();
});

after(async () => {
  await app?.close();
});

async function probe(cookie?: string): Promise<{ reply: Reply; body: Record<string, unknown> }> {
  const reply = await app.get('/api/session', { cookie, accept: 'application/json' });
  assert.equal(reply.status, 200);
  assert.match(String(reply.headers['cache-control']), /no-store/, 'never cached');
  assert.ok(!reply.setCookies.some((line) => line.startsWith('wos-auth-verifier')), 'a session check never starts a sign-in');
  return { reply, body: JSON.parse(reply.body) as Record<string, unknown> };
}

function sessionCleared(reply: Reply): boolean {
  return reply.setCookies.map(parseSetCookie).some((cookie) => cookie.name === 'wos-session' && cookie.value === '');
}

test('without a session the header is told "signed out"', async () => {
  const { reply, body } = await probe();
  assert.deepEqual(body, { signedIn: false });
  assert.deepEqual(reply.setCookies, []);
});

test('a valid Decoda session is reported with the person’s name only', async () => {
  const sealed = await app.sealSession(TONY);
  const { body, reply } = await probe(`wos-session=${sealed}`);
  assert.deepEqual(body, { signedIn: true, user: { firstName: 'Tony', name: 'Tony Pham' } });
  assert.ok(!reply.body.includes(TONY.email) && !reply.body.includes(TONY.id), 'no email or ids in the answer');
  assert.deepEqual(app.takeExchanges(), [], 'a valid session needs no call to WorkOS beyond the JWKS');
});

test('a session whose access token WorkOS did not sign is "signed out" and cleared', async () => {
  const sealed = await app.sealSession(TONY, { forged: true });
  const { body, reply } = await probe(`wos-session=${sealed}`);
  assert.deepEqual(body, { signedIn: false });
  assert.ok(sessionCleared(reply), 'the unusable session cookie is removed');
  assert.deepEqual(app.takeExchanges(), [{ grant_type: 'refresh_token', has_code: false, has_code_verifier: false }]);
});

test('an expired session that WorkOS refuses to refresh is "signed out" and cleared', async () => {
  const sealed = await app.sealSession(TONY, { expiresInSeconds: -60 });
  const { body, reply } = await probe(`wos-session=${sealed}`);
  assert.deepEqual(body, { signedIn: false });
  assert.ok(sessionCleared(reply));
  assert.deepEqual(app.takeExchanges(), [{ grant_type: 'refresh_token', has_code: false, has_code_verifier: false }]);
});

test('a malformed session cookie is "signed out"', async () => {
  const { body } = await probe('wos-session=not-a-sealed-session');
  assert.deepEqual(body, { signedIn: false });
  app.takeExchanges();
});

test('pages stay static: the header is rendered without reading the session, as a pending "Sign in"', async () => {
  const sealed = await app.sealSession(TONY);
  for (const cookie of [undefined, `wos-session=${sealed}`]) {
    const page = await app.get('/', { cookie });
    assert.equal(page.status, 200);
    assert.match(page.body, /<a href="\/sign-in"[^>]*data-account-pending=""[^>]*>Sign in<\/a>/);
    assert.ok(!page.body.includes('Tony'), 'no personal data in the static page');
  }
});

test('the server output never contains a key, a token or a session cookie', () => {
  assertNoSecretsInOutput(app);
});


test('header central-account UX keeps acquisition and authenticated actions separate', () => {
  const source = readFileSync('components/company/account-action.tsx', 'utf8');
  assert.match(source, /state\.status === 'signed-in'[\s\S]*href="\/account"[\s\S]*href="\/launcher"/);
  assert.match(source, /state\.status === 'signed-out'[\s\S]*href="\/request-pilot"/);
  assert.match(source, /href="\/sign-in"/);
  assert.ok(!source.includes('/register'), 'website header must not expose public registration');
});
