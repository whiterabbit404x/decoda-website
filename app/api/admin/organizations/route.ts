/**
 * POST — create a customer organization (without a Pilot request), then link its
 * WorkOS organization.
 * Gate (session, origin, CSRF, platform permission): lib/platform/admin-api.ts.
 */
import { handleAdminMutation } from '@/lib/platform/admin-api';
import { adminDeps } from '@/lib/platform/admin-server';
import { withTransaction } from '@/lib/platform/db';
import { optionalString, requiredString } from '@/lib/platform/http';
import { createOrganizationRecord, ensureWorkOSOrganization } from '@/lib/platform/provisioning';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  return handleAdminMutation(request, 'platform.organizations.manage', adminDeps, async ({ ctx, body, provisioning }) => {
    const created = await withTransaction(
      (client) => createOrganizationRecord(client, ctx, { name: requiredString(body, 'name', 200), website: optionalString(body, 'website', 300) }),
      provisioning.pool,
    );
    let linked = true;
    try {
      await ensureWorkOSOrganization(ctx, provisioning, created.id);
    } catch {
      linked = false;
    }
    return { organization: { id: created.id, slug: created.slug, linked } };
  });
}
