/**
 * Data for the Decoda product launcher, account page and product switcher.
 *
 * Everything is read through the same `platform_api` contract views the
 * products use, so www can never show a product as open that the product
 * itself would refuse (or the reverse). The browser only ever receives
 * presentation states; the decision stays on the server.
 */
import type { AuthSnapshot } from './actor';
import type { ProductUrls } from './config';
import type { DbClient } from './db';
import {
  launcherState,
  launcherStateOpensProduct,
  PRODUCT_DESCRIPTIONS,
  PRODUCT_LABELS,
  PRODUCTS,
  type AccessState,
  type LauncherState,
  type ProductKey,
} from './products';

export interface LauncherOrganization {
  platformOrganizationId: string;
  name: string;
  role: 'admin' | 'member';
  active: boolean;
}

export interface LauncherProduct {
  product: ProductKey;
  label: string;
  description: string;
  state: LauncherState;
  accessState: AccessState;
  url: string | null;
  requestAccessUrl: string | null;
  expiresAt: string | null;
}

export interface LauncherView {
  organizations: LauncherOrganization[];
  activeOrganization: LauncherOrganization | null;
  products: LauncherProduct[];
}

export async function loadLauncher(client: DbClient, auth: AuthSnapshot, urls: ProductUrls): Promise<LauncherView> {
  const orgRows = await client.query<{
    platform_organization_id: string;
    workos_organization_id: string;
    organization_name: string;
    organization_role: 'admin' | 'member';
  }>(
    `SELECT platform_organization_id, workos_organization_id, organization_name, organization_role
       FROM platform_api.user_organizations_v1
      WHERE workos_user_id = $1
      ORDER BY organization_name, platform_organization_id`,
    [auth.workosUserId],
  );
  const organizations = orgRows.rows.map((row) => ({
    platformOrganizationId: row.platform_organization_id,
    name: row.organization_name,
    role: row.organization_role,
    active: row.workos_organization_id === auth.organizationId,
  }));
  const activeOrganization = organizations.find((org) => org.active) ?? null;

  const accessRows = activeOrganization
    ? (
        await client.query<{
          product: ProductKey;
          access_state: AccessState;
          entitlement_status: string | null;
          entitlement_expires_at: Date | null;
        }>(
          `SELECT product, access_state, entitlement_status, entitlement_expires_at
             FROM platform_api.product_access_v1
            WHERE workos_user_id = $1 AND workos_organization_id = $2`,
          [auth.workosUserId, auth.organizationId],
        )
      ).rows
    : [];

  const products = PRODUCTS.map((product): LauncherProduct => {
    const row = accessRows.find((candidate) => candidate.product === product);
    // Assets is shown as "Coming soon" to everyone until the catalog changes.
    const accessState: AccessState = row?.access_state ?? (product === 'assets' ? 'product_unavailable' : 'no_membership');
    const state = launcherState(accessState, row?.entitlement_status ?? null);
    return {
      product,
      label: PRODUCT_LABELS[product],
      description: PRODUCT_DESCRIPTIONS[product],
      state,
      accessState,
      url: launcherStateOpensProduct(state) ? urls[product] : null,
      requestAccessUrl: state === 'not_enabled' && product !== 'assets' ? `/request-pilot?product=${product}` : null,
      expiresAt: row?.entitlement_expires_at ? row.entitlement_expires_at.toISOString() : null,
    };
  });

  return { organizations, activeOrganization, products };
}

/** The single product to forward to after sign-in, when there is exactly one. */
export function soleOpenProduct(view: LauncherView): LauncherProduct | null {
  const open = view.products.filter((product) => product.url);
  return open.length === 1 ? open[0]! : null;
}
