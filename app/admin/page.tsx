import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminForbidden, AdminFrame, AdminUnavailable } from '@/components/platform/admin-chrome';
import styles from '@/components/platform/platform.module.css';
import { adminOverview } from '@/lib/platform/admin-queries';
import { gateAdminPage } from '@/lib/platform/admin-server';
import { withClient } from '@/lib/platform/db';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Decoda | Platform admin', robots: { index: false, follow: false } };

export default async function AdminOverviewPage() {
  const gate = await gateAdminPage('platform.pilot_requests.read', '/admin');
  if (gate.kind === 'forbidden') return <AdminForbidden />;
  if (gate.kind === 'unavailable') return <AdminUnavailable />;
  let overview;
  try {
    overview = await withClient(adminOverview);
  } catch {
    return <AdminUnavailable />;
  }
  const cards = [
    { label: 'Pilot requests awaiting review', value: overview.pendingRequests, href: '/admin/pilot-requests?status=pending' },
    { label: 'Active customer organizations', value: overview.organizations.active, href: '/admin/organizations' },
    { label: 'Suspended organizations', value: overview.organizations.suspended, href: '/admin/organizations' },
    { label: 'Organizations not linked to WorkOS', value: overview.organizations.unlinked, href: '/admin/organizations' },
    { label: 'Open invitations', value: overview.openInvitations, href: '/admin/organizations' },
    { label: 'Failed identity webhooks', value: overview.failedWebhooks, href: '/admin/audit' },
  ];
  return (
    <AdminFrame current="/admin" title="Overview" description="Review pilot requests, provision organizations and products, and manage invitations.">
      <section className={styles.productGrid} aria-label="Platform summary">
        {cards.map((card) => (
          <Link key={card.label} href={card.href} className={styles.productCard} style={{ minHeight: 0 }}>
            <p className="eyebrow">{card.label}</p>
            <h3 style={{ fontSize: '2rem' }}>{card.value}</h3>
          </Link>
        ))}
      </section>
    </AdminFrame>
  );
}
