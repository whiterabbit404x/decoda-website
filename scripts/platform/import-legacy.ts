/**
 * Import a product's reviewed legacy-account manifest (operator CLI).
 *
 *   # 1. Dry run (default): reads the platform database only, calls nothing.
 *   npm run platform:import-legacy -- --product rwa_guard --manifest manifest.json [--report plan.json]
 *
 *   # 2. Apply, as an accountable platform admin:
 *   npm run platform:import-legacy -- --product rwa_guard --manifest manifest.json --apply \
 *       --admin-workos-user-id user_01... --operator "Jane Ops" --reason "RWA Guard cutover" [--report result.json]
 *
 * The manifest comes from the product's read-only export (RWA Guard:
 * `python -m services.api.scripts.identity_migration_export --out manifest.json`).
 * Conflicts and skipped accounts are printed and NEVER applied. Re-running
 * `--apply` is safe: it continues where the last run stopped (retries failed
 * invitations, invites people into further organizations once their primary
 * link is bound) and never duplicates an organization or an invitation.
 *
 * Needs DECODA_PLATFORM_DATABASE_URL (owner role); `--apply` also needs the
 * Website application's WORKOS_CLIENT_ID and WORKOS_API_KEY.
 */
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { Pool } from 'pg';
import { invitationExpiresInDays } from '../../lib/platform/config';
import { PlatformError } from '../../lib/platform/errors';
import {
  applyImport,
  importActor,
  LEGACY_PRODUCTS,
  ManifestError,
  parseManifest,
  planImport,
  type ImportPlan,
  type LegacyProduct,
} from '../../lib/platform/legacy-import';
import { createWorkOSGateway } from '../../lib/platform/workos';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function printPlan(plan: ImportPlan): void {
  console.log(`manifest sha256=${plan.digest} product=${plan.product}`);
  console.log('\nOrganizations');
  for (const org of plan.organizations) {
    console.log(`  ${org.action.padEnd(15)} ${org.legacyOrganizationId}  ${org.name}${org.reason ? `  (${org.reason})` : ''}`);
  }
  console.log('\nAccounts');
  for (const user of plan.users) {
    const detail = user.reasons.length ? `  (${user.reasons.join(', ')})` : '';
    console.log(`  ${user.action.padEnd(16)} ${user.legacyUserId}  ${user.email}${user.role ? `  role=${user.role}` : ''}${detail}`);
    for (const secondary of user.secondary) {
      console.log(`  ${''.padEnd(16)}   + ${secondary.action.padEnd(15)} organization ${secondary.legacyOrganizationId}${secondary.reason ? `  (${secondary.reason})` : ''}`);
    }
  }
  console.log('\nSummary');
  for (const [key, value] of Object.entries(plan.summary).sort()) console.log(`  ${key}=${value}`);
}

async function main(): Promise<number> {
  const url = (process.env.DECODA_PLATFORM_DATABASE_URL ?? '').trim();
  const product = arg('product') as LegacyProduct | undefined;
  const manifestPath = arg('manifest');
  const apply = process.argv.includes('--apply');
  if (!url) {
    console.error('DECODA_PLATFORM_DATABASE_URL is not set.');
    return 2;
  }
  if (!product || !(LEGACY_PRODUCTS as readonly string[]).includes(product) || !manifestPath) {
    console.error(`Required: --product ${LEGACY_PRODUCTS.join('|')} --manifest <file>`);
    return 2;
  }
  let parsed;
  try {
    parsed = parseManifest(readFileSync(manifestPath), product);
  } catch (error) {
    console.error(`invalid manifest: ${error instanceof ManifestError ? error.message : String(error)}`);
    return 3;
  }

  const pool = new Pool({ connectionString: url, max: 2, application_name: 'decoda-platform-import-legacy' });
  try {
    const plan = await planImport(pool, parsed.manifest, parsed.digest);
    printPlan(plan);
    const report: Record<string, unknown> = { plan };
    if (!apply) {
      console.log('\nDry run: nothing was changed. Review the plan, then re-run with --apply.');
      if (arg('report')) writeFileSync(arg('report')!, `${JSON.stringify(report, null, 2)}\n`);
      return 0;
    }

    const adminId = arg('admin-workos-user-id');
    const operator = arg('operator');
    const reason = arg('reason');
    if (!adminId || !/^user_[A-Za-z0-9]+$/.test(adminId) || !operator || !reason) {
      console.error('--apply requires --admin-workos-user-id user_..., --operator "<your name>" and --reason "<why>".');
      return 2;
    }
    const clientId = (process.env.WORKOS_CLIENT_ID ?? '').trim();
    const apiKey = (process.env.WORKOS_API_KEY ?? '').trim();
    if (!clientId || !apiKey) {
      console.error('--apply requires WORKOS_CLIENT_ID and WORKOS_API_KEY (the Website application).');
      return 2;
    }
    const ctx = await importActor(pool, adminId, `import_${randomBytes(8).toString('hex')}`);
    const deps = { pool, gateway: createWorkOSGateway({ apiKey, clientId }), invitationExpiresInDays: invitationExpiresInDays() };
    const result = await applyImport(ctx, deps, parsed.manifest, plan, { label: `operator:${operator}`, reason });
    report.result = result;
    console.log(
      `\napplied: organizations_created=${result.organizationsCreated} workos_linked=${result.organizationsLinkedToWorkOS} ` +
        `identity_links_created=${result.identityLinksCreated} invitations_sent=${result.invitationsSent} failures=${result.failures.length}`,
    );
    for (const item of result.failures) console.log(`  FAILED ${item.subject}: ${item.code} ${item.message}`);
    if (arg('report')) writeFileSync(arg('report')!, `${JSON.stringify(report, null, 2)}\n`);
    return result.failures.length ? 1 : 0;
  } finally {
    await pool.end();
  }
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error instanceof PlatformError ? `${error.code}: ${error.message}` : error instanceof Error ? error.message : String(error));
    process.exit(1);
  },
);
