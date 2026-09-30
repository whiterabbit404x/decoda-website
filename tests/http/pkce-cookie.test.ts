/**
 * The AuthKit PKCE cookie round trip, black-box, against a production build
 * (`next start`) and a local stand-in for the WorkOS API.
 *
 * AuthKit inlines NEXT_PUBLIC_WORKOS_REDIRECT_URI at build time, so the build
 * must use the redirect URI this test expects (AUTH_HTTP_TEST_REDIRECT_URI,
 * default https://localhost:3123/auth/callback):
 *
 *   NEXT_PUBLIC_WORKOS_REDIRECT_URI=https://localhost:3123/auth/callback npm run build
 *   npm run test:http
 *
 * Every credential is a throwaway value generated here; nothing leaves the host.
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { pkceCookieNameForState } from '@/lib/platform/pkce-diagnostics';

const REDIRECT_URI = process.env.AUTH_HTTP_TEST_REDIRECT_URI ?? 'https://localhost:3123/auth/callback';
const APP_HOST = new URL(REDIRECT_URI).host;
const OTHER_HOST = 'decoda-website-8x2kq1abc-example.vercel.test';
const CLIENT_ID = 'client_http_test';
const API_KEY = `sk_test_${randomBytes(16).toString('hex')}`;
const COOKIE_PASSWORD = randomBytes(32).toString('hex');

// Everything that must never appear in the server's output.
const secrets = new Set<string>([API_KEY, COOKIE_PASSWORD]);
const newCode = () => {
  const code = `code_${randomBytes(12).toString('hex')}`;
  secrets.add(code);
  return code;
};

// --- stand-in for the WorkOS API: refuses every code, records booleans only ---
interface Exchange {
  grant_type: unknown;
  has_code: boolean;
  has_code_verifier: boolean;
}
let exchanges: Exchange[] = [];
const workos = http.createServer((req, res) => {
  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', () => {
    if (req.method === 'POST' && req.url === '/user_management/authenticate') {
      const parsed = JSON.parse(body || '{}') as Record<string, unknown>;
      exchanges.push({ grant_type: parsed.grant_type, has_code: Boolean(parsed.code), has_code_verifier: Boolean(parsed.code_verifier) });
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'invalid_grant', error_description: 'Refused by the test stand-in.' }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
});

function takeExchanges(): Exchange[] {
  const taken = exchanges;
  exchanges = [];
  return taken;
}

// --- the app under test ---
let server: ChildProcess;
let port = 0;
let output = '';

async function freePort(): Promise<number> {
  const probe = http.createServer();
  await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const { port: free } = probe.address() as AddressInfo;
  await new Promise((resolve) => probe.close(resolve));
  return free;
}

interface Reply {
  status: number;
  location: string | null;
  setCookies: string[];
}

function get(pathAndQuery: string, { host = APP_HOST, cookie }: { host?: string; cookie?: string } = {}): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, path: pathAndQuery, method: 'GET', headers: { host, accept: 'text/html', ...(cookie ? { cookie } : {}) } },
      (res) => {
        res.resume();
        res.on('end', () => resolve({ status: res.statusCode ?? 0, location: res.headers.location ?? null, setCookies: res.headers['set-cookie'] ?? [] }));
      },
    );
    req.on('error', reject);
    req.end();
  });
}

interface SetCookie {
  name: string;
  value: string;
  attributes: Map<string, string>;
}

function parseSetCookie(line: string): SetCookie {
  const [pair, ...rest] = line.split(';').map((part) => part.trim());
  const eq = pair.indexOf('=');
  const attributes = new Map<string, string>();
  for (const attribute of rest) {
    const at = attribute.indexOf('=');
    attributes.set((at === -1 ? attribute : attribute.slice(0, at)).toLowerCase(), at === -1 ? '' : attribute.slice(at + 1));
  }
  return { name: pair.slice(0, eq), value: pair.slice(eq + 1), attributes };
}

function verifierCookies(reply: Reply): SetCookie[] {
  return reply.setCookies.map(parseSetCookie).filter((cookie) => cookie.name.startsWith('wos-auth-verifier'));
}

/** Start a sign-in on `host`; returns the state and the verifier cookie it set. */
async function startSignIn(host = APP_HOST): Promise<{ reply: Reply; authorize: URL; state: string; cookie: SetCookie }> {
  const reply = await get('/sign-in?returnTo=/account', { host });
  assert.equal(reply.status, 307, '/sign-in redirects to AuthKit');
  const authorize = new URL(reply.location ?? '');
  const state = authorize.searchParams.get('state') ?? '';
  assert.ok(state.length > 0, 'the authorization URL carries a state');
  secrets.add(state);
  const cookies = verifierCookies(reply);
  assert.equal(cookies.length, 1, 'exactly one verifier cookie per sign-in');
  return { reply, authorize, state, cookie: cookies[0]! };
}

function errorReason(reply: Reply): string | null {
  const location = new URL(reply.location ?? '/', 'http://unused.invalid');
  assert.equal(location.pathname, '/auth/error');
  return location.searchParams.get('reason');
}

async function diagnostics(match: (line: Record<string, unknown>) => boolean): Promise<Record<string, unknown>> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const lines = output
      .split('\n')
      .filter((line) => line.startsWith('[auth:pkce-diagnostic] '))
      .map((line) => JSON.parse(line.slice('[auth:pkce-diagnostic] '.length)) as Record<string, unknown>);
    const found = lines.find(match);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail('expected [auth:pkce-diagnostic] line not found in the server output');
}

before(async () => {
  await new Promise<void>((resolve) => workos.listen(0, '127.0.0.1', resolve));
  const workosPort = (workos.address() as AddressInfo).port;
  port = await freePort();
  server = spawn(process.execPath, [path.join(process.cwd(), 'node_modules/next/dist/bin/next'), 'start', '-p', String(port), '-H', '127.0.0.1'], {
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      NODE_ENV: 'production',
      NEXT_TELEMETRY_DISABLED: '1',
      WORKOS_CLIENT_ID: CLIENT_ID,
      WORKOS_API_KEY: API_KEY,
      WORKOS_COOKIE_PASSWORD: COOKIE_PASSWORD,
      NEXT_PUBLIC_WORKOS_REDIRECT_URI: REDIRECT_URI,
      WORKOS_API_HOSTNAME: '127.0.0.1',
      WORKOS_API_PORT: String(workosPort),
      WORKOS_API_HTTPS: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout?.on('data', (chunk: Buffer) => (output += chunk.toString()));
  server.stderr?.on('data', (chunk: Buffer) => (output += chunk.toString()));
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) break;
    try {
      if ((await get('/')).status === 200) return;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`next start did not come up (run \`npm run build\` first):\n${output.split('\n').slice(-20).join('\n')}`);
});

after(async () => {
  if (server && server.exitCode === null) {
    const exited = new Promise((resolve) => server.once('exit', resolve));
    server.kill('SIGTERM');
    await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 5_000))]);
    if (server.exitCode === null) server.kill('SIGKILL');
  }
  await new Promise((resolve) => workos.close(resolve));
});

test('sign-in sends the configured redirect URI with PKCE and sets a host-only verifier cookie bound to the state', async () => {
  const { authorize, state, cookie } = await startSignIn();
  assert.equal(
    authorize.searchParams.get('redirect_uri'),
    REDIRECT_URI,
    `the build must inline NEXT_PUBLIC_WORKOS_REDIRECT_URI=${REDIRECT_URI} (see the header of this file)`,
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

  const line = await diagnostics((entry) => entry.phase === 'sign-in' && entry.verifier_cookie_name === cookie.name);
  assert.equal(line.host, APP_HOST);
  assert.equal(line.expected_redirect_host, APP_HOST);
  assert.equal(line.same_host, true);
  assert.equal(line.redirect_uri_matches_env, true);
  assert.equal(line.verifier_cookie_set, true);
});

test('the callback refuses a return whose verifier cookie is missing (missing_pkce_cookie)', async () => {
  const { state, cookie } = await startSignIn();
  const reply = await get(`/auth/callback?code=${newCode()}&state=${encodeURIComponent(state)}`);
  assert.equal(reply.status, 303);
  assert.equal(errorReason(reply), 'expired');
  const cleared = reply.setCookies.map(parseSetCookie).find((entry) => entry.name === cookie.name);
  assert.ok(cleared && cleared.attributes.get('max-age') === '0', 'the flow cookie is cleared');
  assert.deepEqual(takeExchanges(), [], 'no code exchange without the verifier cookie');
  assert.match(output, /missing_pkce_cookie/);

  const line = await diagnostics((entry) => entry.phase === 'callback' && entry.verifier_cookie_name === cookie.name);
  assert.equal(line.verifier_cookie_present, false);
  assert.equal(line.code_present, true);
  assert.equal(line.state_present, true);
});

test('with its verifier cookie the callback passes the PKCE check and exchanges the code with the verifier', async () => {
  const { state, cookie } = await startSignIn();
  const reply = await get(`/auth/callback?code=${newCode()}&state=${encodeURIComponent(state)}`, { cookie: `${cookie.name}=${cookie.value}` });
  assert.equal(reply.status, 303);
  assert.equal(errorReason(reply), 'failed', 'past PKCE: the stand-in WorkOS refused the code');
  assert.deepEqual(takeExchanges(), [{ grant_type: 'authorization_code', has_code: true, has_code_verifier: true }]);

  const line = await diagnostics((entry) => entry.phase === 'callback' && entry.verifier_cookie_name === cookie.name);
  assert.equal(line.verifier_cookie_present, true);
  assert.equal(line.same_host, true);
});

test('a verifier cookie that holds the state of another flow is refused (state mismatch)', async () => {
  const first = await startSignIn();
  const second = await startSignIn();
  const reply = await get(`/auth/callback?code=${newCode()}&state=${encodeURIComponent(first.state)}`, {
    cookie: `${first.cookie.name}=${second.cookie.value}`,
  });
  assert.equal(errorReason(reply), 'expired');
  assert.deepEqual(takeExchanges(), []);
  assert.match(output, /oauth_state_mismatch/);
});

test('a sign-in started on another host cannot complete: WorkOS returns to the configured host, the cookie stays behind', async () => {
  const { authorize, state, cookie } = await startSignIn(OTHER_HOST);
  // The redirect URI is fixed by configuration, not by the host the flow started on...
  assert.equal(new URL(authorize.searchParams.get('redirect_uri') ?? '').host, APP_HOST);
  // ...and the verifier cookie is host-only, so it belongs to OTHER_HOST.
  assert.ok(!cookie.attributes.has('domain'));
  const started = await diagnostics((entry) => entry.phase === 'sign-in' && entry.verifier_cookie_name === cookie.name);
  assert.equal(started.host, OTHER_HOST);
  assert.equal(started.expected_redirect_host, APP_HOST);
  assert.equal(started.same_host, false);

  // The browser comes back to APP_HOST, which never received that cookie.
  const reply = await get(`/auth/callback?code=${newCode()}&state=${encodeURIComponent(state)}`);
  assert.equal(errorReason(reply), 'expired');
  assert.deepEqual(takeExchanges(), []);
  const returned = await diagnostics((entry) => entry.phase === 'callback' && entry.verifier_cookie_name === cookie.name);
  assert.equal(returned.host, APP_HOST);
  assert.equal(returned.same_host, true);
  assert.equal(returned.verifier_cookie_present, false);
});

test('the server output never contains a key, the cookie password, a code, a state or a cookie value', () => {
  assert.ok(output.includes('[auth:pkce-diagnostic] '), 'diagnostics were written');
  for (const secret of secrets) {
    assert.ok(!output.includes(secret), 'a secret value appeared in the server output');
  }
});
