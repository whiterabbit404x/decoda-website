/**
 * Client-safe Request Pilot constants and response interpretation.
 *
 * Imported by the browser form AND the server, so it must not import anything
 * server-only (database, providers, secrets).
 */

export const PILOT_FIELD_LIMITS = {
  email: 254,
  fullName: 120,
  company: 160,
  role: 120,
  companyWebsite: 300,
  useCase: 2000,
  notes: 4000,
} as const;

export const TEAM_SIZES = ['1-5', '6-20', '21-100', '100+'] as const;
export type TeamSize = (typeof TEAM_SIZES)[number];

/** Hidden field; people never fill it, naive bots do. */
export const PILOT_HONEYPOT_FIELD = 'fax_number';

/** Custom header the form sends; cross-site pages cannot send it without a preflight. */
export const PILOT_FORM_HEADER = 'x-decoda-form';
export const PILOT_FORM_HEADER_VALUE = 'request-pilot';

export type PilotField =
  | 'email'
  | 'fullName'
  | 'company'
  | 'role'
  | 'companyWebsite'
  | 'requestedProducts'
  | 'useCase'
  | 'teamSize'
  | 'notes';

export type PilotFieldErrors = Partial<Record<PilotField, string>>;

/** How each product is offered on the form — never implying availability that does not exist. */
export const PILOT_PRODUCT_OPTIONS = [
  { value: 'rwa_guard', label: 'RWA Guard', note: 'Security monitoring and incident response for tokenized RWAs.' },
  { value: 'vault', label: 'Decoda Vault', note: 'Digital asset operations — testnet pilot only; no real-money custody.' },
  { value: 'assets', label: 'Decoda Assets', note: 'Coming soon — not yet available. Selecting it registers interest.' },
] as const;

export type PilotClientOutcome =
  | { kind: 'success'; reference: string | null }
  | { kind: 'validation'; fieldErrors: PilotFieldErrors }
  | { kind: 'expired' }
  | { kind: 'rate_limited' }
  | { kind: 'failed'; reference: string | null };

/** Success only on a 2xx WITH an explicit `ok: true` from the server. */
export function interpretPilotResponse(status: number, body: unknown): PilotClientOutcome {
  const parsed = (body && typeof body === 'object' ? body : {}) as {
    ok?: unknown;
    reference?: unknown;
    fieldErrors?: PilotFieldErrors;
    error?: { code?: unknown; request_id?: unknown };
  };
  const reference = typeof parsed.reference === 'string' ? parsed.reference : typeof parsed.error?.request_id === 'string' ? parsed.error.request_id : null;
  if (status >= 200 && status < 300 && parsed.ok === true) return { kind: 'success', reference };
  if (status === 400 && parsed.error?.code === 'PILOT_VALIDATION_FAILED' && parsed.fieldErrors) {
    return { kind: 'validation', fieldErrors: parsed.fieldErrors };
  }
  if (status === 400 && parsed.error?.code === 'PILOT_FORM_EXPIRED') return { kind: 'expired' };
  if (status === 429) return { kind: 'rate_limited' };
  return { kind: 'failed', reference };
}
