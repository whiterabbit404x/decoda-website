/**
 * Request Pilot intake: validation, normalisation and persistence.
 *
 * A submission is a queue entry for Decoda to review. It creates no account,
 * organization, membership or entitlement — those exist only after a platform
 * admin approves the request and the invited person accepts.
 *
 * Framework-free so it can be unit-tested without a server.
 */
import { recordAudit } from './audit';
import type { DbClient } from './db';
import { PlatformError } from './errors';
import { isProductKey, PRODUCT_LABELS, type ProductKey } from './products';
import { PILOT_FIELD_LIMITS, TEAM_SIZES, type PilotField, type PilotFieldErrors, type TeamSize } from './pilot-form';
import { looksLikeSecret, SECRET_WARNING } from './secret-detector';

export { PILOT_FIELD_LIMITS, PILOT_HONEYPOT_FIELD, TEAM_SIZES, type PilotFieldErrors, type TeamSize } from './pilot-form';

/** Consumer mailbox providers. Flagged for the reviewer, never blocked. */
const FREE_MAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'ymail.com', 'outlook.com', 'hotmail.com', 'live.com', 'msn.com',
  'icloud.com', 'me.com', 'mac.com', 'aol.com', 'proton.me', 'protonmail.com', 'gmx.com', 'gmx.de', 'mail.com',
  'yandex.com', 'yandex.ru', 'zoho.com', 'qq.com', '163.com', '126.com', 'hey.com', 'fastmail.com',
]);

export interface PilotSubmission {
  email: string;
  emailDomain: string;
  freeMailDomain: boolean;
  fullName: string;
  company: string;
  role: string;
  companyWebsite: string | null;
  requestedProducts: ProductKey[];
  useCase: string | null;
  teamSize: TeamSize | null;
  notes: string | null;
}

const text = (value: unknown) => (typeof value === 'string' ? value : '');
const singleLine = (value: string) => value.normalize('NFC').replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/\s+/g, ' ').trim();
const multiLine = (value: string) =>
  value
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, '')
    .trim();

/**
 * Normalise a work email: NFC, trimmed, lower-cased. Rejects whitespace,
 * control characters and structurally invalid addresses (which also rules out
 * header injection through the reply-to).
 */
export function normalizeWorkEmail(raw: unknown): { email: string; domain: string } | null {
  const value = text(raw).normalize('NFC').trim().toLowerCase();
  if (!value || value.length > PILOT_FIELD_LIMITS.email) return null;
  if (/[\s\u0000-\u001f\u007f]/.test(value)) return null;
  const at = value.lastIndexOf('@');
  if (at <= 0 || value.indexOf('@') !== at || at > 64) return null;
  const domain = value.slice(at + 1);
  if (!/^[a-z0-9¡-￿](?:[a-z0-9¡-￿-]{0,61}[a-z0-9¡-￿])?(?:\.[a-z0-9¡-￿](?:[a-z0-9¡-￿-]{0,61}[a-z0-9¡-￿])?)+$/.test(domain)) {
    return null;
  }
  return { email: value, domain };
}

/** Normalise an optional company website to `https://host[/path]`. */
export function normalizeWebsite(raw: unknown): { ok: true; value: string | null } | { ok: false } {
  const value = singleLine(text(raw));
  if (!value) return { ok: true, value: null };
  if (value.length > PILOT_FIELD_LIMITS.companyWebsite) return { ok: false };
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return { ok: false };
  }
  if ((url.protocol !== 'https:' && url.protocol !== 'http:') || !url.hostname.includes('.') || url.username || url.password) {
    return { ok: false };
  }
  const path = url.pathname === '/' ? '' : url.pathname;
  return { ok: true, value: `https://${url.hostname}${path}`.slice(0, PILOT_FIELD_LIMITS.companyWebsite) };
}

export type PilotValidation = { success: true; data: PilotSubmission } | { success: false; fieldErrors: PilotFieldErrors };

export function validatePilotRequest(raw: unknown): PilotValidation {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const errors: PilotFieldErrors = {};

  const email = normalizeWorkEmail(source.email);
  if (!text(source.email).trim()) errors.email = 'Enter your work email.';
  else if (!email) errors.email = 'Enter a valid work email address.';

  const fullName = singleLine(text(source.fullName));
  if (!fullName) errors.fullName = 'Enter your full name.';
  else if (fullName.length > PILOT_FIELD_LIMITS.fullName) errors.fullName = `Use ${PILOT_FIELD_LIMITS.fullName} characters or fewer.`;

  const company = singleLine(text(source.company));
  if (!company) errors.company = 'Enter your company.';
  else if (company.length > PILOT_FIELD_LIMITS.company) errors.company = `Use ${PILOT_FIELD_LIMITS.company} characters or fewer.`;

  const role = singleLine(text(source.role));
  if (!role) errors.role = 'Enter your job title or role.';
  else if (role.length > PILOT_FIELD_LIMITS.role) errors.role = `Use ${PILOT_FIELD_LIMITS.role} characters or fewer.`;

  const website = normalizeWebsite(source.companyWebsite);
  if (!website.ok) errors.companyWebsite = 'Enter a valid website, e.g. acme.com.';

  const productsRaw = Array.isArray(source.requestedProducts) ? source.requestedProducts : [];
  const requestedProducts = [...new Set(productsRaw.filter(isProductKey))];
  if (requestedProducts.length === 0 || requestedProducts.length !== new Set(productsRaw).size) {
    errors.requestedProducts = 'Choose at least one Decoda product.';
  }

  const useCase = multiLine(text(source.useCase));
  if (useCase.length > PILOT_FIELD_LIMITS.useCase) errors.useCase = `Use ${PILOT_FIELD_LIMITS.useCase} characters or fewer.`;

  const teamSizeRaw = text(source.teamSize).trim();
  const teamSize = teamSizeRaw ? ((TEAM_SIZES as readonly string[]).includes(teamSizeRaw) ? (teamSizeRaw as TeamSize) : undefined) : null;
  if (teamSize === undefined) errors.teamSize = 'Choose a team size from the list.';

  const notes = multiLine(text(source.notes));
  if (notes.length > PILOT_FIELD_LIMITS.notes) errors.notes = `Use ${PILOT_FIELD_LIMITS.notes} characters or fewer.`;

  const freeText: Array<[PilotField, string]> = [
    ['fullName', fullName],
    ['company', company],
    ['role', role],
    ['useCase', useCase],
    ['notes', notes],
  ];
  for (const [field, value] of freeText) {
    if (value && !errors[field] && looksLikeSecret(value)) {
      errors[field] = `That looks like a private key, credential or seed phrase. ${SECRET_WARNING}`;
    }
  }

  if (Object.keys(errors).length > 0 || !email || !website.ok) return { success: false, fieldErrors: errors };
  return {
    success: true,
    data: {
      email: email.email,
      emailDomain: email.domain,
      freeMailDomain: FREE_MAIL_DOMAINS.has(email.domain),
      fullName,
      company,
      role,
      companyWebsite: website.value,
      requestedProducts: requestedProducts.sort((a, b) => ['rwa_guard', 'vault', 'assets'].indexOf(a) - ['rwa_guard', 'vault', 'assets'].indexOf(b)),
      useCase: useCase || null,
      teamSize: teamSize ?? null,
      notes: notes || null,
    },
  };
}

export function productListText(products: readonly ProductKey[]): string {
  return products.map((product) => (product === 'assets' ? `${PRODUCT_LABELS.assets} (coming soon)` : PRODUCT_LABELS[product])).join(', ');
}

// ── Persistence ────────────────────────────────────────────────────────────

/** Durable, instance-independent limits (the in-memory limiter is best effort). */
export const PILOT_DB_LIMITS = { perEmailPerDay: 3, perIpPerHour: 10 } as const;

export interface SubmissionContext {
  requestId: string;
  ipHash: string | null;
  source: string;
}

export type SubmissionOutcome = { kind: 'created'; id: string } | { kind: 'duplicate'; id: string };

export async function submitPilotRequest(client: DbClient, data: PilotSubmission, ctx: SubmissionContext): Promise<SubmissionOutcome> {
  const recent = await client.query<{ by_email: number; by_ip: number }>(
    `SELECT
        (SELECT count(*)::int FROM platform.pilot_requests WHERE email = $1 AND created_at > now() - interval '24 hours') AS by_email,
        (SELECT count(*)::int FROM platform.pilot_requests WHERE $2::text IS NOT NULL AND source_ip_hash = $2 AND created_at > now() - interval '1 hour') AS by_ip`,
    [data.email, ctx.ipHash],
  );
  const counts = recent.rows[0]!;
  if (counts.by_email >= PILOT_DB_LIMITS.perEmailPerDay || counts.by_ip >= PILOT_DB_LIMITS.perIpPerHour) {
    throw new PlatformError(429, 'PILOT_RATE_LIMITED', 'Too many requests. Please try again later.');
  }

  const inserted = await client.query<{ id: string }>(
    `INSERT INTO platform.pilot_requests
        (email, email_domain, full_name, company_name, company_website, role, requested_products, use_case, team_size, notes,
         request_id, source, source_ip_hash, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)
     ON CONFLICT (email) WHERE status = 'pending' DO NOTHING
     RETURNING id`,
    [
      data.email,
      data.emailDomain,
      data.fullName,
      data.company,
      data.companyWebsite,
      data.role,
      data.requestedProducts,
      data.useCase,
      data.teamSize,
      data.notes,
      ctx.requestId,
      ctx.source,
      ctx.ipHash,
      JSON.stringify({ free_mail_domain: data.freeMailDomain }),
    ],
  );
  if (inserted.rows[0]) {
    await recordAudit(client, {
      actorType: 'anonymous',
      action: 'pilot.requested',
      targetType: 'pilot_request',
      targetId: inserted.rows[0].id,
      requestId: ctx.requestId,
      ipHash: ctx.ipHash,
      metadata: { products: data.requestedProducts, free_mail_domain: data.freeMailDomain, source: ctx.source },
    });
    return { kind: 'created', id: inserted.rows[0].id };
  }
  // An open (pending) request already exists for this address. Idempotent: no
  // second row, no second email — the form cannot be used to amplify mail.
  const existing = await client.query<{ id: string }>("SELECT id FROM platform.pilot_requests WHERE email = $1 AND status = 'pending'", [
    data.email,
  ]);
  await recordAudit(client, {
    actorType: 'anonymous',
    action: 'pilot.duplicate_submission',
    targetType: 'pilot_request',
    targetId: existing.rows[0]?.id ?? null,
    requestId: ctx.requestId,
    ipHash: ctx.ipHash,
  });
  return { kind: 'duplicate', id: existing.rows[0]?.id ?? '' };
}

export async function recordNotificationOutcome(
  client: DbClient,
  pilotRequestId: string,
  outcome: { internal: 'sent' | 'failed' | 'skipped'; confirmation: 'sent' | 'failed' | 'skipped' },
): Promise<void> {
  await client.query(
    `UPDATE platform.pilot_requests
        SET metadata = metadata || jsonb_build_object('notifications', $2::jsonb), updated_at = now()
      WHERE id = $1`,
    [pilotRequestId, JSON.stringify(outcome)],
  );
}

// ── Review console reads ──────────────────────────────────────────────────

export interface PilotRequestRow {
  id: string;
  email: string;
  full_name: string;
  company_name: string;
  company_website: string | null;
  role: string;
  requested_products: ProductKey[];
  use_case: string | null;
  team_size: string | null;
  notes: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'converted';
  created_at: Date;
  reviewed_at: Date | null;
  reviewer_email: string | null;
  review_note: string | null;
  organization_id: string | null;
  organization_name: string | null;
  request_id: string;
  metadata: Record<string, unknown>;
}

const SELECT_REQUEST = `
  SELECT r.id, r.email, r.full_name, r.company_name, r.company_website, r.role, r.requested_products, r.use_case,
         r.team_size, r.notes, r.status, r.created_at, r.reviewed_at, reviewer.email AS reviewer_email, r.review_note,
         r.organization_id, o.name AS organization_name, r.request_id, r.metadata
    FROM platform.pilot_requests r
    LEFT JOIN platform.users reviewer ON reviewer.id = r.reviewed_by
    LEFT JOIN platform.organizations o ON o.id = r.organization_id`;

export async function listPilotRequests(client: DbClient, status: string | null, limit = 100): Promise<PilotRequestRow[]> {
  const valid = status && ['pending', 'approved', 'rejected', 'converted'].includes(status) ? status : null;
  const { rows } = await client.query<PilotRequestRow>(
    `${SELECT_REQUEST} WHERE ($1::text IS NULL OR r.status = $1) ORDER BY r.created_at DESC LIMIT $2`,
    [valid, Math.max(1, Math.min(limit, 500))],
  );
  return rows;
}

export async function getPilotRequest(client: DbClient, id: string): Promise<PilotRequestRow | null> {
  const { rows } = await client.query<PilotRequestRow>(`${SELECT_REQUEST} WHERE r.id = $1`, [id]);
  return rows[0] ?? null;
}
