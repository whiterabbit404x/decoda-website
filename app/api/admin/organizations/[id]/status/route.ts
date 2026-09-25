/**
 * POST — suspend or reactivate an organization. Suspension denies every member in
 * every product on their next request.
 * Gate (session, origin, CSRF, platform permission): lib/platform/admin-api.ts.
 */
import { handleAdminMutation } from '@/lib/platform/admin-api';
import { badRequest } from '@/lib/platform/errors';
import { requiredString, uuidOrNotFound } from '@/lib/platform/http';
import { setOrganizationStatus } from '@/lib/platform/provisioning';
import { adminDeps } from '@/lib/platform/admin-server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  return handleAdminMutation(request, 'platform.organizations.manage', adminDeps, async ({ ctx, body, provisioning }) => {
    if (body.status !== 'active' && body.status !== 'suspended') throw badRequest('VALIDATION_FAILED', 'status must be active or suspended.');
    await setOrganizationStatus(ctx, provisioning, uuidOrNotFound(id), body.status, requiredString(body, 'reason', 500));
    return { status: body.status };
  });
}
