/**
 * Apply (or check) Decoda Platform schema migrations.
 *
 *   npm run platform:migrate            # apply pending migrations
 *   npm run platform:migrate -- --check # exit 1 if anything is pending or drifted
 *
 * Reads DECODA_PLATFORM_DATABASE_URL (the owner / read-write role). Run it
 * before deploying a website release that needs a new migration. After
 * migrating, SELECT on the platform_api views is granted to the read-only role
 * named by DECODA_PLATFORM_READER_ROLE (default decoda_platform_reader) if that
 * role exists.
 */
import { Client } from 'pg';
import { migrationStatus, runMigrations } from '../../lib/platform/migrations';

async function main(): Promise<number> {
  const url = (process.env.DECODA_PLATFORM_DATABASE_URL ?? '').trim();
  if (!url) {
    console.error('DECODA_PLATFORM_DATABASE_URL is not set.');
    return 2;
  }
  const client = new Client({ connectionString: url, application_name: 'decoda-platform-migrate' });
  await client.connect();
  try {
    if (process.argv.includes('--check')) {
      const status = await migrationStatus(client);
      console.log(`applied=${status.applied.length} pending=${JSON.stringify(status.pending)} drifted=${JSON.stringify(status.drifted)}`);
      return status.pending.length || status.drifted.length ? 1 : 0;
    }
    const readerRole = (process.env.DECODA_PLATFORM_READER_ROLE ?? 'decoda_platform_reader').trim();
    const applied = await runMigrations(client, { readerRole });
    console.log(`applied ${applied.length} migration(s): ${JSON.stringify(applied)}`);
    return 0;
  } finally {
    await client.end();
  }
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(`migration failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  },
);
