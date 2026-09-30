/**
 * The AuthKit PKCE cookie round trip, black-box (see ./harness.ts).
 *
 * Regression for the staging `missing_pkce_cookie`: the verifier cookie is
 * host-only and WorkOS returns to the host of the build-time redirect URI, so
 * a sign-in must start on that host.
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { APP_HOST, CLIENT_ID, REDIRECT_URI, assertNoSecretsInOutput, parseSetCookie, pkceCookieNameForState, startApp, waitForOutput, type App, type Reply, type SetCookie } from './harness';

const OTHER_HOST = 'decoda-website-8x2kq1abc-example.vercel.test';

let app: App;

before(async () => {
  app = await startApp();
});

after(async () => {
  await app?.close();
});

function verifierCookies(reply: Reply): SetCookie[] {
  return reply.setCookies.map(parseSetCookie).filter((cookie) => cookie.name.startsWith('wos-auth-verifier'));
}

/** Start a sign-in on `host`; returns the state and the verifier cookie it set. */
async function startSignIn(host = APP_HOST): Promise<{ authorize: URL; state: string; cookie: SetCookie }> {
  const reply = await app.get('/sign-in?returnTo=/account', { host });
  assert.equal(reply.status, 307, '/sign-in redirects to AuthKit');
  const authorize = new URL(reply.location ?? '');
  const state = authorize.searchParams.get('state') ?? '';
  assert.ok(state.length > 0, 'the authorization URL carries a state');
  app.secrets.add(state);
  const cookies = verifierCookies(reply);
  assert.equal(cookies.length, 1, 'exactly one verifier cookie per sign-in');
  return { authorize, state, cookie: cookies[0]! };
}

function errorReason(reply: Reply): string | null {
  const location = new URL(reply.location ?? '/', 'http://unused.invalid');
  assert.equal(location.pathname, '/auth/error');
  return location.searchParams.get('reason');
}

test('sign-in sends the configured redirect URI with PKCE and sets a host-only verifier cookie bound to the state', async () => {
  const { authorize, state, cookie } = await startSignIn();
  assert.equal(
    authorize.searchParams.get('redirect_uri'),
    REDIRECT_URI,
    `the build must inline NEXT_PUBLIC_WORKOS_REDIRECT_URI=${REDIRECT_URI} (see tests/http/harness.ts)`,
  );
  assert.equal(authorize.pathname, '/user_management/authorize');
  assert.equal(authorize.searchParams.get('client_id'), CLIENT_ID);
  assert.equal(authorize.searchParams.get('response_type'), 'code');
  assert.equal(authorize.searchParams.get('provider'), 'authkit');
  assert.equal(authorize.searchParams.get('code_challenge_method'), 'S256');
  assert.ok(authorize.searchParams.get('code_challenge'), 'PKCE code challenge present');

  // Survives Next's redirect(): the Set-Cookie is on the 307 itself.
  assert.equal(cookie.name, pkceCookieNameForState(state));
  assert.ok(cookie.value === state, 'the cookie carries the same sealed state as the URL (two-channel check)');
  assert.equal(cookie.attributes.get('path'), '/');
  assert.equal(cookie.attributes.get('max-age'), '600');
  assert.equal(cookie.attributes.get('samesite')?.toLowerCase(), 'lax', 'Lax: sent on the top-level redirect back from WorkOS');
  assert.ok(cookie.attributes.has('httponly'));
  assert.equal(cookie.attributes.has('secure'), new URL(REDIRECT_URI).protocol === 'https:');
  assert.ok(!cookie.attributes.has('domain'), 'host-only: no Domain attribute');
});

test('the callback refuses a return whose verifier cookie is missing (missing_pkce_cookie)', async () => {
  const { state, cookie } = await startSignIn();
  const reply = await app.get(`/auth/callback?code=${app.newCode()}&state=${encodeURIComponent(state)}`);
  assert.equal(reply.status, 303);
  assert.equal(errorReason(reply), 'expired');
  const cleared = reply.setCookies.map(parseSetCookie).find((entry) => entry.name === cookie.name);
  assert.ok(cleared && cleared.attributes.get('max-age') === '0', 'the flow cookie is cleared');
  assert.deepEqual(app.takeExchanges(), [], 'no code exchange without the verifier cookie');
  await waitForOutput(app, /missing_pkce_cookie/);
});

test('with its verifier cookie the callback passes the PKCE check and exchanges the code with the verifier', async () => {
  const { state, cookie } = await startSignIn();
  const reply = await app.get(`/auth/callback?code=${app.newCode()}&state=${encodeURIComponent(state)}`, {
    cookie: `${cookie.name}=${cookie.value}`,
  });
  assert.equal(reply.status, 303);
  assert.equal(errorReason(reply), 'failed', 'past PKCE: the stand-in WorkOS refused the code');
  assert.deepEqual(app.takeExchanges(), [{ grant_type: 'authorization_code', has_code: true, has_code_verifier: true }]);
});

test('a verifier cookie that holds the state of another flow is refused (state mismatch)', async () => {
  const first = await startSignIn();
  const second = await startSignIn();
  const reply = await app.get(`/auth/callback?code=${app.newCode()}&state=${encodeURIComponent(first.state)}`, {
    cookie: `${first.cookie.name}=${second.cookie.value}`,
  });
  assert.equal(errorReason(reply), 'expired');
  assert.deepEqual(app.takeExchanges(), []);
  await waitForOutput(app, /oauth_state_mismatch/);
});

test('a sign-in started on another host cannot complete: WorkOS returns to the configured host, the cookie stays behind', async () => {
  const { authorize, state, cookie } = await startSignIn(OTHER_HOST);
  // The redirect URI is fixed by configuration, not by the host the flow started on...
  assert.equal(new URL(authorize.searchParams.get('redirect_uri') ?? '').host, APP_HOST);
  // ...and the verifier cookie is host-only, so it belongs to OTHER_HOST.
  assert.ok(!cookie.attributes.has('domain'));

  // The browser comes back to APP_HOST, which never received that cookie.
  const reply = await app.get(`/auth/callback?code=${app.newCode()}&state=${encodeURIComponent(state)}`);
  assert.equal(errorReason(reply), 'expired');
  assert.deepEqual(app.takeExchanges(), []);
});

test('the server output never contains a key, the cookie password, a code, a state or a cookie value', () => {
  assertNoSecretsInOutput(app);
});
