/**
 * Black-box HTTP harness: a production build served by `next start`, and a
 * local stand-in for the WorkOS API.
 *
 * AuthKit inlines NEXT_PUBLIC_WORKOS_REDIRECT_URI at build time, so the build
 * must use the redirect URI these tests expect (AUTH_HTTP_TEST_REDIRECT_URI,
 * default https://localhost:3123/auth/callback):
 *
 *   NEXT_PUBLIC_WORKOS_REDIRECT_URI=https://localhost:3123/auth/callback npm run build
 *   npm run test:http
 *
 * Every credential is a throwaway value generated here; nothing leaves the host.
 */
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { createPrivateKey, generateKeyPairSync, randomBytes, sign, type KeyObject } from 'node:crypto';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { sealData } from 'iron-session';

export const REDIRECT_URI = process.env.AUTH_HTTP_TEST_REDIRECT_URI ?? 'https://localhost:3123/auth/callback';
export const APP_HOST = new URL(REDIRECT_URI).host;
export const CLIENT_ID = 'client_http_test';

/** AuthKit's verifier cookie name for an OAuth state: `wos-auth-verifier-<FNV-1a 32 of the state, 8 hex>`. */
export function pkceCookieNameForState(state: string): string {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(state)) hash = Math.imul(hash ^ byte, 0x01000193) >>> 0;
  return `wos-auth-verifier-${hash.toString(16).padStart(8, '0')}`;
}

export interface Reply {
  status: number;
  location: string | null;
  setCookies: string[];
  headers: http.IncomingHttpHeaders;
  body: string;
}

export interface SetCookie {
  name: string;
  value: string;
  attributes: Map<string, string>;
}

export function parseSetCookie(line: string): SetCookie {
  const [pair, ...rest] = line.split(';').map((part) => part.trim());
  const eq = pair.indexOf('=');
  const attributes = new Map<string, string>();
  for (const attribute of rest) {
    const at = attribute.indexOf('=');
    attributes.set((at === -1 ? attribute : attribute.slice(0, at)).toLowerCase(), at === -1 ? '' : attribute.slice(at + 1));
  }
  return { name: pair.slice(0, eq), value: pair.slice(eq + 1), attributes };
}

interface CodeExchange {
  grant_type: unknown;
  has_code: boolean;
  has_code_verifier: boolean;
}

/** Signs RS256 access tokens that only the stand-in's JWKS verifies. */
class TokenIssuer {
  private readonly privateKey: KeyObject;
  readonly jwk: Record<string, unknown>;
  readonly kid = `sso_oidc_key_pair_${randomBytes(6).toString('hex')}`;

  constructor() {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    this.privateKey = privateKey;
    this.jwk = { ...publicKey.export({ format: 'jwk' }), kid: this.kid, alg: 'RS256', use: 'sig' };
  }

  sign(claims: Record<string, unknown>, key: KeyObject = this.privateKey): string {
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const input = `${encode({ alg: 'RS256', typ: 'JWT', kid: this.kid })}.${encode(claims)}`;
    return `${input}.${sign('sha256', Buffer.from(input), key).toString('base64url')}`;
  }

  /** A key WorkOS never published, for forged tokens. */
  static strangerKey(): KeyObject {
    return createPrivateKey(generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ format: 'pem', type: 'pkcs8' }));
  }
}

export interface TestUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

export interface App {
  /** Where `next start` listens (for a browser; `get` sets the Host header itself). */
  baseUrl: string;
  /** Everything the server printed so far. */
  output(): string;
  /** Values that must never appear in the server output. */
  secrets: Set<string>;
  get(pathAndQuery: string, options?: { host?: string; cookie?: string; accept?: string }): Promise<Reply>;
  /** Code exchanges and refreshes the stand-in received since the last call (booleans only). */
  takeExchanges(): CodeExchange[];
  newCode(): string;
  /** A sealed `wos-session` cookie value, as AuthKit writes it after a sign-in. */
  sealSession(user: TestUser, options?: { expiresInSeconds?: number; forged?: boolean }): Promise<string>;
  close(): Promise<void>;
}

export async function startApp(): Promise<App> {
  const apiKey = `sk_test_${randomBytes(16).toString('hex')}`;
  const cookiePassword = randomBytes(32).toString('hex');
  const secrets = new Set<string>([apiKey, cookiePassword]);
  const issuer = new TokenIssuer();
  let exchanges: CodeExchange[] = [];

  // Stand-in WorkOS API: refuses every code and refresh token; publishes the JWKS.
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
      if (req.method === 'GET' && req.url === `/sso/jwks/${CLIENT_ID}`) {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ keys: [issuer.jwk] }));
        return;
      }
      res.writeHead(404);
      res.end();
    });
  });
  await new Promise<void>((resolve) => workos.listen(0, '127.0.0.1', resolve));
  const workosPort = (workos.address() as AddressInfo).port;

  const probe = http.createServer();
  await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const port = (probe.address() as AddressInfo).port;
  await new Promise((resolve) => probe.close(resolve));

  let output = '';
  const server: ChildProcess = spawn(
    process.execPath,
    [path.join(process.cwd(), 'node_modules/next/dist/bin/next'), 'start', '-p', String(port), '-H', '127.0.0.1'],
    {
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        NODE_ENV: 'production',
        NEXT_TELEMETRY_DISABLED: '1',
        WORKOS_CLIENT_ID: CLIENT_ID,
        WORKOS_API_KEY: apiKey,
        WORKOS_COOKIE_PASSWORD: cookiePassword,
        NEXT_PUBLIC_WORKOS_REDIRECT_URI: REDIRECT_URI,
        WORKOS_API_HOSTNAME: '127.0.0.1',
        WORKOS_API_PORT: String(workosPort),
        WORKOS_API_HTTPS: 'false',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  server.stdout?.on('data', (chunk: Buffer) => (output += chunk.toString()));
  server.stderr?.on('data', (chunk: Buffer) => (output += chunk.toString()));

  const get: App['get'] = (pathAndQuery, { host = APP_HOST, cookie, accept = 'text/html' } = {}) =>
    new Promise((resolve, reject) => {
      const req = http.request(
        { host: '127.0.0.1', port, path: pathAndQuery, method: 'GET', headers: { host, accept, ...(cookie ? { cookie } : {}) } },
        (res) => {
          let body = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () =>
            resolve({ status: res.statusCode ?? 0, location: res.headers.location ?? null, setCookies: res.headers['set-cookie'] ?? [], headers: res.headers, body }),
          );
        },
      );
      req.on('error', reject);
      req.end();
    });

  const close = async () => {
    if (server.exitCode === null) {
      const exited = new Promise((resolve) => server.once('exit', resolve));
      server.kill('SIGTERM');
      await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 5_000))]);
      if (server.exitCode === null) server.kill('SIGKILL');
    }
    await new Promise((resolve) => workos.close(resolve));
  };

  const deadline = Date.now() + 60_000;
  let ready = false;
  while (!ready && Date.now() < deadline && server.exitCode === null) {
    try {
      ready = (await get('/')).status === 200;
    } catch {
      // not listening yet
    }
    if (!ready) await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!ready) {
    await close();
    throw new Error(`next start did not come up (run \`npm run build\` first):\n${output.split('\n').slice(-20).join('\n')}`);
  }

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    output: () => output,
    secrets,
    get,
    takeExchanges: () => {
      const taken = exchanges;
      exchanges = [];
      return taken;
    },
    newCode: () => {
      const code = `code_${randomBytes(12).toString('hex')}`;
      secrets.add(code);
      return code;
    },
    sealSession: async (user, { expiresInSeconds = 300, forged = false } = {}) => {
      const now = Math.floor(Date.now() / 1000);
      const claims = { sub: user.id, sid: `session_${randomBytes(8).toString('hex')}`, org_id: 'org_http_test', iat: now, exp: now + expiresInSeconds };
      const accessToken = forged ? issuer.sign(claims, TokenIssuer.strangerKey()) : issuer.sign(claims);
      const refreshToken = `refresh_${randomBytes(12).toString('hex')}`;
      const workosUser = {
        object: 'user',
        id: user.id,
        email: user.email,
        emailVerified: true,
        firstName: user.firstName,
        lastName: user.lastName,
        profilePictureUrl: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const sealed = await sealData({ accessToken, refreshToken, user: workosUser }, { password: cookiePassword, ttl: 0 });
      secrets.add(accessToken);
      secrets.add(refreshToken);
      secrets.add(sealed);
      return sealed;
    },
    close,
  };
}

/** Wait until the server has printed `pattern` (logs are flushed asynchronously). */
export async function waitForOutput(app: App, pattern: RegExp): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (pattern.test(app.output())) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail(`expected server output matching ${pattern}`);
}

export function assertNoSecretsInOutput(app: App): void {
  const output = app.output();
  for (const secret of app.secrets) {
    assert.ok(!output.includes(secret), 'a secret value appeared in the server output');
  }
}
