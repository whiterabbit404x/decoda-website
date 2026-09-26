# Decoda shared identity & onboarding — migration plan

Status: **approved for implementation on branches; no production cutover yet.**
Owner: Decoda Platform (this repository owns the platform data boundary).
Scope: `decoda-website` (www + platform), `decoda-vault`, `decoda-rwa-guard`.
Assets (`assets.decodasecurity.com`) is prepared for, not built.

This document was written after inspecting all three repositories and before
changing any of them. It records what exists today, what replaces it, the
order of the change, and how each step is rolled back.

---

## 1. What exists today (inspection findings)

### decoda-website (www.decodasecurity.com, Next.js 15 on Vercel)
- Marketing site only. No authentication, no database, no middleware.
- `/contact` → `POST /api/contact` → Resend (notification + best-effort
  acknowledgment). Validation, honeypot and a per-instance in-memory rate
  limiter live in `lib/contact.ts` / `lib/rate-limit.ts`; the provider wrapper
  is `lib/email.ts`. Header CTA is "Request a demo" → `/contact`.
- No CSP or security headers are configured.

### decoda-vault (vault.decodasecurity.com, FastAPI API on Railway + Next.js 16 BFF)
- Standalone identity in the `vault` schema: `vault.users` (scrypt password
  hashes), `vault.memberships` (per-org role arrays), `vault.sessions`
  (server-side, token + CSRF stored only as SHA-256 digests, session version,
  revocation), TOTP MFA with AES-GCM-encrypted seeds, org `mfa_policy`
  (`optional | required_for_approvals | required`).
- Access tokens are HMAC tokens with a `decoda-vault` audience; the BFF holds
  them in the HttpOnly `vault_session` cookie; CSRF is a synchronizer token
  echoed from the readable `vault_csrf` cookie. The browser never holds a
  bearer token. Nonce-based CSP via `proxy.ts`.
- Fine-grained product RBAC (`org_admin`, `treasury_operator`, `approver`,
  `security_reviewer`, `issuer_admin`, `signer`, `auditor`, `viewer`) with a
  permission matrix and separation-of-duties rules in the services.
- Demo seed (`python -m vault_api.seed.demo`) creates a TESTNET/DEMO org with
  eleven accounts; `VAULT_ALLOW_DEMO_SEED` can enable it in production and
  `VAULT_DEMO_PASSWORD` sets their password; the dev default password is
  public in the README. The sign-in page can list demo accounts
  (`VAULT_SHOW_DEMO_ACCOUNTS`).
- MVP boundary is enforced in schema and code (testnet-only orgs and
  networks, no key material columns, key-material request guard, append-only
  audit/approvals/decisions). **None of this changes.**

### decoda-rwa-guard (rwa.decodasecurity.com, FastAPI monolith + Next.js 16)
- Its own identity: `users` (password hash, email verification, TOTP MFA +
  recovery codes, `session_version`, `suspended_at`, `auth_provider` +
  `external_subject` columns already present), `auth_sessions` (keyed-hash
  tokens, `auth_mode`, MFA/reauth timestamps), per-workspace OIDC and SCIM.
- Tenancy: `organizations` (plan/status/evaluation window) own `workspaces`;
  `organization_memberships` (`owner|admin|analyst|viewer`) and
  `workspace_members`; `workspace_role_permissions` (explicit RBAC).
  `users.is_internal_admin` is the founder/staff flag.
- **Approval-only Pilot flow already exists** (`pilot_access.py`, migration
  0151): public request → internal review → approve (Guard-minted invitation
  token) → invited → accept → organization provisioned. Guard also still has
  a `/auth/signup` endpoint that creates an account (but no tenant).
- Session handling weakness: the web client stores the access token in
  `localStorage` and a non-HttpOnly `decoda_access_token` cookie, and ~48
  client modules call the Railway API cross-origin with `Authorization:
  Bearer`. This violates the target session rules and is fixed in Phase 4.
- Pilot plans raise the MFA floor to "all members" (`mfa_authorization.py`).

### Gaps against the target
1. Two unrelated password systems (Vault, Guard) and a third account model
   would be needed for Assets. Same person = two passwords today.
2. Guard's Pilot approval flow is product-local; Vault has none.
3. No shared notion of "which Decoda products does this organization have".
4. Guard exposes its session token to page scripts.
5. Demo credentials are reachable from Vault production configuration.

---

## 2. Target architecture

```
                         WorkOS AuthKit (one environment per stage)
             users · organizations · memberships · invitations · MFA · SSO
        ┌──────────────┬───────────────┬───────────────┬────────────────┐
        │ App: Website │ App: RWA Guard│ App: Vault    │ App: Assets    │
        │ client_A     │ client_B      │ client_C      │ client_D (later)│
        └──────┬───────┴──────┬────────┴──────┬────────┴───────┬────────┘
               │ OAuth code+PKCE per app (own redirect URI, own sealed session cookie)
               ▼              ▼               ▼                ▼
   www.decodasecurity.com  rwa.…            vault.…          assets.… (future)
   (platform owner)        Guard BFF+API    Vault BFF+API
        │ writes                 │ reads            │ reads
        ▼                        ▼                  ▼
   ┌──────────────────────── Decoda Platform DB (Neon) ─────────────────────┐
   │ schema platform     : organizations, users (WorkOS mapping),           │
   │                       memberships, organization_product_entitlements,  │
   │                       pilot_requests, invitations, platform admin      │
   │                       grants, workos_events, session revocations,      │
   │                       legacy identity links, audit_events              │
   │ schema platform_api : read-only, versioned views (the product contract)│
   └─────────────────────────────────────────────────────────────────────────┘
   Guard DB (guard domain data)   Vault DB (`vault` schema)   Assets DB (future)
```

**Identity** (who / which org) comes from WorkOS. **Entitlement** (which Decoda
products the org has) comes from the platform DB. **Authorization inside a
product** stays in that product's RBAC. Product databases never hold another
product's data and never query each other.

### Ownership boundary
- The platform schema and its migrations live in this repository
  (`platform/migrations`). Only the website deployment (and operator CLIs in
  `scripts/platform`) write to it.
- Products read through `platform_api.*_v1` views with a dedicated read-only
  role (`decoda_platform_reader`). The views are the contract; base tables can
  evolve. A breaking change ships as `*_v2` alongside `*_v1`.
- Nothing about identity is stored in or read from the Vault database by
  another product.

---

## 3. Decisions

| # | Decision | Why |
|---|---|---|
| D1 | WorkOS AuthKit, hosted UI, **one WorkOS environment per stage**, one **Application per product** (Website, RWA Guard, Vault; Assets later). | Applications share users/orgs/memberships/invitations but each has its own client ID, redirect URIs, session policy and credentials. |
| D2 | Each app runs the official SDK (`@workos-inc/authkit-nextjs` + `@workos-inc/node`) with the SDK's env names (`WORKOS_CLIENT_ID`, `WORKOS_API_KEY`, `WORKOS_COOKIE_PASSWORD`, `NEXT_PUBLIC_WORKOS_REDIRECT_URI`). Session cookie is host-only (`WORKOS_COOKIE_DOMAIN` unset). | No broad `.decodasecurity.com` auth cookie. SSO between apps is the provider's own flow: an app with no session redirects to AuthKit, which recognises the AuthKit session and returns a code for that app. |
| D3 | Product APIs (Python) verify WorkOS access tokens themselves: RS256 against `https://api.workos.com/sso/jwks/<client_id>`, `iss` = `WORKOS_ISSUER` (required in production), `exp`/`iat`, `sid`, `sub`, `org_id` required. The BFF is never trusted to vouch for identity. | Pattern of the official Python SDK (`workos` 10.5), which also names `WORKOS_ISSUER`. |
| D4 | **Session exchange + continuous re-validation.** At callback the BFF sends the WorkOS access token to the product API, which verifies it, checks platform access, links/provisions the product-local user and membership, and issues a product session bound to the WorkOS session id (`sid`). Every API request re-checks platform access (cached ≤15 s) and the revocation list. Every BFF request also requires a live AuthKit session (`withAuth`), so a WorkOS-side sign-out or revocation stops the product within one access-token lifetime even if a webhook is lost. | Reuses each product's hardened session/CSRF/RBAC/audit machinery instead of rewriting it. |
| D5 | Active organization = the `org_id` claim. Switching calls AuthKit `switchToOrganization` (WorkOS re-validates membership) after the product verified the target org is one of the user's active platform memberships, then re-exchanges and does a full page reload. | Browser-supplied org ids are never trusted; client state is discarded on switch. |
| D6 | Invitations are WorkOS invitations sent with the **Website** application's API key, so the recipient returns to www, which routes them to their entitled product. | WorkOS preserves the application context of the key that sent the invitation. |
| D7 | Memberships come only from WorkOS facts (webhooks + API sync). No email-domain auto-join; WorkOS domain JIT provisioning stays off. | Email domain is not proof of membership. |
| D8 | Entitlements: `organization_product_entitlements(product ∈ rwa_guard, vault, assets; status ∈ enabled, disabled, pilot, suspended; plan; starts_at; expires_at)`. Access = user active ∧ org active ∧ membership active ∧ product available ∧ status ∈ {enabled, pilot} ∧ started ∧ not expired. Computed once, in SQL (`platform_api.product_access_v1.access_state`). | Single source of truth; products and the launcher read the same answer. |
| D9 | Product RBAC stays in products. First entry JIT-provisions a least-privilege product membership (Vault `viewer`, Guard `viewer`), except the org's platform **admin**, who is bootstrapped as product admin (Vault `org_admin`; Guard `owner` if the tenant has none, else `admin`). After that, the product owns the roles. | No giant shared "admin" boolean. |
| D10 | Platform admin = row in `platform.platform_admin_grants` with explicit permissions, checked server-side on every admin request. Bootstrapped by an operator CLI (`npm run platform:grant-admin`), never by an email in code. | Auditable, revocable, testable. |
| D11 | WorkOS webhooks land on the platform (`POST /api/webhooks/workos`). SDK signature verification + our own future-timestamp check, then idempotency on the event id (`platform.workos_events`), out-of-order protection via `updated_at`. | Verified before parsing; replays are no-ops. |
| D12 | Request Pilot lives on www and persists to `platform.pilot_requests` (pending → approved/rejected → converted). Emails are best-effort and tracked; persistence is the success criterion. | A form submission is never an account. |
| D13 | MFA is enforced by WorkOS (environment setting, all non-SSO sign-ins; SSO delegates to the customer IdP). Products require an explicit deployment attestation (`DECODA_IDP_MFA_REQUIRED=true`) before they count a WorkOS login as MFA-verified, deny impersonated sessions, and implement step-up as AuthKit re-authentication (`max_age`) verified by `auth_time`. Product TOTP code is not extended. | No new TOTP cryptography; no route can downgrade the org's MFA policy. |
| D14 | Vault production accepts only WorkOS identity; password sign-in returns 410; demo seeding is refused in staging/production regardless of flags. Rollback = redeploy the previous release (all schema changes are additive). | No silent fallback, no public demo credentials in production. |
| D15 | Guard gets an explicit, time-boxed migration mode: `legacy` → `dual` (WorkOS primary; legacy password only for not-yet-linked users; no new password sign-ups; sunset date enforced) → `workos`. | Plaintext passwords cannot be migrated; existing customers must keep working while they activate Decoda accounts. |
| D16 | Existing Guard users migrate through a reviewed manifest: Guard export (dry-run) → platform import (dry-run, then apply) → WorkOS invitation → acceptance binds `workos_user_id` to the recorded legacy user id → Guard links on first WorkOS sign-in. Ambiguous identities are reported as `conflict`, never merged. | "Match only through a controlled migration process." |
| D17 | `assets` exists in the product enum, catalog and contract with availability `coming_soon`; access is denied until the catalog marks it available. | Assets can consume the same identity/entitlements later without a new account system. |
| D18 | The hosted AuthKit domain is whatever the WorkOS environment serves. `auth.decodasecurity.com` is configured in WorkOS + DNS when ready; no code references it. `WORKOS_ISSUER` changes with it. | Don't fake a domain that doesn't exist yet. |

---

## 4. Platform data model (`platform/migrations/0001_platform_foundation.sql`)

| Table | Purpose / key constraints |
|---|---|
| `platform.products` | Catalog: `rwa_guard`, `vault` (`available`), `assets` (`coming_soon`). |
| `platform.users` | Internal UUID + `workos_user_id` (UNIQUE), email, name, status, `workos_updated_at`. |
| `platform.organizations` | Internal UUID + `workos_organization_id` (UNIQUE, NULL until linked), unique slug, status, `security_settings`, `is_internal`. |
| `platform.organization_memberships` | (org, user) UNIQUE, `workos_membership_id` UNIQUE, role `admin|member`, status mirrors WorkOS `active|inactive|pending`, source. |
| `platform.organization_product_entitlements` | (org, product) UNIQUE, status/plan/starts_at/expires_at/metadata, actor columns. |
| `platform.pilot_requests` | Fields from the Request Pilot form, `status pending|approved|rejected|converted`, `reviewed_at/by`, `organization_id`, `request_id`, `source`, `metadata`; at most one **pending** request per email (partial unique index). No secrets. |
| `platform.invitations` | Mirror of WorkOS invitations (`workos_invitation_id` UNIQUE), intended role, state, expiry, actors; one pending invitation per (org, email). |
| `platform.platform_admin_grants` | Explicit platform-admin permissions, one active grant per user, reason + actors. |
| `platform.workos_events` | Webhook idempotency ledger (event id PK, type, status, attempts). |
| `platform.workos_session_revocations` | `session.revoked` facts products check per request. |
| `platform.legacy_identity_links` | Reviewed legacy-user ↔ platform-org ↔ invitation ↔ WorkOS-user links (`pending_invitation|invited|linked|conflict|skipped`). |
| `platform.audit_events` | Append-only (UPDATE/DELETE/TRUNCATE raise), hash-chained. Never stores passwords, cookies, tokens, MFA secrets or API keys. |

Product contract views (`platform_api`, SELECT-only for `decoda_platform_reader`):
- `product_access_v1` — one row per (WorkOS user, WorkOS org, product) with the
  raw facts and the computed `access_state` (`granted` or the denial reason).
- `user_organizations_v1` — active memberships for org switchers/launcher.
- `session_revocations_v1` — revoked WorkOS session ids.
- `legacy_identity_links_v1` — linked legacy users, per product.

All schema changes are forward-only, transactional SQL files with checksums
(drift is refused), applied by `npm run platform:migrate` under an advisory
lock. Rollback of a migration = a new corrective migration; the foundation
migration is additive and can be dropped wholesale (`DROP SCHEMA platform,
platform_api CASCADE`) only before any customer data exists.

---

## 5. Flows

### 5.1 Request Pilot (www)
`/request-pilot` form → `POST /api/pilot-requests`: same-origin + custom-header
check, JSON only, signed form token (bot/time trap) + honeypot, per-IP
in-memory and per-email/IP-hash DB rate limits, server-side validation and
normalisation (lower-cased NFC email, free-mail domains flagged for the
reviewer, not blocked), correlation id, insert `pending`, audit
`pilot.requested`, then best-effort templated emails (prospect confirmation
that does **not** claim approval; internal notification). A duplicate pending
request returns the same response and sends nothing. **No account, org or
membership is created.**

### 5.2 Review & provisioning (platform admin, www/admin)
Approve → create/link platform org (unique slug) → create WorkOS org with
`externalId = platform org id` (idempotency key) → set entitlements for the
requested products (Assets only recorded while `coming_soon`) → send WorkOS
invitation (role `admin`) → request `converted`. Reject records reviewer +
internal note. Revoke invitation, resend, change/disable entitlements, and
suspend orgs are separate audited actions. Every action checks the admin grant
server-side and requires the platform CSRF token + same-origin request.

### 5.3 Invitation acceptance
WorkOS email → AuthKit hosted flow (new user signs up; existing user signs in;
users already in other orgs gain an additional membership) → www
`/auth/callback` → platform syncs the user/membership from WorkOS on demand
(webhooks also arrive) → launcher. One entitled product → redirected straight
into it. A different account than the invited email never receives the
membership (WorkOS binds the invitation to the address; the platform never
grants membership by email match).

### 5.4 Product sign-in (Guard / Vault)
`/sign-in` ("Sign in to Decoda") → AuthKit → `/auth/callback` → exchange with
the product API → product session cookies (HttpOnly) → `/dashboard`.
Denials render a professional screen: *Product not enabled for your
organization*, *No organization access*, *Access pending*, *Organization
suspended*.

### 5.5 Organization switch, sign-out
Switch: verify target org via the product API (platform membership) →
`switchToOrganization` → re-exchange (old product session revoked) → full
reload. Sign-out: revoke product session → clear cookies → AuthKit logout URL
(ends the WorkOS session; other apps stop on their next BFF check).

### 5.6 Webhooks
`user.created|updated|deleted`, `organization.created|updated|deleted`,
`organization_membership.created|updated|deleted`,
`invitation.created|accepted|revoked|resent`, `session.revoked` are applied;
`session.created` and `authentication.*` are recorded for audit; everything
else is recorded as ignored.

---

## 6. Session & request security

| Control | Website | Vault | Guard |
|---|---|---|---|
| Identity cookie | `wos-session` (sealed, HttpOnly, Secure in prod, SameSite=Lax, host-only) | same | same |
| Product session | — | `vault_session` HttpOnly + `vault_csrf` (unchanged model) | `decoda_session` HttpOnly only; `localStorage`/readable token cookie removed; browser→API through a same-origin proxy |
| CSRF | HMAC token bound to WorkOS `sid` + Origin check on admin/account mutations; custom header + Origin on public form | synchronizer token (existing) + Origin check (existing) | existing HMAC CSRF + double-submit (existing) |
| Rotation | WorkOS refresh tokens rotate; product session re-issued on every exchange/org switch | | |
| Expiry | WorkOS session policy per application | product session TTL (existing) bounded by the WorkOS session via per-request BFF check | same |
| Revocation | WorkOS logout | product revoke + WorkOS logout + `session.revoked` list + membership/entitlement re-check | same |
| Fail closed | Missing WorkOS/DB config in production → startup/route error; no demo or legacy fallback | API refuses to start in prod without WorkOS/platform config; platform lookup error → 503, never access | same (in `dual`/`workos` modes) |

Authorization caches: grants only, TTL ≤ 15 s (configurable, hard max 60 s);
denials are never cached; a lookup error is a denial.

---

## 7. MFA
- WorkOS environment: MFA required (dashboard → Authentication). SSO users
  follow their IdP policy. Verified at cutover by attempting a sign-in without
  enrolling a factor.
- Products count a WorkOS login as MFA-verified only when
  `DECODA_IDP_MFA_REQUIRED=true` (required in production). Impersonated
  sessions are refused.
- Vault `required_for_approvals` / `required` and Guard's Pilot MFA floor are
  preserved: an approval or response action on a session without verified MFA
  is refused exactly as today; step-up is AuthKit re-authentication
  (`maxAge`) whose `auth_time` the API verifies.

---

## 8. Rollout (each phase is independently deployable and reversible)

| Phase | Ships | Entry criteria | Exit / verification | Rollback |
|---|---|---|---|---|
| 1 | Platform schema, migration runner, WorkOS wrapper, webhook endpoint, entitlement logic, audit (www) | Neon platform DB + reader role created; WorkOS staging env with 3 applications | `platform:migrate --check` clean; signed test webhook accepted, bad signature/replay rejected | Remove webhook endpoint in WorkOS; redeploy previous www; schema is additive |
| 2 | Request Pilot, platform admin console, invitations, www sign-in + launcher + account | Phase 1 live; `platform:grant-admin` run for the first admin; Resend sender verified | End-to-end on staging: request → approve → invite → accept → launcher | Hide nav links / redeploy previous www; data stays |
| 3 | Vault on shared identity | Phases 1–2 live; Vault WorkOS app configured; `decoda_platform_reader` credentials in Vault API | Staging: invited user enters Vault, wrong-org and not-entitled users are refused, org switch, sign-out, tenant-isolation suite | Redeploy previous Vault API + web (migration 0003 is additive; legacy sessions were never deleted) |
| 4 | Guard on shared identity (`dual` mode), HttpOnly-only sessions, legacy-user migration | Phase 3 verified; manifest reviewed; customers notified | Dry-run manifest reviewed; invitations accepted; linked users keep their orgs/roles | Set `GUARD_IDENTITY_MODE=legacy` (explicit), or redeploy previous release |
| 5 | Product switcher + unified account UX (ships inside 2–4) | — | Launcher/switcher states match entitlements | Same as the phase it shipped in |
| 6 | Remove legacy login paths | All active Guard users linked or explicitly retired; sunset date passed; 2 weeks without legacy sign-ins | Legacy endpoints return 410, then are deleted in a later release | Re-enable only via redeploy of the prior release |

Production cutover checklist: §11.

---

## 9. Existing RWA Guard users
1. `python -m services.api.scripts.identity_migration_export --out manifest.json`
   (read-only transaction on the Guard DB). Classifies each account:
   `matched` (already linked to a WorkOS user), `needs_invitation` (active,
   verified email, member of ≥1 active organization), `conflict`
   (case-insensitive duplicate, unverified or malformed email), `skipped`
   (suspended, no organization, every organization inactive, reserved test
   domain). Each account carries its primary organization (strongest role).
   Decoda internal staff are **annotated** (`internal_admin: true`), not
   skipped: they need a linked Decoda identity to keep using the staff
   console after cutover. No password, MFA secret, token or recovery code is
   exported. The command prints the manifest's SHA-256.
2. `npm run platform:import-legacy -- --product rwa_guard --manifest manifest.json`
   is a dry run by default: it reads the platform DB only (no WorkOS calls) and
   prints the plan per organization and per account.
   `--apply --admin-workos-user-id user_… --operator "<you>" --reason "<why>"`
   runs as that platform admin, who must hold the
   `organizations.manage`, `entitlements.manage` and `invitations.manage`
   permissions. For each imported organization it creates:
   - a platform organization;
   - an `rwa_guard` entitlement: `pilot` for Guard Pilot tenants, otherwise
     `enabled`. It has no expiry, because Guard's own plan still governs
     limits and its evaluation window;
   - a reviewed `platform.legacy_organization_links` row (migration 0002,
     exposed as `platform_api.legacy_organization_links_v1`);
   - a WorkOS organization.

   For each account it creates a `legacy_identity_links` row and a WorkOS
   invitation into the primary organization. The manifest's SHA-256 is
   recorded on every link.

   Anything ambiguous on the platform side is a conflict and is never applied:
   - an existing member with the same address;
   - an open invitation;
   - a WorkOS identity already linked to another legacy account;
   - a tenant that Guard reports as linked but the platform has no record of.

   Re-running `--apply` is idempotent:
   - it finishes organizations whose WorkOS step failed;
   - it retries failed invitations;
   - once a primary link is `linked`, it invites the person into their
     further organizations.
3. The webhook for the accepted invitation binds the `legacy_identity_links`
   row to the WorkOS identity that accepted it.
4. On the first Decoda sign-in into the organization, Guard links its
   existing tenant to the platform organization, but only through the
   reviewed organization link. A missing or disagreeing link is 409
   `ORGANIZATION_LINK_CONFLICT`, never a twin tenant.
5. Guard then links the account through the bound identity link. That:
   - revokes the account's password sessions (the session version is bumped);
   - keeps its organization memberships, workspace roles and MFA history.

   After linking, password sign-in for that account answers 410
   `DECODA_ACCOUNT_LINKED`. No password or email matching happens at sign-in.

---

## 10. Environment variables (new)

| Where | Variable | Notes |
|---|---|---|
| www | `WORKOS_CLIENT_ID`, `WORKOS_API_KEY`, `WORKOS_COOKIE_PASSWORD`, `NEXT_PUBLIC_WORKOS_REDIRECT_URI` | Website application. Cookie password ≥ 32 chars, unique per app. |
| www | `WORKOS_WEBHOOK_SECRET` | Webhook endpoint secret. |
| www | `DECODA_PLATFORM_DATABASE_URL` | Owner (read-write) role. |
| www | `DECODA_PLATFORM_SECRET` | HMAC key for CSRF/form tokens and IP hashing (≥ 32 chars). |
| www | `DECODA_RWA_GUARD_URL`, `DECODA_VAULT_URL`, `DECODA_ASSETS_URL`, `DECODA_WEBSITE_URL` | Product destinations. |
| www | `PILOT_NOTIFICATION_EMAIL`, `PILOT_FROM_EMAIL` (+ existing `RESEND_API_KEY`) | Request Pilot emails. |
| Vault API | `VAULT_IDENTITY_MODE=workos`, `WORKOS_CLIENT_ID`, `WORKOS_API_KEY`, `WORKOS_ISSUER`, `DECODA_PLATFORM_DATABASE_URL` (reader), `DECODA_IDP_MFA_REQUIRED`, `DECODA_ACCESS_CACHE_TTL_SECONDS` | Removes production use of `VAULT_ALLOW_DEMO_SEED` / `VAULT_DEMO_PASSWORD`. |
| Vault web | `VAULT_IDENTITY_MODE=workos`, `WORKOS_CLIENT_ID`, `WORKOS_API_KEY`, `WORKOS_COOKIE_PASSWORD`, `NEXT_PUBLIC_WORKOS_REDIRECT_URI`, `DECODA_WEBSITE_URL`, `DECODA_RWA_GUARD_URL`, `DECODA_ASSETS_URL` | |
| Guard API | `GUARD_IDENTITY_MODE`, `GUARD_LEGACY_PASSWORD_SUNSET`, `WORKOS_CLIENT_ID`, `WORKOS_API_KEY`, `WORKOS_ISSUER`, `DECODA_PLATFORM_DATABASE_URL` (reader), `DECODA_IDP_MFA_REQUIRED` | |
| Guard web | `GUARD_IDENTITY_MODE`, `WORKOS_CLIENT_ID`, `WORKOS_API_KEY`, `WORKOS_COOKIE_PASSWORD`, `NEXT_PUBLIC_WORKOS_REDIRECT_URI`, `DECODA_WEBSITE_URL`, `DECODA_VAULT_URL`, `DECODA_ASSETS_URL` | |

Exact lists with comments are in each repository's `.env.example`.

---

## 11. WorkOS configuration & pre-cutover checklist

Applications (per environment):

| Application | Redirect URI | Initiate login URI | Sign-out redirect |
|---|---|---|---|
| Decoda Website | `https://www.decodasecurity.com/auth/callback` | `https://www.decodasecurity.com/sign-in` | `https://www.decodasecurity.com/` |
| Decoda RWA Guard | `https://rwa.decodasecurity.com/auth/callback` | `https://rwa.decodasecurity.com/auth/sign-in` | `https://rwa.decodasecurity.com/sign-in?signed_out=1` |
| Decoda Vault | `https://vault.decodasecurity.com/auth/callback` | `https://vault.decodasecurity.com/auth/sign-in` | `https://vault.decodasecurity.com/sign-in?signed_out=1` |
| Decoda Assets (later) | `https://assets.decodasecurity.com/auth/callback` | `https://assets.decodasecurity.com/auth/sign-in` | `https://assets.decodasecurity.com/` |

Environment settings: sign-up **disabled / invite-only**; MFA **required**;
organization domain JIT provisioning **off**; webhook endpoint
`https://www.decodasecurity.com/api/webhooks/workos` subscribed to the events
in §5.6; roles `admin` and `member` exist.

Before production cutover verify: production WorkOS environment (not
staging); redirect/sign-out/initiate URIs exact (no localhost, https only);
invitation lands on www; custom domain (if used) verified and `WORKOS_ISSUER`
updated; webhook signatures verified in production; Secure cookies; no demo
auth fallback and no demo users in production; no committed secrets;
entitlements enforced server-side; tenant isolation suites green; MFA,
logout, and invitation flows exercised on production; rollback steps
rehearsed.

---

## 12. Risks & open items
- **WorkOS docs site is not reachable from the build environment**; SDK
  behaviour was taken from the published SDK sources (`@workos-inc/node`
  10.14.0, `@workos-inc/authkit-nextjs` 4.3.2, `workos` 10.5.0). The exact
  `iss` value must be copied from a decoded staging token into `WORKOS_ISSUER`.
- Guard pins `cryptography==46.0.5`; the WorkOS Python SDK needs `~=50.0`.
  Phase 4 upgrades it and relies on Guard's own test suite to prove no
  regression in evidence signing.
- Webhook delivery is at-least-once and unordered; handlers are idempotent
  and ignore stale updates. A lost webhook degrades to the BFF liveness check
  (≤ one access-token lifetime) and on-demand sync at www sign-in.
- The per-request platform check makes the platform DB a dependency of every
  product request. It fails closed; Neon availability therefore gates product
  availability. Monitor it.
