# Contract: access token issued to ipx-ops for svc-identity

What consumers may rely on from either tenant. **Producer**: Auth0 tenant (this feature).
**Consumers**: ipx-ops (IPX-9500) obtains the token, and svc-identity (IPX-9498) verifies it itself
(TRU.IAM.R67).

## How it is obtained

The OIDC authorization-code flow on the ipx-ops application, with `audience=svc-identity` on
`/authorize`. Without the audience no JWT access token for svc-identity is issued (failure mode 4).

## Header

| Field | Value |
|---|---|
| `alg` | `RS256`, the only algorithm. Consumers fix it in configuration and never read it from the token |
| `kid` | Matches a key at `<issuer>.well-known/jwks.json`. It may change when Auth0 rotates keys |

## Claims guaranteed

| Claim | Value |
|---|---|
| `iss` | The tenant issuer, byte-equal to Infisical `/svc-identity` issuer, e.g. `https://ipxos-stg.au.auth0.com/` |
| `aud` | Contains `svc-identity` |
| `sub` | The Auth0 user id for the Workspace identity, e.g. `google-apps\|<id>`. It is stable for a person in one tenant |
| `exp`, `iat` | Present. The lifetime is the API's default token lifetime |

## Claims guaranteed absent

`permissions`, `roles`, `groups`, `scope` grants beyond the OIDC defaults, and any custom namespaced
claim (TRU.IAM.R63; the domain Action adds nothing).

## What consumers must not assume

- That `sub` is the platform user id. It is the provider subject; svc-identity maps it to one
  platform user (TRU.IAM.R66).
- That the same person has the same `sub` in dev and staging.
- That an email claim is present in the access token. Identity comes from `sub`
  (TRU.IAM.R53, constitution Principle V).
