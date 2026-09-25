/**
 * Test double for the WorkOS gateway.
 *
 * Holds users, organizations, memberships and invitations in memory and
 * records every call, so tests can assert exactly which identity-provider side
 * effects happened. Webhook verification is NOT faked: `constructEvent`
 * delegates to the real `@workos-inc/node` implementation, and `signWebhook`
 * produces a genuine `WorkOS-Signature` header for a payload.
 */
import { createHmac, randomBytes } from 'node:crypto';
import {
  createWorkOSGateway,
  type WorkOSGateway,
  type WorkOSInvitation,
  type WorkOSMembership,
  type WorkOSOrganization,
  type WorkOSUser,
} from '../workos';

export const TEST_WEBHOOK_SECRET = 'whsec_test_decoda_platform_0123456789abcdef';

export function signWebhook(body: string, secret: string = TEST_WEBHOOK_SECRET, timestampMs: number = Date.now()): string {
  const signature = createHmac('sha256', secret).update(`${timestampMs}.${body}`).digest('hex');
  return `t=${timestampMs}, v1=${signature}`;
}

const id = (prefix: string) => `${prefix}_${randomBytes(10).toString('hex').toUpperCase()}`;
const iso = (ms = Date.now()) => new Date(ms).toISOString();

export interface FakeCall {
  method: string;
  args: unknown[];
}

export class FakeWorkOS implements WorkOSGateway {
  readonly users = new Map<string, WorkOSUser>();
  readonly organizations = new Map<string, WorkOSOrganization>();
  readonly memberships = new Map<string, WorkOSMembership>();
  readonly invitations = new Map<string, WorkOSInvitation>();
  readonly authFactors = new Map<string, number>();
  readonly calls: FakeCall[] = [];
  /** Method name → error to throw on its next call. */
  readonly failures = new Map<string, Error>();
  private readonly real: WorkOSGateway;

  constructor(private readonly webhookSecret: string = TEST_WEBHOOK_SECRET) {
    this.real = createWorkOSGateway({ apiKey: 'sk_test_fake', clientId: 'client_fake', webhookSecret: () => this.webhookSecret });
  }

  private record(method: string, ...args: unknown[]) {
    this.calls.push({ method, args });
    const failure = this.failures.get(method);
    if (failure) {
      this.failures.delete(method);
      throw failure;
    }
  }

  callsTo(method: string): FakeCall[] {
    return this.calls.filter((call) => call.method === method);
  }

  addUser(overrides: Partial<WorkOSUser> = {}): WorkOSUser {
    const user: WorkOSUser = {
      id: id('user'),
      email: `${randomBytes(4).toString('hex')}@customer.test`,
      emailVerified: true,
      firstName: 'Test',
      lastName: 'User',
      lastSignInAt: null,
      createdAt: iso(),
      updatedAt: iso(),
      externalId: null,
      ...overrides,
    };
    this.users.set(user.id, user);
    return user;
  }

  addOrganization(overrides: Partial<WorkOSOrganization> = {}): WorkOSOrganization {
    const org: WorkOSOrganization = { id: id('org'), name: 'Customer Org', externalId: null, createdAt: iso(), updatedAt: iso(), ...overrides };
    this.organizations.set(org.id, org);
    return org;
  }

  addMembership(userId: string, organizationId: string, overrides: Partial<WorkOSMembership> = {}): WorkOSMembership {
    const membership: WorkOSMembership = {
      id: id('om'),
      userId,
      organizationId,
      status: 'active',
      role: { slug: 'member' },
      createdAt: iso(),
      updatedAt: iso(),
      ...overrides,
    };
    this.memberships.set(membership.id, membership);
    return membership;
  }

  async createOrganization(input: { name: string; externalId: string; idempotencyKey: string }) {
    this.record('createOrganization', input);
    const existing = [...this.organizations.values()].find((org) => org.externalId === input.externalId);
    if (existing) return existing; // WorkOS idempotency-key semantics
    return this.addOrganization({ name: input.name, externalId: input.externalId });
  }

  async getOrganization(orgId: string) {
    this.record('getOrganization', orgId);
    const org = this.organizations.get(orgId);
    if (!org) throw Object.assign(new Error('not found'), { status: 404 });
    return org;
  }

  async getUser(userId: string) {
    this.record('getUser', userId);
    const user = this.users.get(userId);
    if (!user) throw Object.assign(new Error('not found'), { status: 404 });
    return user;
  }

  async listUserMemberships(userId: string) {
    this.record('listUserMemberships', userId);
    return [...this.memberships.values()].filter((m) => m.userId === userId);
  }

  async sendInvitation(input: { email: string; organizationId: string; roleSlug: string; expiresInDays: number; inviterUserId?: string }) {
    this.record('sendInvitation', input);
    const invitation: WorkOSInvitation = {
      id: id('invitation'),
      email: input.email,
      state: 'pending',
      acceptedAt: null,
      revokedAt: null,
      expiresAt: iso(Date.now() + input.expiresInDays * 86_400_000),
      organizationId: input.organizationId,
      inviterUserId: input.inviterUserId ?? null,
      acceptedUserId: null,
      roleSlug: input.roleSlug,
      createdAt: iso(),
      updatedAt: iso(),
    };
    this.invitations.set(invitation.id, invitation);
    return invitation;
  }

  async revokeInvitation(invitationId: string) {
    this.record('revokeInvitation', invitationId);
    const invitation = this.invitations.get(invitationId);
    if (!invitation) throw Object.assign(new Error('not found'), { status: 404 });
    if (invitation.state !== 'pending') throw Object.assign(new Error('invalid state'), { status: 400 });
    const revoked = { ...invitation, state: 'revoked' as const, revokedAt: iso(), updatedAt: iso() };
    this.invitations.set(invitationId, revoked);
    return revoked;
  }

  async resendInvitation(invitationId: string) {
    this.record('resendInvitation', invitationId);
    const invitation = this.invitations.get(invitationId);
    if (!invitation) throw Object.assign(new Error('not found'), { status: 404 });
    if (invitation.state !== 'pending' && invitation.state !== 'expired') throw Object.assign(new Error('invalid state'), { status: 400 });
    const resent = { ...invitation, state: 'pending' as const, expiresAt: iso(Date.now() + 7 * 86_400_000), updatedAt: iso() };
    this.invitations.set(invitationId, resent);
    return resent;
  }

  async countAuthFactors(userId: string) {
    this.record('countAuthFactors', userId);
    return this.authFactors.get(userId) ?? 0;
  }

  /** Accept an invitation the way the hosted AuthKit flow would. */
  acceptInvitation(invitationId: string, user: WorkOSUser): { invitation: WorkOSInvitation; membership: WorkOSMembership } {
    const invitation = this.invitations.get(invitationId);
    if (!invitation || invitation.state !== 'pending') throw new Error('invitation not pending');
    if (invitation.email.toLowerCase() !== user.email.toLowerCase()) throw new Error('invitation email mismatch');
    const accepted = { ...invitation, state: 'accepted' as const, acceptedAt: iso(), acceptedUserId: user.id, updatedAt: iso() };
    this.invitations.set(invitationId, accepted);
    const membership = this.addMembership(user.id, invitation.organizationId!, { role: { slug: invitation.roleSlug ?? 'member' } });
    return { invitation: accepted, membership };
  }

  constructEvent(rawBody: string, signatureHeader: string) {
    return this.real.constructEvent(rawBody, signatureHeader);
  }
}

/** A WorkOS event envelope as WorkOS delivers it (snake_case on the wire). */
export function eventPayload(event: string, data: Record<string, unknown>, overrides: { id?: string; createdAt?: string } = {}) {
  return JSON.stringify({ id: overrides.id ?? id('event'), event, data, created_at: overrides.createdAt ?? iso() });
}

/** snake_case wire forms of the fixture objects. */
export const wire = {
  user: (u: WorkOSUser) => ({
    object: 'user',
    id: u.id,
    email: u.email,
    email_verified: u.emailVerified,
    first_name: u.firstName,
    last_name: u.lastName,
    profile_picture_url: null,
    last_sign_in_at: u.lastSignInAt,
    locale: null,
    external_id: u.externalId ?? null,
    metadata: {},
    created_at: u.createdAt,
    updated_at: u.updatedAt,
  }),
  organization: (o: WorkOSOrganization) => ({
    object: 'organization',
    id: o.id,
    name: o.name,
    allow_profiles_outside_organization: false,
    domains: [],
    external_id: o.externalId,
    metadata: {},
    created_at: o.createdAt,
    updated_at: o.updatedAt,
  }),
  membership: (m: WorkOSMembership) => ({
    object: 'organization_membership',
    id: m.id,
    organization_id: m.organizationId,
    organization_name: 'Customer Org',
    user_id: m.userId,
    status: m.status,
    role: m.role ? { slug: m.role.slug } : null,
    directory_managed: false,
    custom_attributes: {},
    created_at: m.createdAt,
    updated_at: m.updatedAt,
  }),
  invitation: (i: WorkOSInvitation) => ({
    object: 'invitation',
    id: i.id,
    email: i.email,
    state: i.state,
    accepted_at: i.acceptedAt,
    revoked_at: i.revokedAt,
    expires_at: i.expiresAt,
    organization_id: i.organizationId,
    inviter_user_id: i.inviterUserId,
    accepted_user_id: i.acceptedUserId,
    role_slug: i.roleSlug,
    token: 'tok_redacted',
    accept_invitation_url: 'https://auth.example.test/invite',
    created_at: i.createdAt,
    updated_at: i.updatedAt,
  }),
  session: (s: { id: string; userId: string; endedAt?: string | null }) => ({
    object: 'session',
    id: s.id,
    user_id: s.userId,
    ip_address: null,
    user_agent: null,
    auth_method: 'password',
    status: 'revoked',
    expires_at: iso(Date.now() + 3_600_000),
    ended_at: s.endedAt ?? iso(),
    created_at: iso(),
    updated_at: iso(),
  }),
};
