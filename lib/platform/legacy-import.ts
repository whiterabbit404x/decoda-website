/**
 * Reviewed import of a product's legacy accounts into the Decoda platform.
 *
 * Input: the manifest a product exports read-only (RWA Guard:
 * `python -m services.api.scripts.identity_migration_export`). Nothing is
 * inferred beyond it, and nothing is merged by email:
 *
 *   * organizations — each active legacy organization with at least one
 *     importable member gets a platform organization (and a WorkOS
 *     organization), a product entitlement, and a reviewed
 *     `legacy_organization_links` row. The product links its own tenant to the
 *     platform organization only through that row.
 *   * accounts — each `needs_invitation` account gets a
 *     `legacy_identity_links` row and a WorkOS invitation into its primary
 *     organization. The link becomes `linked` only when THAT invitation is
 *     accepted (webhook), binding the exact legacy account to the WorkOS
 *     identity that accepted it. Further organizations are invited only after
 *     that, on a later run.
 *   * `conflict` and `skipped` accounts, and anything the platform state makes
 *     ambiguous (an existing member with the same address, an open invitation,
 *     a WorkOS identity already linked to another legacy account), are
 *     reported and never applied.
 *
 * `planImport` reads only. `applyImport` follows provisioning's rules: WorkOS
 * is called outside database transactions, every change is audited in the
 * transaction that makes it, and a re-run continues where the last one stopped
 * without duplicating anything.
 */
import { createHash } from 'node:crypto';
import type { AdminContext, ProvisioningDeps } from './provisioning';
import { createOrganizationRecord, ensureWorkOSOrganization, sendInvitation, upsertEntitlement } from './provisioning';
import { resolveActor, type AuthSnapshot } from './actor';
import { requirePermission, type PlatformPermission } from './admin-grants';
import { recordAudit, type AuditEvent } from './audit';
import { withClient, withTransaction, type DbClient } from './db';
import { forbidden, PlatformError } from './errors';
import { normalizeEmail } from './identity-sync';

export const MANIFEST_FORMAT = 'decoda.legacy_identity_manifest/v1';
export const LEGACY_PRODUCTS = ['rwa_guard', 'vault'] as const;
export type LegacyProduct = (typeof LEGACY_PRODUCTS)[number];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const PRODUCT_ADMIN_ROLES = new Set(['owner', 'admin']);

export class ManifestError extends Error {}

export interface ManifestOrganization {
  legacy_organization_id: string;
  name: string;
  plan: string | null;
  status: string;
  platform_organization_id: string | null;
  importable_members: number;
}

export interface ManifestUser {
  legacy_user_id: string;
  email: string;
  status: 'matched' | 'needs_invitation' | 'conflict' | 'skipped';
  reasons: string[];
  primary_organization_id: string | null;
  organizations: Array<{ legacy_organization_id: string; role: string }>;
}

export interface LegacyManifest {
  format: string;
  product: LegacyProduct;
  organizations: ManifestOrganization[];
  users: ManifestUser[];
}

function fail(message: string): never {
  throw new ManifestError(message);
}

/** Parse and validate a manifest file; the digest is SHA-256 of the exact bytes. */
export function parseManifest(bytes: Buffer, product: LegacyProduct): { manifest: LegacyManifest; digest: string } {
  const digest = createHash('sha256').update(bytes).digest('hex');
  let raw: unknown;
  try {
    raw = JSON.parse(bytes.toString('utf8'));
  } catch {
    fail('The manifest is not valid JSON.');
  }
  const doc = raw as Partial<LegacyManifest>;
  if (doc.format !== MANIFEST_FORMAT) fail(`Unsupported manifest format (expected ${MANIFEST_FORMAT}).`);
  if (doc.product !== product) fail(`The manifest is for "${String(doc.product)}", not "${product}".`);
  if (!Array.isArray(doc.organizations) || !Array.isArray(doc.users)) fail('The manifest has no organizations or users list.');

  const orgIds = new Set<string>();
  for (const org of doc.organizations) {
    if (!org || typeof org.legacy_organization_id !== 'string' || !ID_RE.test(org.legacy_organization_id)) fail('An organization has an invalid id.');
    if (orgIds.has(org.legacy_organization_id)) fail(`Organization ${org.legacy_organization_id} appears twice.`);
    orgIds.add(org.legacy_organization_id);
    if (typeof org.name !== 'string' || !org.name.trim() || org.name.length > 200) fail(`Organization ${org.legacy_organization_id} has an invalid name.`);
  }
  const userIds = new Set<string>();
  for (const user of doc.users) {
    if (!user || typeof user.legacy_user_id !== 'string' || !ID_RE.test(user.legacy_user_id)) fail('A user has an invalid id.');
    if (userIds.has(user.legacy_user_id)) fail(`User ${user.legacy_user_id} appears twice.`);
    userIds.add(user.legacy_user_id);
    if (!['matched', 'needs_invitation', 'conflict', 'skipped'].includes(user.status)) fail(`User ${user.legacy_user_id} has an unknown status.`);
    if (!Array.isArray(user.organizations)) fail(`User ${user.legacy_user_id} has no organizations list.`);
    for (const membership of user.organizations) {
      if (!orgIds.has(membership.legacy_organization_id)) fail(`User ${user.legacy_user_id} references an organization missing from the manifest.`);
    }
    if (user.primary_organization_id && !orgIds.has(user.primary_organization_id)) {
      fail(`User ${user.legacy_user_id} has a primary organization missing from the manifest.`);
    }
  }
  return { manifest: doc as LegacyManifest, digest };
}

// ── Plan ─────────────────────────────────────────────────────────────────────

export type OrganizationAction = 'create' | 'already_linked' | 'skip';

export interface OrganizationPlan {
  legacyOrganizationId: string;
  name: string;
  action: OrganizationAction;
  reason: string | null;
  platformOrganizationId: string | null;
  entitlement: { status: 'enabled' | 'pilot'; plan: string };
}

export type UserAction = 'invite' | 'retry_invitation' | 'already_invited' | 'already_linked' | 'matched' | 'conflict' | 'skipped';

export interface SecondaryPlan {
  legacyOrganizationId: string;
  role: 'admin' | 'member';
  action: 'invite' | 'deferred' | 'already_member' | 'already_invited' | 'skip';
  reason: string | null;
}

export interface UserPlan {
  legacyUserId: string;
  email: string;
  action: UserAction;
  reasons: string[];
  legacyOrganizationId: string | null;
  role: 'admin' | 'member' | null;
  linkId: string | null;
  secondary: SecondaryPlan[];
}

export interface ImportPlan {
  product: LegacyProduct;
  digest: string;
  organizations: OrganizationPlan[];
  users: UserPlan[];
  summary: Record<string, number>;
}

interface PlatformState {
  orgLinks: Map<string, string>; // legacy org id → platform org id
  linkedPlatformOrgs: Set<string>;
  identityLinks: Map<string, { id: string; status: string; organizationId: string; workosUserId: string | null }>;
  linkedWorkosUsers: Set<string>;
  organizations: Map<string, { status: string; workosOrganizationId: string | null }>;
  usersByEmail: Map<string, { id: string; workosUserId: string; status: string }>;
  memberships: Set<string>; // `${platformOrgId}:${platformUserId}` active
  openInvitations: Map<string, string | null>; // `${platformOrgId}:${email}` → legacy link id
  entitlements: Set<string>; // `${platformOrgId}` having this product
}

async function loadState(client: DbClient, product: LegacyProduct, manifest: LegacyManifest): Promise<PlatformState> {
  const emails = [...new Set(manifest.users.map((u) => normalizeEmail(u.email ?? '')))];
  const orgLinks = await client.query<{ legacy_organization_id: string; organization_id: string }>(
    'SELECT legacy_organization_id, organization_id FROM platform.legacy_organization_links WHERE product = $1',
    [product],
  );
  const identityLinks = await client.query<{ id: string; legacy_user_id: string; status: string; organization_id: string; workos_user_id: string | null }>(
    'SELECT id, legacy_user_id, status, organization_id, workos_user_id FROM platform.legacy_identity_links WHERE product = $1',
    [product],
  );
  const organizations = await client.query<{ id: string; status: string; workos_organization_id: string | null }>(
    'SELECT id, status, workos_organization_id FROM platform.organizations',
  );
  const users = await client.query<{ id: string; workos_user_id: string; status: string; email: string }>(
    'SELECT id, workos_user_id, status, email FROM platform.users WHERE email = ANY($1::text[])',
    [emails],
  );
  const memberships = await client.query<{ organization_id: string; user_id: string }>(
    "SELECT organization_id, user_id FROM platform.organization_memberships WHERE status = 'active' AND user_id = ANY($1::uuid[])",
    [users.rows.map((u) => u.id)],
  );
  const invitations = await client.query<{ organization_id: string; email: string; legacy_link_id: string | null }>(
    "SELECT organization_id, email, legacy_link_id FROM platform.invitations WHERE state IN ('sending', 'pending') AND email = ANY($1::text[])",
    [emails],
  );
  const entitlements = await client.query<{ organization_id: string }>(
    'SELECT organization_id FROM platform.organization_product_entitlements WHERE product = $1',
    [product],
  );
  return {
    orgLinks: new Map(orgLinks.rows.map((r) => [r.legacy_organization_id, r.organization_id])),
    linkedPlatformOrgs: new Set(orgLinks.rows.map((r) => r.organization_id)),
    identityLinks: new Map(
      identityLinks.rows.map((r) => [r.legacy_user_id, { id: r.id, status: r.status, organizationId: r.organization_id, workosUserId: r.workos_user_id }]),
    ),
    linkedWorkosUsers: new Set(identityLinks.rows.filter((r) => r.workos_user_id).map((r) => r.workos_user_id!)),
    organizations: new Map(organizations.rows.map((r) => [r.id, { status: r.status, workosOrganizationId: r.workos_organization_id }])),
    usersByEmail: new Map(users.rows.map((r) => [r.email, { id: r.id, workosUserId: r.workos_user_id, status: r.status }])),
    memberships: new Set(memberships.rows.map((r) => `${r.organization_id}:${r.user_id}`)),
    openInvitations: new Map(invitations.rows.map((r) => [`${r.organization_id}:${r.email}`, r.legacy_link_id])),
    entitlements: new Set(entitlements.rows.map((r) => r.organization_id)),
  };
}

function platformRole(role: string): 'admin' | 'member' {
  return PRODUCT_ADMIN_ROLES.has(role) ? 'admin' : 'member';
}

function entitlementFor(org: ManifestOrganization): OrganizationPlan['entitlement'] {
  // Guard's own plan keeps governing product limits and its evaluation window;
  // the platform entitlement decides who may enter, so it carries no expiry.
  const plan = (org.plan ?? '').toLowerCase();
  return plan === 'pilot' || !plan ? { status: 'pilot', plan: 'pilot' } : { status: 'enabled', plan: /^[a-z0-9_-]{1,64}$/.test(plan) ? plan : 'standard' };
}

export function planFromState(manifest: LegacyManifest, digest: string, state: PlatformState): ImportPlan {
  const orgPlans = new Map<string, OrganizationPlan>();
  for (const org of manifest.organizations) {
    const plan: OrganizationPlan = {
      legacyOrganizationId: org.legacy_organization_id,
      name: org.name.trim(),
      action: 'create',
      reason: null,
      platformOrganizationId: null,
      entitlement: entitlementFor(org),
    };
    const linked = state.orgLinks.get(org.legacy_organization_id);
    if (linked) {
      plan.action = 'already_linked';
      plan.platformOrganizationId = linked;
      const platformOrg = state.organizations.get(linked);
      if (!platformOrg || platformOrg.status !== 'active') Object.assign(plan, { action: 'skip', reason: 'platform_organization_inactive' });
    } else if (org.status !== 'active') {
      Object.assign(plan, { action: 'skip', reason: 'organization_inactive' });
    } else if (!org.importable_members) {
      Object.assign(plan, { action: 'skip', reason: 'no_importable_members' });
    } else if (org.platform_organization_id) {
      // The product already links this tenant to a platform organization that
      // the platform never recorded: someone must look before anything changes.
      Object.assign(plan, { action: 'skip', reason: 'linked_in_product_without_platform_record' });
    }
    orgPlans.set(org.legacy_organization_id, plan);
  }

  const importable = (id: string | null) => {
    const plan = id ? orgPlans.get(id) : undefined;
    return plan && plan.action !== 'skip' ? plan : null;
  };
  const emailCounts = new Map<string, number>();
  for (const user of manifest.users) {
    if (user.status !== 'needs_invitation') continue;
    const email = normalizeEmail(user.email ?? '');
    emailCounts.set(email, (emailCounts.get(email) ?? 0) + 1);
  }

  const users: UserPlan[] = [];
  for (const user of manifest.users) {
    const email = normalizeEmail(user.email ?? '');
    const primary = user.organizations.find((m) => m.legacy_organization_id === user.primary_organization_id) ?? null;
    const plan: UserPlan = {
      legacyUserId: user.legacy_user_id,
      email,
      action: 'invite',
      reasons: [],
      legacyOrganizationId: primary?.legacy_organization_id ?? null,
      role: primary ? platformRole(primary.role) : null,
      linkId: null,
      secondary: [],
    };
    users.push(plan);
    if (user.status === 'matched') {
      plan.action = 'matched';
      continue;
    }
    if (user.status !== 'needs_invitation') {
      plan.action = user.status;
      plan.reasons = [...(user.reasons ?? [])];
      continue;
    }
    const conflict = (reason: string) => {
      plan.action = 'conflict';
      plan.reasons.push(reason);
    };
    const target = importable(plan.legacyOrganizationId);
    const existing = state.identityLinks.get(user.legacy_user_id);
    if (!EMAIL_RE.test(email) || email.length > 254) conflict('invalid_email');
    else if ((emailCounts.get(email) ?? 0) > 1) conflict('duplicate_email');
    else if (!target) {
      plan.action = 'skipped';
      plan.reasons.push('primary_organization_not_imported');
    } else if (existing) {
      plan.linkId = existing.id;
      if (existing.status === 'linked') plan.action = 'already_linked';
      else if (existing.status === 'conflict' || existing.status === 'skipped') conflict(`legacy_link_${existing.status}`);
      else if (target.platformOrganizationId && existing.organizationId !== target.platformOrganizationId) conflict('legacy_link_organization_mismatch');
      else if (existing.status === 'invited') plan.action = 'already_invited';
      else plan.action = 'retry_invitation';
    } else {
      const platformUser = state.usersByEmail.get(email);
      const orgId = target.platformOrganizationId;
      if (platformUser && state.linkedWorkosUsers.has(platformUser.workosUserId)) conflict('identity_already_linked_to_another_account');
      else if (platformUser && orgId && state.memberships.has(`${orgId}:${platformUser.id}`)) conflict('already_a_platform_member');
      else if (orgId && state.openInvitations.has(`${orgId}:${email}`)) conflict('open_invitation_exists');
    }

    // Further organizations: invited once the primary link is bound.
    for (const membership of user.organizations) {
      if (membership.legacy_organization_id === plan.legacyOrganizationId) continue;
      const secondaryOrg = importable(membership.legacy_organization_id);
      const secondary: SecondaryPlan = {
        legacyOrganizationId: membership.legacy_organization_id,
        role: platformRole(membership.role),
        action: 'deferred',
        reason: 'primary_link_pending',
      };
      plan.secondary.push(secondary);
      if (!secondaryOrg) {
        Object.assign(secondary, { action: 'skip', reason: 'organization_not_imported' });
        continue;
      }
      if (plan.action !== 'already_linked' || !existing?.workosUserId) continue;
      const platformUser = [...state.usersByEmail.values()].find((u) => u.workosUserId === existing.workosUserId);
      const orgId = secondaryOrg.platformOrganizationId;
      if (orgId && platformUser && state.memberships.has(`${orgId}:${platformUser.id}`)) Object.assign(secondary, { action: 'already_member', reason: null });
      else if (orgId && state.openInvitations.has(`${orgId}:${email}`)) Object.assign(secondary, { action: 'already_invited', reason: null });
      else Object.assign(secondary, { action: 'invite', reason: null });
    }
  }

  for (const user of users) {
    // A role is only meaningful for an account that is (or will be) invited.
    if (!['invite', 'retry_invitation', 'already_invited', 'already_linked'].includes(user.action)) user.role = null;
  }

  const summary: Record<string, number> = {};
  for (const org of orgPlans.values()) summary[`organizations.${org.action}`] = (summary[`organizations.${org.action}`] ?? 0) + 1;
  for (const user of users) summary[`users.${user.action}`] = (summary[`users.${user.action}`] ?? 0) + 1;
  const secondaryInvites = users.reduce((n, u) => n + u.secondary.filter((s) => s.action === 'invite').length, 0);
  if (secondaryInvites) summary['users.secondary_invite'] = secondaryInvites;
  return { product: manifest.product, digest, organizations: [...orgPlans.values()], users, summary };
}

/** Read-only: what an `--apply` would do right now. */
export async function planImport(pool: ProvisioningDeps['pool'], manifest: LegacyManifest, digest: string): Promise<ImportPlan> {
  return withClient(async (client) => planFromState(manifest, digest, await loadState(client, manifest.product, manifest)), pool);
}

// ── Apply ────────────────────────────────────────────────────────────────────

export const IMPORT_PERMISSIONS: readonly PlatformPermission[] = [
  'platform.organizations.manage',
  'platform.entitlements.manage',
  'platform.invitations.manage',
];

/**
 * The accountable platform admin an `--apply` runs as: an ACTIVE platform user
 * holding every permission the import exercises. Invitations name them as the
 * inviter, and every audit event carries their id.
 */
export async function importActor(pool: ProvisioningDeps['pool'], workosUserId: string, requestId: string): Promise<AdminContext> {
  return withClient(async (client) => {
    const { rows } = await client.query<{ email: string; first_name: string | null; last_name: string | null }>(
      'SELECT email, first_name, last_name FROM platform.users WHERE workos_user_id = $1',
      [workosUserId],
    );
    if (!rows[0]) throw forbidden('PLATFORM_PERMISSION_DENIED', 'No platform user exists for that WorkOS user.');
    const auth: AuthSnapshot = {
      workosUserId,
      sessionId: 'operator-cli',
      organizationId: null,
      impersonated: false,
      email: rows[0].email,
      firstName: rows[0].first_name,
      lastName: rows[0].last_name,
    };
    const actor = await resolveActor(client, auth);
    for (const permission of IMPORT_PERMISSIONS) requirePermission(actor.grant, permission);
    return { actor: { ...actor, platformUserId: actor.platformUserId! }, requestId, ipHash: null };
  }, pool);
}

export interface ApplyReport {
  organizationsCreated: number;
  organizationsLinkedToWorkOS: number;
  identityLinksCreated: number;
  invitationsSent: number;
  failures: Array<{ subject: string; code: string; message: string }>;
}

function failure(report: ApplyReport, subject: string, error: unknown) {
  const code = error instanceof PlatformError ? error.code : 'UNEXPECTED';
  const message = error instanceof Error ? error.message : String(error);
  report.failures.push({ subject, code, message });
}

export async function applyImport(
  ctx: AdminContext,
  deps: ProvisioningDeps,
  manifest: LegacyManifest,
  plan: ImportPlan,
  operator: { label: string; reason: string },
): Promise<ApplyReport> {
  const report: ApplyReport = { organizationsCreated: 0, organizationsLinkedToWorkOS: 0, identityLinksCreated: 0, invitationsSent: 0, failures: [] };
  const importAudit = (client: DbClient, action: string, fields: Partial<AuditEvent>) =>
    recordAudit(client, {
      actorType: 'user',
      actorUserId: ctx.actor.platformUserId,
      actorLabel: ctx.actor.email,
      action,
      requestId: ctx.requestId,
      ...fields,
      metadata: { operator: operator.label, reason: operator.reason, manifest_digest: plan.digest, product: plan.product, ...(fields.metadata ?? {}) },
    });

  // 1. Organizations: platform record + entitlement + reviewed link, then WorkOS.
  const platformOrgFor = new Map<string, string>();
  for (const org of plan.organizations) {
    if (org.action === 'skip') continue;
    try {
      const organizationId = await withTransaction(async (client) => {
        if (org.action === 'already_linked') {
          const has = await client.query('SELECT 1 FROM platform.organization_product_entitlements WHERE organization_id = $1 AND product = $2', [
            org.platformOrganizationId,
            plan.product,
          ]);
          if (!has.rows[0]) await upsertEntitlement(client, ctx, org.platformOrganizationId!, { product: plan.product, ...org.entitlement });
          return org.platformOrganizationId!;
        }
        const created = await createOrganizationRecord(client, ctx, { name: org.name });
        await upsertEntitlement(client, ctx, created.id, { product: plan.product, ...org.entitlement });
        await client.query(
          `INSERT INTO platform.legacy_organization_links (product, legacy_organization_id, organization_id, manifest_digest)
           VALUES ($1, $2, $3, $4)`,
          [plan.product, org.legacyOrganizationId, created.id, plan.digest],
        );
        await importAudit(client, 'legacy_import.organization_linked', {
          organizationId: created.id,
          targetType: 'organization',
          targetId: created.id,
          metadata: { legacy_organization_id: org.legacyOrganizationId },
        });
        report.organizationsCreated += 1;
        return created.id;
      }, deps.pool);
      // Invitations need the WorkOS organization; until it exists (a re-run
      // completes it) the product cannot see the link either.
      await ensureWorkOSOrganization(ctx, deps, organizationId);
      report.organizationsLinkedToWorkOS += 1;
      platformOrgFor.set(org.legacyOrganizationId, organizationId);
    } catch (error) {
      failure(report, `organization ${org.legacyOrganizationId}`, error);
    }
  }

  // 2. Accounts: reviewed link, then the invitation that can bind it.
  const role = (user: UserPlan) => user.role ?? 'member';
  for (const user of plan.users) {
    if (!['invite', 'retry_invitation'].includes(user.action)) continue;
    const organizationId = user.legacyOrganizationId ? platformOrgFor.get(user.legacyOrganizationId) : undefined;
    if (!organizationId) continue; // its organization failed above; reported there
    try {
      let linkId = user.linkId;
      if (!linkId) {
        linkId = await withTransaction(async (client) => {
          const { rows } = await client.query<{ id: string }>(
            `INSERT INTO platform.legacy_identity_links (product, legacy_user_id, email, organization_id, status, manifest_digest, detail)
             VALUES ($1, $2, $3, $4, 'pending_invitation', $5, $6::jsonb) RETURNING id`,
            [plan.product, user.legacyUserId, user.email, organizationId, plan.digest, JSON.stringify({ legacy_organization_id: user.legacyOrganizationId })],
          );
          await importAudit(client, 'legacy_import.identity_link_created', {
            organizationId,
            targetType: 'legacy_identity_link',
            targetId: rows[0]!.id,
          });
          return rows[0]!.id;
        }, deps.pool);
        report.identityLinksCreated += 1;
      }
      const sent = await sendInvitation(ctx, deps, { organizationId, email: user.email, role: role(user), legacyLinkId: linkId });
      await withTransaction(
        (client) =>
          client.query("UPDATE platform.legacy_identity_links SET status = 'invited', updated_at = now() WHERE id = $1 AND status = 'pending_invitation'", [
            linkId,
          ]),
        deps.pool,
      );
      if (!sent.duplicate) report.invitationsSent += 1;
    } catch (error) {
      failure(report, `user ${user.legacyUserId}`, error);
    }
  }

  // 3. Further organizations of people whose primary link is bound.
  for (const user of plan.users) {
    for (const secondary of user.secondary) {
      if (secondary.action !== 'invite') continue;
      const organizationId = platformOrgFor.get(secondary.legacyOrganizationId);
      if (!organizationId) continue;
      try {
        const sent = await sendInvitation(ctx, deps, { organizationId, email: user.email, role: secondary.role });
        if (!sent.duplicate) report.invitationsSent += 1;
      } catch (error) {
        failure(report, `user ${user.legacyUserId} → organization ${secondary.legacyOrganizationId}`, error);
      }
    }
  }

  await withTransaction(
    (client) =>
      importAudit(client, 'legacy_import.applied', {
        result: report.failures.length ? 'failed' : 'success',
        targetType: 'legacy_manifest',
        targetId: plan.digest,
        metadata: {
          organizations_created: report.organizationsCreated,
          identity_links_created: report.identityLinksCreated,
          invitations_sent: report.invitationsSent,
          failures: report.failures.length,
        },
      }),
    deps.pool,
  );
  return report;
}
