import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  callbackDiagnostic,
  logCallbackDiagnostic,
  logSignInDiagnostic,
  PKCE_COOKIE_NAME,
  pkceCookieNameForState,
  signInDiagnostic,
} from './pkce-diagnostics';

const BRANCH_ALIAS = 'decoda-website-git-claude-vib-a525b5-thanhdat852-7511s-projects.vercel.app';
const DEPLOYMENT_URL = 'decoda-website-8x2kq1abc-thanhdat852-7511s-projects.vercel.app';
const REDIRECT_URI = `https://${BRANCH_ALIAS}/auth/callback`;
const STATE = 'Fe26.2*1*sealed-state-stand-in*~2';

const ENV = {
  VERCEL_ENV: 'preview',
  VERCEL_URL: DEPLOYMENT_URL,
  VERCEL_BRANCH_URL: BRANCH_ALIAS,
  NEXT_PUBLIC_WORKOS_REDIRECT_URI: REDIRECT_URI,
};

function makeRequest(url: string, cookies: Record<string, string> = {}, headers: Record<string, string> = {}) {
  return {
    url,
    headers: new Headers({ host: new URL(url).host, ...headers }),
    cookies: { getAll: () => Object.entries(cookies).map(([name, value]) => ({ name, value })) },
  };
}

function authorizationUrl(redirectUri = REDIRECT_URI, state = STATE): string {
  const url = new URL('https://api.workos.com/user_management/authorize');
  url.searchParams.set('client_id', 'client_123');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  return url.toString();
}

const queued = (name: string) => ({ has: (candidate: string) => candidate === name });

test('the verifier cookie name is the 32-bit FNV-1a of the state (AuthKit 4.3.2 naming)', () => {
  // Reference vectors for FNV-1a 32 (also what @sindresorhus/fnv1a, the SDK's hash, returns).
  assert.equal(pkceCookieNameForState(''), `${PKCE_COOKIE_NAME}-811c9dc5`);
  assert.equal(pkceCookieNameForState('a'), `${PKCE_COOKIE_NAME}-e40c292c`);
  assert.equal(pkceCookieNameForState('foobar'), `${PKCE_COOKIE_NAME}-bf9cf968`);
});

test('sign-in on the branch alias: same host as the redirect URI, verifier cookie queued', () => {
  const name = pkceCookieNameForState(STATE);
  const line = signInDiagnostic(makeRequest(`https://${BRANCH_ALIAS}/sign-in`), authorizationUrl(), queued(name), ENV);
  assert.equal(line.phase, 'sign-in');
  assert.equal(line.host, BRANCH_ALIAS);
  assert.equal(line.expected_redirect_host, BRANCH_ALIAS);
  assert.equal(line.same_host, true);
  assert.equal(line.redirect_uri_matches_env, true);
  assert.equal(line.authorize_host, 'api.workos.com');
  assert.equal(line.verifier_cookie_name, name);
  assert.equal(line.verifier_cookie_set, true);
});

test('sign-in started on the deployment URL is flagged as a host mismatch', () => {
  const name = pkceCookieNameForState(STATE);
  const line = signInDiagnostic(makeRequest(`https://${DEPLOYMENT_URL}/sign-in`), authorizationUrl(), queued(name), ENV);
  assert.equal(line.host, DEPLOYMENT_URL);
  assert.equal(line.expected_redirect_host, BRANCH_ALIAS);
  assert.equal(line.same_host, false);
  assert.equal(line.vercel_url, DEPLOYMENT_URL);
  assert.equal(line.vercel_branch_url, BRANCH_ALIAS);
});

test('the host the browser used wins over the server address in request.url', () => {
  const request = makeRequest('http://localhost:3000/sign-in', {}, { 'x-forwarded-host': BRANCH_ALIAS });
  const line = signInDiagnostic(request, authorizationUrl(), queued('none'), ENV);
  assert.equal(line.host, BRANCH_ALIAS);
  assert.equal(line.same_host, true);
});

test('a build whose inlined redirect URI differs from the environment is flagged', () => {
  const stale = `https://${DEPLOYMENT_URL}/auth/callback`;
  const line = signInDiagnostic(makeRequest(`https://${BRANCH_ALIAS}/sign-in`), authorizationUrl(stale), queued('none'), ENV);
  assert.equal(line.redirect_uri_matches_env, false);
  assert.equal(line.expected_redirect_host, DEPLOYMENT_URL);
  assert.equal(line.same_host, false);
  assert.equal(line.verifier_cookie_set, false);
});

test('callback: the verifier cookie for this state is present', () => {
  const name = pkceCookieNameForState(STATE);
  const url = `https://${BRANCH_ALIAS}/auth/callback?code=01CODE&state=${encodeURIComponent(STATE)}`;
  const line = callbackDiagnostic(makeRequest(url, { [name]: STATE, 'wos-session': 'x' }), ENV);
  assert.equal(line.phase, 'callback');
  assert.equal(line.path, '/auth/callback');
  assert.equal(line.code_present, true);
  assert.equal(line.state_present, true);
  assert.equal(line.same_host, true);
  assert.equal(line.verifier_cookie_name, name);
  assert.equal(line.verifier_cookie_present, true);
  assert.equal(line.session_cookie_present, true);
  assert.deepEqual(line.verifier_cookie_names, [name]);
  assert.equal(line.cookie_count, 2);
});

test('callback: a verifier cookie from another flow does not count; the legacy shared name does', () => {
  const url = `https://${BRANCH_ALIAS}/auth/callback?code=01CODE&state=${encodeURIComponent(STATE)}`;
  const other = pkceCookieNameForState('another-flow');
  const withOther = callbackDiagnostic(makeRequest(url, { [other]: 'v' }), ENV);
  assert.equal(withOther.verifier_cookie_present, false);
  assert.deepEqual(withOther.verifier_cookie_names, [other]);
  const withLegacy = callbackDiagnostic(makeRequest(url, { [PKCE_COOKIE_NAME]: 'v' }), ENV);
  assert.equal(withLegacy.verifier_cookie_present, true);
  const withNone = callbackDiagnostic(makeRequest(url), ENV);
  assert.equal(withNone.verifier_cookie_present, false);
  assert.equal(withNone.cookie_count, 0);
});

test('a WORKOS_COOKIE_DOMAIN in the environment is reported (browsers reject a non-matching Domain)', () => {
  const line = callbackDiagnostic(makeRequest(`https://${BRANCH_ALIAS}/auth/callback`), { ...ENV, WORKOS_COOKIE_DOMAIN: 'decodasecurity.com' });
  assert.equal(line.cookie_domain_configured, true);
  assert.equal(callbackDiagnostic(makeRequest(`https://${BRANCH_ALIAS}/auth/callback`), ENV).cookie_domain_configured, false);
});

async function captureInfo(fn: () => void | Promise<void>): Promise<string[]> {
  const original = console.info;
  const lines: string[] = [];
  console.info = (...args: unknown[]) => lines.push(args.map(String).join(' '));
  try {
    await fn();
  } finally {
    console.info = original;
  }
  return lines;
}

async function withEnv(values: Record<string, string>, fn: () => Promise<void>): Promise<void> {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  Object.assign(process.env, values);
  try {
    await fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const ALLOWED_KEYS = new Set([
  'phase', 'host', 'path', 'vercel_env', 'vercel_url', 'vercel_branch_url', 'cookie_count', 'verifier_cookie_names',
  'session_cookie_present', 'cookie_domain_configured', 'sec_fetch_site', 'sec_fetch_mode', 'sec_fetch_dest', 'rsc', 'prefetch',
  'authorize_host', 'expected_redirect_host', 'same_host', 'redirect_uri_matches_env', 'verifier_cookie_name', 'verifier_cookie_set',
  'code_present', 'state_present', 'verifier_cookie_present',
]);

test('no secret ever reaches the log: cookie values, code, state, keys and database URLs', async () => {
  const secrets = {
    code: 'SENTINEL_CODE_7f3a',
    state: 'SENTINEL_STATE_91bc',
    verifier: 'SENTINEL_VERIFIER_VALUE_22d1',
    session: 'SENTINEL_SESSION_VALUE_5e0f',
    apiKey: 'sk_test_SENTINEL_API_KEY_a9',
    cookiePassword: 'SENTINEL_COOKIE_PASSWORD_0123456789abcdef',
    databaseUrl: 'postgresql://user:SENTINEL_DB_PASSWORD@db.invalid/platform',
    platformSecret: 'SENTINEL_PLATFORM_SECRET_0123456789abcdef',
  };
  const lines = await captureInfo(() =>
    withEnv(
      {
        VERCEL_ENV: 'preview',
        DECODA_ENV: '',
        NEXT_PUBLIC_WORKOS_REDIRECT_URI: REDIRECT_URI,
        WORKOS_API_KEY: secrets.apiKey,
        WORKOS_COOKIE_PASSWORD: secrets.cookiePassword,
        DECODA_PLATFORM_DATABASE_URL: secrets.databaseUrl,
        DECODA_PLATFORM_SECRET: secrets.platformSecret,
      },
      async () => {
        const name = pkceCookieNameForState(secrets.state);
        const cookies = { [name]: secrets.verifier, 'wos-session': secrets.session, other: secrets.verifier };
        logSignInDiagnostic(makeRequest(`https://${BRANCH_ALIAS}/sign-in?returnTo=/launcher`, cookies), authorizationUrl(REDIRECT_URI, secrets.state), queued(name));
        logCallbackDiagnostic(makeRequest(`https://${BRANCH_ALIAS}/auth/callback?code=${secrets.code}&state=${secrets.state}`, cookies));
      },
    ),
  );
  assert.equal(lines.length, 2);
  for (const line of lines) {
    assert.ok(line.startsWith('[auth:pkce-diagnostic] {'), 'one tagged JSON line per request');
    for (const [label, secret] of Object.entries(secrets)) {
      assert.ok(!line.includes(secret), `the ${label} must not be logged`);
    }
    assert.ok(!line.includes('SENTINEL'), 'no sentinel of any kind in the line');
    const payload = JSON.parse(line.slice('[auth:pkce-diagnostic] '.length)) as Record<string, unknown>;
    for (const key of Object.keys(payload)) assert.ok(ALLOWED_KEYS.has(key), `unexpected field ${key}`);
    assert.equal(payload.path, payload.phase === 'sign-in' ? '/sign-in' : '/auth/callback', 'path only, never the query string');
  }
});

test('production deployments log nothing', async () => {
  const lines = await captureInfo(() =>
    withEnv({ VERCEL_ENV: 'production' }, async () => {
      logCallbackDiagnostic(makeRequest(`https://${BRANCH_ALIAS}/auth/callback?code=c&state=s`));
    }),
  );
  assert.deepEqual(lines, []);
});
