/**
 * GET /auth/callback — the Website application's WorkOS redirect URI.
 *
 * AuthKit verifies the PKCE verifier + sealed state, exchanges the code, and
 * seals the session into the HttpOnly `wos-session` cookie. `onSuccess` then
 * syncs the user's platform identity and memberships; if that fails AuthKit
 * clears the new session and `onError` shows a controlled error page.
 */
import { handleAuth } from '@workos-inc/authkit-nextjs';
import { NextResponse } from 'next/server';
import { withTransaction } from '@/lib/platform/db';
import { newRequestId } from '@/lib/platform/request-context';
import { recordWebsiteSignIn } from '@/lib/platform/sign-in';
import { getWorkOSGateway, type WorkOSUser } from '@/lib/platform/workos';

export const dynamic = 'force-dynamic';

export const GET = handleAuth({
  returnPathname: '/launcher?welcome=1',
  onSuccess: async ({ user, organizationId, authenticationMethod, impersonator }) => {
    const gateway = getWorkOSGateway();
    await withTransaction((client) =>
      recordWebsiteSignIn(client, gateway, {
        user: user as WorkOSUser,
        organizationId,
        authenticationMethod,
        impersonated: Boolean(impersonator),
      }),
    );
  },
  onError: async ({ error, request }) => {
    const requestId = newRequestId();
    const code = (error as { code?: unknown } | null)?.code;
    // Log only the error class and code: never the query string (it carries
    // the authorization code) and never provider payloads.
    console.error('[platform:callback] sign-in failed', {
      request_id: requestId,
      name: error instanceof Error ? error.name : typeof error,
      code: typeof code === 'string' ? code : null,
    });
    const reason = code === 'missing_pkce_cookie' || code === 'oauth_state_mismatch' ? 'expired' : 'failed';
    return NextResponse.redirect(new URL(`/auth/error?reason=${reason}&ref=${requestId}`, request.url), 303);
  },
});
