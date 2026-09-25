/**
 * Decoda Platform database access (server-only).
 *
 * One small `pg` pool per server instance, created lazily from
 * DECODA_PLATFORM_DATABASE_URL. Every write goes through `withTransaction`, so
 * a response can never report success for work that was rolled back, and an
 * audit event is recorded if and only if the change it describes commits.
 *
 * A missing URL is a configuration error, never an in-memory fallback: the
 * callers turn it into a controlled 503 and grant nothing.
 */
import { Pool, type PoolClient } from 'pg';
import { PlatformConfigError } from './errors';

export type DbClient = PoolClient;

const globalPool = globalThis as unknown as { __decodaPlatformPool?: { url: string; pool: Pool } };

export function platformDatabaseUrl(): string {
  const url = (process.env.DECODA_PLATFORM_DATABASE_URL ?? '').trim();
  if (!url) {
    throw new PlatformConfigError(['DECODA_PLATFORM_DATABASE_URL']);
  }
  return url;
}

export function getPool(): Pool {
  const url = platformDatabaseUrl();
  const cached = globalPool.__decodaPlatformPool;
  if (cached && cached.url === url) {
    return cached.pool;
  }
  const pool = new Pool({
    connectionString: url,
    max: Number(process.env.DECODA_PLATFORM_DB_POOL_MAX ?? 5) || 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
    application_name: 'decoda-platform-web',
  });
  // An idle client error (e.g. the server closed the connection) must not crash
  // the process; the pool discards the client and the next query reconnects.
  pool.on('error', () => undefined);
  globalPool.__decodaPlatformPool = { url, pool };
  return pool;
}

export async function closePool(): Promise<void> {
  const cached = globalPool.__decodaPlatformPool;
  globalPool.__decodaPlatformPool = undefined;
  if (cached) await cached.pool.end();
}

/** Run `fn` in one transaction: committed on success, rolled back on any error. */
export async function withTransaction<T>(fn: (client: DbClient) => Promise<T>, pool: Pool = getPool()): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL statement_timeout = '10s'");
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Read-only work outside an explicit transaction. */
export async function withClient<T>(fn: (client: DbClient) => Promise<T>, pool: Pool = getPool()): Promise<T> {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}
