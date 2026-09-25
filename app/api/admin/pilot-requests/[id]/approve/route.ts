/**
 * POST — approve a pending Pilot request: create/link the organization, enable
 * products, link the WorkOS organization and (optionally) invite its admin.
 * Gate (session, origin, CSRF, platform permission): lib/platform/admin-api.ts.
 */
import { handleAdminMutation, parseApprovalInput } from '@/lib/platform/admin-api';
import { approvePilotRequest } from '@/lib/platform/provisioning';
import { uuidOrNotFound } from '@/lib/platform/http';
import { adminDeps } from '@/lib/platform/admin-server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  return handleAdminMutation(request, ['platform.pilot_requests.review', 'platform.organizations.manage', 'platform.entitlements.manage', 'platform.invitations.manage'], adminDeps, async ({ ctx, body, provisioning }) => {
    const result = await approvePilotRequest(ctx, provisioning, uuidOrNotFound(id), parseApprovalInput(body));
    return { result };
  });
}
