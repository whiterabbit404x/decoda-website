/**
 * Mirror WorkOS identity facts into the platform schema.
 *
 * Called from verified webhooks and from the on-demand sync at www sign-in.
 * Every upsert carries WorkOS's own `updatedAt` and is applied only when it is
 * not older than what is stored, so an out-of-order (or replayed) delivery can
 * never roll a user, organization or membership back to a stale state.
 *
 * Memberships are created ONLY from WorkOS membership objects. Nothing here
 * infers membership from an email address or domain.
 */
import type { DbClient } from './db';
import { PlatformError } from './errors';
import { organizationRoleFromSlug, type WorkOSGateway, type WorkOSMembership, type WorkOSOrganization, type WorkOSUser } from './workos';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeEmail(value: string): string {
  return value.normalize('NFC').trim().toLowerCase();
}

export function slugify(name: string): string {
  const base = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '');
  return base || 'organization';
}

/** A slug not yet taken, derived from `name` (`acme`, `acme-2`, …). */
export async function uniqueSlug(client: DbClient, name: string): Promise<string> {
  const base = slugify(name);
  const { rows } = await client.query<{ slug: string }>(
    "SELECT slug FROM platform.organizations WHERE slug = $1 OR slug LIKE $1 || '-%'",
    [base],
  );
  const taken = new Set(rows.map((row) => row.slug));
  if (!taken.has(base)) return base;
  for (let n = 2; n < 10_000; n += 1) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new PlatformError(409, 'SLUG_UNAVAILABLE', 'Could not allocate an organization identifier.');
}

export async function upsertUser(client: DbClient, user: WorkOSUser): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO platform.users (workos_user_id, email, email_verified, first_name, last_name, last_sign_in_at, workos_updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (workos_user_id) DO UPDATE
        SET email = EXCLUDED.email,
            email_verified = EXCLUDED.email_verified,
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            last_sign_in_at = GREATEST(platform.users.last_sign_in_at, EXCLUDED.last_sign_in_at),
            workos_updated_at = EXCLUDED.workos_updated_at,
            updated_at = now()
      WHERE platform.users.workos_updated_at IS NULL
         OR EXCLUDED.workos_updated_at >= platform.users.workos_updated_at
     RETURNING id`,
    [
      user.id,
      normalizeEmail(user.email),
      Boolean(user.emailVerified),
      user.firstName?.slice(0, 200) ?? null,
      user.lastName?.slice(0, 200) ?? null,
      user.lastSignInAt ?? null,
      user.updatedAt,
    ],
  );
  if (rows[0]) return rows[0].id;
  // A stale update was skipped; the row exists.
  const existing = await client.query<{ id: string }>('SELECT id FROM platform.users WHERE workos_user_id = $1', [user.id]);
  return existing.rows[0]!.id;
}

/** WorkOS deleted the user: keep the row (audit history), revoke everything. */
export async function markUserDeleted(client: DbClient, workosUserId: string): Promise<string | null> {
  const { rows } = await client.query<{ id: string }>(
    "UPDATE platform.users SET status = 'deleted', updated_at = now() WHERE workos_user_id = $1 RETURNING id",
    [workosUserId],
  );
  const userId = rows[0]?.id ?? null;
  if (userId) {
    await client.query(
      "UPDATE platform.organization_memberships SET status = 'inactive', updated_at = now() WHERE user_id = $1",
      [userId],
    );
  }
  return userId;
}

export interface OrganizationUpsert {
  id: string;
  created: boolean;
}

/**
 * Link or mirror a WorkOS organization.
 *
 * An organization the platform created carries `externalId = platform id`, so
 * it links back to exactly that row. A WorkOS id already linked to a different
 * platform row is a conflict and is refused rather than silently re-pointed.
 * An organization created directly in WorkOS is mirrored with no entitlements
 * (it grants nothing until a platform admin enables products).
 */
export async function upsertOrganization(client: DbClient, org: WorkOSOrganization): Promise<OrganizationUpsert> {
  const byWorkos = await client.query<{ id: string }>(
    'SELECT id FROM platform.organizations WHERE workos_organization_id = $1 FOR UPDATE',
    [org.id],
  );
  if (byWorkos.rows[0]) {
    await client.query(
      `UPDATE platform.organizations SET name = $2, workos_updated_at = $3, updated_at = now()
        WHERE id = $1 AND (workos_updated_at IS NULL OR workos_updated_at <= $3)`,
      [byWorkos.rows[0].id, org.name.slice(0, 200), org.updatedAt],
    );
    return { id: byWorkos.rows[0].id, created: false };
  }

  if (org.externalId && UUID_RE.test(org.externalId)) {
    const byExternal = await client.query<{ id: string; workos_organization_id: string | null }>(
      'SELECT id, workos_organization_id FROM platform.organizations WHERE id = $1 FOR UPDATE',
      [org.externalId],
    );
    const row = byExternal.rows[0];
    if (row) {
      if (row.workos_organization_id && row.workos_organization_id !== org.id) {
        throw new PlatformError(409, 'ORGANIZATION_LINK_CONFLICT', 'Organization is already linked to a different identity organization.');
      }
      await client.query(
        `UPDATE platform.organizations SET workos_organization_id = $2, name = $3, workos_updated_at = $4, updated_at = now()
          WHERE id = $1`,
        [row.id, org.id, org.name.slice(0, 200), org.updatedAt],
      );
      return { id: row.id, created: false };
    }
  }

  const slug = await uniqueSlug(client, org.name);
  const inserted = await client.query<{ id: string }>(
    `INSERT INTO platform.organizations (workos_organization_id, name, slug, workos_updated_at, metadata)
     VALUES ($1, $2, $3, $4, '{"source":"workos"}'::jsonb) RETURNING id`,
    [org.id, org.name.slice(0, 200), slug, org.updatedAt],
  );
  return { id: inserted.rows[0]!.id, created: true };
}

/** WorkOS deleted the organization: close it, which denies every member. */
export async function markOrganizationDeleted(client: DbClient, workosOrganizationId: string): Promise<string | null> {
  const { rows } = await client.query<{ id: string }>(
    "UPDATE platform.organizations SET status = 'closed', updated_at = now() WHERE workos_organization_id = $1 RETURNING id",
    [workosOrganizationId],
  );
  return rows[0]?.id ?? null;
}

async function platformUserId(client: DbClient, gateway: WorkOSGateway, workosUserId: string): Promise<string> {
  const { rows } = await client.query<{ id: string }>('SELECT id FROM platform.users WHERE workos_user_id = $1', [workosUserId]);
  if (rows[0]) return rows[0].id;
  return upsertUser(client, await gateway.getUser(workosUserId));
}

async function platformOrganizationId(client: DbClient, gateway: WorkOSGateway, workosOrganizationId: string): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    'SELECT id FROM platform.organizations WHERE workos_organization_id = $1',
    [workosOrganizationId],
  );
  if (rows[0]) return rows[0].id;
  return (await upsertOrganization(client, await gateway.getOrganization(workosOrganizationId))).id;
}

export interface MembershipChange {
  membershipId: string;
  organizationId: string;
  userId: string;
  before: { status: string; role: string } | null;
  after: { status: string; role: string };
}

export async function upsertMembership(
  client: DbClient,
  gateway: WorkOSGateway,
  membership: WorkOSMembership,
  source: 'workos_sync' | 'invitation' | 'admin' | 'legacy_migration' = 'workos_sync',
): Promise<MembershipChange> {
  const userId = await platformUserId(client, gateway, membership.userId);
  const organizationId = await platformOrganizationId(client, gateway, membership.organizationId);
  const role = organizationRoleFromSlug(membership.role?.slug);
  const before = await client.query<{ status: string; role: string }>(
    'SELECT status, role FROM platform.organization_memberships WHERE organization_id = $1 AND user_id = $2 FOR UPDATE',
    [organizationId, userId],
  );
  const { rows } = await client.query<{ id: string; status: string; role: string }>(
    `INSERT INTO platform.organization_memberships
        (organization_id, user_id, workos_membership_id, role, workos_role_slug, status, source, workos_updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (organization_id, user_id) DO UPDATE
        SET workos_membership_id = EXCLUDED.workos_membership_id,
            role = EXCLUDED.role,
            workos_role_slug = EXCLUDED.workos_role_slug,
            status = EXCLUDED.status,
            workos_updated_at = EXCLUDED.workos_updated_at,
            updated_at = now()
      WHERE platform.organization_memberships.workos_updated_at IS NULL
         OR EXCLUDED.workos_updated_at >= platform.organization_memberships.workos_updated_at
     RETURNING id, status, role`,
    [
      organizationId,
      userId,
      membership.id,
      role,
      membership.role?.slug?.slice(0, 100) ?? null,
      membership.status,
      source,
      membership.updatedAt,
    ],
  );
  const current =
    rows[0] ??
    (
      await client.query<{ id: string; status: string; role: string }>(
        'SELECT id, status, role FROM platform.organization_memberships WHERE organization_id = $1 AND user_id = $2',
        [organizationId, userId],
      )
    ).rows[0]!;
  return {
    membershipId: current.id,
    organizationId,
    userId,
    before: before.rows[0] ?? null,
    after: { status: current.status, role: current.role },
  };
}

/** organization_membership.deleted: keep the row, end the access. */
export async function deactivateMembership(client: DbClient, workosMembershipId: string): Promise<{ organizationId: string; userId: string } | null> {
  const { rows } = await client.query<{ organization_id: string; user_id: string }>(
    `UPDATE platform.organization_memberships SET status = 'inactive', updated_at = now()
      WHERE workos_membership_id = $1 RETURNING organization_id, user_id`,
    [workosMembershipId],
  );
  return rows[0] ? { organizationId: rows[0].organization_id, userId: rows[0].user_id } : null;
}

/**
 * Full on-demand sync of one user (called right after sign-in at www), so an
 * invitation accepted seconds ago is reflected before the webhook arrives.
 */
export async function syncUserFromWorkOS(
  client: DbClient,
  gateway: WorkOSGateway,
  user: WorkOSUser,
): Promise<{ userId: string; memberships: MembershipChange[] }> {
  const userId = await upsertUser(client, user);
  const memberships: MembershipChange[] = [];
  for (const membership of await gateway.listUserMemberships(user.id)) {
    memberships.push(await upsertMembership(client, gateway, membership, 'workos_sync'));
  }
  return { userId, memberships };
}
