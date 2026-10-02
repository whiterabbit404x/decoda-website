import assert from 'node:assert/strict';
import { describe } from 'node:test';
import { Client } from 'pg';
import { migrationFiles, migrationStatus, MigrationDriftError, runMigrations } from './migrations';
import { dbIt, fakeId, TEST_SERVER_URL, useTestDatabase } from './testing/database';

const READER_ROLE = 'decoda_platform_reader';

async function readerRoleExists(): Promise<boolean> {
  const client = new Client({ connectionString: TEST_SERVER_URL });
  await client.connect();
  try {
    const { rows } = await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [READER_ROLE]);
    return rows.length > 0;
  } finally {
    await client.end();
  }
}

describe('platform migrations', () => {
  const db = useTestDatabase({ readerRole: READER_ROLE });

  dbIt('applies every migration to a clean database and reports nothing pending', async () => {
    const client = await db().pool.connect();
    try {
      const status = await migrationStatus(client);
      assert.deepEqual(status.pending, []);
      assert.deepEqual(status.drifted, []);
      assert.deepEqual(status.applied, migrationFiles().map((file) => file.name));
    } finally {
      client.release();
    }
  });

  dbIt('is idempotent: a second run applies nothing', async () => {
    const client = await db().pool.connect();
    try {
      assert.deepEqual(await runMigrations(client), []);
    } finally {
      client.release();
    }
  });

  dbIt('refuses to run when an applied migration was edited (drift)', async () => {
    const first = migrationFiles()[0]!;
    const client = await db().pool.connect();
    try {
      await client.query("UPDATE platform.schema_migrations SET checksum = repeat('0', 64) WHERE version = $1", [first.name]);
      await assert.rejects(runMigrations(client), MigrationDriftError);
      assert.deepEqual((await migrationStatus(client)).drifted, [first.name]);
    } finally {
      await client.query('UPDATE platform.schema_migrations SET checksum = $1 WHERE version = $2', [first.checksum, first.name]);
      client.release();
    }
  });

  dbIt('seeds the product catalog with Assets marked coming soon', async () => {
    const { rows } = await db().pool.query('SELECT product, availability FROM platform.products ORDER BY sort_order');
    assert.deepEqual(rows, [
      { product: 'rwa_guard', availability: 'available' },
      { product: 'vault', availability: 'available' },
      { product: 'assets', availability: 'coming_soon' },
    ]);
  });

  dbIt('rejects an identifier of the wrong kind (org id in a user column)', async () => {
    await assert.rejects(
      db().pool.query('INSERT INTO platform.users (workos_user_id, email) VALUES ($1, $2)', [fakeId('org'), 'a@b.co']),
      /users_workos_user_id_check/,
    );
  });

  dbIt('allows at most one pending Pilot request per email', async () => {
    const insert = () =>
      db().pool.query(
        `INSERT INTO platform.pilot_requests (email, email_domain, full_name, company_name, role, requested_products, request_id)
         VALUES ('dup@acme.test', 'acme.test', 'A', 'Acme', 'CISO', ARRAY['vault'], 'req_test_dup_0001')`,
      );
    await insert();
    await assert.rejects(insert(), /pilot_requests_one_pending_per_email/);
  });

  dbIt('audit events are hash-chained and the chain verifies', async () => {
    for (const action of ['pilot.requested', 'pilot.approved', 'organization.created']) {
      await db().pool.query(
        `SELECT platform.append_audit_event('system', NULL, 'test', $1, NULL, 'pilot_request', 'x', 'success',
                                            'req_test_audit_01', NULL, NULL, '{"k":"v"}'::jsonb)`,
        [action],
      );
    }
    const { rows } = await db().pool.query('SELECT platform.verify_audit_chain() AS broken');
    assert.equal(rows[0].broken, null);
    const chain = await db().pool.query('SELECT prev_hash, row_hash FROM platform.audit_events ORDER BY seq');
    for (let i = 1; i < chain.rows.length; i += 1) {
      assert.equal(chain.rows[i].prev_hash, chain.rows[i - 1].row_hash);
    }
  });

  dbIt('the audit trail is append-only: UPDATE, DELETE and TRUNCATE raise', async () => {
    await assert.rejects(db().pool.query("UPDATE platform.audit_events SET action = 'x.y'"), /append-only/);
    await assert.rejects(db().pool.query('DELETE FROM platform.audit_events'), /append-only/);
    await assert.rejects(db().pool.query('TRUNCATE platform.audit_events'), /append-only/);
  });

  describe('platform_api.product_access_v1', () => {
    type Fixture = { workosUserId: string; workosOrgId: string; orgId: string };

    async function member(opts: { userStatus?: string; orgStatus?: string; membershipStatus?: string } = {}): Promise<Fixture> {
      const workosUserId = fakeId('user');
      const workosOrgId = fakeId('org');
      const user = await db().pool.query(
        'INSERT INTO platform.users (workos_user_id, email, status) VALUES ($1, $2, $3) RETURNING id',
        [workosUserId, `${workosUserId.toLowerCase()}@acme.test`, opts.userStatus ?? 'active'],
      );
      const org = await db().pool.query(
        'INSERT INTO platform.organizations (workos_organization_id, name, slug, status) VALUES ($1, $2, $3, $4) RETURNING id',
        [workosOrgId, 'Acme', `acme-${workosOrgId.slice(4, 16).toLowerCase()}`, opts.orgStatus ?? 'active'],
      );
      await db().pool.query(
        `INSERT INTO platform.organization_memberships (organization_id, user_id, role, status, source)
         VALUES ($1, $2, 'member', $3, 'workos_sync')`,
        [org.rows[0].id, user.rows[0].id, opts.membershipStatus ?? 'active'],
      );
      return { workosUserId, workosOrgId, orgId: org.rows[0].id };
    }

    async function entitle(orgId: string, product: string, status: string, window: { starts?: string; expires?: string } = {}) {
      await db().pool.query(
        `INSERT INTO platform.organization_product_entitlements (organization_id, product, status, starts_at, expires_at)
         VALUES ($1, $2, $3, COALESCE($4::timestamptz, now()), $5::timestamptz)`,
        [orgId, product, status, window.starts ?? null, window.expires ?? null],
      );
    }

    async function states(f: Fixture): Promise<Record<string, string>> {
      const { rows } = await db().pool.query(
        'SELECT product, access_state FROM platform_api.product_access_v1 WHERE workos_user_id = $1 AND workos_organization_id = $2',
        [f.workosUserId, f.workosOrgId],
      );
      return Object.fromEntries(rows.map((row) => [row.product, row.access_state]));
    }

    dbIt('Guard + Vault: enabled and pilot entitlements are granted; Assets stays unavailable', async () => {
      const f = await member();
      await entitle(f.orgId, 'rwa_guard', 'enabled');
      await entitle(f.orgId, 'vault', 'pilot');
      await entitle(f.orgId, 'assets', 'enabled');
      assert.deepEqual(await states(f), { rwa_guard: 'granted', vault: 'granted', assets: 'product_unavailable' });
    });

    dbIt('Guard only: Vault is not entitled', async () => {
      const f = await member();
      await entitle(f.orgId, 'rwa_guard', 'enabled');
      const s = await states(f);
      assert.equal(s.rwa_guard, 'granted');
      assert.equal(s.vault, 'not_entitled');
    });

    dbIt('Vault only: Guard is not entitled', async () => {
      const f = await member();
      await entitle(f.orgId, 'vault', 'enabled');
      const s = await states(f);
      assert.equal(s.vault, 'granted');
      assert.equal(s.rwa_guard, 'not_entitled');
    });

    dbIt('disabled, suspended, expired and not-yet-started entitlements deny', async () => {
      const f = await member();
      await entitle(f.orgId, 'rwa_guard', 'disabled');
      await entitle(f.orgId, 'vault', 'suspended');
      const s = await states(f);
      assert.equal(s.rwa_guard, 'not_entitled');
      assert.equal(s.vault, 'entitlement_suspended');

      const expired = await member();
      await entitle(expired.orgId, 'vault', 'pilot', { starts: '2020-01-01T00:00:00Z', expires: '2020-02-01T00:00:00Z' });
      assert.equal((await states(expired)).vault, 'entitlement_expired');

      const future = await member();
      await entitle(future.orgId, 'vault', 'enabled', { starts: '2999-01-01T00:00:00Z' });
      assert.equal((await states(future)).vault, 'entitlement_not_started');
    });

    dbIt('inactive membership, suspended organization and inactive user deny first', async () => {
      const pending = await member({ membershipStatus: 'pending' });
      await entitle(pending.orgId, 'vault', 'enabled');
      assert.equal((await states(pending)).vault, 'membership_inactive');

      const suspended = await member({ orgStatus: 'suspended' });
      await entitle(suspended.orgId, 'vault', 'enabled');
      assert.equal((await states(suspended)).vault, 'organization_inactive');

      const inactiveUser = await member({ userStatus: 'suspended' });
      await entitle(inactiveUser.orgId, 'vault', 'enabled');
      assert.equal((await states(inactiveUser)).vault, 'user_inactive');
    });

    dbIt('a user has no row for an organization they do not belong to', async () => {
      const a = await member();
      const b = await member();
      await entitle(b.orgId, 'vault', 'enabled');
      const { rows } = await db().pool.query(
        'SELECT 1 FROM platform_api.product_access_v1 WHERE workos_user_id = $1 AND workos_organization_id = $2',
        [a.workosUserId, b.workosOrgId],
      );
      assert.equal(rows.length, 0);
    });
  });

  dbIt('the read-only product role can read platform_api views but not platform tables, and cannot write', async (t) => {
    if (!(await readerRoleExists())) {
      t.skip(`role ${READER_ROLE} not present on the test server`);
      return;
    }
    const url = new URL(db().url);
    url.username = READER_ROLE;
    url.password = process.env.PLATFORM_TEST_READER_PASSWORD ?? 'reader';
    const reader = new Client({ connectionString: url.toString() });
    await reader.connect();
    try {
      await reader.query('SELECT count(*) FROM platform_api.product_access_v1');
      await reader.query('SELECT count(*) FROM platform_api.session_revocations_v1');
      await reader.query('SELECT count(*) FROM platform_api.legacy_organization_links_v1');
      await assert.rejects(reader.query('SELECT count(*) FROM platform.legacy_organization_links'), /permission denied/);
      await assert.rejects(reader.query('SELECT count(*) FROM platform.users'), /permission denied/);
      await assert.rejects(
        reader.query("INSERT INTO platform.products (product, display_name, availability, sort_order) VALUES ('x','x','available',1)"),
        /permission denied/,
      );
    } finally {
      await reader.end();
    }
  });
});
