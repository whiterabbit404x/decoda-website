/**
 * SQL migration runner for the Decoda Platform schema (`platform` +
 * `platform_api`).
 *
 * Mirrors the runners in Decoda Vault and RWA Guard: numbered
 * `platform/migrations/*.sql` files applied in order, each in its own
 * transaction, serialised across processes by a Postgres advisory lock. An
 * already-applied migration whose file content changed is reported as drift
 * and refused — a silently edited migration means production and a fresh
 * database no longer have the same schema.
 *
 * After migrating, SELECT on the `platform_api` views is (re)granted to the
 * read-only product role when that role exists, so a role created after the
 * first deploy picks up the contract on the next run.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { Client, PoolClient } from 'pg';

export const MIGRATIONS_DIR = path.resolve(__dirname, '..', '..', 'platform', 'migrations');

// Distinct from the Vault and RWA Guard lock keys so all three runners can
// share a database cluster.
const LOCK_KEY = 0x0dec0da_91a7;

const FILE_RE = /^\d{4}_[a-z0-9_]+\.sql$/;
const ROLE_RE = /^[a-z_][a-z0-9_]{0,62}$/;

export class MigrationDriftError extends Error {}

type Queryable = Pick<Client | PoolClient, 'query'>;

export interface MigrationFile {
  name: string;
  checksum: string;
  sql: string;
}

export function migrationFiles(dir: string = MIGRATIONS_DIR): MigrationFile[] {
  return readdirSync(dir)
    .filter((name) => FILE_RE.test(name))
    .sort()
    .map((name) => {
      const sql = readFileSync(path.join(dir, name), 'utf8');
      return { name, sql, checksum: createHash('sha256').update(sql, 'utf8').digest('hex') };
    });
}

async function ensureLedger(db: Queryable): Promise<void> {
  await db.query('CREATE SCHEMA IF NOT EXISTS platform');
  await db.query(`
    CREATE TABLE IF NOT EXISTS platform.schema_migrations (
      version TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function applied(db: Queryable): Promise<Map<string, string>> {
  const { rows } = await db.query<{ version: string; checksum: string }>(
    'SELECT version, checksum FROM platform.schema_migrations',
  );
  return new Map(rows.map((row) => [row.version, row.checksum]));
}

export interface MigrationStatus {
  applied: string[];
  pending: string[];
  drifted: string[];
}

export async function migrationStatus(db: Queryable, dir?: string): Promise<MigrationStatus> {
  await ensureLedger(db);
  const done = await applied(db);
  const pending: string[] = [];
  const drifted: string[] = [];
  for (const file of migrationFiles(dir)) {
    const checksum = done.get(file.name);
    if (checksum === undefined) pending.push(file.name);
    else if (checksum !== file.checksum) drifted.push(file.name);
  }
  return { applied: [...done.keys()].sort(), pending, drifted };
}

/** Grant the read-only product contract to `role` if it exists. Idempotent. */
export async function grantReaderRole(db: Queryable, role: string): Promise<boolean> {
  if (!ROLE_RE.test(role)) throw new Error(`Invalid reader role name: ${role}`);
  const { rows } = await db.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [role]);
  if (rows.length === 0) return false;
  // The role name was validated against a strict identifier pattern above, so
  // quoting it as an identifier is safe.
  await db.query(`GRANT USAGE ON SCHEMA platform_api TO "${role}"`);
  await db.query(`GRANT SELECT ON ALL TABLES IN SCHEMA platform_api TO "${role}"`);
  await db.query(`REVOKE ALL ON SCHEMA platform FROM "${role}"`);
  return true;
}

export async function runMigrations(
  db: Client | PoolClient,
  options: { dir?: string; readerRole?: string } = {},
): Promise<string[]> {
  const appliedNow: string[] = [];
  await db.query('SELECT pg_advisory_lock($1)', [LOCK_KEY]);
  try {
    await ensureLedger(db);
    const done = await applied(db);
    for (const file of migrationFiles(options.dir)) {
      const checksum = done.get(file.name);
      if (checksum !== undefined) {
        if (checksum !== file.checksum) {
          throw new MigrationDriftError(`${file.name} was modified after it was applied (checksum mismatch).`);
        }
        continue;
      }
      await db.query('BEGIN');
      try {
        await db.query(file.sql);
        await db.query('INSERT INTO platform.schema_migrations (version, checksum) VALUES ($1, $2)', [
          file.name,
          file.checksum,
        ]);
        await db.query('COMMIT');
      } catch (error) {
        await db.query('ROLLBACK');
        throw error;
      }
      appliedNow.push(file.name);
    }
    if (options.readerRole) await grantReaderRole(db, options.readerRole);
  } finally {
    await db.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]);
  }
  return appliedNow;
}
