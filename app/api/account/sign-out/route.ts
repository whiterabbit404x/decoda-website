/**
 * POST /api/account/sign-out — end the Decoda session started at www.
 *
 * Records the WorkOS session as revoked (products bound to it are refused at
 * once), clears the local session cookie and answers the WorkOS logout URL,
 * which the page navigates to so WorkOS ends the session everywhere.
 * POST-only, same-origin and CSRF-checked, so a third-party page cannot sign a
 * user out.
 */
import { getWorkOS } from '@workos-inc/authkit-nextjs';
import { NextResponse } from 'next/server';
import { productUrls, requirePlatformSecret } from '@/lib/platform/config';
import { isSameOrigin, verifyCsrfToken } from '@/lib/platform/csrf';
import { withTransaction } from '@/lib/platform/db';
import { forbidden, PlatformError } from '@/lib/platform/errors';
import { errorResponse } from '@/lib/platform/http';
import { clientIp, hashIp, requestIdFor } from '@/lib/platform/request-context';
import { currentAuth } from '@/lib/platform/session';
import { recordSignOut } from '@/lib/platform/sign-in';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const requestId = requestIdFor(request);
  try {
    if (!isSameOrigin(request)) throw forbidden('ORIGIN_REJECTED', 'Cross-origin requests are not allowed.');
    const auth = await currentAuth();
    if (!auth) throw new PlatformError(401, 'AUTH_REQUIRED', 'You are already signed out.');
    const secret = requirePlatformSecret();
    if (!verifyCsrfToken(request.headers.get('x-csrf-token'), auth.sessionId, secret)) {
      throw forbidden('CSRF_FAILED', 'Security token missing or invalid. Refresh the page and try again.');
    }
    await withTransaction((client) =>
      recordSignOut(client, {
        workosUserId: auth.workosUserId,
        sessionId: auth.sessionId,
        requestId,
        ipHash: hashIp(clientIp(request), secret),
      }),
    );
    const logoutUrl = getWorkOS().userManagement.getLogoutUrl({ sessionId: auth.sessionId, returnTo: `${productUrls().website}/` });
    const response = NextResponse.json({ ok: true, redirect: logoutUrl, request_id: requestId }, { headers: { 'cache-control': 'no-store' } });
    response.cookies.set(process.env.WORKOS_COOKIE_NAME || 'wos-session', '', {
      path: '/',
      maxAge: 0,
      httpOnly: true,
      sameSite: 'lax',
      secure: new URL(request.url).protocol === 'https:' || process.env.NODE_ENV === 'production',
    });
    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
