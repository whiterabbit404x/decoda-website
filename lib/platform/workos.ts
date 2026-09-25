/**
 * The platform's narrow view of WorkOS.
 *
 * Everything the platform asks of the identity provider goes through
 * `WorkOSGateway`, implemented by `createWorkOSGateway` with the official
 * `@workos-inc/node` SDK. Keeping the surface this small makes every WorkOS
 * side effect explicit (and auditable) and lets tests substitute a fake —
 * except webhook signature verification, which tests exercise against the
 * real SDK implementation.
 *
 * Server-only: the API key never leaves the server.
 */
import { WorkOS } from '@workos-inc/node';
import { requireIdentityConfig, requireWebhookSecret } from './config';

/** Subset of the SDK's camelCase user object the platform stores. */
export interface WorkOSUser {
  id: string;
  email: string;
  emailVerified: boolean;
  firstName: string | null;
  lastName: string | null;
  lastSignInAt: string | null;
  createdAt: string;
  updatedAt: string;
  externalId?: string | null;
}

export interface WorkOSOrganization {
  id: string;
  name: string;
  externalId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkOSMembership {
  id: string;
  organizationId: string;
  userId: string;
  status: 'active' | 'inactive' | 'pending';
  role?: { slug: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkOSInvitation {
  id: string;
  email: string;
  state: 'pending' | 'accepted' | 'expired' | 'revoked';
  acceptedAt: string | null;
  revokedAt: string | null;
  expiresAt: string;
  organizationId: string | null;
  inviterUserId: string | null;
  acceptedUserId: string | null;
  roleSlug: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkOSSession {
  id: string;
  userId: string;
  status: string;
  endedAt: string | null;
  updatedAt: string;
}

export interface WorkOSEvent {
  id: string;
  event: string;
  createdAt: string;
  data: unknown;
}

export interface WorkOSGateway {
  createOrganization(input: { name: string; externalId: string; idempotencyKey: string }): Promise<WorkOSOrganization>;
  getOrganization(id: string): Promise<WorkOSOrganization>;
  getUser(id: string): Promise<WorkOSUser>;
  listUserMemberships(userId: string): Promise<WorkOSMembership[]>;
  sendInvitation(input: {
    email: string;
    organizationId: string;
    roleSlug: string;
    expiresInDays: number;
    inviterUserId?: string;
  }): Promise<WorkOSInvitation>;
  revokeInvitation(id: string): Promise<WorkOSInvitation>;
  resendInvitation(id: string): Promise<WorkOSInvitation>;
  countAuthFactors(userId: string): Promise<number>;
  /** Verify the WorkOS-Signature header and parse the event. Throws on any failure. */
  constructEvent(rawBody: string, signatureHeader: string): Promise<WorkOSEvent>;
}

/** Webhook tolerance: the SDK default (3 minutes), in milliseconds. */
export const WEBHOOK_TOLERANCE_MS = 180_000;

let cached: { apiKey: string; gateway: WorkOSGateway } | null = null;

export function createWorkOSGateway(options: { apiKey: string; clientId: string; webhookSecret?: () => string }): WorkOSGateway {
  const workos = new WorkOS(options.apiKey, { clientId: options.clientId });
  const webhookSecret = options.webhookSecret ?? requireWebhookSecret;
  return {
    async createOrganization({ name, externalId, idempotencyKey }) {
      return (await workos.organizations.createOrganization({ name, externalId }, { idempotencyKey })) as WorkOSOrganization;
    },
    async getOrganization(id) {
      return (await workos.organizations.getOrganization(id)) as WorkOSOrganization;
    },
    async getUser(id) {
      return (await workos.userManagement.getUser(id)) as WorkOSUser;
    },
    async listUserMemberships(userId) {
      const page = await workos.userManagement.listOrganizationMemberships({
        userId,
        statuses: ['active', 'inactive', 'pending'],
      });
      return (await page.autoPagination()) as WorkOSMembership[];
    },
    async sendInvitation(input) {
      return (await workos.userManagement.sendInvitation(input)) as WorkOSInvitation;
    },
    async revokeInvitation(id) {
      return (await workos.userManagement.revokeInvitation(id)) as WorkOSInvitation;
    },
    async resendInvitation(id) {
      return (await workos.userManagement.resendInvitation(id)) as WorkOSInvitation;
    },
    async countAuthFactors(userId) {
      const page = await workos.multiFactorAuth.listUserAuthFactors({ userId });
      return (await page.autoPagination()).length;
    },
    async constructEvent(rawBody, signatureHeader) {
      const event = await workos.webhooks.constructEvent({
        payload: rawBody,
        sigHeader: signatureHeader,
        secret: webhookSecret(),
        tolerance: WEBHOOK_TOLERANCE_MS,
      });
      return event as unknown as WorkOSEvent;
    },
  };
}

/** The Website application's gateway, built from the environment (fails closed). */
export function getWorkOSGateway(): WorkOSGateway {
  const config = requireIdentityConfig();
  if (!cached || cached.apiKey !== config.apiKey) {
    cached = { apiKey: config.apiKey, gateway: createWorkOSGateway({ apiKey: config.apiKey, clientId: config.clientId }) };
  }
  return cached.gateway;
}

/** Normalise a WorkOS role slug to the platform's organization role. */
export function organizationRoleFromSlug(slug: string | null | undefined): 'admin' | 'member' {
  return slug === 'admin' ? 'admin' : 'member';
}

/** HTTP status of a WorkOS SDK error, if it carries one. */
export function workosErrorStatus(error: unknown): number | null {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === 'number' ? status : null;
}
