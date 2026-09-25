/**
 * Refuse credential-shaped input before it is stored.
 *
 * Mirrors RWA Guard's `looks_like_secret` (raw 32-byte keys, PEM private keys,
 * a whole-field BIP-39 mnemonic) and adds common API-key shapes. Input that
 * matches is REFUSED, not redacted: a secret must never reach the database,
 * the review console, an email or an audit row.
 */

const SECRET_PATTERNS: RegExp[] = [
  /0x[a-fA-F0-9]{64}/, // raw 32-byte private key
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/, // PEM private key
  /\bxprv[1-9A-HJ-NP-Za-km-z]{100,}/, // BIP-32 extended private key
  /\bsk_(?:live|test)_[A-Za-z0-9]{16,}/, // WorkOS / Stripe-style secret keys
  /\bAKIA[0-9A-Z]{16}\b/, // AWS access key id
  /\bgh[pousr]_[A-Za-z0-9]{36,}\b/, // GitHub tokens
  /\bre_[A-Za-z0-9_]{20,}\b/, // Resend API keys
];

// A mnemonic is the WHOLE field: exactly a BIP-39 word count of bare lowercase
// words. Deliberately not "12+ short words anywhere", which matches prose.
const MNEMONIC_RE = /^[a-z]{3,8}(?: [a-z]{3,8})+$/;
const MNEMONIC_WORD_COUNTS = new Set([12, 15, 18, 21, 24]);

export const SECRET_WARNING = 'Do not include private keys, credentials, seed phrases or other secrets.';

export function looksLikeSecret(value: string): boolean {
  if (SECRET_PATTERNS.some((pattern) => pattern.test(value))) return true;
  const collapsed = value.trim().toLowerCase().split(/\s+/).join(' ');
  return MNEMONIC_RE.test(collapsed) && MNEMONIC_WORD_COUNTS.has(collapsed.split(' ').length);
}
