/**
 * Read models for the platform admin console. Admin-only surfaces: callers
 * must have passed the admin gate. Raw WorkOS ids are shown only here
 * (internal diagnostics), never on customer-facing pages.
 */
import type { DbClient } from './db';
import type { ProductKey } from './products';

export interface AdminOverview {
  pendingRequests: number;
  organizations: { active: number; suspended: number; unlinked: number };
  openInvitations: number;
  failedWebhooks: number;
}

export async function adminOverview(client: DbClient): Promise<AdminOverview> {
  const { rows } = await client.query<{
    pending: number;
    active: number;
    suspended: number;
    unlinked: number;
    invitations: number;
    failed_webhooks: number;
  }>(`
    SELECT
      (SELECT count(*)::int FROM platform.pilot_requests WHERE status = 'pending') AS pending,
      (SELECT count(*)::int FROM platform.organizations WHERE status = 'active' AND NOT is_internal) AS active,
      (SELECT count(*)::int FROM platform.organizations WHERE status = 'suspended') AS suspended,
      (SELECT count(*)::int FROM platform.organizations WHERE workos_organization_id IS NULL AND status = 'active') AS unlinked,
      (SELECT count(*)::int FROM platform.invitations WHERE state = 'pending' AND (expires_at IS NULL OR expires_at > now())) AS invitations,
      (SELECT count(*)::int FROM platform.workos_events WHERE status = 'failed') AS failed_webhooks`);
  const row = rows[0]!;
  return {
    pendingRequests: row.pending,
    organizations: { active: row.active, suspended: row.suspended, unlinked: row.unlinked },
    openInvitations: row.invitations,
    failedWebhooks: row.failed_webhooks,
  };
}

export interface AdminOrganizationRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  website: string | null;
  workos_organization_id: string | null;
  active_members: number;
  entitlements: Array<{ product: ProductKey; status: string; plan: string; expires_at: string | null }>;
  created_at: Date;
}

const ORG_SELECT = `
  SELECT o.id, o.name, o.slug, o.status, o.website, o.workos_organization_id, o.created_at,
         (SELECT count(*)::int FROM platform.organization_memberships m WHERE m.organization_id = o.id AND m.status = 'active') AS active_members,
         COALESCE((SELECT jsonb_agg(jsonb_build_object('product', e.product, 'status', e.status, 'plan', e.plan, 'expires_at', e.expires_at)
                                    ORDER BY e.product)
                     FROM platform.organization_product_entitlements e WHERE e.organization_id = o.id), '[]'::jsonb) AS entitlements
    FROM platform.organizations o`;

export async function listOrganizations(client: DbClient): Promise<AdminOrganizationRow[]> {
  const { rows } = await client.query<AdminOrganizationRow>(`${ORG_SELECT} ORDER BY o.created_at DESC LIMIT 500`);
  return rows;
}

export interface AdminOrganizationDetail extends AdminOrganizationRow {
  members: Array<{ email: string; name: string | null; role: string; status: string; source: string }>;
  invitations: Array<{
    id: string;
    email: string;
    role: string;
    state: string;
    expires_at: Date | null;
    created_at: Date;
    invited_by: string | null;
    failure_code: string | null;
  }>;
  pilotRequests: Array<{ id: string; email: string; status: string; created_at: Date }>;
}

export async function getOrganizationDetail(client: DbClient, id: string): Promise<AdminOrganizationDetail | null> {
  const org = await client.query<AdminOrganizationRow>(`${ORG_SELECT} WHERE o.id = $1`, [id]);
  if (!org.rows[0]) return null;
  const members = await client.query(
    `SELECT u.email, nullif(btrim(concat_ws(' ', u.first_name, u.last_name)), '') AS name, m.role, m.status, m.source
       FROM platform.organization_memberships m JOIN platform.users u ON u.id = m.user_id
      WHERE m.organization_id = $1 ORDER BY m.status, u.email`,
    [id],
  );
  const invitations = await client.query(
    `SELECT i.id, i.email, i.role,
            CASE WHEN i.state = 'pending' AND i.expires_at IS NOT NULL AND i.expires_at <= now() THEN 'expired' ELSE i.state END AS state,
            i.expires_at, i.created_at, inviter.email AS invited_by, i.failure_code
       FROM platform.invitations i LEFT JOIN platform.users inviter ON inviter.id = i.invited_by_user_id
      WHERE i.organization_id = $1 ORDER BY i.created_at DESC LIMIT 100`,
    [id],
  );
  const pilotRequests = await client.query(
    'SELECT id, email, status, created_at FROM platform.pilot_requests WHERE organization_id = $1 ORDER BY created_at DESC',
    [id],
  );
  return {
    ...org.rows[0],
    members: members.rows,
    invitations: invitations.rows,
    pilotRequests: pilotRequests.rows,
  };
}

export interface AdminAuditRow {
  seq: string;
  occurred_at: Date;
  actor_type: string;
  actor_label: string | null;
  action: string;
  result: string;
  organization_name: string | null;
  target_type: string | null;
  target_id: string | null;
  request_id: string | null;
}

export async function listAuditEvents(client: DbClient, limit = 200): Promise<AdminAuditRow[]> {
  const { rows } = await client.query<AdminAuditRow>(
    `SELECT a.seq::text, a.occurred_at, a.actor_type, a.actor_label, a.action, a.result, o.name AS organization_name,
            a.target_type, a.target_id, a.request_id
       FROM platform.audit_events a LEFT JOIN platform.organizations o ON o.id = a.organization_id
      ORDER BY a.seq DESC LIMIT $1`,
    [Math.max(1, Math.min(limit, 1000))],
  );
  return rows;
}
