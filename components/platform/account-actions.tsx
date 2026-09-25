'use client';

import { useRef, useState } from 'react';
import styles from './platform.module.css';

type PostResult = { ok: boolean; redirect?: string; message?: string };

/**
 * POST JSON to a same-origin platform endpoint with the page's CSRF token.
 * The server re-checks origin, token, session and permission on every call.
 */
export async function postPlatform(path: string, csrfToken: string, body: unknown = {}): Promise<PostResult> {
  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify(body),
      credentials: 'same-origin',
      cache: 'no-store',
    });
    const data = (await response.json().catch(() => null)) as
      | { ok?: boolean; redirect?: string; error?: { message?: string; request_id?: string } }
      | null;
    if (response.ok && data?.ok === true) return { ok: true, redirect: data.redirect };
    const reference = data?.error?.request_id ? ` (reference ${data.error.request_id})` : '';
    return { ok: false, message: `${data?.error?.message ?? 'The request failed.'}${reference}` };
  } catch {
    return { ok: false, message: 'Decoda could not be reached. Check your connection and try again.' };
  }
}

export function SignOutButton({ csrfToken }: { csrfToken: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  async function signOut() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(null);
    const result = await postPlatform('/api/account/sign-out', csrfToken);
    if (result.ok && result.redirect) {
      // A full navigation: nothing from the signed-out session stays in memory.
      window.location.assign(result.redirect);
      return;
    }
    inFlight.current = false;
    setPending(false);
    setError(result.message ?? 'Sign-out failed.');
  }

  return (
    <>
      <button type="button" className={styles.linkButton} onClick={() => void signOut()} disabled={pending}>
        {pending ? 'Signing out…' : 'Sign out'}
      </button>
      {error ? (
        <span role="alert" className="field-error">
          {error}
        </span>
      ) : null}
    </>
  );
}

export interface SwitcherOrganization {
  platformOrganizationId: string;
  name: string;
  role: 'admin' | 'member';
  active: boolean;
}

export function OrganizationSwitcher({ organizations, csrfToken }: { organizations: SwitcherOrganization[]; csrfToken: string }) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function switchTo(organizationId: string) {
    if (pendingId) return;
    setPendingId(organizationId);
    setError(null);
    const result = await postPlatform('/api/account/switch-organization', csrfToken, { organizationId });
    if (result.ok && result.redirect) {
      window.location.assign(result.redirect);
      return;
    }
    setPendingId(null);
    setError(result.message ?? 'The organization could not be switched.');
  }

  return (
    <>
      <ul className={styles.orgList}>
        {organizations.map((org) => (
          <li key={org.platformOrganizationId} className={styles.orgItem}>
            <span>
              <strong>{org.name}</strong>
              <span className={styles.muted}>{org.role === 'admin' ? 'Organization admin' : 'Member'}</span>
            </span>
            {org.active ? (
              <span className={styles.badge} data-tone="open">
                Active
              </span>
            ) : (
              <button
                type="button"
                className={styles.linkButton}
                disabled={Boolean(pendingId)}
                onClick={() => void switchTo(org.platformOrganizationId)}
              >
                {pendingId === org.platformOrganizationId ? 'Switching…' : 'Switch'}
              </button>
            )}
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="form-status form-status--error">
          {error}
        </p>
      ) : null}
    </>
  );
}
