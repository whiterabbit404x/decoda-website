/**
 * POST /api/account/switch-organization — switch the active organization of
 * the www session. Body: { organizationId: <platform organization id> }.
 * Answers { ok, redirect } and the page performs a full navigation, so no
 * client state from the previous organization survives.
 */
import { getSignInUrl, refreshSession } from '@workos-inc/authkit-nextjs';
import { requirePlatformSecret } from '@/lib/platform/config';
import { isSameOrigin, verifyCsrfToken } from '@/lib/platform/csrf';
import { withClient, withTransaction } from '@/lib/platform/db';
import { forbidden, PlatformError } from '@/lib/platform/errors';
import { errorResponse, json, readJsonBody, uuidOrNotFound } from '@/lib/platform/http';
import { recordOrganizationSwitch, resolveSwitchTarget } from '@/lib/platform/organization-switch';
import { requestIdFor } from '@/lib/platform/request-context';
import { currentAuth } from '@/lib/platform/session';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const requestId = requestIdFor(request);
  try {
    const auth = await currentAuth();
    if (!auth) throw new PlatformError(401, 'AUTH_REQUIRED', 'Sign in to continue.');
    if (!isSameOrigin(request)) throw forbidden('ORIGIN_REJECTED', 'Cross-origin requests are not allowed.');
    if (!verifyCsrfToken(request.headers.get('x-csrf-token'), auth.sessionId, requirePlatformSecret())) {
      throw forbidden('CSRF_FAILED', 'Security token missing or invalid. Refresh the page and try again.');
    }
    const body = await readJsonBody(request, 2048);
    const target = await withClient((client) => resolveSwitchTarget(client, auth, uuidOrNotFound(body.organizationId)));

    try {
      await refreshSession({ organizationId: target.workosOrganizationId, ensureSignedIn: true });
    } catch (error) {
      const cause = (error as { cause?: { error?: string; rawData?: { authkit_redirect_url?: string } } }).cause;
      if (cause?.rawData?.authkit_redirect_url) {
        return json({ ok: true, redirect: cause.rawData.authkit_redirect_url, request_id: requestId });
      }
      if (cause?.error === 'sso_required' || cause?.error === 'mfa_enrollment') {
        // The target organization demands a stronger sign-in: go through AuthKit.
        const url = await getSignInUrl({ organizationId: target.workosOrganizationId, returnTo: '/launcher' });
        return json({ ok: true, redirect: url, request_id: requestId });
      }
      throw new PlatformError(409, 'ORGANIZATION_SWITCH_FAILED', 'The organization could not be switched. Sign in again and retry.');
    }

    await withTransaction((client) => recordOrganizationSwitch(client, auth, target, requestId));
    return json({ ok: true, redirect: '/launcher', request_id: requestId });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
