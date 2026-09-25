/**
 * Platform-admin provisioning: organizations, product entitlements, Pilot
 * review and invitations.
 *
 * Rules every function here keeps:
 *   * the caller has already been authenticated and holds the platform
 *     permission for the action (checked in lib/platform/admin-api.ts);
 *   * WorkOS is never called inside a database transaction — local state is
 *     committed first (with a `sending` reservation where a double submit
 *     must be impossible), the provider is called, then the outcome is
 *     committed with its audit event;
 *   * every change writes an audit event in the same transaction as the change.
 */
import type { Pool } from 'pg';
import type { PlatformActor } from './actor';
import { recordAudit } from './audit';
import { withTransaction, type DbClient } from './db';
import { badRequest, conflict, notFound, PlatformError } from './errors';
import { normalizeEmail, uniqueSlug } from './identity-sync';
import { ENTITLEMENT_STATUSES, isProductKey, type EntitlementStatus, type ProductKey } from './products';
import { workosErrorStatus, type WorkOSGateway } from './workos';

export interface ProvisioningDeps {
  pool: Pool;
  gateway: WorkOSGateway;
  invitationExpiresInDays: number;
}

export interface AdminContext {
  actor: PlatformActor & { platformUserId: string };
  requestId: string;
  ipHash: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function audit(client: DbClient, ctx: AdminContext, action: string, fields: Partial<Parameters<typeof recordAudit>[1]> = {}) {
  await recordAudit(client, {
    actorType: 'user',
    actorUserId: ctx.actor.platformUserId,
    actorLabel: ctx.actor.email,
    action,
    requestId: ctx.requestId,
    ipHash: ctx.ipHash,
    ...fields,
  });
}

// ── Organizations ──────────────────────────────────────────────────────────

export async function createOrganizationRecord(
  client: DbClient,
  ctx: AdminContext,
  input: { name: string; website?: string | null; pilotRequestId?: string | null },
): Promise<{ id: string; slug: string }> {
  const name = input.name.trim();
  if (!name || name.length > 200) throw badRequest('VALIDATION_FAILED', 'Organization name must be 1–200 characters.');
  const slug = await uniqueSlug(client, name);
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO platform.organizations (name, slug, website, created_by_user_id, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING id`,
    [name, slug, input.website ?? null, ctx.actor.platformUserId, JSON.stringify(input.pilotRequestId ? { pilot_request_id: input.pilotRequestId } : {})],
  );
  await audit(client, ctx, 'organization.created', {
    organizationId: rows[0]!.id,
    targetType: 'organization',
    targetId: rows[0]!.id,
    metadata: { name, slug, source: input.pilotRequestId ? 'pilot_request' : 'admin' },
  });
  return { id: rows[0]!.id, slug };
}

/**
 * Create (or confirm) the WorkOS organization for a platform organization.
 * Idempotent: the WorkOS call carries an idempotency key derived from the
 * platform id, and `external_id = platform id` makes the link verifiable from
 * both sides. Refuses to re-point an organization already linked elsewhere.
 */
export async function ensureWorkOSOrganization(ctx: AdminContext, deps: ProvisioningDeps, organizationId: string): Promise<string> {
  const { rows } = await deps.pool.query<{ name: string; status: string; workos_organization_id: string | null }>(
    'SELECT name, status, workos_organization_id FROM platform.organizations WHERE id = $1',
    [organizationId],
  );
  const org = rows[0];
  if (!org) throw notFound('Organization not found.');
  if (org.workos_organization_id) return org.workos_organization_id;
  if (org.status !== 'active') throw conflict('ORGANIZATION_NOT_ACTIVE', 'Only an active organization can be linked.');

  let workosOrganizationId: string;
  try {
    const created = await deps.gateway.createOrganization({
      name: org.name,
      externalId: organizationId,
      idempotencyKey: `decoda-platform-org-${organizationId}`,
    });
    workosOrganizationId = created.id;
  } catch (error) {
    throw new PlatformError(502, 'IDENTITY_PROVIDER_ERROR', 'The identity provider did not create the organization. Retry shortly.', {
      provider_status: workosErrorStatus(error),
    });
  }

  return withTransaction(async (client) => {
    const updated = await client.query(
      `UPDATE platform.organizations SET workos_organization_id = $2, updated_at = now()
        WHERE id = $1 AND (workos_organization_id IS NULL OR workos_organization_id = $2)`,
      [organizationId, workosOrganizationId],
    );
    if (updated.rowCount === 0) {
      throw conflict('ORGANIZATION_LINK_CONFLICT', 'This organization is already linked to a different identity organization.');
    }
    await audit(client, ctx, 'organization.linked', { organizationId, targetType: 'organization', targetId: organizationId });
    return workosOrganizationId;
  }, deps.pool);
}

export async function setOrganizationStatus(
  ctx: AdminContext,
  deps: ProvisioningDeps,
  organizationId: string,
  status: 'active' | 'suspended',
  reason: string,
): Promise<void> {
  await withTransaction(async (client) => {
    const { rows } = await client.query<{ status: string }>('SELECT status FROM platform.organizations WHERE id = $1 FOR UPDATE', [organizationId]);
    if (!rows[0]) throw notFound('Organization not found.');
    if (rows[0].status === 'closed') throw conflict('ORGANIZATION_CLOSED', 'A closed organization cannot be changed.');
    if (rows[0].status === status) return;
    await client.query('UPDATE platform.organizations SET status = $2, updated_at = now() WHERE id = $1', [organizationId, status]);
    await audit(client, ctx, status === 'suspended' ? 'organization.suspended' : 'organization.reactivated', {
      organizationId,
      targetType: 'organization',
      targetId: organizationId,
      metadata: { reason, from: rows[0].status, to: status },
    });
  }, deps.pool);
}

// ── Entitlements ───────────────────────────────────────────────────────────

export interface EntitlementInput {
  product: ProductKey;
  status: EntitlementStatus;
  plan?: string | null;
  startsAt?: Date | null;
  expiresAt?: Date | null;
}

export function parseEntitlementInput(raw: Record<string, unknown>): EntitlementInput {
  if (!isProductKey(raw.product)) throw badRequest('VALIDATION_FAILED', 'Unknown product.');
  if (typeof raw.status !== 'string' || !(ENTITLEMENT_STATUSES as readonly string[]).includes(raw.status)) {
    throw badRequest('VALIDATION_FAILED', 'Unknown entitlement status.');
  }
  const plan = typeof raw.plan === 'string' && raw.plan.trim() ? raw.plan.trim().toLowerCase() : null;
  if (plan && !/^[a-z0-9_-]{1,64}$/.test(plan)) throw badRequest('VALIDATION_FAILED', 'Plan must be 1–64 lowercase letters, digits, - or _.');
  const date = (key: string): Date | null => {
    const value = raw[key];
    if (value === undefined || value === null || value === '') return null;
    const parsed = new Date(String(value));
    if (Number.isNaN(parsed.getTime())) throw badRequest('VALIDATION_FAILED', `${key} is not a valid date.`);
    return parsed;
  };
  const startsAt = date('startsAt');
  const expiresAt = date('expiresAt');
  if (startsAt && expiresAt && expiresAt <= startsAt) throw badRequest('VALIDATION_FAILED', 'expiresAt must be after startsAt.');
  return { product: raw.product, status: raw.status as EntitlementStatus, plan, startsAt, expiresAt };
}

function entitlementAction(from: string | null, to: EntitlementStatus): string {
  const grants = (s: string | null) => s === 'enabled' || s === 'pilot';
  if (to === 'disabled') return 'entitlement.disabled';
  if (to === 'suspended') return 'entitlement.suspended';
  if (grants(to) && !grants(from)) return 'entitlement.enabled';
  return 'entitlement.updated';
}

export async function upsertEntitlement(client: DbClient, ctx: AdminContext, organizationId: string, input: EntitlementInput): Promise<void> {
  const org = await client.query<{ status: string }>('SELECT status FROM platform.organizations WHERE id = $1 FOR UPDATE', [organizationId]);
  if (!org.rows[0]) throw notFound('Organization not found.');
  if (org.rows[0].status === 'closed') throw conflict('ORGANIZATION_CLOSED', 'A closed organization cannot be changed.');
  const before = await client.query<{ status: string; plan: string; expires_at: Date | null }>(
    'SELECT status, plan, expires_at FROM platform.organization_product_entitlements WHERE organization_id = $1 AND product = $2 FOR UPDATE',
    [organizationId, input.product],
  );
  const plan = input.plan ?? (input.status === 'pilot' ? 'pilot' : before.rows[0]?.plan ?? 'standard');
  await client.query(
    `INSERT INTO platform.organization_product_entitlements
        (organization_id, product, status, plan, starts_at, expires_at, created_by_user_id, updated_by_user_id)
     VALUES ($1, $2, $3, $4, COALESCE($5, now()), $6, $7, $7)
     ON CONFLICT (organization_id, product) DO UPDATE
        SET status = EXCLUDED.status, plan = EXCLUDED.plan,
            starts_at = COALESCE($5, platform.organization_product_entitlements.starts_at),
            expires_at = EXCLUDED.expires_at, updated_by_user_id = EXCLUDED.updated_by_user_id, updated_at = now()`,
    [organizationId, input.product, input.status, plan, input.startsAt ?? null, input.expiresAt ?? null, ctx.actor.platformUserId],
  );
  await audit(client, ctx, entitlementAction(before.rows[0]?.status ?? null, input.status), {
    organizationId,
    targetType: 'entitlement',
    targetId: `${organizationId}:${input.product}`,
    metadata: {
      product: input.product,
      from: before.rows[0]?.status ?? null,
      to: input.status,
      plan,
      expires_at: input.expiresAt ? input.expiresAt.toISOString() : null,
    },
  });
}

export async function setEntitlement(ctx: AdminContext, deps: ProvisioningDeps, organizationId: string, input: EntitlementInput): Promise<void> {
  await withTransaction((client) => upsertEntitlement(client, ctx, organizationId, input), deps.pool);
}

// ── Pilot review ───────────────────────────────────────────────────────────

export async function rejectPilotRequest(ctx: AdminContext, deps: ProvisioningDeps, pilotRequestId: string, note: string | null): Promise<void> {
  await withTransaction(async (client) => {
    const { rows } = await client.query<{ status: string }>('SELECT status FROM platform.pilot_requests WHERE id = $1 FOR UPDATE', [pilotRequestId]);
    if (!rows[0]) throw notFound('Pilot request not found.');
    if (rows[0].status !== 'pending') throw conflict('PILOT_REQUEST_NOT_PENDING', `A ${rows[0].status} request cannot be rejected.`);
    await client.query(
      `UPDATE platform.pilot_requests SET status = 'rejected', reviewed_at = now(), reviewed_by = $2, review_note = $3, updated_at = now()
        WHERE id = $1`,
      [pilotRequestId, ctx.actor.platformUserId, note],
    );
    await audit(client, ctx, 'pilot.rejected', { targetType: 'pilot_request', targetId: pilotRequestId, metadata: { note_recorded: Boolean(note) } });
  }, deps.pool);
}

export interface ApprovalInput {
  organization: { mode: 'create'; name: string } | { mode: 'link'; organizationId: string };
  products: EntitlementInput[];
  invite: { email: string; role: 'admin' | 'member' } | null;
}

export interface ApprovalResult {
  organizationId: string;
  workosLinked: boolean;
  invitation: InvitationOutcome | null;
  warnings: string[];
}

export async function approvePilotRequest(
  ctx: AdminContext,
  deps: ProvisioningDeps,
  pilotRequestId: string,
  input: ApprovalInput,
): Promise<ApprovalResult> {
  if (input.products.length === 0) throw badRequest('VALIDATION_FAILED', 'Enable at least one product.');
  const seen = new Set<string>();
  for (const product of input.products) {
    if (seen.has(product.product)) throw badRequest('VALIDATION_FAILED', 'Each product may appear once.');
    seen.add(product.product);
  }

  const organizationId = await withTransaction(async (client) => {
    const { rows } = await client.query<{ status: string; company_name: string; company_website: string | null }>(
      'SELECT status, company_name, company_website FROM platform.pilot_requests WHERE id = $1 FOR UPDATE',
      [pilotRequestId],
    );
    const request = rows[0];
    if (!request) throw notFound('Pilot request not found.');
    if (request.status !== 'pending') throw conflict('PILOT_REQUEST_NOT_PENDING', `A ${request.status} request cannot be approved again.`);

    let orgId: string;
    if (input.organization.mode === 'create') {
      orgId = (await createOrganizationRecord(client, ctx, { name: input.organization.name, website: request.company_website, pilotRequestId })).id;
    } else {
      const existing = await client.query<{ status: string }>('SELECT status FROM platform.organizations WHERE id = $1', [
        input.organization.organizationId,
      ]);
      if (!existing.rows[0]) throw notFound('Organization not found.');
      if (existing.rows[0].status !== 'active') throw conflict('ORGANIZATION_NOT_ACTIVE', 'Link the request to an active organization.');
      orgId = input.organization.organizationId;
    }
    for (const product of input.products) await upsertEntitlement(client, ctx, orgId, product);
    await client.query(
      `UPDATE platform.pilot_requests SET status = 'approved', reviewed_at = now(), reviewed_by = $2, organization_id = $3, updated_at = now()
        WHERE id = $1`,
      [pilotRequestId, ctx.actor.platformUserId, orgId],
    );
    await audit(client, ctx, 'pilot.approved', {
      organizationId: orgId,
      targetType: 'pilot_request',
      targetId: pilotRequestId,
      metadata: { organization_mode: input.organization.mode, products: input.products.map((p) => `${p.product}:${p.status}`) },
    });
    return orgId;
  }, deps.pool);

  const warnings: string[] = [];
  let workosLinked = false;
  try {
    await ensureWorkOSOrganization(ctx, deps, organizationId);
    workosLinked = true;
  } catch (error) {
    warnings.push(error instanceof PlatformError ? error.message : 'The identity organization could not be created yet.');
  }

  let invitation: InvitationOutcome | null = null;
  if (input.invite && workosLinked) {
    try {
      invitation = await sendInvitation(ctx, deps, {
        organizationId,
        email: input.invite.email,
        role: input.invite.role,
        pilotRequestId,
      });
    } catch (error) {
      warnings.push(error instanceof PlatformError ? error.message : 'The invitation could not be sent.');
    }
  } else if (input.invite) {
    warnings.push('The invitation was not sent because the organization is not linked yet. Link it, then send the invitation.');
  }
  return { organizationId, workosLinked, invitation, warnings };
}

// ── Invitations ────────────────────────────────────────────────────────────

export interface InvitationOutcome {
  invitationId: string;
  state: string;
  duplicate: boolean;
  expiresAt: string | null;
}

export async function sendInvitation(
  ctx: AdminContext,
  deps: ProvisioningDeps,
  input: { organizationId: string; email: string; role: 'admin' | 'member'; pilotRequestId?: string | null; legacyLinkId?: string | null },
): Promise<InvitationOutcome> {
  const email = normalizeEmail(input.email);
  if (!EMAIL_RE.test(email) || email.length > 254) throw badRequest('VALIDATION_FAILED', 'Enter a valid email address.');
  if (input.role !== 'admin' && input.role !== 'member') throw badRequest('VALIDATION_FAILED', 'Role must be admin or member.');

  const reservation = await withTransaction(async (client) => {
    const org = await client.query<{ status: string; workos_organization_id: string | null }>(
      'SELECT status, workos_organization_id FROM platform.organizations WHERE id = $1',
      [input.organizationId],
    );
    if (!org.rows[0]) throw notFound('Organization not found.');
    if (org.rows[0].status !== 'active') throw conflict('ORGANIZATION_NOT_ACTIVE', 'Invitations can only be sent for an active organization.');
    if (!org.rows[0].workos_organization_id) throw conflict('ORGANIZATION_NOT_LINKED', 'Link the organization to the identity provider first.');

    // A reservation abandoned by a crashed request must not block the address forever.
    await client.query(
      `UPDATE platform.invitations SET state = 'failed', failure_code = 'stale_reservation', updated_at = now()
        WHERE organization_id = $1 AND email = $2 AND state = 'sending' AND created_at < now() - interval '5 minutes'`,
      [input.organizationId, email],
    );
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO platform.invitations (organization_id, pilot_request_id, legacy_link_id, email, role, state, invited_by_user_id)
       VALUES ($1, $2, $3, $4, $5, 'sending', $6)
       ON CONFLICT (organization_id, email) WHERE state IN ('sending', 'pending') DO NOTHING
       RETURNING id`,
      [input.organizationId, input.pilotRequestId ?? null, input.legacyLinkId ?? null, email, input.role, ctx.actor.platformUserId],
    );
    if (!inserted.rows[0]) {
      const existing = await client.query<{ id: string; state: string; expires_at: Date | null }>(
        `SELECT id, state, expires_at FROM platform.invitations
          WHERE organization_id = $1 AND email = $2 AND state IN ('sending', 'pending')`,
        [input.organizationId, email],
      );
      return { duplicate: true as const, row: existing.rows[0]!, workosOrganizationId: org.rows[0].workos_organization_id };
    }
    return { duplicate: false as const, id: inserted.rows[0].id, workosOrganizationId: org.rows[0].workos_organization_id };
  }, deps.pool);

  if (reservation.duplicate) {
    // An open invitation already exists: never send a second email by accident.
    // Re-sending is an explicit, separate action.
    return {
      invitationId: reservation.row.id,
      state: reservation.row.state,
      duplicate: true,
      expiresAt: reservation.row.expires_at ? reservation.row.expires_at.toISOString() : null,
    };
  }

  try {
    const sent = await deps.gateway.sendInvitation({
      email,
      organizationId: reservation.workosOrganizationId,
      roleSlug: input.role,
      expiresInDays: deps.invitationExpiresInDays,
      inviterUserId: ctx.actor.workosUserId,
    });
    return await withTransaction(async (client) => {
      await client.query(
        `UPDATE platform.invitations SET state = 'pending', workos_invitation_id = $2, expires_at = $3, workos_updated_at = $4, updated_at = now()
          WHERE id = $1`,
        [reservation.id, sent.id, sent.expiresAt, sent.updatedAt],
      );
      await audit(client, ctx, 'invitation.sent', {
        organizationId: input.organizationId,
        targetType: 'invitation',
        targetId: reservation.id,
        metadata: { role: input.role, pilot_request: Boolean(input.pilotRequestId), legacy_link: Boolean(input.legacyLinkId) },
      });
      return { invitationId: reservation.id, state: 'pending', duplicate: false, expiresAt: sent.expiresAt };
    }, deps.pool);
  } catch (error) {
    if (error instanceof PlatformError) throw error;
    const status = workosErrorStatus(error);
    await withTransaction(async (client) => {
      await client.query(
        "UPDATE platform.invitations SET state = 'failed', failure_code = $2, updated_at = now() WHERE id = $1 AND state = 'sending'",
        [reservation.id, `workos_${status ?? 'error'}`],
      );
      await audit(client, ctx, 'invitation.send_failed', {
        organizationId: input.organizationId,
        targetType: 'invitation',
        targetId: reservation.id,
        result: 'failed',
        metadata: { provider_status: status },
      });
    }, deps.pool);
    throw new PlatformError(502, 'INVITATION_SEND_FAILED', 'The identity provider did not send the invitation. Nothing was sent; retry shortly.', {
      provider_status: status,
    });
  }
}

async function invitationForAction(deps: ProvisioningDeps, invitationId: string) {
  const { rows } = await deps.pool.query<{ id: string; organization_id: string; state: string; workos_invitation_id: string | null; expires_at: Date | null }>(
    'SELECT id, organization_id, state, workos_invitation_id, expires_at FROM platform.invitations WHERE id = $1',
    [invitationId],
  );
  if (!rows[0]) throw notFound('Invitation not found.');
  return rows[0];
}

export async function revokeInvitation(ctx: AdminContext, deps: ProvisioningDeps, invitationId: string): Promise<void> {
  const invitation = await invitationForAction(deps, invitationId);
  if (invitation.state !== 'pending' || !invitation.workos_invitation_id) {
    throw conflict('INVITATION_NOT_PENDING', `A ${invitation.state} invitation cannot be revoked.`);
  }
  try {
    await deps.gateway.revokeInvitation(invitation.workos_invitation_id);
  } catch (error) {
    throw new PlatformError(502, 'IDENTITY_PROVIDER_ERROR', 'The identity provider did not revoke the invitation. It is still active.', {
      provider_status: workosErrorStatus(error),
    });
  }
  await withTransaction(async (client) => {
    await client.query(
      `UPDATE platform.invitations SET state = 'revoked', revoked_at = now(), revoked_by_user_id = $2, updated_at = now()
        WHERE id = $1 AND state = 'pending'`,
      [invitationId, ctx.actor.platformUserId],
    );
    await audit(client, ctx, 'invitation.revoked', { organizationId: invitation.organization_id, targetType: 'invitation', targetId: invitationId });
  }, deps.pool);
}

export async function resendInvitation(ctx: AdminContext, deps: ProvisioningDeps, invitationId: string): Promise<InvitationOutcome> {
  const invitation = await invitationForAction(deps, invitationId);
  if (!invitation.workos_invitation_id || !['pending', 'expired'].includes(invitation.state)) {
    throw conflict('INVITATION_NOT_RESENDABLE', `A ${invitation.state} invitation cannot be re-sent. Send a new invitation instead.`);
  }
  let resent;
  try {
    resent = await deps.gateway.resendInvitation(invitation.workos_invitation_id);
  } catch (error) {
    throw new PlatformError(502, 'IDENTITY_PROVIDER_ERROR', 'The identity provider did not re-send the invitation.', {
      provider_status: workosErrorStatus(error),
    });
  }
  await withTransaction(async (client) => {
    await client.query(
      "UPDATE platform.invitations SET state = 'pending', expires_at = $2, workos_updated_at = $3, updated_at = now() WHERE id = $1",
      [invitationId, resent.expiresAt, resent.updatedAt],
    );
    await audit(client, ctx, 'invitation.resent', { organizationId: invitation.organization_id, targetType: 'invitation', targetId: invitationId });
  }, deps.pool);
  return { invitationId, state: 'pending', duplicate: false, expiresAt: resent.expiresAt };
}
