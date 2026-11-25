# Contract: the portal's identity configuration and its start-up guard

**Producer**: the deployment — Infisical `/web-ipx-ops` and the Helm `env:` block in
`ipx-cd/dev-ipxosai-services/values-dev.yaml`; `apps/ipx-ops/.env.example` → `.env.local` locally.
**Consumer**: `apps/ipx-ops/src/server/auth/config.ts` plus the new
`src/server/auth/platform-user.server.ts`, which are the **only** modules that read these keys from
`process.env` (constitution Principle IX).

This contract is what FR-018 and AC-7 are checked against: which keys exist, which are required
when, and what happens when one is missing or wrong.

## Keys

| Key | Type / rule | Required | Default | Secret |
|---|---|---|---|---|
| `AUTH_PROVIDER` | exactly `authentik` or `auth0` | no | **`authentik`** | no |
| `AUTH_AUTH0_ISSUER` | absolute `https` URL, **byte-exact, trailing slash included** | when `auth0` | — | no |
| `AUTH_AUTH0_ID` | non-empty | when `auth0` | — | no |
| `AUTH_AUTH0_SECRET` | non-empty | when `auth0` | — | **yes** |
| `AUTH_AUTH0_AUDIENCE` | non-empty | when `auth0` | `svc-identity` | no |
| `SVC_IDENTITY_API_URL` | absolute URL, no trailing slash | when `auth0` | — | no |
| `AUTH_AUTHENTIK_ISSUER` | absolute URL | when `authentik` | — | no |
| `AUTH_AUTHENTIK_ID` | non-empty | when `authentik` | — | no |
| `AUTH_AUTHENTIK_SECRET` | non-empty | when `authentik` | — | **yes** |
| `AUTH_SECRET`, `APP_URL`, `AUTH_TRUST_HOST` | as today | yes | — | `AUTH_SECRET` yes |
| `FACTORY_TOKEN_ISSUER`, `JWT_SECRET` | as today, **unchanged** | for factory calls | — | `JWT_SECRET` yes |
| `AUTH_BYPASS`, `ENVIRONMENT` | as today, **unchanged** | no | `AUTH_BYPASS=0` | no |

**Deliberately absent**: any key that selects the token algorithm (RS256 is pinned in code, FR-009),
any key that disables verification (there is none, in any profile), and any Auth0 client credential
for svc-identity (it verifies with JWKS and needs no secret — IPX-9497 decision).

## Validation

Parsed once per server process with zod, at the auth-config module's scope (research.md R4 — there
is no Express boot phase in a TanStack Start app, so "at start-up" means on the first request that
touches auth, which the entry middleware makes the first request of any kind).

1. **Only the active provider's keys are required.** `AUTH_PROVIDER=authentik` requires none of the
   `AUTH_AUTH0_*` keys and not `SVC_IDENTITY_API_URL`; `auth0` requires none of the
   `AUTH_AUTHENTIK_*` keys. This is what lets one image serve both deployments.
2. **A missing or malformed required key refuses start-up**, with one error naming **every**
   offending key at once — and **never its value** (AC-7). A secret's value is never echoed, logged
   or captured.
3. **A set-but-unrecognised `AUTH_PROVIDER` refuses start-up.** It never falls back to the default:
   a typo in this key would otherwise silently change which identity provider a deployment trusts.
4. **An unset `AUTH_PROVIDER` resolves to `authentik`** and is not an error. This is what keeps the
   current deployment's configuration literally unchanged (FR-002, AC-8) — see research.md R1 for
   why the alternative would have broken it on its next image bump.
5. `AUTH_AUTH0_ISSUER` is compared and stored exactly as the tenant's discovery `issuer`, trailing
   slash included; a value differing only by that slash is a mismatch, not a near-miss.

## Who sets what

| Deployment | Sets | Must not set |
|---|---|---|
| Current (`web-ipx-ops`) | `AUTH_PROVIDER=authentik` explicitly, plus today's `AUTH_AUTHENTIK_*` | any `AUTH_AUTH0_*`, `SVC_IDENTITY_API_URL` |
| Parallel (`web-ipx-ops-auth0`) | `AUTH_PROVIDER=auth0`, the four `AUTH_AUTH0_*`, `SVC_IDENTITY_API_URL`, its own `AUTH_SECRET` and cookie name | any `AUTH_AUTHENTIK_*` |
| Local (`.env.local`) | either, per what is being tested; `.env.example` ships working local-profile values | — |

Both deployments keep the **same** `FACTORY_TOKEN_ISSUER` and `JWT_SECRET`, which is what makes "no
factory service needs a configuration change" true (AC-3). The parallel deployment's Auth0 client
secret lives under its own Infisical key, separate from the current portal's (FR-019). Its path
`/web-ipx-ops-auth0` therefore also holds **copies** of the shared keys (`JWT_SECRET` and the rest),
not a second mount of `/web-ipx-ops` (decided 2026-11-25).

## What this contract never permits

- A value written into the code: every one of these comes from validated configuration
  (FR-018, constitution "Identity provider: Auth0 … never from code literals").
- A secret reaching the browser: none of these keys is `VITE_`-prefixed, and none is read from
  client code.
- An "auth off" switch: no key here disables token verification. (`AUTH_BYPASS` is the pre-existing
  dev-session bypass of ADR-0014, out of scope for this feature and the subject of open gate
  G-VIII-a in [plan.md](../plan.md).)
