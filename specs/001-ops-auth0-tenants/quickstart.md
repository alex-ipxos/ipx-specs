# Quickstart: validate an Ops Portal identity provider tenant

Run this against **each** tenant (`ipxos-dev`, `ipxos-stg`) after setup, and again after any
dashboard change. It is the verification checklist that FR-011 requires in `apps/ipx-ops/README.md`.
The README copy is the one maintained; this file is how the feature is proven during delivery.
Setup values are in [data-model.md](data-model.md).

## Prerequisites

- Admin access to the tenant in the Auth0 dashboard.
- One ipxos.ai Google account, and one personal Google account (gmail.com).
- Read access to Infisical `/web-ipx-ops` and `/svc-identity` for the environment.
- The `ipx` checkout, for the Action source.
- `curl` and `jq`.

## 1. Tenant (failure modes 12 and 3)

```bash
T=ipxos-stg   # or ipxos-dev
curl -s "https://$T.au.auth0.com/.well-known/openid-configuration" | jq -r .issuer
```

- [ ] The command returns `https://$T.au.auth0.com/`. That proves the AU region and records the
  issuer.
- [ ] Settings > Advanced: **Enable Application Connections** is off.
- [ ] Settings > Advanced: record **Idle** and **Maximum** session lifetimes here: ____ / ____.

## 2. Application and connections (failure mode 3)

- [ ] Applications > ipx-ops > Connections: exactly **one** enabled connection, the ipxos.ai Google
  Workspace connection.
- [ ] Authentication > Database > Username-Password-Authentication: **Disable Sign Ups** is on, and it
  is enabled for no application.
- [ ] Authentication > Social > google-oauth2: disabled, or enabled for no application.
- [ ] Allowed callback, logout and origin URLs match [data-model.md](data-model.md) exactly, with no
  extra entries.

## 3. Action (failure mode 13)

- [ ] Actions > Flows > Login runs exactly one Action, **Restrict to ipxos.ai**, and it is deployed.
- [ ] Copy the deployed code into `/tmp/deployed.cjs`, then run
  `diff /tmp/deployed.cjs apps/ipx-ops/auth0/actions/restrict-to-ipxos-domain.cjs`. It prints
  nothing.
- [ ] In `ipx`, run `pnpm --filter ipx-ops exec vitest run auth0/actions`. All cases in
  [the Action contract](contracts/restrict-to-ipxos-domain-action.md) pass.

## 4. API

- [ ] Applications > APIs > svc-identity: identifier `svc-identity`, algorithm RS256, RBAC off,
  "Add Permissions in the Access Token" off.

## 5. Behaviour (SC-001, SC-002)

Use the tenant's **Try** button on the ipx-ops application, or a test login against the callback URL.

- [ ] **ipxos.ai account**: sign-in completes in under a minute and returns to the portal's callback
  with a `code`.
- [ ] **Personal Google account**: refused. The callback carries `error=access_denied`, and Monitoring >
  Logs shows a failed login with the Action's reason.
- [ ] **Sign-up**: `curl -s -X POST "https://$T.au.auth0.com/dbconnections/signup" -H 'content-type: application/json' -d '{"client_id":"<ipx-ops client id>","email":"probe@example.com","password":"Probe-123456!","connection":"Username-Password-Authentication"}'`
  is refused, and Logs shows a failed sign-up.

## 6. Token (SC-004, the token contract)

After an ipxos.ai sign-in with `audience=svc-identity`, decode the access token's header and payload
without verifying it (for inspection only):

- [ ] `alg` = `RS256`.
- [ ] `aud` contains `svc-identity`.
- [ ] `iss` = the issuer from step 1.
- [ ] No `permissions`, `roles`, `groups` or custom claims.

## 7. Secrets (failure mode 5, SC-005)

- [ ] The issuer in Infisical `/web-ipx-ops` equals the step 1 issuer byte for byte, trailing slash
  included.
- [ ] The issuer in Infisical `/svc-identity` equals it byte for byte, and the audience there is
  `svc-identity`.
- [ ] `/svc-identity` holds no client id or secret.

**PASS** means every box is ticked for both tenants. Record the date, tenant and checker on IPX-9497.
