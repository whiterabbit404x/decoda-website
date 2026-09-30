/**
 * GET /api/session — whether this browser is signed in to Decoda, for the site
 * header.
 *
 * Marketing pages are static and the AuthKit middleware runs only on the
 * platform surfaces, so the header asks here after load. The answer is the
 * AuthKit session itself (sealed HttpOnly cookie, access token verified against
 * the WorkOS JWKS, refreshed when expiring), and it carries only the person's
 * name. No cookie, an invalid or ended session, or missing configuration all
 * answer "signed out". Never cached.
 */
import { applyResponseHeaders, authkit, partitionAuthkitHeaders } from '@workos-inc/authkit-nextjs';
import { NextResponse, type NextRequest } from 'next/server';
import { actorDisplayName } from '@/lib/platform/actor';
import { requireIdentityConfig } from '@/lib/platform/config';

export const dynamic = 'force-dynamic';

const PKCE_COOKIE_PREFIX = 'wos-auth-verifier';

function answer(body: { signedIn: false } | { signedIn: true; user: { firstName: string | null; name: string } }): NextResponse {
  return NextResponse.json(body, { headers: { 'cache-control': 'no-store', vary: 'Cookie' } });
}

export async function GET(request: NextRequest): Promise<Response> {
  if (!request.cookies.has(process.env.WORKOS_COOKIE_NAME || 'wos-session')) return answer({ signedIn: false });
  try {
    requireIdentityConfig();
  } catch {
    return answer({ signedIn: false });
  }
  try {
    const { session, headers } = await authkit(request);
    const { responseHeaders } = partitionAuthkitHeaders(request, headers);
    // Keep a refreshed (or cleared) session cookie; never start a sign-in from here.
    const setCookies = responseHeaders.getSetCookie().filter((cookie) => !cookie.startsWith(PKCE_COOKIE_PREFIX));
    responseHeaders.delete('set-cookie');
    for (const cookie of setCookies) responseHeaders.append('set-cookie', cookie);

    const user = session.user;
    const response = user
      ? answer({
          signedIn: true,
          user: { firstName: user.firstName ?? null, name: actorDisplayName({ firstName: user.firstName ?? null, lastName: user.lastName ?? null, email: user.email }) },
        })
      : answer({ signedIn: false });
    return applyResponseHeaders(response, responseHeaders);
  } catch (error) {
    console.error('[platform:session] session check failed', { name: error instanceof Error ? error.name : typeof error });
    return answer({ signedIn: false });
  }
}
