# Quickstart: validate svc-identity

How to prove the feature works on a workstation and in CI. Interface:
[contracts/resolve-me-api.md](contracts/resolve-me-api.md). Data: [data-model.md](data-model.md).
Local profile design: [research.md](research.md) R6 and R9. Nothing here deploys anything, and
nothing here needs a live identity-provider tenant (constitution Principle VIII).

## Prerequisites

- The `ipxos-ai/svc-identity` worktree at `ipx-specs/repos/svc-identity` on
  `feat/ipx-9498-svc-identity` (research R7). It exists only once `github-configuration#56` is
  applied.
- Node 22 (`nvm use`), Docker with Compose v2, `curl` and `jq`.
- Free host ports `4024` (service), `5446` (Postgres) and `9024` (local identity provider).
- A GitHub token for the private `@ipxos-ai/*` packages in `~/.npmrc`, as for every factory service.

## 1. Run it locally from a clean clone (the local profile)

```bash
npm ci
cp .env.example .env          # ENVIRONMENT=local, issuer http://localhost:9024/, DB on 5446
npm run db:up                 # postgres + local-idp, returns once both healthchecks pass
npm run db:migrate
npm run dev                   # tsx watch on http://localhost:4024
```

In a second shell:

```bash
curl -s localhost:4024/health | jq
# {"service":"svc-identity","version":"…","status":"ok"}

TOKEN=$(npm run -s local:token -- --sub 'local|alice' --email alice@example.test --name Alice)
curl -s -X POST localhost:4024/v1/users/me -H "Authorization: Bearer $TOKEN" | jq   # 201, created: true
curl -s -X POST localhost:4024/v1/users/me -H "Authorization: Bearer $TOKEN" | jq   # 200, same userId
curl -s -X POST localhost:4024/v1/users/me -H "Authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d '{"sub":"someone-else"}' | jq            # same userId
curl -s -X POST localhost:4024/v1/users/me | jq
# 401 {"code":"invalid_token","message":"…","statusCode":401}
```

The local tokens are checked exactly like Auth0 tokens: signature, exact issuer, audience
`svc-identity` and expiry. There is no setting that turns the check off. `npm run db:down` stops
the dependencies.

## 2. Unit tests: every refusal, no network

```bash
npm run test:unit
```

Expected: tokens signed by test-generated keys cover A1 to A5 below, all passing.

| Case | Expected |
|---|---|
| A1 valid token, new subject (stub profile) | `201`, `created: true` |
| A2 bad signature / wrong `iss` / wrong `aud` / expired | `401 invalid_token`, no repository call |
| A3 `alg: none`, `alg: HS256` | `401 invalid_token` |
| A4 body `{"sub": "other"}` with a valid token | resolves the token's subject only |
| A5 profile stub: timeout / 5xx / 429, then 401 / no email | `503 profile_unavailable`, then `502 profile_invalid`; no create call |

## 3. Integration tests: the Compose Postgres, real HTTP clients

```bash
npm run db:up                 # if not already running
npm run test:integration      # pretest creates svc_identity_test, then runs serially
```

The run is against the same local-idp module run in-process with fault injection. Expected:

- First call `201`, second `200` with the same `userId`. Exactly one row in each table.
- 50 concurrent first calls for one subject leave one user and one link; one `201`, the rest `200`
  with the same id (SC-001).
- A `DISABLED` user gets `403 user_disabled`, and the row stays unchanged.
- With the JWKS server stopped and a warm cache, an existing user gets `200`. With a cold cache:
  `503 identity_provider_unavailable` (SC-007).
- With the database stopped: `503 database_unavailable` and no rows.
- Captured log output contains no token, `sub`, email or name (SC-006).
- `test-reports/integration-junit.xml` lists every acceptance test by its `AC-N:` tag.

## 4. Startup guards

```bash
IDENTITY_ISSUER= npm run dev
# exits non-zero naming IDENTITY_ISSUER, not its value
ENVIRONMENT=staging IDENTITY_ISSUER=http://localhost:9024/ npm run dev
# exits: localhost issuer refused outside local
npm run build && NODE_ENV=production ENVIRONMENT= npm start
# exits: ENVIRONMENT must be set in a deployed build
```

## 5. Quality gates (the same commands CI runs)

```bash
npm run lint && npm run typecheck && npm run knip && npm run test:coverage
```

Expected: all pass and line coverage is at least 70%. The husky pre-commit hook runs `lint` and
`typecheck` on every commit.

## 6. Optional: against the sandbox tenant

This step is optional, and nothing else depends on it. It checks one real Auth0 round trip.

1. In `.env`, set `IDENTITY_ISSUER=https://dev-ipxos-play.eu.auth0.com/` and restart `npm run dev`.
2. Get an access token for `audience=svc-identity` with `scope=openid profile email`. Use the
   IPX-9497 sandbox `/authorize` link and exchange the code with the app's client secret on your
   own machine. Never paste the token anywhere.
3. Repeat the `POST /v1/users/me` calls from step 1. Expect `201`, then `200`.

## 7. CI

The pull request runs these lanes, plus `quality` and the Linear-reference check, and all must
pass:

- `build`;
- `static-analysis` (lint, typecheck, knip);
- `unit`;
- `integration`, against a Postgres service container;
- `contracts`, which checks the OpenAPI is fresh;
- `security`.

No job builds or pushes an image or dispatches a deployment (research R5).

**PASS** means steps 1 to 5 and 7 pass. Record the result on IPX-9498.
