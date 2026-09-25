import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  EntitlementEditor,
  InvitationActions,
  InviteForm,
  LinkOrganizationButton,
  OrganizationStatusForm,
} from '@/components/platform/admin-actions';
import { AdminForbidden, AdminFrame, AdminUnavailable, formatDate } from '@/components/platform/admin-chrome';
import styles from '@/components/platform/platform.module.css';
import { hasPermission } from '@/lib/platform/admin-grants';
import { getOrganizationDetail } from '@/lib/platform/admin-queries';
import { gateAdminPage } from '@/lib/platform/admin-server';
import { withClient } from '@/lib/platform/db';
import { PRODUCT_LABELS } from '@/lib/platform/products';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Decoda | Organization', robots: { index: false, follow: false } };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function OrganizationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const gate = await gateAdminPage('platform.organizations.read', `/admin/organizations/${id}`);
  if (gate.kind === 'forbidden') return <AdminForbidden />;
  if (gate.kind === 'unavailable') return <AdminUnavailable />;
  let org;
  try {
    org = await withClient((client) => getOrganizationDetail(client, id));
  } catch {
    return <AdminUnavailable />;
  }
  if (!org) notFound();
  const can = (permission: Parameters<typeof hasPermission>[1]) => hasPermission(gate.actor.grant, permission);

  return (
    <AdminFrame current="/admin/organizations" title={org.name} description={`Organization · ${org.status} · ${org.slug}`}>
      <div className={styles.twoColumn}>
        <section className={styles.panel} aria-labelledby="entitlements">
          <h2 id="entitlements">Product entitlements</h2>
          <p>Enforced server-side by every product on every request. Assets can be recorded but grants nothing until it launches.</p>
          <div style={{ marginTop: 14 }}>
            {can('platform.entitlements.manage') ? (
              <EntitlementEditor organizationId={org.id} csrfToken={gate.csrfToken} entitlements={org.entitlements} />
            ) : (
              <ul className={styles.orgList}>
                {org.entitlements.map((e) => (
                  <li key={e.product} className={styles.orgItem}>
                    {PRODUCT_LABELS[e.product]} <span className={styles.badge}>{e.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className={styles.panel} aria-labelledby="identity">
          <h2 id="identity">Identity &amp; status</h2>
          <dl className={styles.definitionList}>
            <dt>WorkOS organization</dt>
            <dd>{org.workos_organization_id ?? 'Not linked'}</dd>
            <dt>Status</dt>
            <dd>{org.status}</dd>
            <dt>Website</dt>
            <dd>{org.website ?? '—'}</dd>
            <dt>Created</dt>
            <dd>{formatDate(org.created_at)}</dd>
          </dl>
          {can('platform.organizations.manage') ? (
            <div className={styles.formGrid} style={{ marginTop: 16 }}>
              {!org.workos_organization_id && org.status === 'active' ? (
                <LinkOrganizationButton organizationId={org.id} csrfToken={gate.csrfToken} />
              ) : null}
              <OrganizationStatusForm organizationId={org.id} status={org.status} csrfToken={gate.csrfToken} />
            </div>
          ) : null}
        </section>
      </div>

      <section className={styles.panel} aria-labelledby="members">
        <h2 id="members">Members</h2>
        <p>Memberships come only from WorkOS (accepted invitations or directory provisioning) — never from an email domain.</p>
        <div className={styles.tableWrap} style={{ marginTop: 12 }}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Member</th>
                <th scope="col">Organization role</th>
                <th scope="col">Status</th>
                <th scope="col">Source</th>
              </tr>
            </thead>
            <tbody>
              {org.members.length === 0 ? (
                <tr>
                  <td colSpan={4}>No members yet.</td>
                </tr>
              ) : (
                org.members.map((member) => (
                  <tr key={member.email}>
                    <td>
                      {member.name ?? member.email}
                      <br />
                      <span className={styles.muted}>{member.email}</span>
                    </td>
                    <td>{member.role}</td>
                    <td>{member.status}</td>
                    <td>{member.source}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className={styles.twoColumn}>
        <section className={styles.panel} aria-labelledby="invitations">
          <h2 id="invitations">Invitations</h2>
          <div className={styles.tableWrap} style={{ marginTop: 12 }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Email</th>
                  <th scope="col">Role</th>
                  <th scope="col">State</th>
                  <th scope="col">Expires</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {org.invitations.length === 0 ? (
                  <tr>
                    <td colSpan={5}>No invitations.</td>
                  </tr>
                ) : (
                  org.invitations.map((invitation) => (
                    <tr key={invitation.id}>
                      <td>
                        {invitation.email}
                        {invitation.invited_by ? (
                          <>
                            <br />
                            <span className={styles.muted}>by {invitation.invited_by}</span>
                          </>
                        ) : null}
                      </td>
                      <td>{invitation.role}</td>
                      <td>
                        {invitation.state}
                        {invitation.failure_code ? <span className={styles.muted}> ({invitation.failure_code})</span> : null}
                      </td>
                      <td>{formatDate(invitation.expires_at)}</td>
                      <td>
                        {can('platform.invitations.manage') ? (
                          <InvitationActions invitationId={invitation.id} state={invitation.state} csrfToken={gate.csrfToken} />
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
        {can('platform.invitations.manage') && org.status === 'active' ? (
          <section className={styles.panel} aria-labelledby="invite">
            <h2 id="invite">Invite someone</h2>
            {org.workos_organization_id ? (
              <div style={{ marginTop: 12 }}>
                <InviteForm organizationId={org.id} csrfToken={gate.csrfToken} />
              </div>
            ) : (
              <p>Link the organization to WorkOS before inviting anyone.</p>
            )}
          </section>
        ) : null}
      </div>

      {org.pilotRequests.length > 0 ? (
        <section className={styles.panel}>
          <h2>Pilot requests</h2>
          <ul className={styles.orgList}>
            {org.pilotRequests.map((request) => (
              <li key={request.id} className={styles.orgItem}>
                <Link href={`/admin/pilot-requests/${request.id}`}>{request.email}</Link>
                <span className={styles.badge}>{request.status}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </AdminFrame>
  );
}
