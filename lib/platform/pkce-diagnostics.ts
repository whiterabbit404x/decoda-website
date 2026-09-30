/**
 * TEMPORARY — staging `missing_pkce_cookie` investigation
 * (whiterabbit404x/decoda-website#15). Remove before the PR leaves draft.
 *
 * Writes one `[auth:pkce-diagnostic]` JSON line per /sign-in and /auth/callback
 * request, on non-production deployments only. A line holds hostnames, the path,
 * cookie NAMES and counts, booleans and Vercel deployment metadata — never a
 * cookie value, the OAuth `code` or `state`, a token, a key, a database URL or
 * session contents.
 *
 * AuthKit's PKCE verifier cookie is host-only, so the question each line answers
 * is whether the host that received the request is the host WorkOS returns to.
 */
import { isProductionDeployment } from './config';

/** AuthKit's verifier cookie (`PKCE_COOKIE_NAME` in @workos-inc/authkit-nextjs 4.3.2, dist/esm/pkce.js). */
export const PKCE_COOKIE_NAME = 'wos-auth-verifier';

/**
 * The verifier cookie name AuthKit uses for an OAuth `state`: the 32-bit FNV-1a
 * hash of the state's UTF-8 bytes as 8 hex digits, as in the SDK's private
 * `getPKCECookieNameForState`. Only this derived name is ever logged.
 */
export function pkceCookieNameForState(state: string): string {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(state)) hash = Math.imul(hash ^ byte, 0x01000193) >>> 0;
  return `${PKCE_COOKIE_NAME}-${hash.toString(16).padStart(8, '0')}`;
}

export interface DiagnosticRequest {
  url: string;
  headers: Headers;
  cookies: { getAll(): { name: string }[] };
}

type Env = Record<string, string | undefined>;

export type PkceDiagnostic = Record<string, string | number | boolean | string[] | null>;

function clean(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  // Same normalisation as lib/platform/config.ts: one pair of pasted quotes.
  if (trimmed.length >= 2 && ((trimmed[0] === '"' && trimmed.at(-1) === '"') || (trimmed[0] === "'" && trimmed.at(-1) === "'"))) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function hostOf(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

// The host the browser used. Read the headers: `next start` builds request.url
// from its own address (Vercel builds it from the Host header).
function requestHost(request: DiagnosticRequest): string | null {
  return request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? hostOf(request.url);
}

function common(phase: 'sign-in' | 'callback', request: DiagnosticRequest, env: Env): PkceDiagnostic {
  const names = request.cookies.getAll().map((cookie) => cookie.name);
  const headers = request.headers;
  return {
    phase,
    host: requestHost(request),
    path: new URL(request.url).pathname,
    vercel_env: env.VERCEL_ENV ?? null,
    vercel_url: env.VERCEL_URL ?? null,
    vercel_branch_url: env.VERCEL_BRANCH_URL ?? null,
    cookie_count: names.length,
    verifier_cookie_names: names.filter((name) => name === PKCE_COOKIE_NAME || name.startsWith(`${PKCE_COOKIE_NAME}-`)),
    session_cookie_present: names.includes(clean(env.WORKOS_COOKIE_NAME) ?? 'wos-session'),
    cookie_domain_configured: clean(env.WORKOS_COOKIE_DOMAIN) !== null,
    sec_fetch_site: headers.get('sec-fetch-site'),
    sec_fetch_mode: headers.get('sec-fetch-mode'),
    sec_fetch_dest: headers.get('sec-fetch-dest'),
    rsc: headers.has('rsc'),
    prefetch: headers.has('next-router-prefetch') || /prefetch/i.test(headers.get('sec-purpose') ?? headers.get('purpose') ?? ''),
  };
}

/**
 * /sign-in, after `getSignInUrl()`: where the browser is now, where WorkOS will
 * send it back to (the `redirect_uri` actually sent), and whether the verifier
 * cookie for this flow is queued on the response.
 */
export function signInDiagnostic(
  request: DiagnosticRequest,
  authorizationUrl: string,
  responseCookies: { has(name: string): boolean },
  env: Env = process.env,
): PkceDiagnostic {
  const base = common('sign-in', request, env);
  let authorize: URL | null = null;
  try {
    authorize = new URL(authorizationUrl);
  } catch {
    authorize = null;
  }
  const redirectUri = authorize?.searchParams.get('redirect_uri') ?? null;
  const state = authorize?.searchParams.get('state') ?? null;
  const cookieName = state ? pkceCookieNameForState(state) : null;
  const expectedHost = hostOf(redirectUri);
  return {
    ...base,
    authorize_host: authorize?.host ?? null,
    expected_redirect_host: expectedHost,
    same_host: expectedHost !== null && base.host === expectedHost,
    // False when the deployment was built with another NEXT_PUBLIC_WORKOS_REDIRECT_URI
    // (the SDK inlines it at build time) than the one now in the environment.
    redirect_uri_matches_env: redirectUri !== null && redirectUri === clean(env.NEXT_PUBLIC_WORKOS_REDIRECT_URI),
    verifier_cookie_name: cookieName,
    verifier_cookie_set: cookieName !== null && responseCookies.has(cookieName),
  };
}

/** /auth/callback, before AuthKit runs: did the verifier cookie for this `state` arrive? */
export function callbackDiagnostic(request: DiagnosticRequest, env: Env = process.env): PkceDiagnostic {
  const base = common('callback', request, env);
  const params = new URL(request.url).searchParams;
  const state = params.get('state');
  const cookieName = state ? pkceCookieNameForState(state) : null;
  const names = new Set(request.cookies.getAll().map((cookie) => cookie.name));
  const expectedHost = hostOf(clean(env.NEXT_PUBLIC_WORKOS_REDIRECT_URI));
  return {
    ...base,
    code_present: params.has('code'),
    state_present: state !== null,
    expected_redirect_host: expectedHost,
    same_host: expectedHost !== null && base.host === expectedHost,
    verifier_cookie_name: cookieName,
    // AuthKit also accepts the legacy shared name.
    verifier_cookie_present: (cookieName !== null && names.has(cookieName)) || names.has(PKCE_COOKIE_NAME),
  };
}

function emit(build: () => PkceDiagnostic): void {
  if (isProductionDeployment()) return;
  try {
    console.info('[auth:pkce-diagnostic]', JSON.stringify(build()));
  } catch {
    // Diagnostics must never affect sign-in.
  }
}

export function logSignInDiagnostic(request: DiagnosticRequest, authorizationUrl: string, responseCookies: { has(name: string): boolean }): void {
  emit(() => signInDiagnostic(request, authorizationUrl, responseCookies));
}

export function logCallbackDiagnostic(request: DiagnosticRequest): void {
  emit(() => callbackDiagnostic(request));
}
