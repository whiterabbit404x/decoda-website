/**
 * The site header's account-aware actions, rendered for every session state.
 *
 * Decoda accounts are created by invitation, so a signed-out visitor is offered
 * exactly two ways in — Sign in and Request pilot — and a signed-in person their
 * account and the launcher, never "Request pilot" as the main action. The
 * session itself is checked black-box in tests/http/site-header.test.ts.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createElement, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { accountStateFrom, AccountLink, PrimaryLink, type AccountState } from './account-action';

const SIGNED_IN: AccountState = { status: 'signed-in', label: 'Tony', name: 'Tony Pham' };
const STATES: AccountState[] = [{ status: 'pending' }, { status: 'signed-out' }, SIGNED_IN];

/** The header's two slots, side by side, as the desktop header and the mobile menu render them. */
function header(state: AccountState): string {
  return renderToStaticMarkup(
    createElement(
      Fragment,
      null,
      createElement(AccountLink, { state, className: 'account' }),
      createElement(PrimaryLink, { state, className: 'button-primary' }),
    ),
  );
}

function links(html: string): Array<{ href: string; text: string; pending: boolean }> {
  return [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map(([, attributes, inner]) => ({
    href: /\bhref="([^"]*)"/.exec(attributes)?.[1] ?? '',
    text: inner.replace(/<[^>]+>/g, '').trim(),
    pending: /\bdata-account-pending=""/.test(attributes),
  }));
}

describe('site header actions', () => {
  it('signed out: Sign in and Request pilot', () => {
    assert.deepEqual(links(header({ status: 'signed-out' })), [
      { href: '/sign-in', text: 'Sign in', pending: false },
      { href: '/request-pilot', text: 'Request pilot', pending: false },
    ]);
  });

  it('signed in: the account and the launcher, never Sign in or Request pilot', () => {
    const html = header(SIGNED_IN);
    assert.deepEqual(links(html), [
      { href: '/account', text: 'Tony', pending: false },
      { href: '/launcher', text: 'Open launcher', pending: false },
    ]);
    assert.match(html, /aria-label="Account \(Tony Pham\)"/);
    assert.doesNotMatch(html, /Sign in|Request pilot/);
  });

  it('while the session check is pending, the signed-out links hold their place, hidden', () => {
    assert.deepEqual(links(header({ status: 'pending' })), [
      { href: '/sign-in', text: 'Sign in', pending: true },
      { href: '/request-pilot', text: 'Request pilot', pending: true },
    ]);
  });

  it('the launcher is the only product entry: no product URL is ever linked from the header', () => {
    for (const state of STATES) {
      for (const { href } of links(header(state))) {
        assert.ok(['/sign-in', '/request-pilot', '/account', '/launcher'].includes(href), href);
      }
    }
  });

  it('never offers a registration path (accounts are created by invitation)', () => {
    for (const state of STATES) {
      assert.doesNotMatch(header(state), /register|sign[\s-]?up|create (an |your )?account/i);
    }
  });
});

describe('header state from /api/session', () => {
  it('a signed-in answer shows the first name, with the full name for assistive technology', () => {
    assert.deepEqual(accountStateFrom({ signedIn: true, user: { firstName: 'Tony', name: 'Tony Pham' } }), SIGNED_IN);
    assert.deepEqual(accountStateFrom({ signedIn: true, user: { firstName: null, name: 'tony@decoda.example' } }), {
      status: 'signed-in',
      label: 'Account',
      name: 'tony@decoda.example',
    });
    assert.deepEqual(accountStateFrom({ signedIn: true, user: {} }), { status: 'signed-in', label: 'Account', name: 'Decoda account' });
  });

  it('anything else is signed out', () => {
    for (const body of [{ signedIn: false }, { signedIn: 'true' }, {}, null, 'yes', []]) {
      assert.deepEqual(accountStateFrom(body), { status: 'signed-out' });
    }
  });
});
