import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AuthSnapshot } from './actor';
import { resolveActor } from './actor';
import { activeGrantFor, grantPlatformAdmin, hasPermission, requirePermission, revokePlatformAdmin } from './admin-grants';
import { issueCsrfToken, isSameOrigin, verifyCsrfToken } from './csrf';
import { withTransaction } from './db';
import { PlatformError } from './errors';
import { loadLauncher, soleOpenProduct } from './launcher';
import { resolveSwitchTarget } from './organization-switch';
import { evaluateAccess, type AccessFacts } from './products';
import { safeReturnPath } from './return-to';
import { recordSignOut, recordWebsiteSignIn } from './sign-in';
import { dbIt, useTestDatabase } from './testing/database';
import { FakeWorkOS } from './testing/fake-workos';

const URLS = {
  website: 'https://www.example.test',
  rwa_guard: 'https://rwa.example.test',
  vault: 'https://vault.example.test',
  assets: 'https://assets.example.test',
};

function snapshot(workosUserId: string, organizationId: string | null, overrides: Partial<AuthSnapshot> = {}): AuthSnapshot {
  return {
    workosUserId,
    sessionId: 'session_01TESTSESSION',
    organizationId,
    impersonated: false,
    email: 'person@customer.test',
    firstName: 'Pat',
    lastName: 'Lee',
    ...overrides,
  };
}

describe('CSRF and origin checks', () => {
  const secret = 's'.repeat(40);
  it('accepts only the token bound to this session', () => {
    const token = issueCsrfToken('session_A', secret);
    assert.equal(verifyCsrfToken(token, 'session_A', secret), true);
    assert.equal(verifyCsrfToken(token, 'session_B', secret), false);
    assert.equal(verifyCsrfToken(null, 'session_A', secret), false);
    assert.equal(verifyCsrfToken(`${token}x`, 'session_A', secret), false);
    assert.equal(verifyCsrfToken(issueCsrfToken('session_A', 'x'.repeat(40)), 'session_A', secret), false);
  });

  it('requires a same-origin Origin header', () => {
    const make = (headers: Record<string, string>) => new Request('https://www.example.test/api/x', { method: 'POST', headers });
    assert.equal(isSameOrigin(make({ origin: 'https://www.example.test', host: 'www.example.test' })), true);
    assert.equal(isSameOrigin(make({ origin: 'https://evil.test', host: 'www.example.test' })), false);
    assert.equal(isSameOrigin(make({ host: 'www.example.test' })), false);
    assert.equal(isSameOrigin(make({ origin: 'null', host: 'www.example.test' })), false);
  });
});

describe('return path validation', () => {
  it('only allows same-site platform paths', () => {
    assert.equal(safeReturnPath('/admin/pilot-requests'), '/admin/pilot-requests');
    assert.equal(safeReturnPath('/account?tab=security'), '/account?tab=security');
    assert.equal(safeReturnPath('https://evil.test/launcher'), '/launcher');
    assert.equal(safeReturnPath('//evil.test/launcher'), '/launcher');
    assert.equal(safeReturnPath('/\\evil.test'), '/launcher');
    assert.equal(safeReturnPath('/pricing'), '/launcher');
    assert.equal(safeReturnPath(null), '/launcher');
  });
});

describe('access rule parity', () => {
  it('evaluateAccess mirrors the SQL precedence', () => {
    const base: AccessFacts = {
      userStatus: 'active',
      organizationStatus: 'active',
      membershipStatus: 'active',
      productAvailability: 'available',
      entitlementStatus: 'enabled',
      entitlementStartsAt: new Date('2020-01-01'),
      entitlementExpiresAt: null,
    };
    const now = new Date('2026-06-01');
    assert.equal(evaluateAccess(null), 'no_membership');
    assert.equal(evaluateAccess(base, now), 'granted');
    assert.equal(evaluateAccess({ ...base, entitlementStatus: 'pilot' }, now), 'granted');
    assert.equal(evaluateAccess({ ...base, entitlementStatus: 'disabled' }, now), 'not_entitled');
    assert.equal(evaluateAccess({ ...base, entitlementStatus: null }, now), 'not_entitled');
    assert.equal(evaluateAccess({ ...base, entitlementStatus: 'suspended' }, now), 'entitlement_suspended');
    assert.equal(evaluateAccess({ ...base, entitlementExpiresAt: new Date('2026-05-01') }, now), 'entitlement_expired');
    assert.equal(evaluateAccess({ ...base, entitlementStartsAt: new Date('2027-01-01') }, now), 'entitlement_not_started');
    assert.equal(evaluateAccess({ ...base, productAvailability: 'coming_soon' }, now), 'product_unavailable');
    assert.equal(evaluateAccess({ ...base, membershipStatus: 'pending' }, now), 'membership_inactive');
    assert.equal(evaluateAccess({ ...base, organizationStatus: 'suspended', userStatus: 'suspended' }, now), 'user_inactive');
  });
});

describe('platform identity (database)', () => {
  const db = useTestDatabase();

  async function setupMember(gateway: FakeWorkOS, opts: { role?: string; entitlements?: Record<string, string> } = {}) {
    const org = gateway.addOrganization({ name: `Org ${Math.random().toString(36).slice(2, 8)}` });
    const user = gateway.addUser();
    gateway.addMembership(user.id, org.id, { role: { slug: opts.role ?? 'member' } });
    await withTransaction((client) => recordWebsiteSignIn(client, gateway, { user, organizationId: org.id, impersonated: false }), db().pool);
    const platformOrg = await db().pool.query('SELECT id FROM platform.organizations WHERE workos_organization_id = $1', [org.id]);
    for (const [product, status] of Object.entries(opts.entitlements ?? {})) {
      await db().pool.query(
        'INSERT INTO platform.organization_product_entitlements (organization_id, product, status) VALUES ($1, $2, $3)',
        [platformOrg.rows[0].id, product, status],
      );
    }
    return { org, user, platformOrgId: platformOrg.rows[0].id as string };
  }

  dbIt('sign-in syncs the user and every WorkOS membership before any webhook arrives', async () => {
    const gateway = new FakeWorkOS();
    const { user, org } = await setupMember(gateway);
    const { rows } = await db().pool.query(
      `SELECT m.status FROM platform.organization_memberships m
         JOIN platform.users u ON u.id = m.user_id JOIN platform.organizations o ON o.id = m.organization_id
        WHERE u.workos_user_id = $1 AND o.workos_organization_id = $2`,
      [user.id, org.id],
    );
    assert.deepEqual(rows, [{ status: 'active' }]);
    const audit = await db().pool.query("SELECT 1 FROM platform.audit_events WHERE action = 'auth.website_sign_in'");
    assert.ok(audit.rows.length >= 1);
  });

  dbIt('sign-out records the WorkOS session as revoked for every product', async () => {
    const gateway = new FakeWorkOS();
    const { user } = await setupMember(gateway);
    await withTransaction(
      (client) => recordSignOut(client, { workosUserId: user.id, sessionId: 'session_01SIGNOUTTEST', requestId: 'req_signout_0001', ipHash: null }),
      db().pool,
    );
    const { rows } = await db().pool.query("SELECT 1 FROM platform_api.session_revocations_v1 WHERE workos_session_id = 'session_01SIGNOUTTEST'");
    assert.equal(rows.length, 1);
  });

  dbIt('launcher: Guard + Vault open, Assets coming soon', async () => {
    const gateway = new FakeWorkOS();
    const { user, org } = await setupMember(gateway, { entitlements: { rwa_guard: 'enabled', vault: 'pilot' } });
    const client = await db().pool.connect();
    try {
      const view = await loadLauncher(client, snapshot(user.id, org.id), URLS);
      const states = Object.fromEntries(view.products.map((p) => [p.product, p.state]));
      assert.deepEqual(states, { rwa_guard: 'open', vault: 'pilot', assets: 'coming_soon' });
      assert.equal(view.products.find((p) => p.product === 'vault')!.url, URLS.vault);
      assert.equal(view.products.find((p) => p.product === 'assets')!.url, null);
      assert.equal(soleOpenProduct(view), null);
    } finally {
      client.release();
    }
  });

  dbIt('launcher: Vault-only organization forwards straight to Vault and offers access requests elsewhere', async () => {
    const gateway = new FakeWorkOS();
    const { user, org } = await setupMember(gateway, { entitlements: { vault: 'enabled' } });
    const client = await db().pool.connect();
    try {
      const view = await loadLauncher(client, snapshot(user.id, org.id), URLS);
      assert.equal(soleOpenProduct(view)?.product, 'vault');
      const guard = view.products.find((p) => p.product === 'rwa_guard')!;
      assert.equal(guard.state, 'not_enabled');
      assert.equal(guard.url, null);
      assert.equal(guard.requestAccessUrl, '/request-pilot?product=rwa_guard');
    } finally {
      client.release();
    }
  });

  dbIt('launcher: a session naming an organization the user is not in shows nothing as open', async () => {
    const gateway = new FakeWorkOS();
    const a = await setupMember(gateway, { entitlements: { vault: 'enabled' } });
    const b = await setupMember(gateway, { entitlements: { vault: 'enabled', rwa_guard: 'enabled' } });
    const client = await db().pool.connect();
    try {
      const view = await loadLauncher(client, snapshot(a.user.id, b.org.id), URLS);
      assert.equal(view.activeOrganization, null);
      assert.ok(view.products.every((p) => p.url === null));
    } finally {
      client.release();
    }
  });

  dbIt('organization switch: only active memberships can be selected (tampered id refused)', async () => {
    const gateway = new FakeWorkOS();
    const a = await setupMember(gateway);
    const b = await setupMember(gateway);
    const client = await db().pool.connect();
    try {
      const own = await resolveSwitchTarget(client, snapshot(a.user.id, a.org.id), a.platformOrgId);
      assert.equal(own.workosOrganizationId, a.org.id);
      await assert.rejects(resolveSwitchTarget(client, snapshot(a.user.id, a.org.id), b.platformOrgId), (error: unknown) => {
        assert.ok(error instanceof PlatformError);
        assert.equal(error.status, 403);
        return true;
      });
      await db().pool.query("UPDATE platform.organizations SET status = 'suspended' WHERE id = $1", [a.platformOrgId]);
      await assert.rejects(resolveSwitchTarget(client, snapshot(a.user.id, a.org.id), a.platformOrgId));
    } finally {
      client.release();
    }
  });

  dbIt('platform admin grants: explicit, revocable, never for impersonated sessions', async () => {
    const gateway = new FakeWorkOS();
    const { user, org } = await setupMember(gateway);
    const client = await db().pool.connect();
    try {
      assert.equal((await resolveActor(client, snapshot(user.id, org.id))).grant, null);
      await withTransaction(
        (tx) => grantPlatformAdmin(tx, { workosUserId: user.id, permissions: ['platform.pilot_requests.read'], grantedBy: 'operator:test', reason: 'test grant' }),
        db().pool,
      );
      const actor = await resolveActor(client, snapshot(user.id, org.id));
      assert.equal(hasPermission(actor.grant, 'platform.pilot_requests.read'), true);
      assert.equal(hasPermission(actor.grant, 'platform.pilot_requests.review'), false);
      assert.throws(() => requirePermission(actor.grant, 'platform.entitlements.manage'), /platform permission/);

      const impersonated = await resolveActor(client, snapshot(user.id, org.id, { impersonated: true }));
      assert.equal(impersonated.grant, null);

      assert.equal(await withTransaction((tx) => revokePlatformAdmin(tx, user.id, 'operator:test', 'rotation'), db().pool), true);
      assert.equal((await resolveActor(client, snapshot(user.id, org.id))).grant, null);
    } finally {
      client.release();
    }
  });

  dbIt('platform admin grants die with the user', async () => {
    const gateway = new FakeWorkOS();
    const { user } = await setupMember(gateway);
    await withTransaction(
      (tx) => grantPlatformAdmin(tx, { workosUserId: user.id, permissions: ['platform.audit.read'], grantedBy: 'operator:test', reason: 'test grant' }),
      db().pool,
    );
    await db().pool.query("UPDATE platform.users SET status = 'suspended' WHERE workos_user_id = $1", [user.id]);
    const { rows } = await db().pool.query('SELECT id FROM platform.users WHERE workos_user_id = $1', [user.id]);
    const client = await db().pool.connect();
    try {
      assert.equal(await activeGrantFor(client, rows[0].id), null);
    } finally {
      client.release();
    }
  });
});
