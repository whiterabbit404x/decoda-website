/**
 * POST — invite a person to an organization through WorkOS. An open invitation
 * for the same address is returned, never duplicated.
 * Gate (session, origin, CSRF, platform permission): lib/platform/admin-api.ts.
 */
import { handleAdminMutation } from '@/lib/platform/admin-api';
import { requiredString, uuidOrNotFound } from '@/lib/platform/http';
import { sendInvitation } from '@/lib/platform/provisioning';
import { adminDeps } from '@/lib/platform/admin-server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  return handleAdminMutation(request, 'platform.invitations.manage', adminDeps, async ({ ctx, body, provisioning }) => {
    const invitation = await sendInvitation(ctx, provisioning, {
      organizationId: uuidOrNotFound(id),
      email: requiredString(body, 'email', 254),
      role: body.role === 'admin' ? 'admin' : 'member',
    });
    return { invitation };
  });
}
