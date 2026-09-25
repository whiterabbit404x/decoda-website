/**
 * Adapter from the AuthKit session to the platform's `AuthSnapshot`.
 *
 * `withAuth()` reads the session the AuthKit middleware verified (signature
 * checked against the WorkOS JWKS, refreshed when expiring). Routes that call
 * this must be covered by the middleware matcher in /middleware.ts.
 */
import { withAuth } from '@workos-inc/authkit-nextjs';
import type { AuthSnapshot } from './actor';

export async function currentAuth(): Promise<AuthSnapshot | null> {
  const auth = await withAuth();
  if (!auth.user) return null;
  return {
    workosUserId: auth.user.id,
    sessionId: auth.sessionId,
    organizationId: auth.organizationId ?? null,
    impersonated: Boolean(auth.impersonator),
    email: auth.user.email,
    firstName: auth.user.firstName ?? null,
    lastName: auth.user.lastName ?? null,
  };
}
