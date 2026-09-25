import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { describe } from 'node:test';
import { dbIt, fakeId, useTestDatabase } from './testing/database';
import { eventPayload, FakeWorkOS, signWebhook, TEST_WEBHOOK_SECRET, wire } from './testing/fake-workos';
import { handleWorkOSWebhook, signatureTimestamp } from './webhooks';

const silent = { warn: () => undefined, error: () => undefined };

describe('WorkOS webhooks', () => {
  const db = useTestDatabase();

  function deliver(gateway: FakeWorkOS, body: string, header: string | null = signWebhook(body), now?: () => number) {
    return handleWorkOSWebhook(body, header, `req_${randomBytes(8).toString('hex')}`, { gateway, pool: db().pool, logger: silent, now });
  }

  async function count(sql: string, params: unknown[] = []): Promise<number> {
    const { rows } = await db().pool.query(`SELECT count(*)::int AS n FROM (${sql}) q`, params);
    return rows[0].n;
  }

  describe('signature verification', () => {
    dbIt('accepts a correctly signed event and records it once', async () => {
      const gateway = new FakeWorkOS();
      const user = gateway.addUser();
      const body = eventPayload('user.created', wire.user(user));
      const result = await deliver(gateway, body);
      assert.equal(result.status, 200);
      assert.equal(result.body.outcome, 'processed');
      assert.equal(await count('SELECT 1 FROM platform.users WHERE workos_user_id = $1', [user.id]), 1);
    });

    dbIt('rejects a missing signature header without touching the database', async () => {
      const gateway = new FakeWorkOS();
      const body = eventPayload('user.created', wire.user(gateway.addUser()));
      const before = await count('SELECT 1 FROM platform.workos_events');
      const result = await deliver(gateway, body, null);
      assert.equal(result.status, 400);
      assert.equal(await count('SELECT 1 FROM platform.workos_events'), before);
    });

    dbIt('rejects a signature made with the wrong secret', async () => {
      const gateway = new FakeWorkOS();
      const user = gateway.addUser();
      const body = eventPayload('user.created', wire.user(user));
      const result = await deliver(gateway, body, signWebhook(body, 'whsec_attacker_guess_000000000000000'));
      assert.equal(result.status, 401);
      assert.equal(await count('SELECT 1 FROM platform.users WHERE workos_user_id = $1', [user.id]), 0);
    });

    dbIt('rejects a body that does not match its signature (tampering)', async () => {
      const gateway = new FakeWorkOS();
      const user = gateway.addUser();
      const signedBody = eventPayload('user.created', wire.user(user));
      const tampered = signedBody.replace(user.email, 'attacker@evil.test');
      const result = await deliver(gateway, tampered, signWebhook(signedBody));
      assert.equal(result.status, 401);
      assert.equal(await count("SELECT 1 FROM platform.users WHERE email = 'attacker@evil.test'"), 0);
    });

    dbIt('rejects a stale timestamp (outside the 3-minute tolerance)', async () => {
      const gateway = new FakeWorkOS();
      const body = eventPayload('user.created', wire.user(gateway.addUser()));
      const result = await deliver(gateway, body, signWebhook(body, TEST_WEBHOOK_SECRET, Date.now() - 4 * 60_000));
      assert.equal(result.status, 401);
    });

    dbIt('rejects a timestamp from the future', async () => {
      const gateway = new FakeWorkOS();
      const body = eventPayload('user.created', wire.user(gateway.addUser()));
      const result = await deliver(gateway, body, signWebhook(body, TEST_WEBHOOK_SECRET, Date.now() + 5 * 60_000));
      assert.equal(result.status, 401);
    });

    dbIt('parses the signature timestamp defensively', async () => {
      assert.equal(signatureTimestamp('t=1700000000000, v1=abc'), 1700000000000);
      assert.equal(signatureTimestamp('v1=abc'), null);
      assert.equal(signatureTimestamp('t=notanumber, v1=abc'), null);
    });
  });

  describe('idempotency and replay', () => {
    dbIt('a redelivered (replayed) event is a no-op', async () => {
      const gateway = new FakeWorkOS();
      const user = gateway.addUser();
      const body = eventPayload('user.created', wire.user(user));
      assert.equal((await deliver(gateway, body)).body.outcome, 'processed');
      const auditBefore = await count("SELECT 1 FROM platform.audit_events WHERE action = 'identity.user_created'");
      // Replayed later with a fresh, valid signature: still applied only once.
      const replay = await deliver(gateway, body, signWebhook(body, TEST_WEBHOOK_SECRET, Date.now() + 1000));
      assert.equal(replay.status, 200);
      assert.equal(replay.body.outcome, 'duplicate');
      assert.equal(await count("SELECT 1 FROM platform.audit_events WHERE action = 'identity.user_created'"), auditBefore);
    });

    dbIt('a failed event is recorded as failed and applied when redelivered', async () => {
      const gateway = new FakeWorkOS();
      const org = gateway.addOrganization();
      const user = gateway.addUser();
      const membership = gateway.addMembership(user.id, org.id);
      gateway.failures.set('getUser', Object.assign(new Error('WorkOS unavailable'), { status: 503 }));
      const body = eventPayload('organization_membership.created', wire.membership(membership));
      const failed = await deliver(gateway, body);
      assert.equal(failed.status, 500);
      const ledger = await db().pool.query('SELECT status, attempts FROM platform.workos_events WHERE event_id = $1', [JSON.parse(body).id]);
      assert.deepEqual(ledger.rows[0], { status: 'failed', attempts: 1 });
      assert.equal(await count('SELECT 1 FROM platform.users WHERE workos_user_id = $1', [user.id]), 0);

      const retried = await deliver(gateway, body);
      assert.equal(retried.status, 200);
      const after = await db().pool.query('SELECT status, attempts FROM platform.workos_events WHERE event_id = $1', [JSON.parse(body).id]);
      assert.deepEqual(after.rows[0], { status: 'processed', attempts: 2 });
    });

    dbIt('unknown event types are acknowledged and ignored', async () => {
      const gateway = new FakeWorkOS();
      const body = eventPayload('dsync.group.created', { id: 'directory_group_X', name: 'x' });
      const result = await deliver(gateway, body);
      assert.equal(result.status, 200);
      assert.equal(result.body.outcome, 'ignored');
    });
  });

  describe('synchronisation', () => {
    async function membershipRow(workosMembershipId: string) {
      const { rows } = await db().pool.query('SELECT status, role FROM platform.organization_memberships WHERE workos_membership_id = $1', [
        workosMembershipId,
      ]);
      return rows[0];
    }

    dbIt('membership lifecycle: created, role change, deactivation, deletion', async () => {
      const gateway = new FakeWorkOS();
      const org = gateway.addOrganization();
      const user = gateway.addUser();
      const m = gateway.addMembership(user.id, org.id, { role: { slug: 'member' } });
      await deliver(gateway, eventPayload('organization_membership.created', wire.membership(m)));
      assert.deepEqual(await membershipRow(m.id), { status: 'active', role: 'member' });

      const promoted = { ...m, role: { slug: 'admin' }, updatedAt: new Date(Date.now() + 1000).toISOString() };
      await deliver(gateway, eventPayload('organization_membership.updated', wire.membership(promoted)));
      assert.deepEqual(await membershipRow(m.id), { status: 'active', role: 'admin' });
      assert.equal(await count("SELECT 1 FROM platform.audit_events WHERE action = 'membership.role_changed'"), 1);

      const deactivated = { ...promoted, status: 'inactive' as const, updatedAt: new Date(Date.now() + 2000).toISOString() };
      await deliver(gateway, eventPayload('organization_membership.updated', wire.membership(deactivated)));
      assert.equal((await membershipRow(m.id)).status, 'inactive');

      await deliver(gateway, eventPayload('organization_membership.deleted', wire.membership(deactivated)));
      assert.equal((await membershipRow(m.id)).status, 'inactive');
    });

    dbIt('an out-of-order (older) update cannot roll a membership back', async () => {
      const gateway = new FakeWorkOS();
      const org = gateway.addOrganization();
      const user = gateway.addUser();
      const t0 = Date.now();
      const current = gateway.addMembership(user.id, org.id, { status: 'inactive', updatedAt: new Date(t0 + 5000).toISOString() });
      await deliver(gateway, eventPayload('organization_membership.updated', wire.membership(current)));
      const stale = { ...current, status: 'active' as const, updatedAt: new Date(t0).toISOString() };
      await deliver(gateway, eventPayload('organization_membership.updated', wire.membership(stale)));
      assert.equal((await membershipRow(current.id)).status, 'inactive');
    });

    dbIt('user.deleted marks the user deleted and ends every membership', async () => {
      const gateway = new FakeWorkOS();
      const org = gateway.addOrganization();
      const user = gateway.addUser();
      const m = gateway.addMembership(user.id, org.id);
      await deliver(gateway, eventPayload('organization_membership.created', wire.membership(m)));
      await deliver(gateway, eventPayload('user.deleted', wire.user(user)));
      const { rows } = await db().pool.query('SELECT status FROM platform.users WHERE workos_user_id = $1', [user.id]);
      assert.equal(rows[0].status, 'deleted');
      assert.equal((await membershipRow(m.id)).status, 'inactive');
    });

    dbIt('an organization created by the platform links back through its external id', async () => {
      const gateway = new FakeWorkOS();
      const { rows } = await db().pool.query(
        "INSERT INTO platform.organizations (name, slug) VALUES ('Linked Co', $1) RETURNING id",
        [`linked-${randomBytes(4).toString('hex')}`],
      );
      const org = gateway.addOrganization({ name: 'Linked Co', externalId: rows[0].id });
      await deliver(gateway, eventPayload('organization.created', wire.organization(org)));
      const linked = await db().pool.query('SELECT workos_organization_id FROM platform.organizations WHERE id = $1', [rows[0].id]);
      assert.equal(linked.rows[0].workos_organization_id, org.id);
    });

    dbIt('refuses to re-point an organization already linked to another WorkOS organization', async () => {
      const gateway = new FakeWorkOS();
      const existing = fakeId('org');
      const { rows } = await db().pool.query(
        "INSERT INTO platform.organizations (name, slug, workos_organization_id) VALUES ('Taken', $1, $2) RETURNING id",
        [`taken-${randomBytes(4).toString('hex')}`, existing],
      );
      const hijack = gateway.addOrganization({ name: 'Hijack', externalId: rows[0].id });
      const result = await deliver(gateway, eventPayload('organization.created', wire.organization(hijack)));
      assert.equal(result.status, 500);
      const still = await db().pool.query('SELECT workos_organization_id FROM platform.organizations WHERE id = $1', [rows[0].id]);
      assert.equal(still.rows[0].workos_organization_id, existing);
    });

    dbIt('session.revoked records the revocation products check', async () => {
      const gateway = new FakeWorkOS();
      const session = { id: fakeId('session'), userId: fakeId('user') };
      await deliver(gateway, eventPayload('session.revoked', wire.session(session)));
      const { rows } = await db().pool.query('SELECT workos_session_id FROM platform_api.session_revocations_v1 WHERE workos_session_id = $1', [
        session.id,
      ]);
      assert.equal(rows.length, 1);
    });

    dbIt('authentication failures are audited without secrets', async () => {
      const gateway = new FakeWorkOS();
      const body = eventPayload('authentication.password_failed', {
        type: 'password',
        status: 'failed',
        user_id: fakeId('user'),
        email: 'someone@customer.test',
        ip_address: '203.0.113.9',
        user_agent: 'x',
        error: { code: 'invalid_credentials', message: 'Invalid' },
      });
      await deliver(gateway, body);
      const { rows } = await db().pool.query("SELECT metadata FROM platform.audit_events WHERE action = 'auth.failed' ORDER BY seq DESC LIMIT 1");
      assert.equal(rows[0].metadata.error_code, 'invalid_credentials');
      assert.equal(JSON.stringify(rows[0].metadata).includes('203.0.113.9'), false);
    });
  });
});
