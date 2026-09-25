/**
 * Organization switching.
 *
 * The browser names a platform organization id; it is honoured only if the
 * signed-in user is an ACTIVE member of that ACTIVE organization according to
 * the platform. WorkOS then re-validates the membership when it re-issues the
 * session for that organization, so a forged id is refused twice.
 */
import type { AuthSnapshot } from './actor';
import { recordAudit } from './audit';
import type { DbClient } from './db';
import { forbidden } from './errors';

export interface SwitchTarget {
  platformOrganizationId: string;
  workosOrganizationId: string;
  name: string;
}

export async function resolveSwitchTarget(client: DbClient, auth: AuthSnapshot, platformOrganizationId: string): Promise<SwitchTarget> {
  const { rows } = await client.query<{ workos_organization_id: string; organization_name: string }>(
    `SELECT workos_organization_id, organization_name
       FROM platform_api.user_organizations_v1
      WHERE workos_user_id = $1 AND platform_organization_id = $2`,
    [auth.workosUserId, platformOrganizationId],
  );
  if (!rows[0]) {
    throw forbidden('ORGANIZATION_NOT_AVAILABLE', 'You are not an active member of that organization.');
  }
  return { platformOrganizationId, workosOrganizationId: rows[0].workos_organization_id, name: rows[0].organization_name };
}

export async function recordOrganizationSwitch(
  client: DbClient,
  auth: AuthSnapshot,
  target: SwitchTarget,
  requestId: string,
): Promise<void> {
  const user = await client.query<{ id: string }>('SELECT id FROM platform.users WHERE workos_user_id = $1', [auth.workosUserId]);
  await recordAudit(client, {
    actorType: 'user',
    actorUserId: user.rows[0]?.id ?? null,
    action: 'organization.switched',
    organizationId: target.platformOrganizationId,
    targetType: 'organization',
    targetId: target.platformOrganizationId,
    requestId,
    metadata: { surface: 'website' },
  });
}
