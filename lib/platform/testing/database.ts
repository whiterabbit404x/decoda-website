/**
 * Test-only database harness.
 *
 * Each test file gets its own freshly created and migrated database, so files
 * can run in parallel without sharing state. The server is taken from
 * PLATFORM_TEST_DATABASE_URL (default: the local `decoda` role). When no server
 * is reachable the DB suites are skipped — unless PLATFORM_TEST_REQUIRE_DB=1
 * (set in CI), which turns "skipped" into a hard failure so a missing database
 * can never pass as green.
 */
import { randomBytes } from 'node:crypto';
import { after, before, it, type TestContext } from 'node:test';
import { Client, Pool } from 'pg';
import { runMigrations } from '../migrations';

export const TEST_SERVER_URL =
  process.env.PLATFORM_TEST_DATABASE_URL ?? 'postgresql://decoda:decoda@127.0.0.1:5432/decoda_platform_test';

export interface TestDatabase {
  url: string;
  name: string;
  pool: Pool;
  drop(): Promise<void>;
}

function withDatabase(url: string, database: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

let availability: Promise<boolean> | null = null;

export function databaseAvailable(): Promise<boolean> {
  availability ??= (async () => {
    const client = new Client({ connectionString: TEST_SERVER_URL, connectionTimeoutMillis: 3000 });
    try {
      await client.connect();
      await client.query('SELECT 1');
      return true;
    } catch {
      if (process.env.PLATFORM_TEST_REQUIRE_DB === '1') {
        throw new Error(`PLATFORM_TEST_REQUIRE_DB=1 but no PostgreSQL server is reachable at ${TEST_SERVER_URL}`);
      }
      return false;
    } finally {
      await client.end().catch(() => undefined);
    }
  })();
  return availability;
}

/** A new, migrated database. Call `drop()` in an `after` hook. */
export async function createTestDatabase(options: { readerRole?: string } = {}): Promise<TestDatabase> {
  const name = `decoda_platform_t_${randomBytes(6).toString('hex')}`;
  const admin = new Client({ connectionString: TEST_SERVER_URL });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE ${name}`);
  } finally {
    await admin.end();
  }
  const url = withDatabase(TEST_SERVER_URL, name);
  const migrator = new Client({ connectionString: url });
  await migrator.connect();
  try {
    await runMigrations(migrator, { readerRole: options.readerRole });
  } finally {
    await migrator.end();
  }
  const pool = new Pool({ connectionString: url, max: 4 });
  pool.on('error', () => undefined);
  return {
    url,
    name,
    pool,
    async drop() {
      await pool.end().catch(() => undefined);
      const dropper = new Client({ connectionString: TEST_SERVER_URL });
      await dropper.connect();
      try {
        await dropper.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      } finally {
        await dropper.end();
      }
    },
  };
}

/**
 * Register before/after hooks that create and drop a migrated database for the
 * enclosing suite. The returned getter throws if called when no server exists
 * (use it only inside `dbIt`).
 */
export function useTestDatabase(options: { readerRole?: string } = {}): () => TestDatabase {
  let db: TestDatabase | undefined;
  before(async () => {
    if (await databaseAvailable()) db = await createTestDatabase(options);
  });
  after(async () => {
    await db?.drop();
  });
  return () => {
    if (!db) throw new Error('test database not initialised');
    return db;
  };
}

/**
 * `it()` for DB-backed tests: skipped (at run time) when no server is
 * reachable, failed when PLATFORM_TEST_REQUIRE_DB=1 and none is.
 */
export function dbIt(name: string, fn: (t: TestContext) => Promise<void>): void {
  it(name, async (t) => {
    if (!(await databaseAvailable())) {
      t.skip('no PostgreSQL test server');
      return;
    }
    await fn(t);
  });
}

/** Deterministic fake WorkOS-style identifiers for fixtures. */
export function fakeId(prefix: 'user' | 'org' | 'om' | 'invitation' | 'session' | 'event'): string {
  return `${prefix}_${randomBytes(10).toString('hex').toUpperCase()}`;
}
