# Research: Ops Portal identity provider tenants

Feature: [spec.md](spec.md) · Design record: ipx-ops ADR-0040 (`apps/ipx-ops/docs/adr/0040-…`) ·
Linear: IPX-9497

The developer settled most decisions in `/ipx-discuss IPX-9497` (D1 to D6). This phase checked the
Auth0 behaviour those decisions rely on against primary documentation. Two of them did not hold and
were corrected (R1, R3).

## R1. Does the Google Workspace connection's domain setting refuse other Google accounts?

- **Finding**: No. Auth0's Google Workspace page describes the domain field only as "the Google
  Workspace domain name for your organization". It says: "To verify Google authentications, you can
  use a post-login Action to validate that the idp_tenant_domain claim associated with the user
  matches the expected organization." Pre- and post-user-registration triggers fire only for database
  connections, so a post-login Action is the only Auth0 hook that runs for a Google login.
- **Decision** (developer, 2026-10-26): one deny-only post-login Action, **Restrict to ipxos.ai**, in
  each tenant. It denies when `event.user.idp_tenant_domain !== 'ipxos.ai'`, which covers a missing
  value too, whatever the connection's strategy. It adds no claims and writes no metadata.
- **Rationale**: This is the documented Auth0 pattern. It works regardless of which Google Cloud
  project owns the OAuth client. Checking every strategy, rather than only `google-oauth2` as the
  docs' sample does, keeps the check closed if another connection is ever enabled by mistake.
- **Alternatives considered**: A Google "Internal" consent screen, with the Google Cloud project
  under the ipxos.ai organisation, so Google returns `org_internal` to outsiders and no Action is
  needed. Recommended, but not chosen. Using both was also considered and not chosen.
- **Consequence**: ADR-0040 decision 5 changes from "no Actions" to "one deny-only domain Action".
  Done-when items 2 and 4 change, and item 9 is added on IPX-9497. The LLD rows in ipx-cd#1639 were
  amended.

## R2. Do new applications inherit connections by default?

- **Finding**: Yes, unless the tenant flag is off. Auth0 Support says that when "Enable Application
  Connections" is on, all configured connections are enabled for any new application. Auth0's Google
  guide says every new tenant has the Google social connection (`google-oauth2`) enabled by default.
- **Decision**: In each tenant, set "Enable Application Connections" to off (Settings > Advanced)
  **before** creating the ipx-ops application. Then enable only the Workspace connection for it, and
  disable `google-oauth2`.
- **Rationale**: This removes the setup-drift path behind failure mode 3. Turning the flag off later
  does not detach connections from an application that already exists.

## R3. What are Auth0's session lifetimes?

- **Finding**: Auth0 documents **caps**, not defaults. Non-Enterprise plans are capped at 4,320
  minutes (3 days) idle and 43,200 minutes (30 days) absolute. A 7-day "SSO session" default is
  mentioned without saying which setting it applies to. ADR-0040 had called 3 days and 30 days the
  defaults; that was corrected.
- **Decision**: Keep the tenant's defaults (D6). The checklist records each tenant's actual idle and
  maximum lifetimes, and the leaver risk is stated against those values.

## R4. Where do the Action's source and test live, given Principle III?

- **Finding**: `apps/ipx-ops` is `"type": "module"`. Vitest's default include pattern picks up
  `*.test.ts` anywhere outside `node_modules`, `dist`, `.output`, `.tanstack` and `e2e`. `tsc -b`
  type-checks only `src/`. Auth0 Actions are CommonJS (`exports.onExecutePostLogin`) on Node 22.
- **Decision**: Keep the source at `apps/ipx-ops/auth0/actions/restrict-to-ipxos-domain.cjs`. That
  is the exact text pasted into the Auth0 editor; the `.cjs` extension lets Node load it as CommonJS
  inside a module package. Its test sits beside it, `restrict-to-ipxos-domain.test.ts`, with
  `// @vitest-environment node`, loading the source through `createRequire`.
- **Rationale**: The file is byte-identical to what each tenant runs, so the checklist can diff it.
  It is covered by the existing `pnpm --filter ipx-ops test` gate with no new tooling.
- **Alternatives considered**:
  - A TypeScript source under `src/` with a build step that emits the paste text. Rejected: one more
    transform between the reviewed code and the deployed code.
  - Keeping the code only in the README. Rejected: it can't be tested, and Principle III is not met.
- **Known gap**: the `.cjs` file is outside `tsc`'s include, so it is not type-checked. The test is
  the guard.

## R5. Callback path, issuer format, region domain

- **Callback**: ipx-ops serves Auth.js under `/api/auth` (the existing
  `/api/auth/callback/authentik`), so the built-in `auth0` provider's callback is
  `/api/auth/callback/auth0`. IPX-9500 adopts it.
- **Issuer**: Auth0's issuer is `https://<tenant>.<region>.auth0.com/`, with a trailing slash. Store
  the `issuer` field from `/.well-known/openid-configuration` exactly as published (ADR-0040
  decision 8).
- **Google redirect URI** (per Auth0's Google Workspace page): `https://<tenant>.au.auth0.com/login/callback`,
  with the JavaScript origin `https://<tenant>.au.auth0.com`. Enable the Admin SDK API in the Google
  Cloud project, and add `auth0.com` to the consent screen's authorised domains.

## Sources

- Auth0, Google Workspace enterprise connection: https://auth0.com/docs/authenticate/identity-providers/enterprise-identity-providers/google-apps
- Auth0 Support, unwanted connections on new applications: https://support.auth0.com/center/s/article/New-applications-get-enabled-on-unwanted-connections
- Auth0, Tenant Settings (session caps, Enable Application Connections): https://auth0.com/docs/get-started/tenant-settings
- Auth0, Configure Session Lifetime Settings: https://auth0.com/docs/manage-users/sessions/configure-session-lifetime-settings
- Auth0 Community, registration triggers do not fire for social connections: https://community.auth0.com/t/limit-sign-in-and-social-sign-in-to-specific-domains/190243
- Google Cloud, Manage App Audience (Internal user type): https://support.google.com/cloud/answer/15549945
