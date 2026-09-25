/**
 * Grant, revoke or list Decoda platform-admin permissions (operator CLI).
 *
 *   npm run platform:grant-admin -- --workos-user-id user_01... --operator "Jane Ops" \
 *       --reason "Founding platform admin" [--permissions a,b,c]
 *   npm run platform:grant-admin -- --revoke --workos-user-id user_01... --operator "Jane Ops" --reason "Left team"
 *   npm run platform:grant-admin -- --list
 *
 * The person must have signed in at www once (so a platform user exists).
 * Default permissions: all platform permissions. Every change is audited with
 * actor_type = operator.
 */
import { Pool } from 'pg';
import { grantPlatformAdmin, isPlatformPermission, PLATFORM_PERMISSIONS, revokePlatformAdmin } from '../../lib/platform/admin-grants';
import { withTransaction } from '../../lib/platform/db';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<number> {
  const url = (process.env.DECODA_PLATFORM_DATABASE_URL ?? '').trim();
  if (!url) {
    console.error('DECODA_PLATFORM_DATABASE_URL is not set.');
    return 2;
  }
  const pool = new Pool({ connectionString: url, max: 1, application_name: 'decoda-platform-grant-admin' });
  try {
    if (process.argv.includes('--list')) {
      const { rows } = await pool.query(
        `SELECT u.workos_user_id, u.email, g.permissions, g.granted_by, g.granted_at
           FROM platform.platform_admin_grants g JOIN platform.users u ON u.id = g.user_id
          WHERE g.revoked_at IS NULL ORDER BY g.granted_at`,
      );
      console.table(rows);
      return 0;
    }
    const workosUserId = arg('workos-user-id');
    const operator = arg('operator');
    const reason = arg('reason');
    if (!workosUserId || !/^user_[A-Za-z0-9]+$/.test(workosUserId) || !operator || !reason) {
      console.error('Required: --workos-user-id user_..., --operator "<your name>", --reason "<why>"');
      return 2;
    }
    if (process.argv.includes('--revoke')) {
      const revoked = await withTransaction((client) => revokePlatformAdmin(client, workosUserId, operator, reason), pool);
      console.log(revoked ? 'revoked' : 'no active grant for that user');
      return revoked ? 0 : 1;
    }
    const requested = (arg('permissions') ?? PLATFORM_PERMISSIONS.join(',')).split(',').map((p) => p.trim()).filter(Boolean);
    const invalid = requested.filter((p) => !isPlatformPermission(p));
    if (invalid.length) {
      console.error(`Unknown permission(s): ${invalid.join(', ')}. Valid: ${PLATFORM_PERMISSIONS.join(', ')}`);
      return 2;
    }
    const grantId = await withTransaction(
      (client) =>
        grantPlatformAdmin(client, {
          workosUserId,
          permissions: requested.filter(isPlatformPermission),
          grantedBy: `operator:${operator}`,
          reason,
        }),
      pool,
    );
    console.log(`granted ${requested.length} permission(s); grant ${grantId}`);
    return 0;
  } finally {
    await pool.end();
  }
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  },
);
