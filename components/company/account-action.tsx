'use client';

/**
 * Header identity actions.
 *
 * Marketing pages stay static, so the browser asks /api/session once per page
 * load. Signed-out visitors see "Sign in" + "Request pilot". Signed-in visitors
 * see their Decoda account + a direct Launcher shortcut, and never get the
 * acquisition CTA as their primary action.
 */
import { useEffect, useState } from 'react';
import { IconArrowRight, IconUser } from './icons';

type AccountState = { status: 'pending' } | { status: 'signed-out' } | { status: 'signed-in'; label: string; name: string };

const SIGNED_OUT: AccountState = { status: 'signed-out' };
const PROBE_TIMEOUT_MS = 4000;

let probe: Promise<AccountState> | null = null;

async function readSession(): Promise<AccountState> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetch('/api/session', {
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) return SIGNED_OUT;
    const data = (await response.json()) as { signedIn?: unknown; user?: { firstName?: unknown; name?: unknown } };
    if (data.signedIn !== true) return SIGNED_OUT;
    const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);
    const name = text(data.user?.name) ?? 'Decoda account';
    return { status: 'signed-in', label: text(data.user?.firstName) ?? 'Account', name };
  } catch {
    return SIGNED_OUT;
  } finally {
    clearTimeout(timer);
  }
}

/** One request per page load, shared by the desktop and mobile instances. */
function sessionState(): Promise<AccountState> {
  probe ??= readSession();
  return probe;
}

export function AccountAction({
  className,
  launcherClassName,
  requestClassName,
}: {
  className: string;
  launcherClassName: string;
  requestClassName: string;
}) {
  const [state, setState] = useState<AccountState>({ status: 'pending' });

  useEffect(() => {
    let active = true;
    const load = () =>
      void sessionState().then((next) => {
        if (active) setState(next);
      });
    load();
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      probe = null;
      load();
    };
    window.addEventListener('pageshow', onPageShow);
    return () => {
      active = false;
      window.removeEventListener('pageshow', onPageShow);
    };
  }, []);

  if (state.status === 'signed-in') {
    return (
      <>
        <a href="/account" className={className} aria-label={`Account (${state.name})`} title={state.name}>
          <IconUser size={18} />
          {state.label}
        </a>
        <a href="/launcher" className={launcherClassName}>
          Launcher
        </a>
      </>
    );
  }

  return (
    <>
      <a href="/sign-in" className={className} data-account-pending={state.status === 'pending' ? '' : undefined}>
        Sign in
      </a>
      {state.status === 'signed-out' ? (
        <a href="/request-pilot" className={requestClassName}>
          Request pilot
          <IconArrowRight size={16} />
        </a>
      ) : null}
    </>
  );
}
