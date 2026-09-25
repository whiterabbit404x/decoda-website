import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { OrganizationSwitcher, SignOutButton } from '@/components/platform/account-actions';
import { PlatformUnavailable } from '@/components/platform/platform-unavailable';
import { StateBadge } from '@/components/platform/product-card';
import styles from '@/components/platform/platform.module.css';
import { actorDisplayName } from '@/lib/platform/actor';
import { productUrls, requirePlatformSecret } from '@/lib/platform/config';
import { issueCsrfToken } from '@/lib/platform/csrf';
import { withClient } from '@/lib/platform/db';
import { logPlatformPageError } from '@/lib/platform/http';
import { loadLauncher } from '@/lib/platform/launcher';
import { currentAuth } from '@/lib/platform/session';
import { getWorkOSGateway } from '@/lib/platform/workos';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Decoda | Account', robots: { index: false, follow: false } };

async function mfaStatus(workosUserId: string): Promise<string> {
  try {
    const factors = await getWorkOSGateway().countAuthFactors(workosUserId);
    return factors > 0
      ? 'Authenticator app enrolled. Decoda asks for it when you sign in.'
      : 'No authenticator app enrolled with Decoda. If your organization signs in with SSO, your identity provider enforces MFA.';
  } catch {
    return 'Unavailable right now.';
  }
}

export default async function AccountPage() {
  const auth = await currentAuth();
  if (!auth) redirect('/sign-in?returnTo=/account');

  let data;
  try {
    const urls = productUrls();
    const csrfToken = issueCsrfToken(auth.sessionId, requirePlatformSecret());
    data = await withClient(async (client) => {
      const view = await loadLauncher(client, auth, urls);
      const user = await client.query<{ email_verified: boolean }>('SELECT email_verified FROM platform.users WHERE workos_user_id = $1', [
        auth.workosUserId,
      ]);
      return { view, emailVerified: Boolean(user.rows[0]?.email_verified), csrfToken };
    });
  } catch (error) {
    logPlatformPageError('account', error);
    return <PlatformUnavailable />;
  }
  const { view, emailVerified, csrfToken } = data;
  const mfa = await mfaStatus(auth.workosUserId);
  const enabled = view.products.filter((product) => product.state === 'open' || product.state === 'pilot');

  return (
    <div className="content-stack">
      <div className={styles.page}>
        <header className={styles.pageHeader}>
          <div>
            <p className="eyebrow">Decoda account</p>
            <h1>{actorDisplayName(auth)}</h1>
            <p>One Decoda identity for every Decoda product. Passwords, multi-factor authentication and SSO are managed centrally.</p>
          </div>
          <div className={styles.headerActions}>
            <Link className={styles.linkButton} href="/launcher">
              Products
            </Link>
            <SignOutButton csrfToken={csrfToken} />
          </div>
        </header>

        <div className={styles.twoColumn}>
          <section className={styles.panel} aria-labelledby="profile">
            <h2 id="profile">Profile &amp; organization</h2>
            <dl className={styles.definitionList}>
              <dt>User</dt>
              <dd>{actorDisplayName(auth)}</dd>
              <dt>Email</dt>
              <dd>
                {auth.email} {emailVerified ? <span className={styles.badge} data-tone="open">Verified</span> : null}
              </dd>
              <dt>Organization</dt>
              <dd>{view.activeOrganization?.name ?? 'No active organization'}</dd>
              <dt>Role</dt>
              <dd>{view.activeOrganization ? (view.activeOrganization.role === 'admin' ? 'Organization admin' : 'Member') : '—'}</dd>
              <dt>Products enabled</dt>
              <dd>
                {enabled.length === 0 ? (
                  'None'
                ) : (
                  <span className={styles.inlineActions}>
                    {enabled.map((product) => (
                      <span key={product.product}>
                        {product.label} <StateBadge state={product.state} />
                      </span>
                    ))}
                  </span>
                )}
              </dd>
            </dl>
          </section>

          <section className={styles.panel} aria-labelledby="security">
            <h2 id="security">Security</h2>
            <dl className={styles.definitionList}>
              <dt>Multi-factor authentication</dt>
              <dd>{mfa}</dd>
              <dt>Password &amp; recovery</dt>
              <dd>Handled on the Decoda sign-in page (&ldquo;Forgot password&rdquo;). Decoda products never store your password.</dd>
              <dt>Sessions</dt>
              <dd>Signing out ends your Decoda session in every product.</dd>
            </dl>
          </section>
        </div>

        {view.organizations.length > 1 ? (
          <section className={styles.panel} aria-labelledby="orgs">
            <h2 id="orgs">Organizations</h2>
            <p>Switching changes the organization every Decoda product opens in.</p>
            <OrganizationSwitcher organizations={view.organizations} csrfToken={csrfToken} />
          </section>
        ) : null}
      </div>
    </div>
  );
}
