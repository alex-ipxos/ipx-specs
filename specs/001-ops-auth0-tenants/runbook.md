# Runbook: Ops Portal Auth0 tenants (manual setup)

The operator guide FR-011 requires: setup steps, the verification checklist, and recovery runbooks.
It lives in this spec folder while the tenants are configured by hand. A copy in
`apps/ipx-ops/README.md` is deferred to a follow-up ticket (see [tasks.md](tasks.md), Deferred).

Values are in [data-model.md](data-model.md). The checklist is [quickstart.md](quickstart.md).
The Action source is [auth0/restrict-to-ipxos-domain.cjs](auth0/restrict-to-ipxos-domain.cjs).

Auth0 authenticates only and grants no roles (TRU.IAM.R63). Production is IPX-9504's.

## Setup order (per tenant: `ipxos-dev` first, then `ipxos-stg`)

Nobody can sign in until step 7. Do not reorder: the Workspace connection is enabled for ipx-ops
only after the Action is bound and diffed.

### 1. Tenant

- Create the tenant, name `ipxos-dev` / `ipxos-stg`, **region AU**. The region is fixed at creation;
  the domain must end `.au.auth0.com`. Wrong region → delete and recreate before anyone signs in.
- Settings > Advanced: **Enable Application Connections: off**, before creating any application.
- Keep the default session lifetimes. Write the Idle and Maximum values into the checklist.
- No custom domain.

### 2. Google Workspace connection

- Google Cloud: create one OAuth client for this tenant.
  - Authorised redirect URI `https://<tenant>.au.auth0.com/login/callback`.
  - JavaScript origin `https://<tenant>.au.auth0.com`.
  - Enable the Admin SDK API. Add `auth0.com` to the consent screen's authorised domains.
- Auth0: Authentication > Enterprise > Google Workspace: create the connection with Google Workspace
  domain `ipxos.ai` and the OAuth client above. **Enable it for no application yet.**
- Authentication > Database > `Username-Password-Authentication`: **Disable Sign Ups: on**, enabled
  for no application.
- Authentication > Social > `google-oauth2`: disable it, or enable it for no application.

The domain field does not refuse other Google accounts on its own. The Action (step 5) does.

### 3. svc-identity API

- Applications > APIs > Create: identifier (audience) `svc-identity`, signing algorithm RS256.
- Enable RBAC: off. Add Permissions in the Access Token: off. Allow Offline Access: off.

### 4. ipx-ops application

- Applications > Create: Regular Web Application, name `ipx-ops`.
- Callbacks, logout URLs and web origins exactly as in [data-model.md](data-model.md), nothing extra:
  - dev callbacks `https://ops.ipxos.dev/api/auth/callback/auth0`,
    `https://ipx-ops.localhost/api/auth/callback/auth0`;
  - staging callback `https://ops.ipxos.app/api/auth/callback/auth0`;
  - logout URLs and web origins: the matching app roots.
- Connections tab: **none enabled** for now.

### 5. Restrict to ipxos.ai Action

1. Actions > Library > Build Custom: trigger Login / Post Login, runtime Node 22, name
   `Restrict to ipxos.ai`.
2. Paste the full contents of [auth0/restrict-to-ipxos-domain.cjs](auth0/restrict-to-ipxos-domain.cjs),
   unedited. No secrets, no dependencies.
3. Deploy.
4. Actions > Flows > Login: drag it in as the **only** Action, then Apply.

Change the source here first (with `node --test 'specs/001-ops-auth0-tenants/auth0/*.test.cjs'` passing), then
re-paste into every tenant.

### 6. Deployed-code check

Copy the deployed code from the Auth0 editor into a file, then from the `ipx-specs` root:

```bash
diff /tmp/deployed.cjs specs/001-ops-auth0-tenants/auth0/restrict-to-ipxos-domain.cjs
```

It must print nothing.

### 7. Open sign-in

Applications > ipx-ops > Connections: enable the ipxos.ai Google Workspace connection. Confirm it is
the only one. This is the first moment anyone can sign in.

### 8. Secrets (Infisical, dev and staging)

Copy the issuer from `https://<tenant>.au.auth0.com/.well-known/openid-configuration` (`issuer`
field), byte exact, trailing slash included.

| Location | Values |
|---|---|
| `/web-ipx-ops` | client id, client secret, issuer |
| `/svc-identity` | issuer, audience `svc-identity`. **No** client credentials |

Variable names are set by IPX-9500 (ipx-ops) and IPX-9498 (svc-identity). Until then, record the
values without inventing names, or hold this step.

### 9. Verify

Run [quickstart.md](quickstart.md) against the tenant. Ideally someone who did not do the setup runs
it (SC-003). Record date, tenant, checker and result on IPX-9497.

## Runbooks

**R1: logins fail on a tenant.** Open the tenant's logs and filter on the Workspace connection. If the
errors name the Google client, open Google Cloud console, check that tenant's OAuth client (redirect
URI `https://<tenant>.au.auth0.com/login/callback`), and update the client id and secret on the Auth0
connection. Verify by signing in as an ipxos.ai operator.

**R2: ipx-ops client secret exposed.** In Auth0, open the ipx-ops application and rotate the client
secret. Update the client secret in Infisical `/web-ipx-ops` for that environment, then redeploy
ipx-ops once deployment is allowed. Existing sessions continue. Verify a fresh sign-in.

**R3: an operator leaves.** Suspend the Workspace account (People Ops). In each tenant, open User
Management, find the user by email, and block them. That ends their Auth0 session at its next use.
Record the date in the leaver ticket. (Accepted risk until TRU.IAM.R63 AC4: an existing session can
outlive the Workspace suspension up to the session lifetimes.)

Source: ipx-ops ADR-0040, Runbooks and Failure modes (draft in `repos/ipx`, not yet committed).
