'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { postPlatform } from './account-actions';
import styles from './platform.module.css';

type ProductKey = 'rwa_guard' | 'vault' | 'assets';
const PRODUCT_LABELS: Record<ProductKey, string> = { rwa_guard: 'RWA Guard', vault: 'Vault', assets: 'Assets' };

/** Shared submit plumbing: in-flight latch, error display, refresh on success. */
function useAdminSubmit() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const inFlight = useRef(false);

  async function submit(path: string, csrfToken: string, body: unknown, success: string) {
    if (inFlight.current) return false;
    inFlight.current = true;
    setPending(true);
    setMessage(null);
    const result = await postPlatform(path, csrfToken, body);
    inFlight.current = false;
    setPending(false);
    if (!result.ok) {
      setMessage({ tone: 'error', text: result.message ?? 'The action failed.' });
      return false;
    }
    setMessage({ tone: 'success', text: success });
    router.refresh();
    return true;
  }

  const feedback = message ? (
    <p role={message.tone === 'error' ? 'alert' : 'status'} className={`form-status form-status--${message.tone}`}>
      {message.text}
    </p>
  ) : null;
  return { pending, submit, feedback, setMessage };
}

export function ApprovalForm({
  requestId,
  csrfToken,
  company,
  email,
  requestedProducts,
  organizations,
}: {
  requestId: string;
  csrfToken: string;
  company: string;
  email: string;
  requestedProducts: ProductKey[];
  organizations: Array<{ id: string; name: string }>;
}) {
  const { pending, submit, feedback } = useAdminSubmit();
  const [mode, setMode] = useState<'create' | 'link'>('create');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const products = (['rwa_guard', 'vault', 'assets'] as ProductKey[])
      .filter((product) => data.get(`enable_${product}`) === 'on')
      .map((product) => ({
        product,
        status: String(data.get(`status_${product}`) ?? 'pilot'),
        expiresAt: String(data.get(`expires_${product}`) ?? '') || null,
      }));
    await submit(
      `/api/admin/pilot-requests/${requestId}/approve`,
      csrfToken,
      {
        organizationMode: mode,
        organizationName: String(data.get('organizationName') ?? ''),
        organizationId: String(data.get('organizationId') ?? ''),
        products,
        invite: data.get('invite') === 'on',
        inviteEmail: String(data.get('inviteEmail') ?? ''),
        inviteRole: String(data.get('inviteRole') ?? 'admin'),
      },
      'Approved. Review the organization page for the invitation status.',
    );
  }

  return (
    <form className={styles.formGrid} onSubmit={onSubmit}>
      <fieldset className={styles.formGrid} style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="eyebrow">Organization</legend>
        <label className={styles.checkboxRow}>
          <input type="radio" name="organizationMode" value="create" checked={mode === 'create'} onChange={() => setMode('create')} />
          Create a new organization
        </label>
        <label className={styles.checkboxRow}>
          <input type="radio" name="organizationMode" value="link" checked={mode === 'link'} onChange={() => setMode('link')}
            disabled={organizations.length === 0} />
          Link an existing organization
        </label>
        {mode === 'create' ? (
          <label>
            Organization name
            <input name="organizationName" defaultValue={company} required maxLength={200} />
          </label>
        ) : (
          <label>
            Existing organization
            <select name="organizationId" required defaultValue="">
              <option value="" disabled>
                Select an organization
              </option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </fieldset>

      <fieldset className={styles.formGrid} style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="eyebrow">Products</legend>
        {(['rwa_guard', 'vault', 'assets'] as ProductKey[]).map((product) => (
          <div key={product} className={styles.orgItem}>
            <label className={styles.checkboxRow}>
              <input type="checkbox" name={`enable_${product}`} defaultChecked={requestedProducts.includes(product) && product !== 'assets'} />
              {PRODUCT_LABELS[product]}
              {product === 'assets' ? <span className={styles.badge}>Coming soon — recorded only</span> : null}
            </label>
            <span className={styles.inlineActions}>
              <select name={`status_${product}`} defaultValue="pilot" aria-label={`${PRODUCT_LABELS[product]} status`}>
                <option value="pilot">Pilot</option>
                <option value="enabled">Enabled</option>
              </select>
              <input type="date" name={`expires_${product}`} aria-label={`${PRODUCT_LABELS[product]} pilot end date`} />
            </span>
          </div>
        ))}
      </fieldset>

      <fieldset className={styles.formGrid} style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="eyebrow">Organization admin invitation</legend>
        <label className={styles.checkboxRow}>
          <input type="checkbox" name="invite" defaultChecked />
          Send a WorkOS invitation now
        </label>
        <label>
          Email
          <input name="inviteEmail" type="email" defaultValue={email} maxLength={254} />
        </label>
        <label>
          Organization role
          <select name="inviteRole" defaultValue="admin">
            <option value="admin">Organization admin</option>
            <option value="member">Member</option>
          </select>
        </label>
      </fieldset>

      <button className="button-primary" type="submit" disabled={pending}>
        {pending ? 'Approving…' : 'Approve and provision'}
      </button>
      {feedback}
    </form>
  );
}

export function RejectForm({ requestId, csrfToken }: { requestId: string; csrfToken: string }) {
  const { pending, submit, feedback } = useAdminSubmit();
  return (
    <form
      className={styles.formGrid}
      onSubmit={(event) => {
        event.preventDefault();
        const note = String(new FormData(event.currentTarget).get('note') ?? '');
        void submit(`/api/admin/pilot-requests/${requestId}/reject`, csrfToken, { note }, 'Rejected.');
      }}
    >
      <label>
        Internal note (never shown to the applicant)
        <textarea name="note" rows={3} maxLength={2000} />
      </label>
      <button className={styles.linkButton} type="submit" disabled={pending}>
        {pending ? 'Rejecting…' : 'Reject request'}
      </button>
      {feedback}
    </form>
  );
}

export function EntitlementEditor({
  organizationId,
  csrfToken,
  entitlements,
}: {
  organizationId: string;
  csrfToken: string;
  entitlements: Array<{ product: ProductKey; status: string; plan: string; expires_at: string | null }>;
}) {
  const { pending, submit, feedback } = useAdminSubmit();
  return (
    <div className={styles.formGrid}>
      {(['rwa_guard', 'vault', 'assets'] as ProductKey[]).map((product) => {
        const current = entitlements.find((entry) => entry.product === product);
        return (
          <form
            key={product}
            className={styles.orgItem}
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              void submit(
                `/api/admin/organizations/${organizationId}/entitlements`,
                csrfToken,
                {
                  product,
                  status: String(data.get('status')),
                  plan: String(data.get('plan') ?? '') || null,
                  expiresAt: String(data.get('expiresAt') ?? '') || null,
                },
                `${PRODUCT_LABELS[product]} updated.`,
              );
            }}
          >
            <strong>
              {PRODUCT_LABELS[product]}
              {product === 'assets' ? <span className={styles.muted}> (coming soon — never grants access yet)</span> : null}
            </strong>
            <span className={styles.inlineActions}>
              <select name="status" defaultValue={current?.status ?? 'disabled'} aria-label={`${PRODUCT_LABELS[product]} status`}>
                <option value="enabled">Enabled</option>
                <option value="pilot">Pilot</option>
                <option value="suspended">Suspended</option>
                <option value="disabled">Disabled</option>
              </select>
              <input name="plan" defaultValue={current?.plan ?? ''} placeholder="plan" maxLength={64} aria-label="Plan" style={{ width: 110 }} />
              <input type="date" name="expiresAt" defaultValue={current?.expires_at ? current.expires_at.slice(0, 10) : ''} aria-label="Expires" />
              <button className={styles.linkButton} type="submit" disabled={pending}>
                Save
              </button>
            </span>
          </form>
        );
      })}
      {feedback}
    </div>
  );
}

export function InviteForm({ organizationId, csrfToken }: { organizationId: string; csrfToken: string }) {
  const { pending, submit, feedback } = useAdminSubmit();
  return (
    <form
      className={styles.formGrid}
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        const sent = await submit(
          `/api/admin/organizations/${organizationId}/invitations`,
          csrfToken,
          { email: String(data.get('email') ?? ''), role: String(data.get('role') ?? 'member') },
          'Invitation sent (or an open invitation already existed).',
        );
        if (sent) form.reset();
      }}
    >
      <label>
        Email
        <input name="email" type="email" required maxLength={254} />
      </label>
      <label>
        Organization role
        <select name="role" defaultValue="member">
          <option value="member">Member</option>
          <option value="admin">Organization admin</option>
        </select>
      </label>
      <button className={styles.linkButton} type="submit" disabled={pending}>
        {pending ? 'Sending…' : 'Send invitation'}
      </button>
      {feedback}
    </form>
  );
}

export function InvitationActions({ invitationId, state, csrfToken }: { invitationId: string; state: string; csrfToken: string }) {
  const { pending, submit, feedback } = useAdminSubmit();
  if (state !== 'pending' && state !== 'expired') return null;
  return (
    <span className={styles.inlineActions}>
      <button className={styles.linkButton} type="button" disabled={pending}
        onClick={() => void submit(`/api/admin/invitations/${invitationId}/resend`, csrfToken, {}, 'Invitation re-sent.')}>
        Resend
      </button>
      {state === 'pending' ? (
        <button className={styles.linkButton} type="button" disabled={pending}
          onClick={() => void submit(`/api/admin/invitations/${invitationId}/revoke`, csrfToken, {}, 'Invitation revoked.')}>
          Revoke
        </button>
      ) : null}
      {feedback}
    </span>
  );
}

export function OrganizationStatusForm({ organizationId, status, csrfToken }: { organizationId: string; status: string; csrfToken: string }) {
  const { pending, submit, feedback } = useAdminSubmit();
  if (status === 'closed') return <p className={styles.muted}>Closed organizations cannot be changed.</p>;
  const target = status === 'active' ? 'suspended' : 'active';
  return (
    <form
      className={styles.formGrid}
      onSubmit={(event) => {
        event.preventDefault();
        const reason = String(new FormData(event.currentTarget).get('reason') ?? '');
        void submit(`/api/admin/organizations/${organizationId}/status`, csrfToken, { status: target, reason },
          target === 'suspended' ? 'Organization suspended.' : 'Organization reactivated.');
      }}
    >
      <label>
        Reason (recorded in the audit trail)
        <input name="reason" required maxLength={500} />
      </label>
      <button className={styles.linkButton} type="submit" disabled={pending}>
        {target === 'suspended' ? 'Suspend organization' : 'Reactivate organization'}
      </button>
      {feedback}
    </form>
  );
}

export function LinkOrganizationButton({ organizationId, csrfToken }: { organizationId: string; csrfToken: string }) {
  const { pending, submit, feedback } = useAdminSubmit();
  return (
    <span className={styles.inlineActions}>
      <button className={styles.linkButton} type="button" disabled={pending}
        onClick={() => void submit(`/api/admin/organizations/${organizationId}/link`, csrfToken, {}, 'Linked to the identity provider.')}>
        {pending ? 'Linking…' : 'Link identity organization'}
      </button>
      {feedback}
    </span>
  );
}

export function CreateOrganizationForm({ csrfToken }: { csrfToken: string }) {
  const { pending, submit, feedback } = useAdminSubmit();
  return (
    <form
      className={styles.formGrid}
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        const ok = await submit('/api/admin/organizations', csrfToken,
          { name: String(data.get('name') ?? ''), website: String(data.get('website') ?? '') }, 'Organization created.');
        if (ok) form.reset();
      }}
    >
      <label>
        Organization name
        <input name="name" required maxLength={200} />
      </label>
      <label>
        Website (optional)
        <input name="website" maxLength={300} />
      </label>
      <button className={styles.linkButton} type="submit" disabled={pending}>
        {pending ? 'Creating…' : 'Create organization'}
      </button>
      {feedback}
    </form>
  );
}
