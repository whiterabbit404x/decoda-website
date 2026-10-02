import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import { grantPlatformAdmin, PLATFORM_PERMISSIONS, type PlatformPermission } from './admin-grants';
import { withTransaction } from './db';
import { PlatformError } from './errors';
import { applyImport, IMPORT_PERMISSIONS, importActor, ManifestError, MANIFEST_FORMAT, parseManifest, planImport, type ImportPlan } from './legacy-import';
import type { AdminContext, ProvisioningDeps } from './provisioning';
import { sendInvitation } from './provisioning';
import { recordWebsiteSignIn } from './sign-in';
import { dbIt, useTestDatabase } from './testing/database';
import { eventPayload, FakeWorkOS, signWebhook, wire } from './testing/fake-workos';
import { handleWorkOSWebhook } from './webhooks';
import type { WorkOSUser } from './workos';

const silent = { warn: () => undefined, error: () => undefined };

// ── Manifest fixtures (the shape RWA Guard's export writes) ─────────────────

interface Org {
  legacy_organization_id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  evaluation_expires_at: null;
  platform_organization_id: string | null;
  workos_organization_id: string | null;
  members: Array<{ legacy_user_id: string; role: string }>;
  importable_members: number;
}

interface User {
  legacy_user_id: string;
  email: string;
  full_name: string;
  status: string;
  reasons: string[];
  auth_provider: string;
  workos_user_id: string | null;
  email_verified: boolean;
  mfa_enrolled: boolean;
  internal_admin: boolean;
  last_sign_in_at: null;
  primary_organization_id: string | null;
  organizations: Array<{ legacy_organization_id: string; role: string }>;
}

function org(name: string, overrides: Partial<Org> = {}): Org {
  return {
    legacy_organization_id: randomUUID(),
    name,
    slug: name.toLowerCase().replace(/\W+/g, '-'),
    plan: 'pilot',
    status: 'active',
    evaluation_expires_at: null,
    platform_organization_id: null,
    workos_organization_id: null,
    members: [],
    importable_members: 1,
    ...overrides,
  };
}

function user(email: string, memberships: Array<[Org, string]>, overrides: Partial<User> = {}): User {
  return {
    legacy_user_id: randomUUID(),
    email,
    full_name: email.split('@')[0]!,
    status: 'needs_invitation',
    reasons: [],
    auth_provider: 'password',
    workos_user_id: null,
    email_verified: true,
    mfa_enrolled: true,
    internal_admin: false,
    last_sign_in_at: null,
    primary_organization_id: memberships[0]?.[0].legacy_organization_id ?? null,
    organizations: memberships.map(([o, role]) => ({ legacy_organization_id: o.legacy_organization_id, role })),
    ...overrides,
  };
}

function manifestBytes(orgs: Org[], users: User[], product = 'rwa_guard', format = MANIFEST_FORMAT): Buffer {
  for (const o of orgs) o.members = users.flatMap((u) => u.organizations.filter((m) => m.legacy_organization_id === o.legacy_organization_id).map((m) => ({ legacy_user_id: u.legacy_user_id, role: m.role })));
  return Buffer.from(JSON.stringify({ format, product, generated_at: '2026-09-26T00:00:00Z', source: {}, summary: {}, organizations: orgs, users }, null, 2));
}

const mail = (label: string) => `${label}.${randomBytes(4).toString('hex')}@harbor-trust.io`;

// ── Pure validation ──────────────────────────────────────────────────────────

describe('legacy manifest parsing', () => {
  it('records the SHA-256 of the exact bytes and accepts a well-formed manifest', () => {
    const harbor = org('Harbor Trust');
    const bytes = manifestBytes([harbor], [user(mail('owner'), [[harbor, 'owner']])]);
    const { manifest, digest } = parseManifest(bytes, 'rwa_guard');
    assert.equal(digest, createHash('sha256').update(bytes).digest('hex'));
    assert.equal(manifest.users.length, 1);
  });

  it('refuses anything it cannot trust', () => {
    const harbor = org('Harbor Trust');
    const ok = user(mail('owner'), [[harbor, 'owner']]);
    const cases: Array<[string, Buffer]> = [
      ['not valid JSON', Buffer.from('{nope')],
      ['Unsupported manifest format', manifestBytes([harbor], [ok], 'rwa_guard', 'something/else')],
      ['is for "vault"', manifestBytes([harbor], [ok], 'vault')],
      ['appears twice', manifestBytes([harbor], [ok, ok])],
      ['missing from the manifest', manifestBytes([], [ok])],
      ['invalid id', manifestBytes([harbor], [{ ...ok, legacy_user_id: 'drop table;' }])],
    ];
    for (const [message, bytes] of cases) {
      assert.throws(() => parseManifest(bytes, 'rwa_guard'), (error: unknown) => error instanceof ManifestError && error.message.includes(message), message);
    }
  });
});

// ── Against a real platform database ────────────────────────────────────────

describe('legacy manifest import', () => {
  const db = useTestDatabase();

  interface Harness {
    gateway: FakeWorkOS;
    deps: ProvisioningDeps;
    ctx: AdminContext;
    admin: WorkOSUser;
  }

  async function harness(permissions: PlatformPermission[] = [...PLATFORM_PERMISSIONS]): Promise<Harness> {
    const gateway = new FakeWorkOS();
    const internal = gateway.addOrganization({ name: 'Decoda' });
    const admin = gateway.addUser({ email: `ops.${randomBytes(3).toString('hex')}@decoda.test` });
    gateway.addMembership(admin.id, internal.id, { role: { slug: 'admin' } });
    await withTransaction((client) => recordWebsiteSignIn(client, gateway, { user: admin, organizationId: internal.id, impersonated: false }), db().pool);
    await withTransaction(
      (client) => grantPlatformAdmin(client, { workosUserId: admin.id, permissions, grantedBy: 'operator:test', reason: 'import tests' }),
      db().pool,
    );
    const deps: ProvisioningDeps = { pool: db().pool, gateway, invitationExpiresInDays: 7 };
    const allowed = IMPORT_PERMISSIONS.every((permission) => permissions.includes(permission));
    const ctx = allowed ? await importActor(db().pool, admin.id, `req_${randomBytes(6).toString('hex')}`) : (null as unknown as AdminContext);
    return { gateway, deps, ctx, admin };
  }

  async function plan(bytes: Buffer): Promise<ImportPlan> {
    const { manifest, digest } = parseManifest(bytes, 'rwa_guard');
    return planImport(db().pool, manifest, digest);
  }

  async function apply(h: Harness, bytes: Buffer) {
    const { manifest, digest } = parseManifest(bytes, 'rwa_guard');
    const current = await planImport(db().pool, manifest, digest);
    return { plan: current, report: await applyImport(h.ctx, h.deps, manifest, current, { label: 'operator:test', reason: 'Guard cutover' }) };
  }

  async function deliver(gateway: FakeWorkOS, event: string, data: Record<string, unknown>) {
    const body = eventPayload(event, data);
    const result = await handleWorkOSWebhook(body, signWebhook(body), `req_${randomBytes(8).toString('hex')}`, { gateway, pool: db().pool, logger: silent });
    assert.equal(result.status, 200, JSON.stringify(result.body));
  }

  /** The hosted AuthKit flow: the invitee accepts, WorkOS sends its webhooks. */
  async function accept(h: Harness, email: string): Promise<WorkOSUser> {
    const invitation = [...h.gateway.invitations.values()].find((i) => i.email === email && i.state === 'pending')!;
    const person = [...h.gateway.users.values()].find((u) => u.email === email) ?? h.gateway.addUser({ email });
    const accepted = h.gateway.acceptInvitation(invitation.id, person);
    await deliver(h.gateway, 'user.created', wire.user(person));
    await deliver(h.gateway, 'organization_membership.created', wire.membership(accepted.membership));
    await deliver(h.gateway, 'invitation.accepted', wire.invitation(accepted.invitation));
    return person;
  }

  const actionsOf = (p: ImportPlan) => Object.fromEntries(p.users.map((u) => [u.email, [u.action, ...u.reasons].join(':')]));

  dbIt('a dry run plans every account and changes nothing', async () => {
    const h = await harness();
    const harbor = org('Harbor Trust', { importable_members: 2 });
    const closed = org('Closed Co', { status: 'expired' });
    const empty = org('Empty Co', { importable_members: 0 });
    const owner = user(mail('owner'), [[harbor, 'owner'], [empty, 'viewer']]);
    const analyst = user(mail('analyst'), [[harbor, 'analyst']]);
    const dup = user(mail('dup'), [[harbor, 'viewer']], { status: 'conflict', reasons: ['duplicate_email'] });
    const gone = user(mail('gone'), [[closed, 'owner']], { status: 'skipped', reasons: ['organization_inactive'] });
    const linked = user(mail('linked'), [[harbor, 'viewer']], { status: 'matched', workos_user_id: 'user_01ALREADY' });
    const before = await db().pool.query('SELECT count(*)::int AS n FROM platform.organizations');

    const p = await plan(manifestBytes([harbor, closed, empty], [owner, analyst, dup, gone, linked]));
    assert.deepEqual(
      Object.fromEntries(p.organizations.map((o) => [o.name, [o.action, o.reason]])),
      { 'Harbor Trust': ['create', null], 'Closed Co': ['skip', 'organization_inactive'], 'Empty Co': ['skip', 'no_importable_members'] },
    );
    assert.deepEqual(actionsOf(p), {
      [owner.email]: 'invite',
      [analyst.email]: 'invite',
      [dup.email]: 'conflict:duplicate_email',
      [gone.email]: 'skipped:organization_inactive',
      [linked.email]: 'matched',
    });
    const planned = Object.fromEntries(p.users.map((u) => [u.email, u.role]));
    assert.equal(planned[owner.email], 'admin');
    assert.equal(planned[analyst.email], 'member');
    assert.deepEqual(p.users.find((u) => u.email === owner.email)!.secondary.map((s) => [s.action, s.reason]), [['skip', 'organization_not_imported']]);
    assert.equal(p.organizations[0]!.entitlement.status, 'pilot');

    const after = await db().pool.query('SELECT count(*)::int AS n FROM platform.organizations');
    assert.equal(after.rows[0].n, before.rows[0].n);
    assert.equal(h.gateway.callsTo('createOrganization').length + h.gateway.callsTo('sendInvitation').length, 0);
  });

  dbIt('apply provisions reviewed links and invitations, audits them, and never applies a conflict', async () => {
    const h = await harness();
    const harbor = org('Harbor Trust', { importable_members: 2 });
    const owner = user(mail('owner'), [[harbor, 'owner']]);
    const viewer = user(mail('viewer'), [[harbor, 'viewer']]);
    const dup = user(mail('dup'), [[harbor, 'viewer']], { status: 'conflict', reasons: ['duplicate_email'] });
    const bytes = manifestBytes([harbor], [owner, viewer, dup]);
    const { report } = await apply(h, bytes);
    assert.deepEqual(report, { organizationsCreated: 1, organizationsLinkedToWorkOS: 1, identityLinksCreated: 2, invitationsSent: 2, failures: [] });

    const link = await db().pool.query(
      `SELECT l.legacy_organization_id, o.id AS platform_id, o.workos_organization_id, o.name
         FROM platform_api.legacy_organization_links_v1 l JOIN platform.organizations o ON o.id = l.platform_organization_id
        WHERE l.product = 'rwa_guard' AND l.legacy_organization_id = $1`,
      [harbor.legacy_organization_id],
    );
    assert.equal(link.rows.length, 1);
    assert.equal(link.rows[0].legacy_organization_id, harbor.legacy_organization_id);
    assert.equal(h.gateway.organizations.get(link.rows[0].workos_organization_id)!.externalId, link.rows[0].platform_id);
    const entitlement = await db().pool.query(
      "SELECT status, plan, expires_at FROM platform.organization_product_entitlements WHERE organization_id = $1 AND product = 'rwa_guard'",
      [link.rows[0].platform_id],
    );
    assert.deepEqual(entitlement.rows[0], { status: 'pilot', plan: 'pilot', expires_at: null });

    const links = await db().pool.query(
      "SELECT legacy_user_id, email, status, manifest_digest FROM platform.legacy_identity_links WHERE product = 'rwa_guard' AND legacy_user_id = ANY($1) ORDER BY email",
      [[owner, viewer, dup].map((u) => u.legacy_user_id)],
    );
    const digest = createHash('sha256').update(bytes).digest('hex');
    assert.deepEqual(
      links.rows.map((r) => [r.email, r.status, r.manifest_digest]),
      [owner, viewer].map((u) => [u.email, 'invited', digest]).sort(),
    );
    assert.ok(!links.rows.some((r) => r.legacy_user_id === dup.legacy_user_id), 'a conflict is never applied');
    const invitations = await db().pool.query(
      'SELECT email, role, legacy_link_id IS NOT NULL AS linked FROM platform.invitations WHERE organization_id = $1 ORDER BY email',
      [link.rows[0].platform_id],
    );
    assert.deepEqual(invitations.rows, [owner, viewer].map((u) => ({ email: u.email, role: u === owner ? 'admin' : 'member', linked: true })).sort((a, b) => a.email.localeCompare(b.email)));

    const actions = (await db().pool.query('SELECT action, actor_user_id FROM platform.audit_events ORDER BY seq')).rows;
    const imported = actions.map((a) => a.action);
    for (const action of ['organization.created', 'entitlement.enabled', 'legacy_import.organization_linked', 'organization.linked', 'legacy_import.identity_link_created', 'invitation.sent', 'legacy_import.applied']) {
      assert.ok(imported.includes(action), action);
    }
    assert.ok(actions.filter((a) => a.action.startsWith('legacy_import.')).every((a) => a.actor_user_id === h.ctx.actor.platformUserId));
  });

  dbIt('re-running is idempotent, and binding a link unlocks further organizations', async () => {
    const h = await harness();
    const harbor = org('Harbor Trust');
    const second = org('Harbor Labs');
    const owner = user(mail('owner'), [[harbor, 'owner'], [second, 'analyst']]);
    const bytes = manifestBytes([harbor, second], [owner]);
    await apply(h, bytes);

    const again = await apply(h, bytes);
    assert.deepEqual(again.report, { organizationsCreated: 0, organizationsLinkedToWorkOS: 2, identityLinksCreated: 0, invitationsSent: 0, failures: [] });
    assert.deepEqual(actionsOf(again.plan), { [owner.email]: 'already_invited' });
    assert.equal(h.gateway.callsTo('sendInvitation').length, 1);
    assert.deepEqual(again.plan.users[0]!.secondary.map((s) => [s.action, s.reason]), [['deferred', 'primary_link_pending']]);

    const person = await accept(h, owner.email);
    const bound = await db().pool.query('SELECT legacy_user_id, workos_user_id FROM platform_api.legacy_identity_links_v1 WHERE product = $1 AND workos_user_id = $2', [
      'rwa_guard',
      person.id,
    ]);
    assert.deepEqual(bound.rows, [{ legacy_user_id: owner.legacy_user_id, workos_user_id: person.id }]);

    const third = await apply(h, bytes);
    assert.deepEqual(actionsOf(third.plan), { [owner.email]: 'already_linked' });
    assert.deepEqual(third.plan.users[0]!.secondary.map((s) => [s.action, s.role]), [['invite', 'member']]);
    assert.equal(third.report.invitationsSent, 1);
    const secondInvite = await db().pool.query('SELECT role, legacy_link_id FROM platform.invitations WHERE email = $1 AND state = $2', [owner.email, 'pending']);
    assert.deepEqual(secondInvite.rows, [{ role: 'member', legacy_link_id: null }]);
    assert.equal((await apply(h, bytes)).report.invitationsSent, 0);
  });

  dbIt('platform facts that make an account ambiguous are conflicts, never merges', async () => {
    const h = await harness();
    const harbor = org('Harbor Trust');
    const owner = user(mail('owner'), [[harbor, 'owner']]);
    await apply(h, manifestBytes([harbor], [owner]));
    const person = await accept(h, owner.email);
    const platformOrg = (
      await db().pool.query("SELECT organization_id FROM platform.legacy_organization_links WHERE product = 'rwa_guard' AND legacy_organization_id = $1", [
        harbor.legacy_organization_id,
      ])
    ).rows[0].organization_id;

    // Someone already in the organization under the same address.
    const member = h.gateway.addUser({ email: mail('member') });
    const membership = h.gateway.addMembership(member.id, (await db().pool.query('SELECT workos_organization_id FROM platform.organizations WHERE id = $1', [platformOrg])).rows[0].workos_organization_id);
    await deliver(h.gateway, 'user.created', wire.user(member));
    await deliver(h.gateway, 'organization_membership.created', wire.membership(membership));
    // An open invitation for another address.
    const invited = mail('invited');
    await sendInvitation(h.ctx, h.deps, { organizationId: platformOrg, email: invited, role: 'member' });
    // A re-export: the owner is now linked in the product; a second legacy
    // account carries the address of the identity that is already linked.
    const linkedOwner = { ...owner, status: 'matched', workos_user_id: person.id };
    const twin = user(person.email, [[harbor, 'viewer']]);

    const p = await plan(manifestBytes([harbor], [linkedOwner, user(member.email, [[harbor, 'viewer']]), user(invited, [[harbor, 'viewer']]), twin]));
    const byId = Object.fromEntries(p.users.map((u) => [u.legacyUserId, [u.action, ...u.reasons].join(':')]));
    assert.equal(byId[owner.legacy_user_id], 'matched');
    assert.equal(byId[twin.legacy_user_id], 'conflict:identity_already_linked_to_another_account');
    assert.deepEqual(
      p.users.filter((u) => u.email === member.email || u.email === invited).map((u) => [u.action, ...u.reasons].join(':')).sort(),
      ['conflict:already_a_platform_member', 'conflict:open_invitation_exists'],
    );
  });

  dbIt('a product tenant linked without a platform record is held for a human', async () => {
    const h = await harness();
    const harbor = org('Harbor Trust', { platform_organization_id: randomUUID() });
    const p = await plan(manifestBytes([harbor], [user(mail('owner'), [[harbor, 'owner']])]));
    assert.deepEqual([p.organizations[0]!.action, p.organizations[0]!.reason], ['skip', 'linked_in_product_without_platform_record']);
    assert.deepEqual(p.users.map((u) => [u.action, ...u.reasons]), [['skipped', 'primary_organization_not_imported']]);
    assert.equal((await apply(h, manifestBytes([harbor], [user(mail('x'), [[harbor, 'owner']])]))).report.organizationsCreated, 0);
  });

  dbIt('a failed invitation leaves the link pending and a re-run retries it', async () => {
    const h = await harness();
    const harbor = org('Harbor Trust');
    const owner = user(mail('owner'), [[harbor, 'owner']]);
    const bytes = manifestBytes([harbor], [owner]);
    h.gateway.failures.set('sendInvitation', Object.assign(new Error('rate limited'), { status: 429 }));
    const first = await apply(h, bytes);
    assert.equal(first.report.failures.length, 1);
    assert.equal(first.report.failures[0]!.code, 'INVITATION_SEND_FAILED');
    const pending = await db().pool.query('SELECT status FROM platform.legacy_identity_links WHERE legacy_user_id = $1', [owner.legacy_user_id]);
    assert.equal(pending.rows[0].status, 'pending_invitation');

    const second = await apply(h, bytes);
    assert.deepEqual(actionsOf(second.plan), { [owner.email]: 'retry_invitation' });
    assert.deepEqual([second.report.identityLinksCreated, second.report.invitationsSent, second.report.failures.length], [0, 1, 0]);
    const invited = await db().pool.query('SELECT status FROM platform.legacy_identity_links WHERE legacy_user_id = $1', [owner.legacy_user_id]);
    assert.equal(invited.rows[0].status, 'invited');
  });

  dbIt('only an active platform admin holding every import permission may apply', async () => {
    const h = await harness(['platform.organizations.read', 'platform.organizations.manage']);
    await assert.rejects(
      () => importActor(db().pool, h.admin.id, 'req_x'),
      (error: unknown) => error instanceof PlatformError && error.code === 'PLATFORM_PERMISSION_DENIED',
    );
    await assert.rejects(
      () => importActor(db().pool, 'user_01NOBODY', 'req_x'),
      (error: unknown) => error instanceof PlatformError && error.status === 403,
    );
  });
});
