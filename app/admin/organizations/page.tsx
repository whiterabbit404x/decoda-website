import type { Metadata } from 'next';
import Link from 'next/link';
import { CreateOrganizationForm } from '@/components/platform/admin-actions';
import { AdminForbidden, AdminFrame, AdminUnavailable, formatDate } from '@/components/platform/admin-chrome';
import styles from '@/components/platform/platform.module.css';
import { hasPermission } from '@/lib/platform/admin-grants';
import { listOrganizations } from '@/lib/platform/admin-queries';
import { gateAdminPage } from '@/lib/platform/admin-server';
import { withClient } from '@/lib/platform/db';
import { PRODUCT_LABELS } from '@/lib/platform/products';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Decoda | Organizations', robots: { index: false, follow: false } };

export default async function OrganizationsPage() {
  const gate = await gateAdminPage('platform.organizations.read', '/admin/organizations');
  if (gate.kind === 'forbidden') return <AdminForbidden />;
  if (gate.kind === 'unavailable') return <AdminUnavailable />;
  let rows;
  try {
    rows = await withClient(listOrganizations);
  } catch {
    return <AdminUnavailable />;
  }
  return (
    <AdminFrame current="/admin/organizations" title="Organizations" description="Customer organizations, their Decoda product entitlements and members.">
      <div className={styles.twoColumn}>
        <section className={styles.panel}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Organization</th>
                  <th scope="col">Status</th>
                  <th scope="col">Products</th>
                  <th scope="col">Members</th>
                  <th scope="col">Created</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((org) => (
                  <tr key={org.id}>
                    <td>
                      <Link href={`/admin/organizations/${org.id}`}>{org.name}</Link>
                      {!org.workos_organization_id ? (
                        <>
                          <br />
                          <span className={styles.badge} data-tone="warn">
                            Not linked to WorkOS
                          </span>
                        </>
                      ) : null}
                    </td>
                    <td>{org.status}</td>
                    <td>
                      {org.entitlements.length === 0
                        ? '—'
                        : org.entitlements.map((e) => `${PRODUCT_LABELS[e.product]}: ${e.status}`).join(', ')}
                    </td>
                    <td>{org.active_members}</td>
                    <td>{formatDate(org.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        {hasPermission(gate.actor.grant, 'platform.organizations.manage') ? (
          <section className={styles.panel} aria-labelledby="create-org">
            <h2 id="create-org">Create organization</h2>
            <p>For customers onboarded without a Pilot request. Products are enabled on the organization page.</p>
            <div style={{ marginTop: 14 }}>
              <CreateOrganizationForm csrfToken={gate.csrfToken} />
            </div>
          </section>
        ) : null}
      </div>
    </AdminFrame>
  );
}
