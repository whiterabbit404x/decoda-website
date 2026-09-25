/**
 * Post-sign-in destinations. Only same-site paths under an allowlisted prefix
 * are honoured, so a crafted `returnTo` can never become an open redirect.
 */
const ALLOWED_PREFIXES = ['/launcher', '/account', '/admin'];

export function safeReturnPath(value: string | null | undefined, fallback = '/launcher'): string {
  if (!value || typeof value !== 'string') return fallback;
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\') || /[\u0000-\u001f]/.test(value)) return fallback;
  let parsed: URL;
  try {
    parsed = new URL(value, 'https://return.invalid');
  } catch {
    return fallback;
  }
  if (parsed.origin !== 'https://return.invalid') return fallback;
  const allowed = ALLOWED_PREFIXES.some((prefix) => parsed.pathname === prefix || parsed.pathname.startsWith(`${prefix}/`));
  return allowed ? `${parsed.pathname}${parsed.search}` : fallback;
}
