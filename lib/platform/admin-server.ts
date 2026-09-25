/**
 * Server wiring for the platform admin console: real dependencies for admin
 * API routes, and the gate every admin PAGE passes before rendering.
 *
 * Pages hide nothing that the API does not also refuse: each admin route
 * re-checks the permission itself (lib/platform/admin-api.ts).
 */
import { redirect } from 'next/navigation';
import { resolveActor, type PlatformActor } from './actor';
import type { AdminApiDeps } from './admin-api';
import { hasPermission, type PlatformPermission } from './admin-grants';
import { recordAudit } from './audit';
import { invitationExpiresInDays, requirePlatformSecret } from './config';
import { issueCsrfToken } from './csrf';
import { getPool, withClient, withTransaction } from './db';
import { logPlatformPageError } from './http';
import { currentAuth } from './session';
import { getWorkOSGateway } from './workos';

export async function adminDeps(): Promise<AdminApiDeps> {
  return {
    auth: await currentAuth(),
    secret: requirePlatformSecret(),
    pool: getPool(),
    gateway: getWorkOSGateway(),
    invitationExpiresInDays: invitationExpiresInDays(),
  };
}

export type AdminPageGate =
  | { kind: 'ok'; actor: PlatformActor; csrfToken: string }
  | { kind: 'forbidden' }
  | { kind: 'unavailable' };

export async function gateAdminPage(permission: PlatformPermission, returnTo: string): Promise<AdminPageGate> {
  const auth = await currentAuth();
  if (!auth) redirect(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
  try {
    const secret = requirePlatformSecret();
    const actor = await withClient((client) => resolveActor(client, auth));
    if (!hasPermission(actor.grant, permission)) {
      await withTransaction((client) =>
        recordAudit(client, {
          actorType: 'user',
          actorUserId: actor.platformUserId,
          actorLabel: auth.email,
          action: 'admin.permission_denied',
          result: 'denied',
          targetType: 'permission',
          targetId: permission,
          metadata: { page: returnTo, impersonated: auth.impersonated },
        }),
      ).catch(() => undefined);
      return { kind: 'forbidden' };
    }
    return { kind: 'ok', actor, csrfToken: issueCsrfToken(auth.sessionId, secret) };
  } catch (error) {
    logPlatformPageError('admin', error);
    return { kind: 'unavailable' };
  }
}
