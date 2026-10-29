# Quickstart: validate svc-identity

How to prove the feature works, locally and in CI. Interface: [contracts/resolve-me-api.md](contracts/resolve-me-api.md).
Data: [data-model.md](data-model.md). Nothing here deploys anything.

## Prerequisites

- The `ipxos-ai/svc-identity` worktree at `ipx-specs/repos/svc-identity` on
  `feat/ipx-9498-svc-identity` (research R7). It exists only once `github-configuration#56` is applied.
- Node 22, Docker (for the test Postgres), `curl`, `jq`.
- For step 4 only: an ipxos.ai Google account and the sandbox tenant `dev-ipxos-play` with its
  `ipx-ops` application (IPX-9497 sandbox).

## 1. Unit tests: every refusal, no network

```bash
npm ci && npm run test:unit
```

Expected: tokens signed by test-generated keys cover A1 to A5 below, all passing.

| Case | Expected |
|---|---|
| A1 valid token, new subject (stub profile) | `201`, `created: true` |
| A2 bad signature / wrong `iss` / wrong `aud` / expired | `401 invalid_token`, no repository call |
| A3 `alg: none`, `alg: HS256` | `401 invalid_token` |
| A4 body `{"sub": "other"}` with a valid token | resolves the token's subject only |
| A5 profile stub: timeout / 5xx / 429, then 401 / no email | `503 profile_unavailable`, then `502 profile_invalid`; no create call |

## 2. Integration tests: real Postgres, real HTTP clients

```bash
npm run test:integration   # starts the Compose test database first
```

Expected, against a local JWKS server and `/userinfo` stub:

- First call `201`, second `200` with the same `userId`. Exactly one row in each table.
- 50 concurrent first calls for one subject leave one user and one link; one `201`, the rest `200`
  with the same id (SC-001).
- A `DISABLED` user gets `403 user_disabled`, and the row stays unchanged.
- The JWKS server stopped with a warm cache: existing user `200`. Cold cache: `503
  identity_provider_unavailable` (SC-007).
- Database stopped: `503 database_unavailable`, no rows.
- Captured log output contains no token, `sub`, email or name (SC-006).

## 3. Startup and health

```bash
IDENTITY_ISSUER= npm start   # expect exit non-zero naming IDENTITY_ISSUER, not its value
IDENTITY_ISSUER=https://dev-ipxos-play.eu.auth0.com/ DATABASE_URL=<local> npm start &
curl -s localhost:4024/health | jq   # {"service":"svc-identity","version":"…","status":"ok"}
```

## 4. Manual run against the sandbox tenant (optional)

Get an access token for `audience=svc-identity` with `scope=openid profile email` from
`dev-ipxos-play` (the IPX-9497 sandbox `/authorize` link, exchanged with the app's client secret on
your own machine; never paste the token anywhere). Then:

```bash
curl -s -X POST localhost:4024/v1/users/me -H "Authorization: Bearer $TOKEN" | jq   # 201, then 200
curl -s -X POST localhost:4024/v1/users/me -H "Authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d '{"sub":"someone-else"}' | jq            # same userId
```

## 5. CI

The pull request runs the `build`, `static-analysis`, `unit`, `integration`, `contracts` (OpenAPI
fresh) and `security` lanes, plus `quality` and the Linear-reference check. All must pass. No job
builds or pushes an image or dispatches a deployment (research R5).

**PASS** means steps 1 to 3 and 5 pass. Record the result on IPX-9498.
