-- Decoda Platform — Decoda Assets goes live.
--
-- Assets (assets.decodasecurity.com) was registered in 0001 as `coming_soon`,
-- which platform_api.product_access_v1 turns into `product_unavailable` for
-- every organization. This moves it to `available`, the state RWA Guard and
-- Vault are in. Nothing else changes:
--   * access still requires an active user, organization and membership AND
--     an `enabled` / `pilot` entitlement for `assets` that has started and
--     not expired — the view is untouched;
--   * no entitlement is created here. Organizations are granted Assets
--     through the audited admin path (`/admin/organizations/<id>` →
--     POST /api/admin/organizations/<id>/entitlements).
--
-- An `assets` entitlement recorded while the product was `coming_soon`
-- becomes effective when this runs. Review them first:
--   SELECT o.name, e.status, e.plan, e.expires_at
--     FROM platform.organization_product_entitlements e
--     JOIN platform.organizations o ON o.id = e.organization_id
--    WHERE e.product = 'assets' AND e.status IN ('enabled', 'pilot');
--
-- Rollback: a corrective migration setting `availability = 'coming_soon'`.

DO $$
BEGIN
    UPDATE platform.products
       SET availability = 'available', updated_at = now()
     WHERE product = 'assets' AND availability <> 'available';
    IF FOUND THEN
        PERFORM platform.append_audit_event(
            'system', NULL, 'platform migration 0003_assets_available', 'product.availability_changed',
            NULL, 'product', 'assets', 'success', NULL, NULL, NULL,
            jsonb_build_object('product', 'assets', 'from', 'coming_soon', 'to', 'available')
        );
    END IF;
END
$$;
