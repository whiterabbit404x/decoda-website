/**
 * POST — reject a pending Pilot request (internal note is never shown to the applicant).
 * Gate (session, origin, CSRF, platform permission): lib/platform/admin-api.ts.
 */
import { handleAdminMutation } from '@/lib/platform/admin-api';
import { optionalString, uuidOrNotFound } from '@/lib/platform/http';
import { rejectPilotRequest } from '@/lib/platform/provisioning';
import { adminDeps } from '@/lib/platform/admin-server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  return handleAdminMutation(request, 'platform.pilot_requests.review', adminDeps, async ({ ctx, body, provisioning }) => {
    await rejectPilotRequest(ctx, provisioning, uuidOrNotFound(id), optionalString(body, 'note', 2000));
    return {};
  });
}
