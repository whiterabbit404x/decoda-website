/**
 * WorkOS webhook processing.
 *
 * Order of operations — nothing in the body is trusted before step 3:
 *   1. require the WorkOS-Signature header;
 *   2. reject a signature timestamp from the future (the SDK only bounds age);
 *   3. verify the HMAC signature and age with the official SDK
 *      (`webhooks.constructEvent`, 3-minute tolerance);
 *   4. claim the event id in `platform.workos_events` — a replayed or
 *      redelivered event is recognised and applied at most once;
 *   5. apply the event and mark it processed, in the SAME transaction, so a
 *      crash can never leave an event half-applied or recorded as done.
 * A failure rolls everything back, records the event as `failed` with a safe
 * error code, and answers 500 so WorkOS redelivers.
 */
import type { Pool } from 'pg';
import { recordAudit, type AuditEvent } from './audit';
import { getPool, withTransaction, type DbClient } from './db';
import { PlatformConfigError, PlatformError } from './errors';
import {
  deactivateMembership,
  markOrganizationDeleted,
  markUserDeleted,
  upsertMembership,
  upsertOrganization,
  upsertUser,
} from './identity-sync';
import type {
  WorkOSEvent,
  WorkOSGateway,
  WorkOSInvitation,
  WorkOSMembership,
  WorkOSOrganization,
  WorkOSSession,
  WorkOSUser,
} from './workos';

const EVENT_ID_RE = /^event_[A-Za-z0-9]{1,120}$/;
const EVENT_TYPE_RE = /^[a-z_]+(\.[a-z_]+)+$/;
/** Allowed clock skew for a signature timestamp ahead of our clock. */
export const MAX_FUTURE_SKEW_MS = 60_000;

export interface WebhookResult {
  status: number;
  body: Record<string, unknown>;
}

export interface WebhookDeps {
  gateway: WorkOSGateway;
  pool?: Pool;
  now?: () => number;
  logger?: Pick<Console, 'warn' | 'error'>;
}

/** Timestamp (ms) from `t=<ms>, v1=<hash>`, or null when absent/malformed. */
export function signatureTimestamp(header: string): number | null {
  const part = header
    .split(',')
    .map((piece) => piece.trim())
    .find((piece) => piece.startsWith('t='));
  if (!part) return null;
  const value = Number(part.slice(2));
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

type Outcome = 'processed' | 'ignored';

async function audit(
  client: DbClient,
  requestId: string,
  action: string,
  fields: Omit<AuditEvent, 'actorType' | 'action' | 'requestId'> = {},
) {
  await recordAudit(client, { actorType: 'webhook', actorLabel: 'workos', action, requestId, ...fields });
}

async function applyInvitation(client: DbClient, event: WorkOSEvent, requestId: string): Promise<Outcome> {
  const invitation = event.data as WorkOSInvitation;
  if (event.event === 'invitation.created') {
    // Mirror invitations sent outside the platform (e.g. from the WorkOS
    // dashboard) so the console shows them. Only for known organizations.
    if (!invitation.organizationId) return 'ignored';
    const org = await client.query<{ id: string }>('SELECT id FROM platform.organizations WHERE workos_organization_id = $1', [
      invitation.organizationId,
    ]);
    if (!org.rows[0]) return 'ignored';
    await client.query(
      `INSERT INTO platform.invitations (organization_id, email, role, workos_invitation_id, state, expires_at, workos_updated_at)
       VALUES ($1, lower($2), $3, $4, 'pending', $5, $6)
       ON CONFLICT DO NOTHING`,
      [org.rows[0].id, invitation.email, invitation.roleSlug === 'admin' ? 'admin' : 'member', invitation.id, invitation.expiresAt, invitation.updatedAt],
    );
    return 'processed';
  }

  const { rows } = await client.query<{ id: string; organization_id: string; pilot_request_id: string | null; legacy_link_id: string | null; state: string }>(
    'SELECT id, organization_id, pilot_request_id, legacy_link_id, state FROM platform.invitations WHERE workos_invitation_id = $1 FOR UPDATE',
    [invitation.id],
  );
  const row = rows[0];
  if (!row) return 'ignored';

  if (event.event === 'invitation.accepted') {
    if (!invitation.acceptedUserId) throw new PlatformError(422, 'WEBHOOK_PAYLOAD_INVALID', 'Accepted invitation without a user.');
    await client.query(
      `UPDATE platform.invitations
          SET state = 'accepted', accepted_at = COALESCE($2::timestamptz, now()), accepted_workos_user_id = $3,
              workos_updated_at = $4, updated_at = now()
        WHERE id = $1`,
      [row.id, invitation.acceptedAt, invitation.acceptedUserId, invitation.updatedAt],
    );
    if (row.pilot_request_id) {
      await client.query(
        "UPDATE platform.pilot_requests SET status = 'converted', updated_at = now() WHERE id = $1 AND status = 'approved'",
        [row.pilot_request_id],
      );
    }
    if (row.legacy_link_id) await bindLegacyLink(client, row.legacy_link_id, invitation.acceptedUserId, requestId, row.organization_id);
    await audit(client, requestId, 'invitation.accepted', {
      organizationId: row.organization_id,
      targetType: 'invitation',
      targetId: row.id,
      metadata: { workos_user_id: invitation.acceptedUserId, legacy_link: Boolean(row.legacy_link_id) },
    });
    return 'processed';
  }

  if (event.event === 'invitation.revoked') {
    if (row.state === 'revoked') return 'processed';
    await client.query(
      `UPDATE platform.invitations SET state = 'revoked', revoked_at = COALESCE($2::timestamptz, now()), workos_updated_at = $3, updated_at = now()
        WHERE id = $1`,
      [row.id, invitation.revokedAt, invitation.updatedAt],
    );
    await audit(client, requestId, 'invitation.revoked', { organizationId: row.organization_id, targetType: 'invitation', targetId: row.id });
    return 'processed';
  }

  if (event.event === 'invitation.resent') {
    await client.query('UPDATE platform.invitations SET expires_at = $2, workos_updated_at = $3, updated_at = now() WHERE id = $1', [
      row.id,
      invitation.expiresAt,
      invitation.updatedAt,
    ]);
    return 'processed';
  }
  return 'ignored';
}

/**
 * Bind a reviewed legacy account to the WorkOS identity that accepted the
 * invitation sent for it. Refuses (marks `conflict`) rather than re-pointing a
 * link, or linking one WorkOS identity to two legacy accounts.
 */
async function bindLegacyLink(client: DbClient, linkId: string, workosUserId: string, requestId: string, organizationId: string) {
  await client.query('SAVEPOINT legacy_link');
  try {
    const { rowCount } = await client.query(
      `UPDATE platform.legacy_identity_links SET workos_user_id = $2, status = 'linked', updated_at = now()
        WHERE id = $1 AND status IN ('pending_invitation', 'invited') AND workos_user_id IS NULL`,
      [linkId, workosUserId],
    );
    await client.query('RELEASE SAVEPOINT legacy_link');
    if (rowCount) {
      await audit(client, requestId, 'legacy_identity.linked', { organizationId, targetType: 'legacy_identity_link', targetId: linkId });
      return;
    }
  } catch (error) {
    await client.query('ROLLBACK TO SAVEPOINT legacy_link');
    if ((error as { code?: string }).code !== '23505') throw error;
  }
  const current = await client.query<{ workos_user_id: string | null; status: string }>(
    'SELECT workos_user_id, status FROM platform.legacy_identity_links WHERE id = $1',
    [linkId],
  );
  if (current.rows[0]?.status === 'linked' && current.rows[0].workos_user_id === workosUserId) return;
  await client.query(
    `UPDATE platform.legacy_identity_links
        SET status = 'conflict', workos_user_id = NULL, detail = detail || jsonb_build_object('conflict', 'workos_identity_mismatch'), updated_at = now()
      WHERE id = $1 AND status <> 'linked'`,
    [linkId],
  );
  await audit(client, requestId, 'legacy_identity.conflict', {
    organizationId,
    targetType: 'legacy_identity_link',
    targetId: linkId,
    result: 'denied',
  });
}

async function applyEvent(client: DbClient, gateway: WorkOSGateway, event: WorkOSEvent, requestId: string): Promise<Outcome> {
  switch (event.event) {
    case 'user.created':
    case 'user.updated': {
      const user = event.data as WorkOSUser;
      const userId = await upsertUser(client, user);
      if (event.event === 'user.created') {
        await audit(client, requestId, 'identity.user_created', { targetType: 'user', targetId: userId });
      }
      return 'processed';
    }
    case 'user.deleted': {
      const user = event.data as WorkOSUser;
      const userId = await markUserDeleted(client, user.id);
      if (userId) await audit(client, requestId, 'identity.user_deleted', { targetType: 'user', targetId: userId });
      return userId ? 'processed' : 'ignored';
    }
    case 'organization.created':
    case 'organization.updated': {
      const result = await upsertOrganization(client, event.data as WorkOSOrganization);
      await audit(client, requestId, result.created ? 'organization.created' : 'organization.updated', {
        organizationId: result.id,
        targetType: 'organization',
        targetId: result.id,
        metadata: { source: 'workos' },
      });
      return 'processed';
    }
    case 'organization.deleted': {
      const orgId = await markOrganizationDeleted(client, (event.data as WorkOSOrganization).id);
      if (orgId) await audit(client, requestId, 'organization.closed', { organizationId: orgId, targetType: 'organization', targetId: orgId });
      return orgId ? 'processed' : 'ignored';
    }
    case 'organization_membership.created':
    case 'organization_membership.updated': {
      const change = await upsertMembership(client, gateway, event.data as WorkOSMembership);
      const target = { organizationId: change.organizationId, targetType: 'membership', targetId: change.membershipId };
      if (!change.before) {
        await audit(client, requestId, 'membership.created', { ...target, metadata: { status: change.after.status, role: change.after.role } });
      } else {
        if (change.before.role !== change.after.role) {
          await audit(client, requestId, 'membership.role_changed', { ...target, metadata: { from: change.before.role, to: change.after.role } });
        }
        if (change.before.status !== change.after.status) {
          await audit(client, requestId, change.after.status === 'active' ? 'membership.activated' : 'membership.removed', {
            ...target,
            metadata: { from: change.before.status, to: change.after.status },
          });
        }
      }
      return 'processed';
    }
    case 'organization_membership.deleted': {
      const removed = await deactivateMembership(client, (event.data as WorkOSMembership).id);
      if (removed) {
        await audit(client, requestId, 'membership.removed', { organizationId: removed.organizationId, targetType: 'user', targetId: removed.userId });
      }
      return removed ? 'processed' : 'ignored';
    }
    case 'invitation.created':
    case 'invitation.accepted':
    case 'invitation.revoked':
    case 'invitation.resent':
      return applyInvitation(client, event, requestId);
    case 'session.created': {
      const session = event.data as WorkOSSession;
      await audit(client, requestId, 'auth.login', { targetType: 'session', targetId: session.id, metadata: { workos_user_id: session.userId } });
      return 'processed';
    }
    case 'session.revoked': {
      const session = event.data as WorkOSSession;
      await client.query(
        `INSERT INTO platform.workos_session_revocations (workos_session_id, workos_user_id, revoked_at, source)
         VALUES ($1, $2, COALESCE($3::timestamptz, now()), 'webhook') ON CONFLICT (workos_session_id) DO NOTHING`,
        [session.id, session.userId, session.endedAt],
      );
      await audit(client, requestId, 'auth.logout', { targetType: 'session', targetId: session.id, metadata: { workos_user_id: session.userId, via: 'session.revoked' } });
      return 'processed';
    }
    default:
      if (event.event.startsWith('authentication.') && event.event.endsWith('_failed')) {
        const data = (event.data ?? {}) as { user_id?: string; userId?: string; type?: string; error?: { code?: string } };
        await audit(client, requestId, 'auth.failed', {
          result: 'failed',
          targetType: 'user',
          targetId: data.userId ?? data.user_id ?? null,
          metadata: { event: event.event, error_code: data.error?.code ?? null },
        });
        return 'processed';
      }
      return 'ignored';
  }
}

function objectId(event: WorkOSEvent): string | null {
  const id = (event.data as { id?: unknown } | null)?.id;
  return typeof id === 'string' ? id.slice(0, 128) : null;
}

export async function handleWorkOSWebhook(
  rawBody: string,
  signatureHeader: string | null,
  requestId: string,
  deps: WebhookDeps,
): Promise<WebhookResult> {
  const now = deps.now ?? Date.now;
  const logger = deps.logger ?? console;
  if (!signatureHeader) {
    return { status: 400, body: { ok: false, error: { code: 'WEBHOOK_SIGNATURE_MISSING', request_id: requestId } } };
  }
  const timestamp = signatureTimestamp(signatureHeader);
  if (timestamp === null || timestamp > now() + MAX_FUTURE_SKEW_MS) {
    return { status: 401, body: { ok: false, error: { code: 'WEBHOOK_SIGNATURE_INVALID', request_id: requestId } } };
  }

  let event: WorkOSEvent;
  try {
    event = await deps.gateway.constructEvent(rawBody, signatureHeader);
  } catch (error) {
    if (error instanceof PlatformConfigError) {
      logger.error('[platform:webhook] not configured', { request_id: requestId, diagnostic: error.diagnostic });
      return { status: 503, body: { ok: false, error: { code: error.code, request_id: requestId } } };
    }
    // Never log the body or the header: an unverified payload is untrusted input.
    logger.warn('[platform:webhook] signature verification failed', { request_id: requestId });
    return { status: 401, body: { ok: false, error: { code: 'WEBHOOK_SIGNATURE_INVALID', request_id: requestId } } };
  }

  if (!EVENT_ID_RE.test(String(event.id)) || !EVENT_TYPE_RE.test(String(event.event))) {
    return { status: 400, body: { ok: false, error: { code: 'WEBHOOK_PAYLOAD_INVALID', request_id: requestId } } };
  }

  const pool = deps.pool ?? getPool();
  try {
    const outcome = await withTransaction(async (client) => {
      const claimed = await client.query(
        `INSERT INTO platform.workos_events (event_id, event_type, event_created_at, object_id, status)
         VALUES ($1, $2, $3, $4, 'processing') ON CONFLICT (event_id) DO NOTHING RETURNING event_id`,
        [event.id, event.event, event.createdAt, objectId(event)],
      );
      if (!claimed.rows[0]) {
        // Blocks until any concurrent delivery of the same event commits.
        const existing = await client.query<{ status: string }>('SELECT status FROM platform.workos_events WHERE event_id = $1 FOR UPDATE', [event.id]);
        if (existing.rows[0]?.status !== 'failed') return 'duplicate' as const;
        await client.query("UPDATE platform.workos_events SET status = 'processing', attempts = attempts + 1 WHERE event_id = $1", [event.id]);
      }
      const result = await applyEvent(client, deps.gateway, event, requestId);
      await client.query('UPDATE platform.workos_events SET status = $2, processed_at = now(), error_code = NULL WHERE event_id = $1', [
        event.id,
        result,
      ]);
      return result;
    }, pool);
    return { status: 200, body: { ok: true, outcome, request_id: requestId } };
  } catch (error) {
    const code = error instanceof PlatformError ? error.code : ((error as { code?: string }).code ?? 'PROCESSING_FAILED');
    logger.error('[platform:webhook] processing failed', { request_id: requestId, event_id: event.id, event_type: event.event, code });
    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO platform.workos_events (event_id, event_type, event_created_at, object_id, status, error_code)
         VALUES ($1, $2, $3, $4, 'failed', $5)
         ON CONFLICT (event_id) DO UPDATE SET status = 'failed', error_code = EXCLUDED.error_code, attempts = platform.workos_events.attempts + 1
          WHERE platform.workos_events.status NOT IN ('processed', 'ignored')`,
        [event.id, event.event, event.createdAt, objectId(event), String(code).slice(0, 80)],
      );
    }, pool).catch(() => undefined);
    return { status: 500, body: { ok: false, error: { code: 'WEBHOOK_PROCESSING_FAILED', request_id: requestId } } };
  }
}
