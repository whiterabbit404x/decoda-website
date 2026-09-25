import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminForbidden, AdminFrame, AdminUnavailable, formatDate } from '@/components/platform/admin-chrome';
import styles from '@/components/platform/platform.module.css';
import { gateAdminPage } from '@/lib/platform/admin-server';
import { withClient } from '@/lib/platform/db';
import { listPilotRequests, productListText } from '@/lib/platform/pilot-requests';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Decoda | Pilot requests', robots: { index: false, follow: false } };

const FILTERS = ['pending', 'approved', 'converted', 'rejected'] as const;

export default async function PilotRequestsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const gate = await gateAdminPage('platform.pilot_requests.read', '/admin/pilot-requests');
  if (gate.kind === 'forbidden') return <AdminForbidden />;
  if (gate.kind === 'unavailable') return <AdminUnavailable />;
  const { status } = await searchParams;
  const filter = (FILTERS as readonly string[]).includes(status ?? '') ? status! : null;
  let rows;
  try {
    rows = await withClient((client) => listPilotRequests(client, filter));
  } catch {
    return <AdminUnavailable />;
  }
  return (
    <AdminFrame current="/admin/pilot-requests" title="Pilot requests" description="Every request is reviewed by a person. Nothing is provisioned until you approve it.">
      <nav className={styles.adminNav} aria-label="Filter by status">
        <Link href="/admin/pilot-requests" aria-current={filter === null ? 'page' : undefined}>
          All
        </Link>
        {FILTERS.map((value) => (
          <Link key={value} href={`/admin/pilot-requests?status=${value}`} aria-current={filter === value ? 'page' : undefined}>
            {value[0]!.toUpperCase() + value.slice(1)}
          </Link>
        ))}
      </nav>
      <section className={styles.panel}>
        {rows.length === 0 ? (
          <p>No requests match this filter.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Company</th>
                  <th scope="col">Contact</th>
                  <th scope="col">Products</th>
                  <th scope="col">Status</th>
                  <th scope="col">Received</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/admin/pilot-requests/${row.id}`}>{row.company_name}</Link>
                    </td>
                    <td>
                      {row.full_name}
                      <br />
                      <span className={styles.muted}>{row.email}</span>
                    </td>
                    <td>{productListText(row.requested_products)}</td>
                    <td>
                      <span className={styles.badge} data-tone={row.status === 'pending' ? 'pilot' : row.status === 'rejected' ? 'danger' : 'open'}>
                        {row.status}
                      </span>
                    </td>
                    <td>{formatDate(row.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminFrame>
  );
}
