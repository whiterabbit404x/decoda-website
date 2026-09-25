/**
 * The authenticated platform actor behind a request.
 *
 * `AuthSnapshot` is what the verified AuthKit session says (WorkOS user,
 * session id, active organization, impersonation). `resolveActor` adds what
 * the PLATFORM says about that identity: the internal user id and any
 * platform-admin grant. Impersonated sessions never carry platform-admin
 * authority, whatever grant the impersonated user holds.
 */
import { activeGrantFor, type AdminGrant } from './admin-grants';
import type { DbClient } from './db';

export interface AuthSnapshot {
  workosUserId: string;
  sessionId: string;
  organizationId: string | null;
  impersonated: boolean;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

export interface PlatformActor extends AuthSnapshot {
  platformUserId: string | null;
  userStatus: string | null;
  grant: AdminGrant | null;
}

export async function resolveActor(client: DbClient, auth: AuthSnapshot): Promise<PlatformActor> {
  const { rows } = await client.query<{ id: string; status: string }>(
    'SELECT id, status FROM platform.users WHERE workos_user_id = $1',
    [auth.workosUserId],
  );
  const user = rows[0];
  const grant = user && user.status === 'active' && !auth.impersonated ? await activeGrantFor(client, user.id) : null;
  return { ...auth, platformUserId: user?.id ?? null, userStatus: user?.status ?? null, grant };
}

export function actorDisplayName(actor: Pick<AuthSnapshot, 'firstName' | 'lastName' | 'email'>): string {
  const name = [actor.firstName, actor.lastName].filter(Boolean).join(' ').trim();
  return name || actor.email;
}
