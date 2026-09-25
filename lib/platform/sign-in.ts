/**
 * What the platform does when a user completes sign-in at www, and when they
 * sign out.
 *
 * Sign-in runs an on-demand sync of the user and ALL their WorkOS memberships,
 * so an invitation accepted seconds ago is reflected before its webhook
 * arrives. If it fails, the AuthKit callback clears the new session and shows
 * an error: the platform never lets someone in on data it could not refresh.
 *
 * Sign-out records the WorkOS session as revoked at once, so every product
 * session bound to it is refused immediately — not only when the
 * `session.revoked` webhook lands.
 */
import { recordAudit } from './audit';
import type { DbClient } from './db';
import { syncUserFromWorkOS } from './identity-sync';
import type { WorkOSGateway, WorkOSUser } from './workos';

export interface SignInFacts {
  user: WorkOSUser;
  organizationId?: string;
  authenticationMethod?: string;
  impersonated: boolean;
}

export async function recordWebsiteSignIn(client: DbClient, gateway: WorkOSGateway, facts: SignInFacts): Promise<{ platformUserId: string }> {
  const { userId, memberships } = await syncUserFromWorkOS(client, gateway, facts.user);
  await client.query('UPDATE platform.users SET last_sign_in_at = now(), updated_at = now() WHERE id = $1', [userId]);
  const organization = facts.organizationId
    ? await client.query<{ id: string }>('SELECT id FROM platform.organizations WHERE workos_organization_id = $1', [facts.organizationId])
    : null;
  await recordAudit(client, {
    actorType: 'user',
    actorUserId: userId,
    action: 'auth.website_sign_in',
    organizationId: organization?.rows[0]?.id ?? null,
    targetType: 'user',
    targetId: userId,
    metadata: {
      method: facts.authenticationMethod ?? null,
      impersonated: facts.impersonated,
      memberships_synced: memberships.length,
    },
  });
  return { platformUserId: userId };
}

export async function recordSignOut(
  client: DbClient,
  facts: { workosUserId: string; sessionId: string; requestId: string; ipHash: string | null },
): Promise<void> {
  await client.query(
    `INSERT INTO platform.workos_session_revocations (workos_session_id, workos_user_id, revoked_at, source)
     VALUES ($1, $2, now(), 'user_sign_out') ON CONFLICT (workos_session_id) DO NOTHING`,
    [facts.sessionId, facts.workosUserId],
  );
  const user = await client.query<{ id: string }>('SELECT id FROM platform.users WHERE workos_user_id = $1', [facts.workosUserId]);
  await recordAudit(client, {
    actorType: 'user',
    actorUserId: user.rows[0]?.id ?? null,
    action: 'auth.logout',
    targetType: 'session',
    targetId: facts.sessionId,
    requestId: facts.requestId,
    ipHash: facts.ipHash,
    metadata: { via: 'website' },
  });
}
