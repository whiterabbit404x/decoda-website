/**
 * The one gate every platform-admin mutation passes through.
 *
 * Order of checks (all server-side, on every request):
 *   1. a verified AuthKit session (401 otherwise);
 *   2. a same-origin request (403 ORIGIN_REJECTED);
 *   3. the CSRF token bound to that session (403 CSRF_FAILED);
 *   4. an active platform user holding the named platform permission, never
 *      from an impersonated session (403 PLATFORM_PERMISSION_DENIED, audited
 *      as `admin.permission_denied` — a privilege-escalation attempt leaves a
 *      trace).
 * Only then does the action run. Hiding a button in the console is never the
 * control; this is.
 */
import type { Pool } from 'pg';
import { resolveActor, type AuthSnapshot } from './actor';
import { hasPermission, type PlatformPermission } from './admin-grants';
import { recordAudit } from './audit';
import { isSameOrigin, verifyCsrfToken } from './csrf';
import { withClient, withTransaction } from './db';
import { badRequest, forbidden, PlatformError } from './errors';
import { errorResponse, json, readJsonBody, requiredString, uuidOrNotFound } from './http';
import { isProductKey } from './products';
import { parseEntitlementInput, type AdminContext, type ApprovalInput, type ProvisioningDeps } from './provisioning';
import { clientIp, hashIp, requestIdFor } from './request-context';
import type { WorkOSGateway } from './workos';

export interface AdminApiDeps {
  auth: AuthSnapshot | null;
  secret: string;
  pool: Pool;
  gateway: WorkOSGateway;
  invitationExpiresInDays: number;
  logger?: Pick<Console, 'error'>;
}

export type AdminAction = (input: {
  ctx: AdminContext;
  body: Record<string, unknown>;
  provisioning: ProvisioningDeps;
}) => Promise<Record<string, unknown>>;

async function recordDenied(deps: AdminApiDeps, auth: AuthSnapshot, platformUserId: string | null, permission: string, request: Request, requestId: string) {
  await withTransaction(
    (client) =>
      recordAudit(client, {
        actorType: 'user',
        actorUserId: platformUserId,
        actorLabel: auth.email,
        action: 'admin.permission_denied',
        result: 'denied',
        requestId,
        ipHash: hashIp(clientIp(request), deps.secret),
        targetType: 'permission',
        targetId: permission,
        metadata: { path: new URL(request.url).pathname, impersonated: auth.impersonated },
      }),
    deps.pool,
  ).catch(() => undefined);
}

export async function handleAdminMutation(
  request: Request,
  required: PlatformPermission | PlatformPermission[],
  loadDeps: () => Promise<AdminApiDeps>,
  action: AdminAction,
): Promise<Response> {
  const requestId = requestIdFor(request);
  let logger: Pick<Console, 'error'> = console;
  try {
    const deps = await loadDeps();
    logger = deps.logger ?? console;
    if (!deps.auth) throw new PlatformError(401, 'AUTH_REQUIRED', 'Sign in to continue.');
    if (!isSameOrigin(request)) throw forbidden('ORIGIN_REJECTED', 'Cross-origin requests are not allowed.');
    if (!verifyCsrfToken(request.headers.get('x-csrf-token'), deps.auth.sessionId, deps.secret)) {
      throw forbidden('CSRF_FAILED', 'Security token missing or invalid. Refresh the page and try again.');
    }
    const auth = deps.auth;
    const actor = await withClient((client) => resolveActor(client, auth), deps.pool);
    const permissions = Array.isArray(required) ? required : [required];
    const missing = permissions.find((permission) => !hasPermission(actor.grant, permission));
    if (!actor.platformUserId || missing) {
      await recordDenied(deps, auth, actor.platformUserId, missing ?? permissions[0]!, request, requestId);
      throw forbidden('PLATFORM_PERMISSION_DENIED', 'Your account does not have the platform permission required for this action.');
    }
    const body = await readJsonBody(request);
    const result = await action({
      ctx: { actor: { ...actor, platformUserId: actor.platformUserId }, requestId, ipHash: hashIp(clientIp(request), deps.secret) },
      body,
      provisioning: { pool: deps.pool, gateway: deps.gateway, invitationExpiresInDays: deps.invitationExpiresInDays },
    });
    return json({ ok: true, ...result, request_id: requestId });
  } catch (error) {
    return errorResponse(error, requestId, logger);
  }
}

/** Parse the approval form. Only `pilot` / `enabled` can be granted at approval time. */
export function parseApprovalInput(body: Record<string, unknown>): ApprovalInput {
  const organization: ApprovalInput['organization'] =
    body.organizationMode === 'link'
      ? { mode: 'link', organizationId: uuidOrNotFound(body.organizationId) }
      : { mode: 'create', name: requiredString(body, 'organizationName', 200) };
  if (!Array.isArray(body.products)) throw badRequest('VALIDATION_FAILED', 'products must be a list.');
  const products = body.products.map((raw) => {
    if (!raw || typeof raw !== 'object') throw badRequest('VALIDATION_FAILED', 'Invalid product entry.');
    const parsed = parseEntitlementInput(raw as Record<string, unknown>);
    if (parsed.status !== 'pilot' && parsed.status !== 'enabled') {
      throw badRequest('VALIDATION_FAILED', 'Approval can only enable products (pilot or enabled).');
    }
    return parsed;
  });
  const invite =
    body.invite === true
      ? { email: requiredString(body, 'inviteEmail', 254), role: body.inviteRole === 'member' ? ('member' as const) : ('admin' as const) }
      : null;
  return { organization, products, invite };
}

export function parseProductParam(value: unknown) {
  if (!isProductKey(value)) throw badRequest('VALIDATION_FAILED', 'Unknown product.');
  return value;
}
