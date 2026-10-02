'use client';

/**
 * The header's account-aware actions, one per slot:
 *
 *   AccountAction  "Sign in" → /sign-in              | their name → /account
 *   PrimaryAction  "Request pilot" → /request-pilot  | "Open launcher" → /launcher
 *
 * Signed out, the header offers the two ways into Decoda: sign in, or request a
 * pilot. There is no "Register": Decoda accounts are created by invitation.
 * Signed in, it offers the person's account and their products; requesting a
 * product their organization does not have is done from the launcher.
 *
 * Pages stay static (the header never reads the session on the server), so the
 * state is asked of /api/session once per page load and shared by every
 * instance (desktop and mobile). Until it answers, both actions keep their
 * place but are hidden (globals.css, `data-account-pending`), so a signed-in
 * visitor never sees "Sign in" or "Request pilot". Without JavaScript they are
 * the plain signed-out links, as before.
 */
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { IconArrowRight, IconUser } from './icons';

export type AccountState = { status: 'pending' } | { status: 'signed-out' } | { status: 'signed-in'; label: string; name: string };

const SIGNED_OUT: AccountState = { status: 'signed-out' };
const PROBE_TIMEOUT_MS = 4000;

let probe: Promise<AccountState> | null = null;
let probeFor: Event | null = null;

/** The header's state from an /api/session answer. Anything unexpected is "signed out". */
export function accountStateFrom(data: unknown): AccountState {
  const body = (data ?? {}) as { signedIn?: unknown; user?: { firstName?: unknown; name?: unknown } };
  if (body.signedIn !== true) return SIGNED_OUT;
  const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);
  const name = text(body.user?.name) ?? 'Decoda account';
  return { status: 'signed-in', label: text(body.user?.firstName) ?? 'Account', name };
}

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
    return accountStateFrom(await response.json());
  } catch {
    return SIGNED_OUT;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * One request per page load, shared by every instance. A page restored from the
 * back/forward cache may predate a sign-in or sign-out: its `pageshow` event
 * starts one fresh request, however many instances receive it.
 */
function sessionState(restored: Event | null): Promise<AccountState> {
  if (restored && restored !== probeFor) {
    probeFor = restored;
    probe = null;
  }
  probe ??= readSession();
  return probe;
}

function useAccountState(): AccountState {
  const [state, setState] = useState<AccountState>({ status: 'pending' });

  useEffect(() => {
    let active = true;
    const load = (restored: Event | null) =>
      void sessionState(restored).then((next) => {
        if (active) setState(next);
      });
    load(null);
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) load(event);
    };
    window.addEventListener('pageshow', onPageShow);
    return () => {
      active = false;
      window.removeEventListener('pageshow', onPageShow);
    };
  }, []);

  return state;
}

const pendingMarker = (state: AccountState) => (state.status === 'pending' ? '' : undefined);

/** The account slot for a session state. */
export function AccountLink({ state, className }: { state: AccountState; className: string }) {
  if (state.status === 'signed-in') {
    return (
      <a href="/account" className={className} aria-label={`Account (${state.name})`} title={state.name}>
        <IconUser size={18} />
        {state.label}
      </a>
    );
  }
  return (
    <a href="/sign-in" className={className} data-account-pending={pendingMarker(state)}>
      Sign in
    </a>
  );
}

/** The primary slot for a session state. */
export function PrimaryLink({ state, className }: { state: AccountState; className: string }) {
  if (state.status === 'signed-in') {
    return (
      <a href="/launcher" className={className}>
        Open launcher
        <IconArrowRight size={16} />
      </a>
    );
  }
  return (
    <Link href="/request-pilot" className={className} data-account-pending={pendingMarker(state)}>
      Request pilot
      <IconArrowRight size={16} />
    </Link>
  );
}

export function AccountAction({ className }: { className: string }) {
  return <AccountLink state={useAccountState()} className={className} />;
}

export function PrimaryAction({ className }: { className: string }) {
  return <PrimaryLink state={useAccountState()} className={className} />;
}
