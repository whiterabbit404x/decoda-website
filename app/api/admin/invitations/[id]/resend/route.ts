/**
 * POST — re-send a pending or expired invitation (explicit action; never automatic).
 * Gate (session, origin, CSRF, platform permission): lib/platform/admin-api.ts.
 */
import { handleAdminMutation } from '@/lib/platform/admin-api';
import { resendInvitation } from '@/lib/platform/provisioning';
import { uuidOrNotFound } from '@/lib/platform/http';
import { adminDeps } from '@/lib/platform/admin-server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  return handleAdminMutation(request, 'platform.invitations.manage', adminDeps, async ({ ctx, body, provisioning }) => {
    const invitation = await resendInvitation(ctx, provisioning, uuidOrNotFound(id));
    return { invitation };
  });
}
