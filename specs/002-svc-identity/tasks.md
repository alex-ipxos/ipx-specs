# Tasks: Platform user record (svc-identity)

**Input**: Design documents from `specs/002-svc-identity/`, revised 2026-11-05 for constitution
v1.2.0

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/resolve-me-api.md](contracts/resolve-me-api.md),
[quickstart.md](quickstart.md)

**Linear**: every task belongs to [IPX-9498](https://linear.app/ipxos-ai/issue/IPX-9498) unless it
says otherwise (constitution Principle VII).

**Tests**: Required. `ipx-fix` works test-first (a RED commit before GREEN, Principle IX), and
IPX-9498's "Done when" items 1 to 13 are each a test.

**Organization**: Tasks are grouped by user story so each story can be built and checked on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: the user story the task serves (US1 to US4, from spec.md)
- **BLOCKED**: cannot start until `ipxos-ai/github-configuration#56` is applied and the repository
  exists
- **HELD**: merges a PR. It does not start until the developer explicitly approves (plan.md
  "Delivery constraints")

## Rules for every task

- Paths are relative to the `ipx-specs` root for Phase 1. From Phase 2 on, paths are relative to
  `repos/svc-identity`, the `ipxos-ai/svc-identity` worktree on `feat/ipx-9498-svc-identity`.
- Every change to service code, tests, schema, stubs, Compose, CI or the Dockerfile is made **only
  through `ipx-fix`**, test-first (Principles III and IX). Run `ipx-*` turns from
  `repos/svc-identity`.
- **AC tags**: a test that proves IPX-9498 "Done when" item N starts with the tag `AC-N:`. Use a
  bare integer at the very start of the test name, e.g. `it("AC-3: wrong issuer → 401 …")`. The
  integration lane's JUnit file is what `ipx-verify-qa` reads.
- **Layering** (Principle IX):
  - `routes/` → `services/` → `repositories/`; only `src/repositories/IdentityRepository.ts`
    imports Prisma.
  - Only `src/config/index.ts` reads `process.env`.
  - Dependencies are wired in `src/container.ts` by constructor injection.
  - No `any`.
- **Local profile** (Principle VIII): never add a setting that switches token verification off, in
  any environment. Before any phase is reported complete, the clean-clone sequence in quickstart
  step 1 and the gates in step 5 must pass on a workstation (Workflow 9).
- Never commit to `main`. Never merge. CI must have no image-push or deploy-dispatch job
  (research R5).
- No token, `sub`, email or name in any log line, test snapshot or fixture committed to the repo
  (FR-014). Fixture identities use `example.test` addresses.
- Conventional Commits, lowercase subject, with a Linear reference (`IPX-9498`) for the
  `linear-reference` check. Stage files by name, never `git add -A`.

---

## Phase 1: Setup (shared) — BLOCKED on the repository

**Purpose**: Turn the placeholder into the real worktree and bring the governance workflow up to the
`fix` turn.

- [X] T001 BLOCKED. Confirm `ipxos-ai/github-configuration#56` is merged and applied:
  `gh repo view ipxos-ai/svc-identity --json name,defaultBranchRef` succeeds, and
  `gh api repos/ipxos-ai/svc-identity/rules/branches/main` lists the `service-v1` and
  `linear-reference` checks (IPX-9498)
- [X] T002 Clone the main checkout: `git clone https://github.com/ipxos-ai/svc-identity.git
  /Users/valyalkin/ipxos/svc-identity`. It stays on `main` and is never edited for this feature
  (IPX-9498)
- [X] T003 Convert the placeholder at the same path (research R7):
  1. `mv repos/svc-identity repos/svc-identity.placeholder`
  2. `git -C ../svc-identity worktree add /Users/valyalkin/ipxos/ipx-specs/repos/svc-identity -b feat/ipx-9498-svc-identity origin/main`
  3. `rsync -a --exclude .git repos/svc-identity.placeholder/ repos/svc-identity/`
  4. Confirm `git -C repos/svc-identity status --porcelain` lists only the design docs and
     `.planning/`, then `rm -rf repos/svc-identity.placeholder`

  Do not commit anything here (IPX-9498)
- [X] T004 From `repos/svc-identity`, run `/ipxos-skills:ipx-status`. It must resolve `IPX-9498` with
  evidence root `.planning` (pointer source `pointer-keyed`), proving the pointers survived T003
  unchanged (IPX-9498)
- [X] T005 Refresh the repo conventions in `repos/svc-identity/.planning/config.json`, which discuss
  recorded as pending (detect-repo-conventions): the rulesets probe on `main`, CODEOWNERS, and the
  Node version (`22`). Replace the `status: pending` block (IPX-9498)
- [X] T006 Run `/ipxos-skills:ipx-next` through the turns before `fix`: `readiness`, then
  `implementation-plan` (risk tier and approval: wait for the approver it names), then `branch`.
  `ipx-branch` owns the Linear move to In Progress (IPX-9498)

**Checkpoint**: The worktree exists at the same path, the evidence resolves, and the orchestrator's
next turn is `fix`.

---

## Phase 2: Foundational (blocking)

**Purpose**: a skeleton that runs locally from a clean clone, passes every quality gate and is
CI-checked. Every story builds on it. All tasks via `ipx-fix`.

- [X] T007 Scaffold the tooling from `svc-crm-factory` (research R1):
  - **`package.json`**: `"type": "module"`, `engines.node` `>=22.0.0`, `"prepare": "husky"`, and
    the scripts from plan.md "Local profile":
    - `dev` = `node --import tsx --import ./src/instrument.ts --watch src/index.ts`
    - `build` = `tsc`
    - `start` = `node --import ./dist/instrument.js dist/index.js`
    - `typecheck` = `tsc -p tsconfig.typecheck.json --noEmit`
    - `lint`, `lint:fix`, `knip`
    - `test` and `test:unit`, using `NODE_OPTIONS=--experimental-vm-modules jest`
    - `test:integration` with `--config jest.integration.config.ts`, and `test:coverage`
    - `setup:test-db` = `node --import tsx scripts/setup-test-db.ts`, and `pretest:integration` =
      `npm run setup:test-db`
    - `db:up` = `docker compose -f docker-compose.db.yml up -d --wait`, and `db:down` =
      `docker compose -f docker-compose.db.yml down`
    - `db:migrate` = `prisma migrate deploy`, and `db:generate` = `prisma generate`
    - `local:token` = `tsx scripts/local-token.ts`
    - `generate:openapi` and `check:generated-clean`
  - **Dependencies**: express 5, @prisma/client and prisma 7, @prisma/adapter-pg, zod 4, pino 10,
    pino-http, @sentry/node 10, @ipxos-ai/sentry-scrubber, @ipxos-ai/environment, helmet,
    express-rate-limit, jose 6, dotenv.
  - **Dev dependencies**: typescript 6, tsx, jest 30, ts-jest, @types/jest, supertest, jest-junit,
    eslint 10, @eslint/js, @typescript-eslint/parser and @typescript-eslint/eslint-plugin, prettier,
    eslint-config-prettier, eslint-plugin-prettier, knip, husky,
    @asteasolutions/zod-to-openapi.
  - **Other files**:
    - `.nvmrc` (`22`) and `.npmrc` (the `@ipxos-ai` registry line, no token).
    - `config/tsconfig.json` with exactly `target ES2022`, `module`/`moduleResolution` `NodeNext`,
      `strict`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`,
      `noFallthroughCasesInSwitch`, `forceConsistentCasingInFileNames`, `esModuleInterop`,
      `resolveJsonModule`, `sourceMap`, `outDir ../dist`, `rootDir ../src`. Plus `tsconfig.json`
      extending it (src and tests) and `tsconfig.typecheck.json`.
    - `eslint.config.js` (typescript-eslint recommended, `@typescript-eslint/no-explicit-any`
      `error`, `no-unused-vars` with `argsIgnorePattern: '^_'`, `prettier/prettier` `error`) and
      `.prettierrc`.
    - `knip.config.ts`.
    - `.husky/pre-commit` running `npm run lint && npm run typecheck`.
    - `jest.config.ts` (ts-jest `default-esm` preset, roots `tests/unit`, `.js` suffix mapper).
    - `jest.integration.config.ts` (roots `tests/integration`, `setupFiles: ['<rootDir>/tests/setup.ts']`,
      `maxWorkers: 1`, `testTimeout: 15000`, and a `jest-junit` reporter with
      `outputDirectory: 'test-reports'`, `outputName: 'integration-junit.xml'` and
      `titleTemplate: '{title}'`).
    - `.gitignore` (`.env`, `dist/`, `test-reports/`, `coverage/`, `node_modules/`).

  Coverage threshold: `coverageThreshold.global.lines` = `70` (IPX-9498)
- [X] T008 RED then GREEN: `tests/unit/config.test.ts`, then `src/config/index.ts` (research R6).
  - **Loading**: `dotenv` loads `.env.test` when `NODE_ENV=test`, otherwise `.env`, and only when
    `NODE_ENV !== "production"`.
  - **Schema**:
    - `ENVIRONMENT` via `EnvironmentSchema` from `@ipxos-ai/environment`, default `local`.
    - `NODE_ENV` is `development | test | production`, default `development`.
    - `IDENTITY_ISSUER` is a URL ending in `/`. It must be `https`, except that
      `ENVIRONMENT=local` also accepts `http://localhost:<port>/` and `http://127.0.0.1:<port>/`.
    - `IDENTITY_AUDIENCE` defaults to `svc-identity`.
    - `DATABASE_URL` is required, with no default.
    - `PORT` defaults to `4024`.
    - `SENTRY_DSN` is optional.
    - `LOG_LEVEL` is `debug | info | warn | error | silent`, default `info`.
  - **Derived**: `jwksUrl = <issuer>.well-known/jwks.json` and `userinfoUrl = <issuer>userinfo`.
  - **Guards**, as `superRefine`:
    - A localhost issuer with `ENVIRONMENT` `staging` or `production` fails.
    - `NODE_ENV=production` with `ENVIRONMENT` resolving to `local` fails with
      `ENVIRONMENT must be set (development|staging|production) in a deployed build`.
  - **Errors**: a missing or invalid key throws an error naming the key and never its value.
  - **No bypass**: no key disables authentication.
  - **Tests**: each case is a test, and `AC-12:` covers a missing or invalid issuer and audience
    (FR-007, FR-015, FR-016) (IPX-9498)
- [X] T009 [P] `.env.example`, `.env.test` and `tests/setup.ts` (research R6).
  - `.env.example` is committed, with a header saying "local profile; copy to .env". It holds
    `NODE_ENV=development`, `ENVIRONMENT=local`, `PORT=4024`, `LOG_LEVEL=info`,
    `DATABASE_URL=postgresql://identity_user:identity_password@localhost:5446/svc_identity_dev`,
    `IDENTITY_ISSUER=http://localhost:9024/`, `IDENTITY_AUDIENCE=svc-identity` and `SENTRY_DSN=`.
  - `.env.test` holds `NODE_ENV=test`, `ENVIRONMENT=local`, `LOG_LEVEL=silent` and
    `IDENTITY_AUDIENCE=svc-identity`. It deliberately has **no** `DATABASE_URL`, with a comment
    explaining why.
  - `tests/setup.ts` sets `DATABASE_URL ??=
    postgresql://identity_user:identity_password@localhost:5446/svc_identity_test`, so CI's value
    wins (IPX-9498)
- [X] T010 [P] `docker-compose.db.yml` (`postgres` only; T016 adds `local-idp`) and
  `scripts/setup-test-db.ts` (research R9).
  - The compose file's first line is
    `# LOCAL DEVELOPMENT ONLY — credentials here must never be used in staging or production`.
  - Service `postgres`:
    - `image: postgres:16-alpine`;
    - `POSTGRES_USER: identity_user`, `POSTGRES_PASSWORD: identity_password`,
      `POSTGRES_DB: svc_identity_dev`;
    - `ports: ["5446:5432"]` (first re-check that no sibling compose file uses 5446);
    - healthcheck `pg_isready -U identity_user -d svc_identity_dev`, every 5s, 10 retries;
    - named volume `postgres_data`.
  - `scripts/setup-test-db.ts` creates `svc_identity_test` if missing, then runs
    `prisma migrate deploy` against it.
  - Done when `npm run db:up` returns only once Postgres is healthy (IPX-9498)
- [X] T011 [P] RED then GREEN: `tests/unit/logger.test.ts`, then `src/logger.ts`,
  `src/middleware/correlation.ts` and `src/middleware/requestLogging.ts`.
  - pino, with redaction of `req.headers.authorization` and any `token`, `sub`, `email` or `name`
    field. The logger is one of the two allowed module singletons.
  - The correlation middleware accepts `X-Correlation-Id` (UUID) or mints one, puts it on every log
    line and returns it in the response header.
  - pino-http request logging never logs bodies (FR-014) (IPX-9498)
- [X] T012 [P] `src/instrument.ts`: Sentry init with `@ipxos-ai/sentry-scrubber`, off when
  `SENTRY_DSN` is unset. The environment tag comes from `ENVIRONMENT`, not `NODE_ENV`. Each request
  opens a scope tagged `flow.name=resolve_me` and `correlationId` (observability spec) (IPX-9498)
- [X] T013 [P] RED then GREEN: `tests/unit/errorHandler.test.ts`, then `src/errors/` (typed errors
  and the code/status table) and `src/middleware/errorHandler.ts` (research R10).
  - Typed errors map to `401 invalid_token`, `403 user_disabled`, `502 profile_invalid`,
    `503 identity_provider_unavailable`, `503 profile_unavailable`, `503 database_unavailable`
    (each `503` with `Retry-After: 5`) and `500 internal_error`.
  - The body is exactly `{ "code": "<code>", "message": "<fixed text>", "statusCode": <status> }`,
    with fixed messages that never echo input and no stack trace.
  - A malformed JSON body from `express.json()` maps to `400` with the same body shape.
  - Sentry fires only for the `5xx` codes (FR-013) (contracts/resolve-me-api.md) (IPX-9498)
- [X] T014 [P] RED then GREEN: `tests/unit/health.test.ts` (`AC-15:`), then `src/routes/health.ts`.
  `GET /health` → `200 { service: "svc-identity", version: <package.json version>, status: "ok" }`.
  It is unauthenticated, exempt from rate limiting and makes no database or identity-provider call
  (constitution, `svc-product-factory` pattern) (IPX-9498)
- [X] T015 `prisma/schema.prisma`, the first migration under `prisma/migrations/`, `prisma.config.ts`,
  `src/db/prisma.ts` (`PrismaClient` with `@prisma/adapter-pg`, pool `connectionTimeoutMillis: 3000`
so a down database answers `503` instead of hanging), and the plain types
  `src/models/PlatformUser.ts` and `src/models/IdentityLink.ts`. Exactly as the ERD
  (`docs/erd/ipx-9498-erd.md`) and data-model.md: PascalCase models and camelCase fields mapped to
  snake_case with `@@map`/`@map`.
  - enum `UserStatus { ACTIVE DISABLED }`.
  - `PlatformUser` (`@@map("platform_user")`):
    - `id String @id @default(uuid())` — "Platform-issued; never the provider's subject;
      documented style-guide exception", so carry that comment;
    - `email String` — "From `/userinfo` at creation only; PII; never logged; never a lookup key";
    - `name String` — "From `/userinfo` at creation only; PII; never logged";
    - `status UserStatus @default(ACTIVE)`;
    - `createdAt` (`created_at`), `updatedAt` (`updated_at`), and `deletedAt DateTime?`
      (`deleted_at`) — "Soft delete (PII); not used in this slice";
    - `@@index([deletedAt])`.
  - `IdentityLink` (`@@map("identity_link")`):
    - `id String @id @default(cuid(2))`;
    - `provider String` — "The verified `iss`, byte-exact";
    - `subject String` — "The verified `sub`; personal data; never logged";
    - `platformUserId` → `platform_user_id`, with `onDelete: Restrict, onUpdate: Restrict`;
    - `createdAt`, `updatedAt`, `deletedAt DateTime?`;
    - `@@unique([provider, subject])`, `@@index([platformUserId])`, `@@index([deletedAt])`.

  Migrations are never edited after commit, and nothing migrates on boot (IPX-9498)
- [X] T016 [P] RED then GREEN: `tests/unit/localIdp.test.ts`, then `tests/support/keys.ts`,
  `tests/support/local-idp/server.ts` and `scripts/local-token.ts`. Then add the `local-idp` service
  to `docker-compose.db.yml` (research R9).
  - **`keys.ts`**: a `jose.generateKeyPair('RS256')` helper and a token builder with overridable
    `iss`, `aud`, `exp`, `alg` and `kid`.
  - **`local-idp/server.ts`**:
    - Dependency-free: Node `http` and `crypto` only, valid under Node's built-in type stripping.
      Erasable syntax only, with `.ts` import extensions and its own
      `tests/support/local-idp/tsconfig.json`. It is excluded from the service `tsc` build and
      from knip.
    - Exports `createLocalIdp({ port, issuer, faults })` for in-process use, and starts a server
      when run directly.
    - Generates an RS256 key pair on start.
    - Serves `GET /.well-known/jwks.json` and `GET /userinfo` (answers only for tokens it issued,
      with fixture name and email per subject).
    - Serves `POST /oauth/token`, which takes an optional `sub`, `email` and `name` and signs an
      access token with `iss` = issuer, `aud=svc-identity` and a one-hour `exp`.
    - Fault controls, for in-process use only: `/userinfo` answering 401, 403, 429 or 5xx, giving
      no email, or hanging past 3 s; `stop()` and `start()` for the JWKS; key rotation (a new
      `kid`).
  - **Compose service `local-idp`**:
    - `image: node:22.23.4-alpine`;
    - `command: node tests/support/local-idp/server.ts`, with the directory mounted read-only;
    - `environment: LOCAL_IDP_ISSUER=http://localhost:9024/`, `ports: ["9024:9024"]`;
    - healthcheck `wget -qO- http://localhost:9024/.well-known/jwks.json`.
  - **`scripts/local-token.ts`**: posts to `http://localhost:9024/oauth/token` with `--sub`,
    `--email` and `--name`, and prints only the token.
  - No real personal data in fixtures (IPX-9498)
- [X] T017 [P] `.github/workflows/ci.yml`, mirroring `svc-crm-factory/.github/workflows/ci.yml`:
  - Jobs:
    - `build`;
    - `static-analysis` (`lint`, `typecheck`, `knip`);
    - `unit` (`test:coverage`, at least 70% lines);
    - `integration` (with `--passWithNoTests` until the first integration test lands), with a
      `postgres:16-alpine` service container, `DATABASE_URL` pointing at it,
      `setup:test-db`, then `test:integration`, uploading `test-reports/integration-junit.xml`;
    - `contracts`;
    - `security`;
    - and the `quality` aggregator.
  - Copy `codeql.yml` and `require-linear-reference.yml`.
  - **Omit** the docker, `dispatch-dev-image`, `publish-api-client` and `notify` jobs (research R5).
  - Pin actions by SHA, as the source does (IPX-9498)
- [X] T018 [P] `Dockerfile`, `.dockerignore` (excluding `tests/`, `scripts/local-token.ts`, `.env*`,
  `coverage/` and `test-reports/`) and `start.sh`, after `svc-party-factory`:
  - multi-stage, on `node:22.23.4-alpine`;
  - `npm ci` with the `node_auth_token` build secret, and `prisma generate`;
  - a non-root `nodejs` user (uid 1001) and `dumb-init`;
  - `ENV NODE_ENV=production`, `EXPOSE 4024`, and a `HEALTHCHECK` on `http://localhost:4024/health`;
  - `CMD ["sh", "start.sh"]`. `start.sh` runs only
    `exec node --import ./dist/instrument.js dist/index.js` and **does not migrate**.

  The image is built in CI's `build` lane only and never pushed (IPX-9498)
- [X] T019 `src/app.ts`, `src/container.ts` and `src/index.ts`.
  - `app.ts` exports `createApp(deps)`, which builds the Express app without listening: helmet,
    `express.json({ limit: '10kb' })`, correlation, request logging, a global `express-rate-limit`
    (with `/health` exempt), `/health`, the routes, and `errorHandler` last.
  - `container.ts` is the composition root. Each piece is added by constructor injection as its
    task lands, built from the parsed config: `JoseTokenVerifier` with T033, then
    `Auth0ProfileClient`, `IdentityRepository` and `ResolveMeService` with T027.
  - Substitute verifiers exist **only** as `createApp` parameters in tests.
    `POST /v1/users/me` is never mounted behind anything but the real `JoseTokenVerifier`, at any
    commit (implementation plan round 2).
  - `index.ts` parses the config, builds the container, listens on `PORT`, and shuts down gracefully
    on SIGTERM (closing the server, then Prisma) (IPX-9498)
- [X] T020 Gate, on a workstation:
  1. Run the clean-clone sequence from quickstart step 1: `npm ci` → `cp .env.example .env` →
     `npm run db:up` → `npm run db:migrate` → `npm run dev`. Then `curl localhost:4024/health`
     gives `200`.
  2. Quickstart step 4 (the startup guards) and step 5 (`lint`, `typecheck`, `knip`,
     `test:coverage`) pass.
  3. The husky hook runs on a commit.
  4. Push the branch and confirm all CI lanes are green (IPX-9498)

**Checkpoint**: A skeleton that runs locally from a clean clone, with schema, config and its
guards, logging, errors, health, the local identity provider and green CI. No story logic yet.

---

## Phase 3: User Story 1 — An operator's first sign-in gives them one lasting platform user (P1) 🎯 MVP

**Goal**: `POST /v1/users/me` creates one platform user and link on first login and returns the same
id afterwards.

**Independent Test**: With a substitute `TokenVerifier` (a valid token) and a stub profile, the first
call returns `201 {userId, created: true}`, the second `200` with the same `userId`, and 50
concurrent first calls leave one user and one link (quickstart step 3).

### Tests for User Story 1 (write first, must fail) ⚠️

- [X] T021 [P] [US1] RED: `tests/integration/IdentityRepository.test.ts` against the Compose
  Postgres (`svc_identity_test`):
  - `createUserWithLink(provider, subject, {email, name})` writes one `platform_user` with
    `status` `ACTIVE` and one `identity_link` in one transaction.
  - `findLink(provider, subject)` returns it.
  - A second insert for the same `(provider, subject)` raises `LinkExistsError` (FR-002).
  - Each test cleans both tables first (IPX-9498)
- [X] T022 [P] [US1] RED: `tests/unit/ResolveMeService.test.ts`, with a fake repository and profile
  client:
  - New subject → profile fetched once, user created, `{userId, created: true}`.
  - Existing active subject → no profile fetch and no create, `{userId, created: false}`.
  - `userId` is a UUID and does not contain the token's `sub` (US1 scenario 4) (FR-003, FR-004,
    FR-008) (IPX-9498)
- [X] T023 [P] [US1] RED: `tests/integration/usersMe.test.ts` (supertest on `createApp` with a
  substitute verifier and profile, real database):
  - `AC-1:` the first `POST /v1/users/me` is `201 {userId, created: true}`, and the second is
    `200 {userId, created: false}` with the same id, leaving exactly one row per table.
  - `AC-7:` 50 concurrent first calls for one subject give one `201` and 49 `200`s with the same
    id, and one row per table (SC-001) (IPX-9498)

### Implementation for User Story 1

- [X] T024 [US1] GREEN: `src/repositories/IdentityRepository.ts`, the only module that imports
  Prisma.
  - `findLink(provider, subject)` returns the link plus the user.
  - `createUserWithLink(provider, subject, profile)` runs in a `prisma.$transaction`.
  - A Prisma `P2002`, matched on the code alone (never `meta.target`, which differs under
    adapter-pg), surfaces as `LinkExistsError`.
  - Adapter-pg connection failures (`DriverAdapterError`) surface as `DatabaseUnavailableError`;
    the test pins the exact shape.

  T021 passes (IPX-9498)
- [X] T025 [US1] GREEN: `src/services/ResolveMeService.ts`, with
  `constructor(repository, profileClient, logger)` and `resolveOrCreate(verifiedToken)`.
  - Look up `(iss, sub)`.
  - On a miss, call `ProfileClient.fetchProfile(token)`, then `createUserWithLink`.
  - On `LinkExistsError`, re-read and return `{userId, created: false}` with an INFO log
    `outcome: race_lost`. If the re-read finds no link, throw an internal error (→ `500`). There
    is no retry loop.
  - Never search by email (FR-011).

  T022 passes (IPX-9498)
- [X] T026 [US1] GREEN: `src/services/ProfileClient.ts`, holding the `ProfileClient` interface and
  `Auth0ProfileClient` (happy path only).
  - GET `config.userinfoUrl` with `Authorization: Bearer <the verified raw token>`, a 3 s timeout,
    and `traceparent` and `X-Correlation-Id` headers.
  - Parse with zod: `email` is a non-empty string; `name` is a non-empty string, "falling back to
    the email when the provider omits it" (data-model.md) (IPX-9498)
- [X] T027 [US1] GREEN: `src/routes/usersMe.ts`.
  - `POST /v1/users/me` reads only `req.verifiedToken` (set by the auth middleware), **never**
    `req.body`, `req.query` or other headers.
  - It answers `201` or `200` with `{ userId, created }`.
  - Mount it in `src/app.ts` behind the auth middleware, and wire `ResolveMeService` in
    `src/container.ts`.

  T023 passes (IPX-9498)

**Checkpoint**: The MVP flow works with a substitute verifier: create once, resolve forever, race-safe.

---

## Phase 4: User Story 2 — Only a sign-in the service checks itself is accepted (P1)

**Goal**: Real in-service token verification (TRU.IAM.R67) and subject-from-token only (R53), with
no bypass in any environment, including local.

**Independent Test**: Every malformed, forged, expired, wrongly issued or wrongly addressed token, or
one with an unexpected algorithm, gets `401 invalid_token` with no repository call. A body naming
another subject changes nothing.

### Tests for User Story 2 (write first, must fail) ⚠️

- [X] T028 [P] [US2] RED: `tests/unit/TokenVerifier.test.ts`, using `tests/support/keys.ts` and
  `createLocalJWKSet`:
  - A valid token → `{issuer, subject, raw}`.
  - `AC-3:` each of these → `InvalidTokenError` with the matching reason code:
    - bad signature (another key);
    - `iss` differing by one character, including a missing trailing slash;
    - `aud` without `svc-identity`;
    - `exp` in the past.
  - `AC-4:` `alg: none`, `alg: HS256` (signed with a shared secret) and an unknown `kid` →
    `InvalidTokenError`.
  - `AC-3:` a validly signed token with no `exp`, with no `sub`, or with an empty `sub` →
    `InvalidTokenError` (implementation plan round 2, §2a).
  - Error mapping is an explicit allowlist:
    - a reachable JWKS with no key for the `kid` (`JWKSNoMatchingKey`, including during jose's
      refetch cooldown) → `InvalidTokenError`, with no Sentry event;
    - only `JWKSTimeout`, a fetch `TypeError` or network error, a non-200 JWKS response and
      `JWKSInvalid` → `JwksUnavailableError`;
    - `JWKSMultipleMatchingKeys` and `JOSENotSupported` → `InvalidTokenError` (one test each);
    - any other error → `500`. A test proves that a plain `JOSEError` subclass outside the lists
      does not become `503`.
  - Reason codes come from `{missing, malformed, bad_signature, wrong_issuer, wrong_audience,
    expired, wrong_algorithm, unknown_kid}` (IPX-9498)
- [X] T029 [P] [US2] RED: `tests/unit/requireVerifiedToken.test.ts`:
  - `AC-5:` no `Authorization` header, a non-Bearer scheme, or an empty token → `401` with body
    `{code: "invalid_token", message, statusCode: 401}`, and no verifier or repository call.
  - The WARN log carries only the reason code (IPX-9498)
- [X] T030 [P] [US2] RED: `tests/integration/usersMe.auth.test.ts`, with the real `JoseTokenVerifier`
  against `createLocalIdp` in-process and a real database:
  - `AC-3:` each refusal from T028 → `401`, with the row count unchanged and no `/userinfo` call.
  - `AC-2:` a valid token for subject A, with body `{"sub": "B", "subject": "B", "provider": "x"}`,
    header `X-User-Id: B` and query `?sub=B`, resolves A, and no row for B exists (SC-003)
    (IPX-9498)
- [X] T031 [P] [US2] RED: `tests/unit/noBypass.test.ts`:
  - Starting with `IDENTITY_ISSUER` unset fails.
  - No environment variable (`AUTH_DISABLED`, `AUTH_BYPASS`, `SKIP_AUTH`, `IDENTITY_AUTH_ENABLED=false`,
    `NODE_ENV=test`, `ENVIRONMENT=local`) lets an unauthenticated `POST /v1/users/me` succeed
    (FR-007, spec US2 scenario 5, Principle VIII) (IPX-9498)

### Implementation for User Story 2

- [X] T032 [US2] GREEN: `src/services/TokenVerifier.ts`, holding the `TokenVerifier` interface and
  `JoseTokenVerifier`.
  - Build the key set with `createRemoteJWKSet(new URL(config.jwksUrl), { timeoutDuration: 3000 })`.
  - Verify with `jwtVerify(token, jwks, { algorithms: ['RS256'], issuer: config.issuer,
    audience: config.audience, requiredClaims: ['exp', 'sub'] })`. Then use zod to check that
    `sub` is a non-empty string and `iss` is a string.
  - The JWKS fetch uses jose's `customFetch`, which adds `X-Correlation-Id` from AsyncLocalStorage.
    Sentry's `tracePropagationTargets` includes the issuer host, for `traceparent`.
  - Map jose errors with the allowlist from T028:
    - `JWKSNoMatchingKey`, `JWSSignatureVerificationFailed`, `JWTClaimValidationFailed`,
      `JWTExpired`, `JOSEAlgNotAllowed`, `JWSInvalid` and `JWTInvalid` →
      `InvalidTokenError` (`401`);
    - `JWKSMultipleMatchingKeys` and `JOSENotSupported` (e.g. a `crit` header or an unsupported
      key type) → `InvalidTokenError` (`401`);
    - `JWKSTimeout`, a network `TypeError`, a non-200 response and `JWKSInvalid` →
      `JwksUnavailableError` (`503`). The non-200 response is matched by
      `err.code === 'ERR_JOSE_GENERIC'`, checked after every subclass. It is **never** matched
      with `instanceof JOSEError`, because every jose error extends that class.
  - Return `{issuer: payload.iss, subject: payload.sub, raw}`.

  T028 passes (IPX-9498)
- [X] T033 [US2] GREEN: `src/middleware/requireVerifiedToken.ts`, a factory taking a `TokenVerifier`.
  It parses `Authorization: Bearer <jws>` with zod, calls the verifier, and sets
  `req.verifiedToken`. It never reads the body. Wire `JoseTokenVerifier` in `src/container.ts`;
  tests inject the local one. T029, T030 and T031 pass (IPX-9498)
- [X] T034 [US2] Local check (Principle VIII):
  - With `npm run db:up` and `npm run dev`, run the quickstart step 1 `curl` sequence using
    `npm run -s local:token`. Expect `201`, then `200` with the same `userId`; the same `userId`
    with a body naming another subject; and `401 invalid_token` without a token.
  - Restart the `local-idp` container (a new key) and confirm a fresh token still verifies, through
    the unknown-`kid` refetch (IPX-9498)

**Checkpoint**: US1 and US2 together are the full happy path with real verification, runnable
locally against the local identity provider.

---

## Phase 5: User Story 3 — A disabled platform user is refused (P2)

**Goal**: The platform record, not Auth0, decides whether a user may act (R63 AC2).

**Independent Test**: Set a user's `status` to `DISABLED` in the database; a valid token for them gets
`403 user_disabled`, and the row is unchanged.

- [X] T035 [P] [US3] RED: `tests/integration/usersMe.disabled.test.ts`:
  - `AC-6:` seed a linked user, set `status = 'DISABLED'` directly, then call → `403` with body
    `{code: "user_disabled", message, statusCode: 403}`.
  - Afterwards there is still one user (still `DISABLED`, `updated_at` unchanged) and one link, and
    no `/userinfo` call was made (IPX-9498)
- [X] T036 [US3] GREEN: in `src/services/ResolveMeService.ts`, a found link whose user is `DISABLED`
  throws `UserDisabledError` (→ `403 user_disabled`, WARN log, no Sentry). Never update, re-enable or
  re-create (FR-010). The service never writes `status`, so no state-machine class is needed
  (research R10). T035 passes (IPX-9498)

---

## Phase 6: User Story 4 — Dependency failures leave nothing half-done and are diagnosable (P2)

**Goal**: Every failure path F4 to F9 in `docs/sequences/ipx-9498-resolve-me.md` behaves as
`docs/observability/ipx-9498-observability.md` states.

**Independent Test**: Make each dependency fail in turn (quickstart step 3). Each gets the expected
status, zero partial rows remain, and Sentry is called with the expected tags.

### Tests for User Story 4 (write first, must fail) ⚠️

- [X] T037 [P] [US4] RED: `tests/integration/usersMe.profileFailures.test.ts`, against
  `createLocalIdp` with `/userinfo` faults:
  - `AC-9:` a first login with `/userinfo` hanging past 3 s, answering 5xx or answering 429 →
    `503 profile_unavailable` with `Retry-After: 5` and zero rows. A Sentry spy is called with
    `flow.step=fetch_profile`, `target.service=auth0-userinfo` and `target.statusCode`.
  - `AC-10:` 401, 403 or 200 without `email` → `502 profile_invalid` and zero rows, and Sentry
    fires (IPX-9498)
- [X] T038 [P] [US4] RED: `tests/integration/usersMe.jwks.test.ts`, against `createLocalIdp`:
  - `AC-8:` with the JWKS stopped before any fetch (cold cache) → `503
    identity_provider_unavailable` with `Retry-After: 5`, no database query, and Sentry tagged
    `flow.step=verify_token`, `target.service=auth0-jwks`.
  - After one successful call (warm cache), stopping the JWKS → an existing user still gets `200`
    without a fetch.
  - A token with a rotated `kid` while stopped → `503` (SC-007) (IPX-9498)
- [X] T039 [P] [US4] RED: `tests/integration/usersMe.database.test.ts`:
  - `AC-11:` with the database unreachable (a `DATABASE_URL` pointing at a closed port) →
    `503 database_unavailable` with `Retry-After: 5`, and Sentry tagged `target.service=postgres`.
  - A create interrupted after the user insert (failure injected through the repository's
    transaction) leaves zero rows (F9 rollback) (IPX-9498)
- [X] T040 [P] [US4] RED: `tests/integration/noPiiInLogs.test.ts`:
  - `AC-13:` run every scenario in T023, T030, T035 and T037 to T039 with sentinel token, `sub`,
    email and name values, capturing pino output and Sentry events. Assert at least one log line
    per request and at least one Sentry event per `5xx` scenario (a count, so an empty capture
    fails). The `Authorization` header appears only redacted, and each sentinel value occurs zero
    times.
  - Every log line has `correlationId`.
  - The local-idp JWKS and `/userinfo` received `traceparent` and `X-Correlation-Id` (SC-006)
    (IPX-9498)

### Implementation for User Story 4

- [X] T041 [US4] GREEN: extend `Auth0ProfileClient` in `src/services/ProfileClient.ts`:
  - A timeout, a network error, 5xx or 429 → `ProfileUnavailableError`.
  - 401, 403, or a zod parse failure (no `email`) → `ProfileInvalidError`.

  The client is called before any write, so failures leave no rows. T037 passes (IPX-9498)
- [X] T042 [US4] GREEN: `src/middleware/errorHandler.ts` and `src/instrument.ts`.
  - On each `5xx` error, call `Sentry.captureException` with tags `flow.name`, `flow.step`,
    `entity.userId` (when known), `entity.created`, `target.service`, `target.statusCode`,
    `auth.issuer` and `correlationId`. Never tag the token, `sub`, email or name.
  - Emit the breadcrumb log lines from the observability spec at each step.

  T038, T039 and T040 pass (IPX-9498)

**Checkpoint**: All of IPX-9498's "Done when" items 1 to 13 are covered by passing, `AC-N`-tagged
tests.

---

## Phase 7: Polish & cross-cutting

- [X] T043 [P] Via `ipx-fix`: `scripts/generate-openapi.ts` (zod-to-openapi) writes
  `docs/openapi.yaml` for `POST /v1/users/me` and `GET /health`, with the error schema
  `{code, message, statusCode}`, matching
  [contracts/resolve-me-api.md](contracts/resolve-me-api.md). The `contracts` CI lane runs
  `generate:openapi` and `check:generated-clean` (IPX-9498)
- [X] T044 [P] Via `ipx-fix`, write `README.md`:
  - the local profile: prerequisites, ports 4024, 5446 and 9024, and the clean-clone sequence;
  - `local:token` usage;
  - the test lanes and quality gates;
  - the configuration keys, with which are local-only;
  - links to `docs/LLD.md` and ADR-0001.

  Also reconcile the discuss design docs (`CONTEXT.md`, `docs/adr/0001-…`, `docs/erd/…`,
  `docs/sequences/…`, `docs/observability/…`, `docs/architecture/…`, `docs/LLD.md`) with the final
  code, including the error body and layout. Commit them on `feat/ipx-9498-svc-identity`
  (`design.same_repo_docs`) ("Done when" item 14) (IPX-9498)
- [X] T045 Data contract (research R8), after the first commit is pushed:
  - In a `domain-docs` worktree at `repos/domain-docs-9498`, on `docs/ipx-9498-data-contracts`, add
    `svc-identity` to `data-contracts/services.yaml` (`canon_domain: [TRU]`,
    `repository: ipxos-ai/svc-identity`, `observed_at: <the pushed commit SHA>`).
  - Draft `contracts/svc-identity.platform-user-id.yaml` (`contract_type: identifier`,
    `service: svc-identity`, `semantic_type: uuid`, `status: proposed`, `agreed_in: IPX-9498`),
    following `ipx-discuss/references/draft-data-contract.md` (duplicate check, `generate.py
    --root`, `--check`).
  - Record `design.contract_drafts[]`, then open the `domain-docs` PR (land-the-design-docs worktree
    sub-path). **Do not merge** (IPX-9498)
- [X] T046 [P] Run `/ipxos-skills:service-lld update svc-identity` against the final code. Patch these
  sections of `docs/services/svc-identity.md` in `repos/ipx-cd-9498`:
  - §4 runtime;
  - §5 ingress;
  - §7 data;
  - §8 config keys, from `src/config/index.ts`, including `ENVIRONMENT`;
  - §10 health;
  - the local-run section.

  Make it a new commit on `docs/ipx-9498-svc-identity-lld` (PR ipxos-ai/ipx-cd#1802). Write through
  the branch, never with `gh api` to `main` (IPX-9498)
- [ ] T047 Run [quickstart.md](quickstart.md) steps 1 to 5 from a fresh clone of the branch (step 6,
  against `dev-ipxos-play`, is optional). Record pass counts, the coverage figure and the measured
  p95 latencies (SC-004) for the progress comment (IPX-9498)
- [ ] T048 Run the remaining non-deploying governance turns from `repos/svc-identity` via
  `/ipxos-skills:ipx-next`: `audit`, `verify-qa`, `pr`. `verify-qa` reads the `AC-N` JUnit evidence.
  `pr` pushes `feat/ipx-9498-svc-identity` and opens the PR, which moves Linear to In Review. Stop
  before `merge` (IPX-9498)
- [ ] T049 Post the `[Speckit] implement` progress comment on IPX-9498: completed task IDs, commit
  SHAs, the PR links (svc-identity, ipx-cd#1802, domain-docs), the T047 results, and "HELD: T050".
  If the endpoint or error codes changed beyond the 2026-11-05 error-body note, post a short note
  on IPX-9500 too (IPX-9498, IPX-9500)
- [ ] T050 HELD. After approval: merge the svc-identity PR via `ipx-merge`, then ipx-cd#1802 and the
  `domain-docs` contract PR. Merging deploys nothing (no deploy job, research R5); deployment is
  IPX-9499 (IPX-9498)

---

## Dependencies & execution order

- **T001 blocks everything in the service repo.** Until it passes, only spec-side work (this file,
  `/speckit-analyze`) can proceed.
- **Phase 1 → Phase 2 → stories.** T006 must reach the `fix` turn before any `ipx-fix` task.
- **Within Phase 2**:
  - T007 comes first.
  - T008 to T018 follow; T010 must finish before T016 adds the `local-idp` service to the same
    compose file.
  - T019 needs T008, T011, T013 and T014.
  - T020's local run and green CI gate the story phases.
- **Build order (implementation plan round 2)**: the US2 verifier (T028, T029, T032, T033) comes
  **before** the US1 route (T021–T027). Then come T030, T031 (no-bypass) and T034.
  `POST /v1/users/me` is only ever mounted behind the real verifier. The US1 service and
  repository tests still use fakes through `createApp` parameters.
- **US1 (T021–T027)** depends on Phase 2 and on T032/T033.
- **US2 (T028–T034)** depends only on Phase 2 (and on T016 for the local identity provider). T027 and
  T033 both touch `src/app.ts` and `src/container.ts` wiring: serialise them. T034 needs US1 and
  US2.
- **US3 (T035–T036)** depends on US1 (the resolve service and route).
- **US4 (T037–T042)** depends on US1, and on US2 for T038 (the real JWKS path).
- **Phase 7**:
  - T043 and T044 come after all stories.
  - T045 comes after the first push (T020).
  - T046 comes after T043.
  - T047 comes after all stories.
  - T048 comes after T043 to T047, and T049 after T048.
  - T050 is HELD.

## Parallel opportunities

- Phase 2 (after T007): T008, T009, T010, T011, T012, T013, T014, T017 and T018 touch different
  files. T016 can run alongside them once T010 is done.
- Within each story, the RED test tasks marked [P] together.
- US1 and US2 implementation can run in parallel (different files) up to the `src/app.ts` and
  `src/container.ts` wiring.
- Phase 7: T043, T044 and T046.

```text
# After T020:
ipx-fix: T021 ∥ T022 ∥ T023 → T024 → T025 → T026 → T027          (US1)
ipx-fix: T028 ∥ T029 ∥ T030 ∥ T031 → T032 → T033 → T034 (local)   (US2)
then:    T035 → T036                                              (US3)
then:    T037 ∥ T038 ∥ T039 ∥ T040 → T041 → T042                  (US4)
```

## Implementation strategy

- **MVP**: Phases 1 and 2, then US1 and US2 (T001–T034). A verified operator gets one lasting
  platform user, and it runs end to end on a laptop against the local identity provider. That is
  enough for IPX-9500 to integrate against locally.
- **Increment 2**: US3 and US4 (T035–T042), which close the disabled-user and failure acceptance
  criteria.
- **Increment 3**: Phase 7 up to the open PRs (T043–T049). T050 only after approval.

## Notes

- 50 tasks: 1 BLOCKED gate (T001, which in practice blocks T002–T049 as well) and 1 HELD (T050).
- AC tags map to IPX-9498 "Done when":
  - US1 → AC-1, AC-7
  - US2 → AC-2, AC-3, AC-4, AC-5
  - US3 → AC-6
  - US4 → AC-8, AC-9, AC-10, AC-11, AC-13
  - config → AC-12 (T008); health → AC-15 (T014)
  - docs → item 14 (T044)
- Changes from the 2026-10-29 task list (constitution v1.2.0):
  - Phase 2 adds the local profile: `ENVIRONMENT` guards (T008), `.env.example`, `.env.test` and
    `tests/setup.ts` (T009), the Compose Postgres on port 5446 with `db:up --wait` (T010), and the
    local identity provider in Compose plus `local:token` (T016).
  - It also adds knip, husky, Prettier, jest-junit and the 70% coverage threshold (T007), and the
    clean-clone gate (T020).
  - New tasks: T034 (the local end-to-end check).
  - Paths now follow the estate layout, with `container.ts` and PascalCase class files.
  - The error body is now `{code, message, statusCode}`.
- Linear state: `ipx-branch` (T006) → In Progress, `ipx-pr` (T048) → In Review,
  `ipx-merge` (T050, HELD) → Done. Spec Kit only comments.
