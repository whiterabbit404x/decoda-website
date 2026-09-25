/**
 * Platform-admin authority.
 *
 * A platform admin is a platform user holding an active row in
 * `platform.platform_admin_grants` with explicit, named permissions. Every
 * admin route checks the permission it needs, server-side, on every request;
 * the console's hidden links are presentation only. Grants are written by the
 * operator CLI (first grant) or by an admin, and every change is audited. No
 * email address is special anywhere in code.
 */
import { recordAudit } from './audit';
import type { DbClient } from './db';
import { forbidden, notFound, PlatformError } from './errors';

export const PLATFORM_PERMISSIONS = [
  'platform.pilot_requests.read',
  'platform.pilot_requests.review',
  'platform.organizations.read',
  'platform.organizations.manage',
  'platform.entitlements.manage',
  'platform.invitations.manage',
  'platform.audit.read',
] as const;
export type PlatformPermission = (typeof PLATFORM_PERMISSIONS)[number];

export function isPlatformPermission(value: string): value is PlatformPermission {
  return (PLATFORM_PERMISSIONS as readonly string[]).includes(value);
}

export interface AdminGrant {
  grantId: string;
  permissions: ReadonlySet<PlatformPermission>;
}

/** The active grant of an ACTIVE platform user, or null. */
export async function activeGrantFor(client: DbClient, platformUserId: string): Promise<AdminGrant | null> {
  const { rows } = await client.query<{ id: string; permissions: string[] }>(
    `SELECT g.id, g.permissions
       FROM platform.platform_admin_grants g
       JOIN platform.users u ON u.id = g.user_id
      WHERE g.user_id = $1 AND g.revoked_at IS NULL AND u.status = 'active'`,
    [platformUserId],
  );
  const row = rows[0];
  if (!row) return null;
  return { grantId: row.id, permissions: new Set(row.permissions.filter(isPlatformPermission)) };
}

export function hasPermission(grant: AdminGrant | null, permission: PlatformPermission): boolean {
  return Boolean(grant?.permissions.has(permission));
}

export function requirePermission(grant: AdminGrant | null, permission: PlatformPermission): void {
  if (!hasPermission(grant, permission)) {
    throw forbidden('PLATFORM_PERMISSION_DENIED', 'Your account does not have the platform permission required for this action.');
  }
}

export interface GrantInput {
  workosUserId: string;
  permissions: PlatformPermission[];
  grantedBy: string;
  reason: string;
}

/** Create or replace a user's active grant (operator CLI / admin action). */
export async function grantPlatformAdmin(client: DbClient, input: GrantInput): Promise<string> {
  if (input.permissions.length === 0) throw new PlatformError(400, 'PERMISSIONS_REQUIRED', 'At least one permission is required.');
  const user = await client.query<{ id: string; status: string }>('SELECT id, status FROM platform.users WHERE workos_user_id = $1', [
    input.workosUserId,
  ]);
  if (!user.rows[0]) throw notFound('No platform user exists for that WorkOS user. The person must sign in at www once first.');
  if (user.rows[0].status !== 'active') throw new PlatformError(409, 'USER_NOT_ACTIVE', 'That user is not active.');
  const userId = user.rows[0].id;
  await client.query(
    `UPDATE platform.platform_admin_grants SET revoked_at = now(), revoked_by = $2, revoke_reason = 'replaced by a new grant'
      WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId, input.grantedBy],
  );
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO platform.platform_admin_grants (user_id, permissions, granted_by, reason)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [userId, [...new Set(input.permissions)], input.grantedBy, input.reason],
  );
  await recordAudit(client, {
    actorType: 'operator',
    actorLabel: input.grantedBy,
    action: 'platform_admin.granted',
    targetType: 'user',
    targetId: userId,
    metadata: { permissions: [...new Set(input.permissions)], reason: input.reason },
  });
  return rows[0]!.id;
}

export async function revokePlatformAdmin(client: DbClient, workosUserId: string, revokedBy: string, reason: string): Promise<boolean> {
  const { rows } = await client.query<{ user_id: string }>(
    `UPDATE platform.platform_admin_grants g SET revoked_at = now(), revoked_by = $2, revoke_reason = $3
       FROM platform.users u
      WHERE u.id = g.user_id AND u.workos_user_id = $1 AND g.revoked_at IS NULL
      RETURNING g.user_id`,
    [workosUserId, revokedBy, reason],
  );
  if (!rows[0]) return false;
  await recordAudit(client, {
    actorType: 'operator',
    actorLabel: revokedBy,
    action: 'platform_admin.revoked',
    targetType: 'user',
    targetId: rows[0].user_id,
    metadata: { reason },
  });
  return true;
}
