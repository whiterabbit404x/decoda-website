import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ApprovalForm, RejectForm } from '@/components/platform/admin-actions';
import { AdminForbidden, AdminFrame, AdminUnavailable, formatDate } from '@/components/platform/admin-chrome';
import styles from '@/components/platform/platform.module.css';
import { hasPermission } from '@/lib/platform/admin-grants';
import { gateAdminPage } from '@/lib/platform/admin-server';
import { withClient } from '@/lib/platform/db';
import { getPilotRequest, productListText } from '@/lib/platform/pilot-requests';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Decoda | Pilot request', robots: { index: false, follow: false } };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PilotRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const gate = await gateAdminPage('platform.pilot_requests.read', `/admin/pilot-requests/${id}`);
  if (gate.kind === 'forbidden') return <AdminForbidden />;
  if (gate.kind === 'unavailable') return <AdminUnavailable />;
  let data;
  try {
    data = await withClient(async (client) => ({
      request: await getPilotRequest(client, id),
      organizations: (
        await client.query<{ id: string; name: string }>(
          "SELECT id, name FROM platform.organizations WHERE status = 'active' AND NOT is_internal ORDER BY name LIMIT 500",
        )
      ).rows,
    }));
  } catch {
    return <AdminUnavailable />;
  }
  const request = data.request;
  if (!request) notFound();
  const canReview =
    hasPermission(gate.actor.grant, 'platform.pilot_requests.review') &&
    hasPermission(gate.actor.grant, 'platform.organizations.manage') &&
    hasPermission(gate.actor.grant, 'platform.entitlements.manage') &&
    hasPermission(gate.actor.grant, 'platform.invitations.manage');
  const notifications = (request.metadata as { notifications?: { internal?: string; confirmation?: string } }).notifications;

  return (
    <AdminFrame current="/admin/pilot-requests" title={request.company_name} description={`Pilot request · ${request.status}`}>
      <div className={styles.twoColumn}>
        <section className={styles.panel} aria-labelledby="request-details">
          <h2 id="request-details">Request</h2>
          <dl className={styles.definitionList}>
            <dt>Contact</dt>
            <dd>
              {request.full_name} · {request.role}
            </dd>
            <dt>Work email</dt>
            <dd>
              {request.email}{' '}
              {(request.metadata as { free_mail_domain?: boolean }).free_mail_domain ? (
                <span className={styles.badge} data-tone="warn">
                  Consumer mailbox
                </span>
              ) : null}
            </dd>
            <dt>Company website</dt>
            {/* Shown as text, never as a link: it is unverified applicant input. */}
            <dd>{request.company_website ?? '—'}</dd>
            <dt>Products</dt>
            <dd>{productListText(request.requested_products)}</dd>
            <dt>Team size</dt>
            <dd>{request.team_size ?? '—'}</dd>
            <dt>Primary use case</dt>
            <dd style={{ whiteSpace: 'pre-wrap' }}>{request.use_case ?? '—'}</dd>
            <dt>Notes</dt>
            <dd style={{ whiteSpace: 'pre-wrap' }}>{request.notes ?? '—'}</dd>
            <dt>Received</dt>
            <dd>{formatDate(request.created_at)}</dd>
            <dt>Reference</dt>
            <dd>{request.request_id}</dd>
            <dt>Notifications</dt>
            <dd>
              Internal: {notifications?.internal ?? 'unknown'} · Applicant confirmation: {notifications?.confirmation ?? 'unknown'}
            </dd>
            {request.status !== 'pending' ? (
              <>
                <dt>Reviewed</dt>
                <dd>
                  {formatDate(request.reviewed_at)} by {request.reviewer_email ?? 'unknown'}
                </dd>
                {request.review_note ? (
                  <>
                    <dt>Internal note</dt>
                    <dd style={{ whiteSpace: 'pre-wrap' }}>{request.review_note}</dd>
                  </>
                ) : null}
                {request.organization_id ? (
                  <>
                    <dt>Organization</dt>
                    <dd>
                      <Link href={`/admin/organizations/${request.organization_id}`}>{request.organization_name}</Link>
                    </dd>
                  </>
                ) : null}
              </>
            ) : null}
          </dl>
        </section>

        {request.status === 'pending' ? (
          canReview ? (
            <div className={styles.formGrid}>
              <section className={styles.panel} aria-labelledby="approve">
                <h2 id="approve">Approve</h2>
                <p>Creates or links the organization, enables products and invites the organization admin through WorkOS.</p>
                <div style={{ marginTop: 16 }}>
                  <ApprovalForm
                    requestId={request.id}
                    csrfToken={gate.csrfToken}
                    company={request.company_name}
                    email={request.email}
                    requestedProducts={request.requested_products}
                    organizations={data.organizations}
                  />
                </div>
              </section>
              <section className={styles.panel} aria-labelledby="reject">
                <h2 id="reject">Reject</h2>
                <div style={{ marginTop: 12 }}>
                  <RejectForm requestId={request.id} csrfToken={gate.csrfToken} />
                </div>
              </section>
            </div>
          ) : (
            <section className={styles.panel}>
              <h2>Review</h2>
              <p>Your platform permissions allow viewing requests but not approving or rejecting them.</p>
            </section>
          )
        ) : null}
      </div>
    </AdminFrame>
  );
}
