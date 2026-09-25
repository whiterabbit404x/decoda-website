/**
 * AuthKit session handling for the authenticated parts of www.
 *
 * Only the platform surfaces are matched: marketing pages never touch the
 * session. On a matched path the AuthKit middleware verifies the sealed
 * `wos-session` cookie (JWT signature checked against the WorkOS JWKS) and
 * refreshes it when it is about to expire; an unauthenticated visitor is sent
 * to AuthKit (pages) or answered 401 (APIs).
 *
 * Fails closed: without the WorkOS configuration there is no session handling
 * to fall back to, so protected pages go to an "unavailable" notice and APIs
 * answer 503. There is no demo or legacy path.
 */
import { applyResponseHeaders, authkit, handleAuthkitHeaders, partitionAuthkitHeaders } from '@workos-inc/authkit-nextjs';
import { NextResponse, type NextRequest } from 'next/server';

function identityConfigured(): boolean {
  return Boolean(
    process.env.WORKOS_CLIENT_ID &&
      process.env.WORKOS_API_KEY &&
      (process.env.WORKOS_COOKIE_PASSWORD ?? '').length >= 32 &&
      process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI,
  );
}

function apiError(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ ok: false, error: { code, message, request_id: null } }, { status, headers: { 'cache-control': 'no-store' } });
}

export default async function middleware(request: NextRequest) {
  const isApi = request.nextUrl.pathname.startsWith('/api/');
  if (!identityConfigured()) {
    if (isApi) return apiError(503, 'PLATFORM_NOT_CONFIGURED', 'This Decoda service is not available right now.');
    return NextResponse.redirect(new URL('/auth/error?reason=unavailable', request.url));
  }

  const { session, headers, authorizationUrl } = await authkit(request);
  if (!session.user) {
    if (isApi) {
      const { responseHeaders } = partitionAuthkitHeaders(request, headers);
      const response = apiError(401, 'AUTH_REQUIRED', 'Sign in to continue.');
      applyResponseHeaders(response, responseHeaders);
      return response;
    }
    return handleAuthkitHeaders(request, headers, { redirect: authorizationUrl as string });
  }
  return handleAuthkitHeaders(request, headers);
}

export const config = {
  matcher: ['/launcher/:path*', '/account/:path*', '/admin/:path*', '/api/admin/:path*', '/api/account/:path*'],
};
