/**
 * GET /sign-in — "Sign In" on www and the Website application's Initiate
 * login URI in WorkOS. Starts the shared Decoda AuthKit flow (PKCE + sealed
 * state) and returns the user to a validated same-site path afterwards.
 *
 * There is no sign-up counterpart: Decoda is invite-only.
 */
import { getSignInUrl } from '@workos-inc/authkit-nextjs';
import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';
import { requireIdentityConfig } from '@/lib/platform/config';
import { PlatformConfigError } from '@/lib/platform/errors';
import { safeReturnPath } from '@/lib/platform/return-to';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    requireIdentityConfig();
  } catch (error) {
    if (error instanceof PlatformConfigError) {
      console.error('[platform:sign-in] not configured', { diagnostic: error.diagnostic });
      redirect('/auth/error?reason=unavailable');
    }
    throw error;
  }
  const returnTo = safeReturnPath(request.nextUrl.searchParams.get('returnTo'));
  const signInUrl = await getSignInUrl({ returnTo });
  redirect(signInUrl);
}
