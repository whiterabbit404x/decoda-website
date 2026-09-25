/**
 * POST — create (or confirm) the WorkOS organization linked to a platform organization.
 * Gate (session, origin, CSRF, platform permission): lib/platform/admin-api.ts.
 */
import { handleAdminMutation } from '@/lib/platform/admin-api';
import { ensureWorkOSOrganization } from '@/lib/platform/provisioning';
import { uuidOrNotFound } from '@/lib/platform/http';
import { adminDeps } from '@/lib/platform/admin-server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  return handleAdminMutation(request, 'platform.organizations.manage', adminDeps, async ({ ctx, body, provisioning }) => {
    await ensureWorkOSOrganization(ctx, provisioning, uuidOrNotFound(id));
    return { linked: true };
  });
}
