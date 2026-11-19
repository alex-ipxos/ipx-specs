# Auth0 application for the parallel portal (`ipx-ops-auth0`)

Decision (research.md R8, settled 2026-11-19): the parallel portal gets **its own Auth0
application**, with its own client id and secret. It does not share the `ipx-ops` application that
IPX-9497 creates. FR-003 says the two portals share no identity-provider registration, and a second
callback on one application would share one client secret and one set of tenant-side settings.

**Dev tenant only.** The parallel portal is dev-only (FR-005), so `ipxos-stg` gets nothing.

**Held.** Every step that changes a live tenant or Infisical waits until the developer approves
deployment (plan.md → Delivery constraints). Until then this page is the plan.

## Prerequisites

| Needed | From | Check |
|---|---|---|
| `ipxos-dev` tenant, with "Enable Application Connections" **off** | IPX-9497 runbook §1 | Settings > Advanced |
| ipxos.ai Google Workspace connection | IPX-9497 runbook §2 | Authentication > Enterprise |
| `svc-identity` API (RS256, RBAC off, offline access off) | IPX-9497 runbook §3 | Applications > APIs |
| `Restrict to ipxos.ai` post-login Action, bound to the Login flow | IPX-9497 runbook §5 | Actions > Flows > Login |
| The parallel portal's host, e.g. `ops-auth0.ipxos.dev` | T044 (`virtualService.host`) | Fixed before step 2, because the callback URL contains it |
| An Auth0 tenant admin and an Infisical writer for the dev environment | — | — |

The Action runs **tenant-wide** on every login, so the new application is covered by the ipxos.ai
domain restriction without extra work. Step 7 proves it.

## Values

`<host>` below is the parallel portal's host from T044.

| Setting | Value |
|---|---|
| Name | `ipx-ops-auth0` |
| Type | Regular Web Application |
| Allowed Callback URLs | `https://<host>/api/auth/callback/auth0`, and nothing else |
| Allowed Logout URLs | `https://<host>` |
| Allowed Web Origins | `https://<host>` |
| Application Login URI | blank |
| Grant types (Advanced > Grant Types) | **Authorization Code** only. Untick Implicit, Refresh Token and Client Credentials |
| JWT signature algorithm (Advanced > OAuth) | RS256 |
| OIDC Conformant (Advanced > OAuth) | on |
| Refresh tokens | none (rotation off, no `offline_access` scope requested) |
| Enabled connections | exactly one: the ipxos.ai Google Workspace connection (enabled last, in step 6) |
| API access | allowed to request the `svc-identity` audience for users (step 4) |

There is **no** `ipx-ops.localhost` callback. Local development signs in against the local OIDC
stub (research.md R5). If someone needs to test locally against the live tenant, the `ipx-ops`
application from IPX-9497 already has that callback.

## Steps (`ipxos-dev`)

1. **Create.** Applications > Applications > Create Application. Name `ipx-ops-auth0`, type
   Regular Web Application. Skip the technology quickstart.
2. **Settings tab.** Enter the callback, logout and web-origin URLs from the table, exactly as
   written. Leave the Application Login URI blank. Save.
3. **Advanced settings.** Grant Types: Authorization Code only. OAuth: RS256, OIDC Conformant on.
   Save.
4. **API access.** Applications > APIs > `svc-identity` > Application Access (or the API's user
   access policy, depending on the dashboard version). If the policy requires each application to
   be authorised for user access, authorise `ipx-ops-auth0`. If the policy allows every
   application, change nothing. Either way, step 7 shows whether it worked: the access token's
   `aud` contains `svc-identity`.
5. **Connections tab.** Confirm that **no** connection is enabled yet. "Enable Application
   Connections" is off, so a new application starts with none. If any are enabled, the tenant flag
   is wrong. Stop and fix that first (IPX-9497 research R2).
6. **Open sign-in.** Connections tab: enable the ipxos.ai Google Workspace connection and nothing
   else. From this moment anyone on ipxos.ai can sign in to the parallel portal.
7. **Verify in the tenant.** Then delete the test user or users created here from User Management:
   - An `@ipxos.ai` account completes the hosted login. Under Monitoring > Logs, the login shows
     application `ipx-ops-auth0`, connection `google-apps`.
   - A Google account outside ipxos.ai is refused by `Restrict to ipxos.ai`. The log shows the
     Action's denial, not a successful login.
   - An access token issued to `ipx-ops-auth0` with `audience=svc-identity` has
     `iss = https://ipxos-dev.au.auth0.com/` and `aud` containing `svc-identity`, and its header
     `alg` is `RS256`. Get it from the deployed portal or Auth0's Authentication API debugger, and
     decode it locally. Never paste a token into a website.
8. **Credentials tab.** Copy the client id and client secret, and leave the authentication method
   at its default. If the token exchange in T048 fails with `invalid_client`, the authentication
   method is the first thing to check: Auth.js sends the secret with HTTP Basic by default.

## Secrets (Infisical, dev only)

The parallel release has its own secret reference (T044), so it gets **its own path**,
`/web-ipx-ops-auth0`. It does not add keys to `/web-ipx-ops`, so neither portal can read the
other's secrets (FR-019).

| Key | Value | Secret? |
|---|---|---|
| `AUTH_AUTH0_ID` | client id (step 8) | treated as secret |
| `AUTH_AUTH0_SECRET` | client secret (step 8) | **yes** |
| `AUTH_AUTH0_ISSUER` | `issuer` from `https://ipxos-dev.au.auth0.com/.well-known/openid-configuration`, byte-exact, **trailing slash included** | no, but kept beside the others |
| `AUTH_SECRET` | a **new** value (`openssl rand -base64 33`), never the current portal's | **yes** |

`AUTH_PROVIDER=auth0`, `AUTH_AUTH0_AUDIENCE=svc-identity` and `SVC_IDENTITY_API_URL` are not
secrets. They go in the release's `env:` block in `values-dev.yaml` (T044).

## What this changes in IPX-9497's design

`specs/001-ops-auth0-tenants/data-model.md` says the Workspace connection is "enabled for: ipx-ops
only", and its checklist asserts that. After step 6 it is enabled for **two** applications. The
IPX-9497 checklist must accept `ipx-ops-auth0` as the second one, otherwise a re-run of that
checklist reports a failure (T061).

## Withdrawal

This extends AC-14. After the Helm release is deleted (T048):

1. Applications > `ipx-ops-auth0` > Connections: disable the Workspace connection. No one can
   sign in to it from then on.
2. Delete the application. Its client secret is revoked with it.
3. Delete the `/web-ipx-ops-auth0` path in Infisical.

None of these steps touches `ipx-ops`, the connection's other binding, the API or the Action, so
the current portal (Authentik) and the IPX-9497 application are unaffected.
