import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { describe } from 'node:test';
import type { AuthSnapshot } from './actor';
import { resolveActor } from './actor';
import { handleAdminMutation, parseApprovalInput, type AdminApiDeps } from './admin-api';
import { grantPlatformAdmin, PLATFORM_PERMISSIONS, type PlatformPermission } from './admin-grants';
import { issueCsrfToken } from './csrf';
import { withTransaction } from './db';
import { PlatformError } from './errors';
import {
  approvePilotRequest,
  ensureWorkOSOrganization,
  rejectPilotRequest,
  resendInvitation,
  revokeInvitation,
  sendInvitation,
  setEntitlement,
  setOrganizationStatus,
  type AdminContext,
  type ProvisioningDeps,
} from './provisioning';
import { recordWebsiteSignIn } from './sign-in';
import { dbIt, useTestDatabase } from './testing/database';
import { eventPayload, FakeWorkOS, signWebhook, wire } from './testing/fake-workos';
import { handleWorkOSWebhook } from './webhooks';
import type { WorkOSUser } from './workos';

const SECRET = 'a'.repeat(48);
const silent = { warn: () => undefined, error: () => undefined };

describe('platform provisioning and invitations', () => {
  const db = useTestDatabase();

  interface Harness {
    gateway: FakeWorkOS;
    deps: ProvisioningDeps;
    ctx: AdminContext;
    admin: WorkOSUser;
  }

  async function harness(permissions: PlatformPermission[] = [...PLATFORM_PERMISSIONS]): Promise<Harness> {
    const gateway = new FakeWorkOS();
    const internal = gateway.addOrganization({ name: 'Decoda' });
    const admin = gateway.addUser({ email: `admin.${randomBytes(3).toString('hex')}@decoda.test` });
    gateway.addMembership(admin.id, internal.id, { role: { slug: 'admin' } });
    await withTransaction((client) => recordWebsiteSignIn(client, gateway, { user: admin, organizationId: internal.id, impersonated: false }), db().pool);
    await withTransaction(
      (client) => grantPlatformAdmin(client, { workosUserId: admin.id, permissions, grantedBy: 'operator:test', reason: 'test harness' }),
      db().pool,
    );
    const client = await db().pool.connect();
    try {
      const actor = await resolveActor(client, snapshot(admin, internal.id));
      return {
        gateway,
        admin,
        deps: { pool: db().pool, gateway, invitationExpiresInDays: 7 },
        ctx: { actor: { ...actor, platformUserId: actor.platformUserId! }, requestId: `req_${randomBytes(8).toString('hex')}`, ipHash: null },
      };
    } finally {
      client.release();
    }
  }

  function snapshot(user: WorkOSUser, organizationId: string | null, overrides: Partial<AuthSnapshot> = {}): AuthSnapshot {
    return {
      workosUserId: user.id,
      sessionId: `session_${randomBytes(6).toString('hex').toUpperCase()}`,
      organizationId,
      impersonated: false,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      ...overrides,
    };
  }

  async function pendingRequest(products: string[] = ['rwa_guard', 'vault']): Promise<{ id: string; email: string }> {
    const email = `ciso.${randomBytes(4).toString('hex')}@customer.test`;
    const { rows } = await db().pool.query(
      `INSERT INTO platform.pilot_requests (email, email_domain, full_name, company_name, role, requested_products, request_id)
       VALUES ($1, 'customer.test', 'Casey Customer', 'Customer Holdings', 'CISO', $2, $3) RETURNING id`,
      [email, products, `req_${randomBytes(8).toString('hex')}`],
    );
    return { id: rows[0].id, email };
  }

  async function deliver(gateway: FakeWorkOS, event: string, data: Record<string, unknown>) {
    const body = eventPayload(event, data);
    const result = await handleWorkOSWebhook(body, signWebhook(body), `req_${randomBytes(8).toString('hex')}`, {
      gateway,
      pool: db().pool,
      logger: silent,
    });
    assert.equal(result.status, 200, JSON.stringify(result.body));
  }

  async function actions(): Promise<string[]> {
    const { rows } = await db().pool.query('SELECT action FROM platform.audit_events ORDER BY seq');
    return rows.map((row) => row.action);
  }

  async function access(workosUserId: string, workosOrgId: string): Promise<Record<string, string>> {
    const { rows } = await db().pool.query(
      'SELECT product, access_state FROM platform_api.product_access_v1 WHERE workos_user_id = $1 AND workos_organization_id = $2',
      [workosUserId, workosOrgId],
    );
    return Object.fromEntries(rows.map((row) => [row.product, row.access_state]));
  }

  const approvalBody = (email: string) => ({
    organizationMode: 'create',
    organizationName: 'Customer Holdings',
    products: [
      { product: 'rwa_guard', status: 'enabled' },
      { product: 'vault', status: 'pilot', expiresAt: '2999-01-01' },
    ],
    invite: true,
    inviteEmail: email,
    inviteRole: 'admin',
  });

  dbIt('approval provisions org, entitlements, WorkOS organization and admin invitation, all audited', async () => {
    const h = await harness();
    const request = await pendingRequest();
    const result = await approvePilotRequest(h.ctx, h.deps, request.id, parseApprovalInput(approvalBody(request.email)));
    assert.equal(result.workosLinked, true);
    assert.deepEqual(result.warnings, []);
    assert.equal(result.invitation?.state, 'pending');

    const org = await db().pool.query('SELECT workos_organization_id, status FROM platform.organizations WHERE id = $1', [result.organizationId]);
    const workosOrg = h.gateway.organizations.get(org.rows[0].workos_organization_id)!;
    assert.equal(workosOrg.externalId, result.organizationId);
    const [sendCall] = h.gateway.callsTo('sendInvitation');
    assert.deepEqual(
      { email: (sendCall!.args[0] as { email: string }).email, role: (sendCall!.args[0] as { roleSlug: string }).roleSlug },
      { email: request.email, role: 'admin' },
    );
    const status = await db().pool.query('SELECT status, organization_id FROM platform.pilot_requests WHERE id = $1', [request.id]);
    assert.deepEqual(status.rows[0], { status: 'approved', organization_id: result.organizationId });
    const logged = await actions();
    for (const action of ['pilot.approved', 'organization.created', 'entitlement.enabled', 'organization.linked', 'invitation.sent']) {
      assert.ok(logged.includes(action), `missing audit action ${action}`);
    }
  });

  dbIt('a request cannot be approved twice, or rejected once approved', async () => {
    const h = await harness();
    const request = await pendingRequest();
    await approvePilotRequest(h.ctx, h.deps, request.id, parseApprovalInput(approvalBody(request.email)));
    await assert.rejects(approvePilotRequest(h.ctx, h.deps, request.id, parseApprovalInput(approvalBody(request.email))), (error: unknown) => {
      assert.ok(error instanceof PlatformError);
      assert.equal(error.code, 'PILOT_REQUEST_NOT_PENDING');
      return true;
    });
    await assert.rejects(rejectPilotRequest(h.ctx, h.deps, request.id, null), /cannot be rejected/);
  });

  dbIt('rejection records the reviewer and never provisions anything', async () => {
    const h = await harness();
    const request = await pendingRequest();
    await rejectPilotRequest(h.ctx, h.deps, request.id, 'Not a fit for the current pilot cohort.');
    const { rows } = await db().pool.query('SELECT status, reviewed_by, review_note, organization_id FROM platform.pilot_requests WHERE id = $1', [request.id]);
    assert.equal(rows[0].status, 'rejected');
    assert.equal(rows[0].reviewed_by, h.ctx.actor.platformUserId);
    assert.equal(rows[0].organization_id, null);
    assert.equal(h.gateway.callsTo('createOrganization').length, 0);
    assert.equal(h.gateway.callsTo('sendInvitation').length, 0);
  });

  dbIt('a WorkOS outage leaves the approval committed and retryable; no invitation is sent unlinked', async () => {
    const h = await harness();
    const request = await pendingRequest();
    h.gateway.failures.set('createOrganization', Object.assign(new Error('unavailable'), { status: 503 }));
    const result = await approvePilotRequest(h.ctx, h.deps, request.id, parseApprovalInput(approvalBody(request.email)));
    assert.equal(result.workosLinked, false);
    assert.equal(result.invitation, null);
    assert.equal(result.warnings.length, 2);
    assert.equal(h.gateway.callsTo('sendInvitation').length, 0);
    const workosOrgId = await ensureWorkOSOrganization(h.ctx, h.deps, result.organizationId);
    assert.match(workosOrgId, /^org_/);
    const invitation = await sendInvitation(h.ctx, h.deps, { organizationId: result.organizationId, email: request.email, role: 'admin' });
    assert.equal(invitation.state, 'pending');
  });

  dbIt('duplicate invitations are refused without a second email; a failed send is recorded and retryable', async () => {
    const h = await harness();
    const request = await pendingRequest();
    const approved = await approvePilotRequest(h.ctx, h.deps, request.id, parseApprovalInput({ ...approvalBody(request.email), invite: false }));
    const first = await sendInvitation(h.ctx, h.deps, { organizationId: approved.organizationId, email: request.email, role: 'admin' });
    const second = await sendInvitation(h.ctx, h.deps, { organizationId: approved.organizationId, email: request.email.toUpperCase(), role: 'admin' });
    assert.equal(second.duplicate, true);
    assert.equal(second.invitationId, first.invitationId);
    assert.equal(h.gateway.callsTo('sendInvitation').length, 1);

    const other = `ops.${randomBytes(3).toString('hex')}@customer.test`;
    h.gateway.failures.set('sendInvitation', Object.assign(new Error('rejected'), { status: 422 }));
    await assert.rejects(sendInvitation(h.ctx, h.deps, { organizationId: approved.organizationId, email: other, role: 'member' }), (error: unknown) => {
      assert.ok(error instanceof PlatformError);
      assert.equal(error.code, 'INVITATION_SEND_FAILED');
      return true;
    });
    const failed = await db().pool.query('SELECT state, failure_code FROM platform.invitations WHERE email = $1', [other]);
    assert.deepEqual(failed.rows, [{ state: 'failed', failure_code: 'workos_422' }]);
    const retried = await sendInvitation(h.ctx, h.deps, { organizationId: approved.organizationId, email: other, role: 'member' });
    assert.equal(retried.state, 'pending');
  });

  dbIt('revoke and resend change WorkOS first, then the record; a revoked invitation cannot be accepted', async () => {
    const h = await harness();
    const request = await pendingRequest();
    const approved = await approvePilotRequest(h.ctx, h.deps, request.id, parseApprovalInput(approvalBody(request.email)));
    const invitationId = approved.invitation!.invitationId;
    const resent = await resendInvitation(h.ctx, h.deps, invitationId);
    assert.equal(resent.state, 'pending');
    await revokeInvitation(h.ctx, h.deps, invitationId);
    const row = await db().pool.query('SELECT state, workos_invitation_id FROM platform.invitations WHERE id = $1', [invitationId]);
    assert.equal(row.rows[0].state, 'revoked');
    await assert.rejects(revokeInvitation(h.ctx, h.deps, invitationId), /cannot be revoked/);
    const invitee = h.gateway.addUser({ email: request.email });
    assert.throws(() => h.gateway.acceptInvitation(row.rows[0].workos_invitation_id, invitee), /not pending/);
  });

  describe('invitation acceptance', () => {
    async function approvedWithInvitation(h: Harness) {
      const request = await pendingRequest();
      const approved = await approvePilotRequest(h.ctx, h.deps, request.id, parseApprovalInput(approvalBody(request.email)));
      const org = await db().pool.query('SELECT workos_organization_id FROM platform.organizations WHERE id = $1', [approved.organizationId]);
      const invitation = await db().pool.query('SELECT workos_invitation_id FROM platform.invitations WHERE id = $1', [approved.invitation!.invitationId]);
      return { request, approved, workosOrgId: org.rows[0].workos_organization_id as string, workosInvitationId: invitation.rows[0].workos_invitation_id as string };
    }

    dbIt('a brand-new user accepts: membership activates, request converts, entitled products open', async () => {
      const h = await harness();
      const { request, workosOrgId, workosInvitationId, approved } = await approvedWithInvitation(h);
      const invitee = h.gateway.addUser({ email: request.email });
      const { invitation, membership } = h.gateway.acceptInvitation(workosInvitationId, invitee);
      await deliver(h.gateway, 'user.created', wire.user(invitee));
      await deliver(h.gateway, 'organization_membership.created', wire.membership(membership));
      await deliver(h.gateway, 'invitation.accepted', wire.invitation(invitation));

      assert.deepEqual(await access(invitee.id, workosOrgId), { rwa_guard: 'granted', vault: 'granted', assets: 'product_unavailable' });
      const role = await db().pool.query(
        `SELECT m.role FROM platform.organization_memberships m JOIN platform.users u ON u.id = m.user_id WHERE u.workos_user_id = $1`,
        [invitee.id],
      );
      assert.equal(role.rows[0].role, 'admin');
      const converted = await db().pool.query('SELECT status FROM platform.pilot_requests WHERE id = $1', [request.id]);
      assert.equal(converted.rows[0].status, 'converted');
      const inv = await db().pool.query('SELECT state, accepted_workos_user_id FROM platform.invitations WHERE id = $1', [approved.invitation!.invitationId]);
      assert.deepEqual(inv.rows[0], { state: 'accepted', accepted_workos_user_id: invitee.id });
    });

    dbIt('an existing user of another organization gains a second, separate membership', async () => {
      const h = await harness();
      const first = await approvedWithInvitation(h);
      const person = h.gateway.addUser({ email: first.request.email });
      const accepted = h.gateway.acceptInvitation(first.workosInvitationId, person);
      await deliver(h.gateway, 'organization_membership.created', wire.membership(accepted.membership));

      const second = await approvedWithInvitation(h);
      const secondInvitation = await sendInvitation(h.ctx, h.deps, { organizationId: second.approved.organizationId, email: person.email, role: 'member' });
      const workosInvitation = await db().pool.query('SELECT workos_invitation_id FROM platform.invitations WHERE id = $1', [secondInvitation.invitationId]);
      const acceptedSecond = h.gateway.acceptInvitation(workosInvitation.rows[0].workos_invitation_id, person);
      await deliver(h.gateway, 'organization_membership.created', wire.membership(acceptedSecond.membership));

      const { rows } = await db().pool.query('SELECT workos_organization_id FROM platform_api.user_organizations_v1 WHERE workos_user_id = $1', [person.id]);
      assert.deepEqual(new Set(rows.map((row) => row.workos_organization_id)), new Set([first.workosOrgId, second.workosOrgId]));
    });

    dbIt('the wrong account cannot use the invitation, and a same-domain colleague gains nothing', async () => {
      const h = await harness();
      const { request, workosOrgId, workosInvitationId } = await approvedWithInvitation(h);
      const colleague = h.gateway.addUser({ email: request.email.replace(/^[^@]+/, 'colleague') });
      assert.throws(() => h.gateway.acceptInvitation(workosInvitationId, colleague), /email mismatch/);
      // The colleague signs in at www: the platform syncs WorkOS facts only, so
      // sharing the invited address's domain grants nothing.
      await withTransaction((client) => recordWebsiteSignIn(client, h.gateway, { user: colleague, impersonated: false }), db().pool);
      assert.deepEqual(await access(colleague.id, workosOrgId), {});
    });

    dbIt('an expired invitation cannot be accepted and grants nothing', async () => {
      const h = await harness();
      const { request, workosOrgId, workosInvitationId } = await approvedWithInvitation(h);
      const stored = h.gateway.invitations.get(workosInvitationId)!;
      h.gateway.invitations.set(workosInvitationId, { ...stored, state: 'expired' });
      const invitee = h.gateway.addUser({ email: request.email });
      assert.throws(() => h.gateway.acceptInvitation(workosInvitationId, invitee), /not pending/);
      assert.deepEqual(await access(invitee.id, workosOrgId), {});
    });
  });

  dbIt('disabling or suspending entitlements, and suspending the organization, deny access immediately', async () => {
    const h = await harness();
    const request = await pendingRequest();
    const approved = await approvePilotRequest(h.ctx, h.deps, request.id, parseApprovalInput(approvalBody(request.email)));
    const org = await db().pool.query('SELECT workos_organization_id FROM platform.organizations WHERE id = $1', [approved.organizationId]);
    const invitation = await db().pool.query('SELECT workos_invitation_id FROM platform.invitations WHERE id = $1', [approved.invitation!.invitationId]);
    const invitee = h.gateway.addUser({ email: request.email });
    const { membership } = h.gateway.acceptInvitation(invitation.rows[0].workos_invitation_id, invitee);
    await deliver(h.gateway, 'organization_membership.created', wire.membership(membership));
    const workosOrgId = org.rows[0].workos_organization_id;

    await setEntitlement(h.ctx, h.deps, approved.organizationId, { product: 'vault', status: 'disabled' });
    await setEntitlement(h.ctx, h.deps, approved.organizationId, { product: 'rwa_guard', status: 'suspended' });
    assert.deepEqual(await access(invitee.id, workosOrgId), { rwa_guard: 'entitlement_suspended', vault: 'not_entitled', assets: 'product_unavailable' });

    await setEntitlement(h.ctx, h.deps, approved.organizationId, { product: 'rwa_guard', status: 'enabled' });
    await setOrganizationStatus(h.ctx, h.deps, approved.organizationId, 'suspended', 'contract paused');
    assert.equal((await access(invitee.id, workosOrgId)).rwa_guard, 'organization_inactive');
    const logged = await actions();
    for (const action of ['entitlement.disabled', 'entitlement.suspended', 'organization.suspended']) assert.ok(logged.includes(action), action);
  });

  describe('admin API gate', () => {
    function adminRequest(csrf: string | null, headers: Record<string, string> = {}, body: unknown = {}) {
      return new Request('https://www.decoda.test/api/admin/x', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'https://www.decoda.test',
          host: 'www.decoda.test',
          ...(csrf ? { 'x-csrf-token': csrf } : {}),
          ...headers,
        },
        body: JSON.stringify(body),
      });
    }

    function deps(h: Harness, auth: AuthSnapshot | null): () => Promise<AdminApiDeps> {
      return async () => ({ auth, secret: SECRET, pool: db().pool, gateway: h.gateway, invitationExpiresInDays: 7, logger: silent });
    }

    async function deniedCount(): Promise<number> {
      const { rows } = await db().pool.query("SELECT count(*)::int AS n FROM platform.audit_events WHERE action = 'admin.permission_denied'");
      return rows[0].n;
    }

    dbIt('runs the action only for an authorised, same-origin, CSRF-valid request', async () => {
      const h = await harness();
      const auth = snapshot(h.admin, null);
      let ran = 0;
      const action = async () => {
        ran += 1;
        return { done: true };
      };
      const ok = await handleAdminMutation(adminRequest(issueCsrfToken(auth.sessionId, SECRET)), 'platform.pilot_requests.review', deps(h, auth), action);
      assert.equal(ok.status, 200);
      assert.equal((await ok.json()).done, true);

      assert.equal((await handleAdminMutation(adminRequest(null), 'platform.pilot_requests.review', deps(h, null), action)).status, 401);
      assert.equal(
        (await handleAdminMutation(adminRequest(issueCsrfToken(auth.sessionId, SECRET), { origin: 'https://evil.test' }), 'platform.pilot_requests.review', deps(h, auth), action)).status,
        403,
      );
      assert.equal((await handleAdminMutation(adminRequest(null), 'platform.pilot_requests.review', deps(h, auth), action)).status, 403);
      assert.equal(
        (await handleAdminMutation(adminRequest(issueCsrfToken('session_OTHER', SECRET)), 'platform.pilot_requests.review', deps(h, auth), action)).status,
        403,
      );
      assert.equal(ran, 1);
    });

    dbIt('refuses and audits non-admins, impersonated admins and admins missing a permission (privilege escalation)', async () => {
      const h = await harness(['platform.pilot_requests.read', 'platform.pilot_requests.review']);
      const outsider = h.gateway.addUser();
      await withTransaction((client) => recordWebsiteSignIn(client, h.gateway, { user: outsider, impersonated: false }), db().pool);
      const action = async () => {
        throw new Error('must not run');
      };
      const before = await deniedCount();

      const outsiderAuth = snapshot(outsider, null);
      const r1 = await handleAdminMutation(adminRequest(issueCsrfToken(outsiderAuth.sessionId, SECRET)), 'platform.pilot_requests.review', deps(h, outsiderAuth), action);
      assert.equal(r1.status, 403);

      const impersonated = snapshot(h.admin, null, { impersonated: true });
      const r2 = await handleAdminMutation(adminRequest(issueCsrfToken(impersonated.sessionId, SECRET)), 'platform.pilot_requests.review', deps(h, impersonated), action);
      assert.equal(r2.status, 403);

      const adminAuth = snapshot(h.admin, null);
      const r3 = await handleAdminMutation(
        adminRequest(issueCsrfToken(adminAuth.sessionId, SECRET)),
        ['platform.pilot_requests.review', 'platform.entitlements.manage'],
        deps(h, adminAuth),
        action,
      );
      assert.equal(r3.status, 403);
      assert.equal((await r3.json()).error.code, 'PLATFORM_PERMISSION_DENIED');
      assert.equal(await deniedCount(), before + 3);
    });

    dbIt('rejects malformed bodies and non-UUID identifiers safely', async () => {
      const h = await harness();
      const auth = snapshot(h.admin, null);
      const csrf = issueCsrfToken(auth.sessionId, SECRET);
      const nonJson = await handleAdminMutation(adminRequest(csrf, { 'content-type': 'text/plain' }), 'platform.pilot_requests.review', deps(h, auth), async () => ({}));
      assert.equal(nonJson.status, 415);
      const { uuidOrNotFound } = await import('./http');
      const tampered = await handleAdminMutation(adminRequest(csrf), 'platform.pilot_requests.review', deps(h, auth), async () => {
        uuidOrNotFound("1' OR '1'='1");
        return {};
      });
      assert.equal(tampered.status, 404);
    });
  });
});
