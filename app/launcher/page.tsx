import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { OrganizationSwitcher, SignOutButton } from '@/components/platform/account-actions';
import { PlatformUnavailable } from '@/components/platform/platform-unavailable';
import { ProductCard } from '@/components/platform/product-card';
import styles from '@/components/platform/platform.module.css';
import { actorDisplayName, resolveActor } from '@/lib/platform/actor';
import { productUrls, requirePlatformSecret } from '@/lib/platform/config';
import { issueCsrfToken } from '@/lib/platform/csrf';
import { withClient } from '@/lib/platform/db';
import { logPlatformPageError } from '@/lib/platform/http';
import { loadLauncher, soleOpenProduct } from '@/lib/platform/launcher';
import { currentAuth } from '@/lib/platform/session';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Decoda | Your products', robots: { index: false, follow: false } };

export default async function LauncherPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const auth = await currentAuth();
  if (!auth) redirect('/sign-in');

  let data;
  try {
    const urls = productUrls();
    const csrfToken = issueCsrfToken(auth.sessionId, requirePlatformSecret());
    data = await withClient(async (client) => ({
      view: await loadLauncher(client, auth, urls),
      actor: await resolveActor(client, auth),
      csrfToken,
    }));
  } catch (error) {
    logPlatformPageError('launcher', error);
    return <PlatformUnavailable />;
  }
  const { view, actor, csrfToken } = data;

  // Straight from sign-in (e.g. an accepted invitation) with exactly one
  // product open: go there instead of stopping at the launcher.
  const { welcome } = await searchParams;
  if (welcome === '1') {
    const sole = soleOpenProduct(view);
    if (sole?.url) redirect(sole.url);
  }

  return (
    <div className="content-stack">
      <div className={styles.page}>
        <header className={styles.pageHeader}>
          <div>
            <p className="eyebrow">Decoda</p>
            <h1>Welcome, {actorDisplayName(actor)}</h1>
            <p>
              {view.activeOrganization
                ? `Products available to ${view.activeOrganization.name}. Access is set by your organization's Decoda agreement.`
                : 'Your account is signed in to Decoda.'}
            </p>
          </div>
          <div className={styles.headerActions}>
            <Link className={styles.linkButton} href="/account">
              Account
            </Link>
            {actor.grant ? (
              <Link className={styles.linkButton} href="/admin">
                Platform admin
              </Link>
            ) : null}
            <SignOutButton csrfToken={csrfToken} />
          </div>
        </header>

        {view.organizations.length === 0 ? (
          <section className={styles.panel} aria-labelledby="no-org">
            <h2 id="no-org">No organization access</h2>
            <p>
              Your Decoda account is not a member of an organization yet. If you were invited, open the invitation email and
              accept it with this address. Otherwise, request a pilot and the Decoda team will review it.
            </p>
            <p style={{ marginTop: 14 }}>
              <Link className="button-primary" href="/request-pilot">
                Request a pilot
              </Link>
            </p>
          </section>
        ) : null}

        {view.organizations.length > 0 && !view.activeOrganization ? (
          <section className={styles.panel} aria-labelledby="choose-org">
            <h2 id="choose-org">Choose an organization</h2>
            <p>Select the organization you want to work in. You can switch at any time.</p>
            <OrganizationSwitcher organizations={view.organizations} csrfToken={csrfToken} />
          </section>
        ) : null}

        <section aria-label="Decoda products" className={styles.productGrid}>
          {view.products.map((product) => (
            <ProductCard key={product.product} product={product} />
          ))}
        </section>

        {view.activeOrganization && view.organizations.length > 1 ? (
          <section className={styles.panel} aria-labelledby="switch-org">
            <h2 id="switch-org">Organizations</h2>
            <p>You belong to more than one organization. Switching reloads each product in that organization.</p>
            <OrganizationSwitcher organizations={view.organizations} csrfToken={csrfToken} />
          </section>
        ) : null}
      </div>
    </div>
  );
}
