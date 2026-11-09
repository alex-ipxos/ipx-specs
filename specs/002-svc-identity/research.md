# Research: Platform user record (svc-identity)

Phase 0 for [plan.md](plan.md). The design decisions themselves (D1 to D9) were settled in the
IPX-9498 `/ipx-discuss` turn and are recorded in svc-identity ADR-0001; this file resolves the
remaining technical unknowns from estate precedent. Precedent repositories were read at:
`svc-crm-factory` `2c2d96e` (the newest TypeScript service, also provisioned through
`github-configuration`), `svc-document` and `svc-claims-factory` (JWKS verification with `jose`),
`svc-product-factory` (health route).

## R1. Which runtime and library versions?

- **Finding**: `svc-crm-factory` runs Node 22 (`.nvmrc` `22`, `engines >=22`), TypeScript ESM
  (`"type": "module"`, TypeScript 6), Express 5, Prisma 7 with `@prisma/adapter-pg`, zod 4, pino 10
  with pino-http, `@sentry/node` 10 with `@ipxos-ai/sentry-scrubber`, and helmet. Tests use Jest 30
  with ts-jest and supertest, with separate unit and integration configs and a Docker Compose test
  database.
- **Decision**: Match `svc-crm-factory` exactly, including its Jest setup and its
  `src/instrument.ts` Sentry bootstrap. Pin the same major versions. Also take
  `@ipxos-ai/environment` (the `ENVIRONMENT` schema, R6), `jest-junit` (AC evidence) and Prettier
  from it, and add the two gates constitution v1.2.0 requires that it lacks: `knip` (as in
  `svc-party-factory`) and a husky pre-commit hook running `lint` and `typecheck` (as in
  `svc-product-factory`).
- **Rationale**: The constitution fixes the stack (Express, Prisma, zod, pino, Sentry). Copying the
  newest sibling keeps tooling, CI and reviewers' expectations identical, and its CI already
  satisfies the `service-v1` checks this repository will be held to.
- **Alternatives considered**: Vitest (used in the `ipx` monorepo). Rejected: no service repository
  uses it, and changing the test runner here would diverge from the CI lane setup being copied.

## R2. How is the token verified (FR-005, FR-012)?

- **Finding**: `svc-document` and `svc-claims-factory` use `jose` 6 (`createRemoteJWKSet` and
  `jwtVerify`). `jose`'s remote JWKS caches keys, refetches on an unknown `kid` (with a cooldown) and
  takes a fetch timeout. `svc-crm-factory` uses `jsonwebtoken`, which is only right for its interim
  HS256 scheme. `svc-document` **skips authentication when no issuer is configured**.
- **Decision**: `jose` 6. `jwtVerify(token, jwks, { algorithms: ['RS256'], issuer, audience })` with
  the issuer and audience from validated configuration. The remote JWKS gets a 3 s timeout, and the
  issuer comparison is the exact configured string. The JWKS URL is derived from the issuer
  (`<issuer>.well-known/jwks.json`). There is no "skip when unconfigured" branch: missing
  configuration stops startup (FR-007, FR-015).
- **Rationale**: Estate precedent, it is maintained, and `algorithms` pins the signing method so a
  token's `alg` header (including `none`) can never choose it (TRU.IAM.R67).
- **Alternatives considered**: `jsonwebtoken` with `jwks-rsa`. Rejected: two libraries where one
  suffices, and no estate precedent for RS256. `svc-document`'s auth-skip. Rejected by D5 (no bypass).

## R3. How do tests run without network or a real tenant?

- **Decision**:
  - **Unit**: the route depends on a `TokenVerifier` and a `ProfileClient` interface (class diagram).
    Tests generate an RS256 key pair with `jose.generateKeyPair`, sign tokens with it, and verify
    them through `createLocalJWKSet`. Tokens signed by another key, with another `iss`/`aud`, expired,
    with `alg: none` or HS256 are all produced the same way.
  - **Integration**: a real Postgres (Docker Compose, as in `svc-crm-factory`). A small local HTTP
    server serves the JWKS and a stub `/userinfo`, so the production `jose` remote-JWKS path and the
    real HTTP profile client are exercised, including timeouts, 5xx, 429, 401 and a missing email.
  - **Local runs**: the local identity-provider stub in Compose (R9), the same stub code the
    integration tests use. The sandbox tenant `dev-ipxos-play` is an optional extra check only
    (quickstart step 6); nothing depends on it (constitution Principle VIII).
- **Rationale**: Proves every refusal without a network and still exercises the real remote-JWKS
  code once. There is no bypass to test around (D5).

## R4. How is "resolve or create" made race-safe (FR-002, FR-004)?

- **Decision**: Look up the link by `(provider, subject)`. On a miss, fetch the profile, then create
  the user and the link in one Prisma transaction. On a unique-constraint violation (Prisma `P2002`
  on `identity_link (provider, subject)`), roll back, re-read the link and answer `200` with the
  winner's id. The integration test fires concurrent first calls against the real database.
- **Rationale**: The database constraint is the only reliable guard (style guide §10), and it gives
  the losing caller a deterministic answer (observability spec F7).
- **Alternatives considered**: An application-level lock or `SELECT ... FOR UPDATE` on a row that
  does not exist yet. Rejected: nothing to lock on a first login, and the constraint is needed anyway.

## R5. Which CI lanes, and what must they not do?

- **Finding**: The `service-v1` ruleset (github-configuration#56) requires the checks `build`,
  `static-analysis`, `unit`, `integration`, `contracts` and `security`. `svc-crm-factory`'s `ci.yml`
  has exactly those lanes plus a `quality` aggregator, and also, on a push to `main`, a Docker build
  and `dispatch-dev-image`, which deploys to dev.
- **Decision**: Copy the six lanes and the `quality` aggregator. **Leave out** the Docker push,
  `dispatch-dev-image`, API-client publishing and Slack jobs: deployment is IPX-9499, and nothing may
  deploy before approval (constitution Workflow 8). The `contracts` lane generates `docs/openapi.yaml`
  from the zod schemas and fails when it is stale, as in `svc-crm-factory`. Also copy
  `require-linear-reference.yml` (the `linear-reference v1` policy) and CodeQL.
- **Rationale**: The ruleset blocks merging until those checks exist and pass, so CI is part of the
  first build, not a later chore.

## R6. Configuration and port

- **Decision**: One zod schema in `src/config/index.ts` parses the environment once at startup. No
  other module reads `process.env`.

  | Key | Rule |
  |---|---|
  | `ENVIRONMENT` | `local \| development \| staging \| production` (`@ipxos-ai/environment`), default `local` |
  | `NODE_ENV` | `development \| test \| production`; describes the build only, never relaxes a rule |
  | `IDENTITY_ISSUER` | URL ending in `/`. `https` required, except that `ENVIRONMENT=local` also accepts `http://localhost:<port>/` or `http://127.0.0.1:<port>/`. A localhost issuer is refused in `staging` and `production` |
  | `IDENTITY_AUDIENCE` | default `svc-identity` |
  | `DATABASE_URL` | required, no default in code |
  | `PORT` | default `4024` |
  | `SENTRY_DSN` | optional |
  | `LOG_LEVEL` | `debug \| info \| warn \| error \| silent`, default `info` |

  The JWKS and `/userinfo` URLs are derived from the issuer. Names are this service's own;
  ipx-ops's names belong to IPX-9500. A failure exits non-zero, naming the key and never printing
  the value.
- **Boot guard** (ADR-PLATFORM-004 §D4 amendment): `NODE_ENV=production` with `ENVIRONMENT`
  resolving to `local` refuses to start.
- **Files**: `.env.example` (committed) holds working local values, so `cp .env.example .env` is
  the only configuration step. `.env.test` sets `NODE_ENV=test` and `LOG_LEVEL=silent` and
  deliberately leaves `DATABASE_URL` unset. `tests/setup.ts` defaults it to the local test
  database only when it is unset, so CI's value wins (the `svc-party-factory` pattern). `dotenv`
  loads either file only when `NODE_ENV !== "production"`.
- **No auth switch**: there is no `IDENTITY_AUTH_ENABLED` or similar, in any environment. The
  factory `<SVC>_AUTH_ENABLED=false` lever is deliberately not copied (Principles IV and VIII,
  spec User Story 2 scenario 5).
- **Rationale**: The constitution says Auth0 values come from zod-validated configuration, never
  code literals. Port 4024 follows the highest assigned port (4023) in `ipx-cd`
  `dev-ipxosai-services/values.yaml`, and is confirmed in IPX-9499.

## R7. Moving from the placeholder repository to the real one

- **Finding**: Discuss evidence and design docs live in a local placeholder at
  `ipx-specs/repos/svc-identity` (no commits, `origin` set to the future URL). The pointer files are
  keyed on that absolute path. `github-configuration#56` creates the repository with one README
  commit on `main`.
- **Decision**: Once #56 is applied:
  1. Clone `ipxos-ai/svc-identity` to `../svc-identity`, the main checkout that stays on `main`.
  2. Move the placeholder aside, then
     `git -C ../svc-identity worktree add <ipx-specs>/repos/svc-identity -b feat/ipx-9498-svc-identity origin/main`
     at the **same path**.
  3. Copy the placeholder's design docs and `.planning/` back in, and delete the placeholder copy.

  Same path and same `origin` slug, so the workspace and active-task pointers stay valid with no
  re-registration.
- **Rationale**: Matches the workspace rule (worktrees under `ipx-specs/repos/`, main checkout
  untouched), and avoids the re-keying IPX-9497 needed when its evidence moved.

## R8. Data contract for the platform user id

- **Finding**: `domain-docs` `data-contracts/services.yaml` requires an `observed_at` commit for each
  declared service.
- **Decision**: After R7, in the same task, declare `svc-identity` (canon domain `TRU`, `observed_at`
  = the first real commit) and draft `svc-identity.platform-user-id` (`identifier`, `UUID`,
  `status: proposed`, `agreed_in: IPX-9498`) through `draft-data-contract.md`. It lands as its own
  `domain-docs` PR.
- **Rationale**: Making up a commit to satisfy the registry would be a fabricated record.

## R9. Local profile: Compose dependencies and the local identity provider

- **Problem**: constitution Principle VIII requires the service to run on a workstation with no
  live identity-provider tenant. Every request needs a token signed by a key the service trusts,
  and first login calls `/userinfo`.
- **Finding**: the estate's Express/Prisma services keep one `docker-compose.db.yml` per repository,
  with `postgres:16-alpine` and a healthcheck. Host Postgres ports 5432 to 5445 are taken across
  the services' compose files (e.g. `svc-product-factory` 5434, `svc-party-factory` 5437). Ready-made
  mock OIDC servers serve JWKS at their own paths, not Auth0's `<issuer>.well-known/jwks.json`,
  so the URL derivation in R2 would differ between local and deployed runs.
- **Decision**: `docker-compose.db.yml`, headed
  `# LOCAL DEVELOPMENT ONLY — credentials here must never be used in staging or production`, has
  two services. The service itself runs on the host (`npm run dev`).

  | Compose service | Image | Host port | Healthcheck | Purpose |
  |---|---|---|---|---|
  | `postgres` | `postgres:16-alpine` | `5446` | `pg_isready` | Databases `svc_identity_dev` (local run) and `svc_identity_test` (integration tests, created by `npm run setup:test-db`) |
  | `local-idp` | `node:22.23.4-alpine`, running `tests/support/local-idp/server.ts` mounted read-only, with Node's built-in type stripping and no dependencies | `9024` | `wget` on the JWKS | Issuer `http://localhost:9024/` |

  The `local-idp` stub uses only Node's `crypto` module. On start it generates an RS256 key pair and
  serves the Auth0-shaped paths, so the production code path is identical:
  - `GET /.well-known/jwks.json`;
  - `GET /userinfo`, which answers for tokens the stub issued, with fixture name and email per
    subject;
  - `POST /oauth/token`, a local-only mint taking an optional `sub`, `email` and `name` and
    returning an access token for `aud=svc-identity` with a one-hour expiry.

  The integration tests import the same module in-process, adding fault injection (timeouts, 5xx,
  429, 401, no email, JWKS stopped).
- **Rationale**: the service verifies stub tokens exactly as it verifies Auth0 tokens: signature,
  exact issuer, audience and expiry. That makes this a stand-in identity provider, not an
  authentication bypass (Principle IV). Deployed environments never trust it, because their
  configured issuer is the Auth0 tenant and staging/production refuse a localhost issuer (R6). One
  stub for tests and local runs keeps them from drifting apart.
- **Scripts**:
  - `db:up` = `docker compose -f docker-compose.db.yml up -d --wait`; `db:down` = `… down`.
  - `db:migrate` = `prisma migrate deploy`. It also runs in CI and as a Kubernetes Job when
    deployed, never on boot.
  - `dev`, `setup:test-db` (with a `pretest:integration` hook), `test`, `test:unit`,
    `test:integration`, `test:coverage`, `lint`, `typecheck`, `knip`, `build` and `start`.
  - `local:token` (`tsx scripts/local-token.ts`) prints a stub token, so that `curl` needs no
    hand-built JWT.
- **Alternatives considered**:
  - The sandbox tenant as the local default (the previous plan). Rejected: Principle VIII forbids
    depending on a live tenant, and it needs a browser login.
  - A published mock OIDC server image. Rejected: its JWKS path differs from Auth0's, which would
    force a configurable JWKS URL (a new setting that could be misconfigured in deployed
    environments).
  - Testcontainers. Rejected: the estate's Express/Prisma services use a Compose database, and
    one Compose file serves both local runs and tests.

## R10. Error body and code layout (constitution Principle IX)

- **Decision**: every error answers `{ "code": "<code>", "message": "<fixed text>", "statusCode":
  <n> }`, the shape `svc-crm-factory`'s `errorHandler` returns. The codes and statuses in the
  contract are unchanged. Typed errors in `src/errors/` are mapped to HTTP in one
  `middleware/errorHandler.ts`.
- **Layout**:
  - `routes` → `services` → `repositories`; only `IdentityRepository` uses Prisma.
  - `TokenVerifier` and `ProfileClient` are service-level interfaces with `jose` and Auth0
    implementations.
  - Constructor injection is wired once in `src/container.ts`. The only module-level singletons
    are the parsed configuration and the pino logger.
  - Class files are PascalCase (`ResolveMeService.ts`) and other files camelCase, as in the
    factory services.
- **Rationale**: this replaces the previous plan's `{ "error": { … } }` envelope and feature
  folders, which matched no estate service. No client exists yet (ipx-ops is IPX-9500), so the
  change costs a note on IPX-9500 and nothing else.
- **State machines**: this slice reads `status` but never changes it, so no state-machine class is
  needed yet. The disable/re-enable work brings one.

## Sources

- svc-identity ADR-0001 and its ERD, sequences, observability spec, class diagram and contract map
  (placeholder repository, landing with the first code PR).
- LLD: `ipxos-ai/ipx-cd#1802`.
- Token contract: `specs/001-ops-auth0-tenants/contracts/access-token-for-svc-identity.md`.
- Constitution v1.2.0 (Principles VIII, IX; Backend Stack and Coding Standards);
  ADR-PLATFORM-004 §D4.
- Precedent code: `svc-crm-factory/package.json`, `src/config/index.ts`,
  `src/middleware/errorHandler.ts` and `.github/workflows/ci.yml`; `svc-party-factory`
  `docker-compose.db.yml`, `.env.example`, `.env.test` and `jest.integration.config.ts`;
  `svc-document/src/middleware/jwt-auth.ts`; `svc-product-factory/src/routes/health.ts`.
- `skills/docs/data-model-style-guide.md`; `github-configuration` `inventory/repositories.yaml`
  policy contracts.
