import type { Metadata } from 'next';
import { AdminForbidden, AdminFrame, AdminUnavailable, formatDate } from '@/components/platform/admin-chrome';
import styles from '@/components/platform/platform.module.css';
import { listAuditEvents } from '@/lib/platform/admin-queries';
import { gateAdminPage } from '@/lib/platform/admin-server';
import { withClient } from '@/lib/platform/db';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Decoda | Audit trail', robots: { index: false, follow: false } };

export default async function AuditPage() {
  const gate = await gateAdminPage('platform.audit.read', '/admin/audit');
  if (gate.kind === 'forbidden') return <AdminForbidden />;
  if (gate.kind === 'unavailable') return <AdminUnavailable />;
  let data;
  try {
    data = await withClient(async (client) => ({
      events: await listAuditEvents(client),
      broken: (await client.query<{ broken: string | null }>('SELECT platform.verify_audit_chain()::text AS broken')).rows[0]?.broken ?? null,
    }));
  } catch {
    return <AdminUnavailable />;
  }
  return (
    <AdminFrame current="/admin/audit" title="Audit trail" description="Append-only and hash-chained. Credentials, tokens and secrets are never recorded.">
      <p className={data.broken ? `${styles.notice} ${styles.noticeDanger}` : styles.notice} role="status">
        {data.broken ? `Chain verification FAILED at sequence ${data.broken}. Investigate immediately.` : 'Chain verified: every event links to its predecessor.'}
      </p>
      <section className={styles.panel}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">When</th>
                <th scope="col">Actor</th>
                <th scope="col">Action</th>
                <th scope="col">Result</th>
                <th scope="col">Organization</th>
                <th scope="col">Reference</th>
              </tr>
            </thead>
            <tbody>
              {data.events.map((event) => (
                <tr key={event.seq}>
                  <td>{event.seq}</td>
                  <td>{formatDate(event.occurred_at)}</td>
                  <td>
                    {event.actor_type}
                    {event.actor_label ? <span className={styles.muted}> · {event.actor_label}</span> : null}
                  </td>
                  <td>{event.action}</td>
                  <td>{event.result}</td>
                  <td>{event.organization_name ?? '—'}</td>
                  <td className={styles.muted}>{event.request_id ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AdminFrame>
  );
}
