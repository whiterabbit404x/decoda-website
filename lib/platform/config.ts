/**
 * Decoda Platform configuration, read from the environment at request time.
 *
 * Nothing here is evaluated at build time, so `next build` never needs
 * secrets. At request time every identity surface calls `requireIdentityConfig`
 * or `requirePlatformSecret`; a missing or unsafe value raises
 * `PlatformConfigError` (a controlled 503 that names only variable NAMES in the
 * server log). There is no demo, mock or legacy fallback.
 *
 * WorkOS variable names are the ones the official SDKs read
 * (`@workos-inc/authkit-nextjs`): WORKOS_CLIENT_ID, WORKOS_API_KEY,
 * WORKOS_COOKIE_PASSWORD, NEXT_PUBLIC_WORKOS_REDIRECT_URI.
 */
import { PlatformConfigError } from './errors';

function env(name: string): string {
  const raw = process.env[name];
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  // Hosting dashboards store pasted quotes literally; strip one matching pair.
  if (trimmed.length >= 2 && ((trimmed[0] === '"' && trimmed.at(-1) === '"') || (trimmed[0] === "'" && trimmed.at(-1) === "'"))) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

/** True for the real production deployment (Vercel production, or explicit). */
export function isProductionDeployment(): boolean {
  return env('DECODA_ENV') === 'production' || env('VERCEL_ENV') === 'production';
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '0.0.0.0']);

/** Parse an absolute URL; production requires https and a non-local host. */
export function parseServiceUrl(name: string, value: string, production: boolean): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new PlatformConfigError([name], 'invalid');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new PlatformConfigError([name], 'invalid');
  if (production && (url.protocol !== 'https:' || LOCAL_HOSTS.has(url.hostname))) {
    throw new PlatformConfigError([name], 'unsafe for production');
  }
  return url;
}

export interface ProductUrls {
  website: string;
  rwa_guard: string;
  vault: string;
  assets: string;
}

const DEFAULT_URLS: ProductUrls = {
  website: 'https://www.decodasecurity.com',
  rwa_guard: 'https://rwa.decodasecurity.com',
  vault: 'https://vault.decodasecurity.com',
  assets: 'https://assets.decodasecurity.com',
};

export function productUrls(): ProductUrls {
  const production = isProductionDeployment();
  const read = (name: string, fallback: string) =>
    parseServiceUrl(name, env(name) || fallback, production).toString().replace(/\/$/, '');
  return {
    website: read('DECODA_WEBSITE_URL', DEFAULT_URLS.website),
    rwa_guard: read('DECODA_RWA_GUARD_URL', DEFAULT_URLS.rwa_guard),
    vault: read('DECODA_VAULT_URL', DEFAULT_URLS.vault),
    assets: read('DECODA_ASSETS_URL', DEFAULT_URLS.assets),
  };
}

export interface IdentityConfig {
  clientId: string;
  apiKey: string;
  redirectUri: string;
}

/**
 * WorkOS AuthKit configuration for the Website application. Called by every
 * sign-in/callback/admin surface before touching the SDK, so a missing value
 * fails closed with a named diagnostic instead of an opaque SDK error.
 */
export function requireIdentityConfig(): IdentityConfig {
  const missing: string[] = [];
  const clientId = env('WORKOS_CLIENT_ID');
  const apiKey = env('WORKOS_API_KEY');
  const cookiePassword = env('WORKOS_COOKIE_PASSWORD');
  const redirectUri = env('NEXT_PUBLIC_WORKOS_REDIRECT_URI');
  if (!clientId) missing.push('WORKOS_CLIENT_ID');
  if (!apiKey) missing.push('WORKOS_API_KEY');
  if (!cookiePassword) missing.push('WORKOS_COOKIE_PASSWORD');
  if (!redirectUri) missing.push('NEXT_PUBLIC_WORKOS_REDIRECT_URI');
  if (missing.length) throw new PlatformConfigError(missing);
  if (cookiePassword.length < 32) throw new PlatformConfigError(['WORKOS_COOKIE_PASSWORD'], 'too short (min 32 chars)');
  parseServiceUrl('NEXT_PUBLIC_WORKOS_REDIRECT_URI', redirectUri, isProductionDeployment());
  return { clientId, apiKey, redirectUri };
}

export function requireWebhookSecret(): string {
  const secret = env('WORKOS_WEBHOOK_SECRET');
  if (!secret) throw new PlatformConfigError(['WORKOS_WEBHOOK_SECRET']);
  return secret;
}

/**
 * HMAC key for platform CSRF tokens, Request Pilot form tokens and IP hashing.
 * Distinct from the WorkOS cookie password so rotating one never invalidates
 * the other.
 */
export function requirePlatformSecret(): string {
  const secret = env('DECODA_PLATFORM_SECRET');
  if (!secret) throw new PlatformConfigError(['DECODA_PLATFORM_SECRET']);
  if (secret.length < 32) throw new PlatformConfigError(['DECODA_PLATFORM_SECRET'], 'too short (min 32 chars)');
  return secret;
}

export interface PilotEmailConfig {
  notificationTo: string;
  from: string;
  sendConfirmation: boolean;
}

export function pilotEmailConfig(): PilotEmailConfig {
  return {
    notificationTo: env('PILOT_NOTIFICATION_EMAIL') || 'hello@decodasecurity.com',
    from: env('PILOT_FROM_EMAIL') || env('CONTACT_FROM_EMAIL') || 'Decoda <noreply@decodasecurity.com>',
    sendConfirmation: env('PILOT_SEND_CONFIRMATION') !== 'false',
  };
}

/** Days a WorkOS invitation stays valid (WorkOS accepts 1–30). */
export function invitationExpiresInDays(): number {
  const parsed = Number.parseInt(env('DECODA_INVITATION_EXPIRES_DAYS') || '7', 10);
  if (!Number.isFinite(parsed)) return 7;
  return Math.min(30, Math.max(1, parsed));
}
