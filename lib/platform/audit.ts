/**
 * Platform audit trail writer.
 *
 * Events are appended through `platform.append_audit_event`, inside the
 * caller's transaction, so an event exists if and only if the change it
 * describes committed. Metadata is sanitised before it is written: any key that
 * names a credential is dropped, whatever its value, as defense in depth on top
 * of callers never passing one.
 */
import type { DbClient } from './db';

export type AuditActorType = 'user' | 'anonymous' | 'system' | 'webhook' | 'operator';
export type AuditResult = 'success' | 'denied' | 'failed';

export interface AuditEvent {
  actorType: AuditActorType;
  actorUserId?: string | null;
  actorLabel?: string | null;
  action: string;
  organizationId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  result?: AuditResult;
  requestId?: string | null;
  ipHash?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

const SENSITIVE_KEY = /(pass(word)?|secret|token|cookie|authorization|api[_-]?key|private[_-]?key|seed|mnemonic|otp|totp|session[_-]?data)/i;
const ACTION_RE = /^[a-z_]+(\.[a-z_]+)+$/;

export function sanitizeAuditMetadata(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeAuditMetadata(item, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY.test(key)) continue;
      out[key] = sanitizeAuditMetadata(inner, depth + 1);
    }
    return out;
  }
  if (typeof value === 'string') return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  return value;
}

export async function recordAudit(client: DbClient, event: AuditEvent): Promise<string> {
  if (!ACTION_RE.test(event.action)) throw new Error(`Invalid audit action: ${event.action}`);
  const metadata = sanitizeAuditMetadata(event.metadata ?? {}) as Record<string, unknown>;
  const { rows } = await client.query<{ id: string }>(
    'SELECT platform.append_audit_event($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb) AS id',
    [
      event.actorType,
      event.actorUserId ?? null,
      event.actorLabel ? event.actorLabel.slice(0, 200) : null,
      event.action,
      event.organizationId ?? null,
      event.targetType ?? null,
      event.targetId ?? null,
      event.result ?? 'success',
      event.requestId ?? null,
      event.ipHash ?? null,
      event.userAgent ?? null,
      JSON.stringify(metadata),
    ],
  );
  return rows[0]!.id;
}
