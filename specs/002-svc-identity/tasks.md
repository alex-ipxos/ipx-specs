# Tasks: Platform user record (svc-identity)

**Input**: Design documents from `specs/002-svc-identity/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/resolve-me-api.md](contracts/resolve-me-api.md),
[quickstart.md](quickstart.md)

**Linear**: every task belongs to [IPX-9498](https://linear.app/ipxos-ai/issue/IPX-9498) unless it
says otherwise (constitution Principle VII).

**Tests**: Required. `ipx-fix` works test-first (a RED commit before GREEN), and IPX-9498's "Done
when" items 1 to 13 are each a test.

**Organization**: Tasks are grouped by user story so each story can be built and checked on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: the user story the task serves (US1 to US4, from spec.md)
- **BLOCKED**: cannot start until `ipxos-ai/github-configuration#56` is applied and the repository
  exists
- **HELD**: merges a PR. It does not start until the developer explicitly approves (plan.md
  "Delivery constraints")

## Rules for every task

- Paths are relative to the `ipx-specs` root. `repos/svc-identity` is the `ipxos-ai/svc-identity`
  worktree on `feat/ipx-9498-svc-identity`; service paths below are relative to it.
- Every change to service code, tests, schema, CI or the Dockerfile is made **only through
  `ipx-fix`**, test-first (constitution Principle III). Run `ipx-*` turns from `repos/svc-identity`.
- Never commit to `main`. Never merge. CI must have no image-push or deploy-dispatch job
  (research R5).
- No token, `sub`, email or name in any log line, test snapshot or fixture committed to the repo
  (FR-014).
- Conventional Commits, lowercase subject, with a Linear reference (`IPX-9498`) for the
  `linear-reference` check. Stage files by name, never `git add -A`.

---

## Phase 1: Setup (shared) — BLOCKED on the repository

**Purpose**: Turn the placeholder into the real worktree and bring the governance workflow up to the
`fix` turn.

- [ ] T001 BLOCKED. Confirm `ipxos-ai/github-configuration#56` is merged and applied:
  `gh repo view ipxos-ai/svc-identity --json name,defaultBranchRef` succeeds, and
  `gh api repos/ipxos-ai/svc-identity/rules/branches/main` lists the `service-v1` and
  `linear-reference` checks (IPX-9498)
- [ ] T002 Clone the main checkout: `git clone https://github.com/ipxos-ai/svc-identity.git
  /Users/valyalkin/ipxos/svc-identity`. It stays on `main` and is never edited for this feature
  (IPX-9498)
- [ ] T003 Convert the placeholder at the same path (research R7):
  1. `mv repos/svc-identity repos/svc-identity.placeholder`
  2. `git -C ../svc-identity worktree add /Users/valyalkin/ipxos/ipx-specs/repos/svc-identity -b feat/ipx-9498-svc-identity origin/main`
  3. `rsync -a --exclude .git repos/svc-identity.placeholder/ repos/svc-identity/`
  4. Confirm `git -C repos/svc-identity status --porcelain` lists only the design docs and
     `.planning/`, then `rm -rf repos/svc-identity.placeholder`

  Do not commit anything here (IPX-9498)
- [ ] T004 From `repos/svc-identity`, run `/ipxos-skills:ipx-status`. It must resolve `IPX-9498` with
  evidence root `.planning` (pointer source `pointer-keyed`), proving the pointers survived T003
  unchanged (IPX-9498)
- [ ] T005 Refresh the repo conventions in `repos/svc-identity/.planning/config.json`, which discuss
  recorded as pending (detect-repo-conventions): the rulesets probe on `main`, CODEOWNERS, and the
  Node version. Replace the `status: pending` block (IPX-9498)
- [ ] T006 Run `/ipxos-skills:ipx-next` through the turns before `fix`: `readiness`, then
  `implementation-plan` (risk tier and approval: wait for the approver it names), then `branch`.
  `ipx-branch` owns the Linear move to In Progress (IPX-9498)

**Checkpoint**: The worktree exists at the same path, the evidence resolves, and the orchestrator's
next turn is `fix`.

---

## Phase 2: Foundational (blocking)

**Purpose**: A buildable, testable, CI-checked service skeleton that every story builds on. All
tasks via `ipx-fix`.

- [ ] T007 Scaffold from `svc-crm-factory` (research R1): `package.json` (`"type": "module"`,
  `engines.node >=22`, scripts `build`, `typecheck`, `lint`, `test`, `test:unit`,
  `test:integration`, `generate:openapi`, `check:generated-clean`, `db:migrate`, `db:generate`),
  `.nvmrc` (`22`), `tsconfig.json`, `eslint.config.js`, `jest.config.ts`,
  `jest.integration.config.ts`, `.gitignore`, `.env.example` with no real values. Dependencies:
  express 5, @prisma/client and prisma 7, @prisma/adapter-pg, zod 4, pino 10, pino-http,
  @sentry/node 10, @ipxos-ai/sentry-scrubber, helmet, jose 6. Dev: jest 30, ts-jest, supertest,
  typescript 6, tsx, @asteasolutions/zod-to-openapi (IPX-9498)
- [ ] T008 RED then GREEN: `tests/unit/config.test.ts`, then `src/config.ts`. A zod schema over
  `process.env`:
  - `IDENTITY_ISSUER` is a URL ending in `/`.
  - `IDENTITY_AUDIENCE` defaults to `svc-identity`.
  - `DATABASE_URL` is required.
  - `PORT` defaults to `4024`.
  - `SENTRY_DSN` is optional, and `LOG_LEVEL` defaults to `info`.
  - The JWKS URL (`<issuer>.well-known/jwks.json`) and the userinfo URL (`<issuer>userinfo`) are
    derived from the issuer.

  A missing or invalid key throws an error naming the key and never its value. There is **no**
  setting that disables authentication (FR-007, FR-015, FR-016) (IPX-9498)
- [ ] T009 [P] RED then GREEN: `tests/unit/logging.test.ts`, then `src/logging/logger.ts` and
  `src/logging/correlation.ts`:
  - pino with redaction of `req.headers.authorization` and any `token`, `sub`, `email` or `name`
    field.
  - A correlation-id middleware: accept `X-Correlation-Id` (UUID) or mint one, put it on every log
    line, and return it in the response header (FR-014) (IPX-9498)
- [ ] T010 [P] `src/instrument.ts`: Sentry init with `@ipxos-ai/sentry-scrubber`, off when
  `SENTRY_DSN` is unset. Each request opens a scope tagged `flow.name=resolve_me` and
  `correlationId` (observability spec) (IPX-9498)
- [ ] T011 [P] RED then GREEN: `tests/unit/errors.test.ts`, then `src/errors/index.ts` and
  `src/errors/handler.ts`. Typed errors map to `401 invalid_token`, `403 user_disabled`,
  `502 profile_invalid`, `503 identity_provider_unavailable`, `503 profile_unavailable`,
  `503 database_unavailable` (each `503` with `Retry-After: 5`) and `500 internal_error`. The body is
  `{ "error": { "code", "message" } }` with fixed messages that never echo input. Sentry fires only
  for the `5xx` codes (FR-013) (contracts/resolve-me-api.md) (IPX-9498)
- [ ] T012 [P] RED then GREEN: `tests/unit/health.test.ts`, then `src/routes/health.ts`.
  `GET /health` → `200 { service: "svc-identity", version: <package.json version>, status: "ok" }`,
  unauthenticated, with no database or Auth0 call (constitution, `svc-product-factory` pattern)
  (IPX-9498)
- [ ] T013 `prisma/schema.prisma` and the first migration under `prisma/migrations/`, exactly as the
  ERD (`docs/erd/ipx-9498-erd.md`):
  - enum `UserStatus { ACTIVE DISABLED }`.
  - `PlatformUser` (`@@map("platform_user")`): `id String @id @default(uuid())`, carrying the
    style-guide exception comment; `email String`; `name String`;
    `status UserStatus @default(ACTIVE)`; `createdAt`, `updatedAt`, `deletedAt DateTime?`;
    `@@index([deletedAt])`.
  - `IdentityLink` (`@@map("identity_link")`): `id String @id @default(cuid(2))`; `provider String`;
    `subject String`; `platformUserId` mapped to `platform_user_id`, with
    `onDelete: Restrict, onUpdate: Restrict`; `@@unique([provider, subject])`;
    `@@index([platformUserId])`; `@@index([deletedAt])`.

  Plus `prisma.config.ts` (IPX-9498)
- [ ] T014 [P] `docker-compose.db.yml` and `scripts/setup-test-db.sh` for a local test Postgres on a
  free host port (check that `svc-crm-factory`'s 5443 and other siblings' ports are not reused), as
  in `svc-crm-factory` (IPX-9498)
- [ ] T015 [P] `tests/support/keys.ts` (a `jose.generateKeyPair('RS256')` helper and a token builder
  with overridable `iss`, `aud`, `exp`, `alg` and `kid`), `tests/support/jwks-server.ts` (a local
  HTTP JWKS server that can be stopped and restarted), and `tests/support/userinfo-stub.ts` (a local
  `/userinfo` that can answer 200, 401, 403, 429, 5xx, no email, or hang past 3 s). No real tokens
  or personal data in fixtures (research R3) (IPX-9498)
- [ ] T016 [P] `.github/workflows/ci.yml` with jobs `build`, `static-analysis`, `unit`,
  `integration`, `contracts`, `security` and a `quality` aggregator, mirroring
  `svc-crm-factory/.github/workflows/ci.yml`. Copy `codeql.yml` and `require-linear-reference.yml`.
  **Omit** the docker, `dispatch-dev-image`, `publish-api-client` and `notify` jobs (research R5).
  Pin actions by SHA, as the source does (IPX-9498)
- [ ] T017 [P] `Dockerfile`: multi-stage, `node:22-alpine`, non-root user, `dumb-init`, as
  `svc-crm-factory`. It is built in CI's `build` lane only and never pushed (IPX-9498)
- [ ] T018 `src/app.ts` and `src/index.ts`: build the Express app (helmet, json limit, correlation,
  pino-http, `/health`, the error handler) with injected `TokenVerifier`, `ProfileClient` and
  repository interfaces (class diagram), so tests can substitute them. `index.ts` parses config,
  connects Prisma, listens on `PORT`, and shuts down gracefully on SIGTERM (IPX-9498)
- [ ] T019 Gate: `npm run build && npm run typecheck && npm run lint && npm run test:unit` all pass
  locally; push the branch and confirm all CI lanes are green (IPX-9498)

**Checkpoint**: A green, CI-checked skeleton with schema, config, logging, errors and health. No
story logic yet.

---

## Phase 3: User Story 1 — An operator's first sign-in gives them one lasting platform user (P1) 🎯 MVP

**Goal**: `POST /v1/users/me` creates one platform user and link on first login and returns the same
id afterwards.

**Independent Test**: With a stub verifier (a valid token) and a stub profile, the first call returns
`201 {userId, created: true}`, the second `200` with the same `userId`, and 50 concurrent first calls
leave one user and one link (quickstart step 2).

### Tests for User Story 1 (write first, must fail) ⚠️

- [ ] T020 [P] [US1] RED: `tests/integration/identity.repository.test.ts` against the Compose
  Postgres:
  - `createUserWithLink(provider, subject, {email, name})` writes one `platform_user` with
    `status` `ACTIVE` and one `identity_link` in one transaction.
  - `findLink(provider, subject)` returns it.
  - A second insert for the same `(provider, subject)` raises the unique-violation error (FR-002)
    (IPX-9498)
- [ ] T021 [P] [US1] RED: `tests/unit/resolve-me.service.test.ts`:
  - New subject → profile fetched once, user created, `{userId, created: true}`.
  - Existing active subject → no profile fetch and no create, `{userId, created: false}`.
  - `userId` is a UUID and does not contain the token's `sub` (US1 scenario 4) (FR-003, FR-004,
    FR-008) (IPX-9498)
- [ ] T022 [P] [US1] RED: `tests/integration/users-me.test.ts` (supertest, stub verifier and profile,
  real database):
  - The first `POST /v1/users/me` is `201 {userId, created: true}` and the second is
    `200 {userId, created: false}` with the same id, leaving exactly one row per table ("Done when"
    item 1).
  - 50 concurrent first calls for one subject give one `201` and 49 `200`s with the same id, and
    one row per table ("Done when" item 7, SC-001) (IPX-9498)

### Implementation for User Story 1

- [ ] T023 [US1] GREEN: `src/users/identity.repository.ts`. `findLink(provider, subject)` (link plus
  user) and `createUserWithLink(provider, subject, profile)` run in a `prisma.$transaction`; the
  Prisma `P2002` on `identity_link (provider, subject)` surfaces as a typed `LinkExistsError`.
  Database connectivity errors surface as `DatabaseUnavailableError` (T020 passes) (IPX-9498)
- [ ] T024 [US1] GREEN: `src/users/resolve-me.service.ts` `resolveOrCreate(verifiedToken)`. Look up
  `(iss, sub)`. On a miss, call `ProfileClient.fetchProfile(token)`, then `createUserWithLink`. On
  `LinkExistsError`, re-read and return `{userId, created: false}` with an INFO log
  `outcome: race_lost`. Never search by email (FR-011) (T021 passes) (IPX-9498)
- [ ] T025 [US1] GREEN: `src/profile/auth0-profile-client.ts`, happy path only:
  - GET the configured userinfo URL with `Authorization: Bearer <the verified raw token>`, a 3 s
    timeout, and `traceparent` and `X-Correlation-Id` headers.
  - Parse with zod: `email` is a non-empty string; `name` is a non-empty string, "falling back to the
    email when the provider omits it" (data-model.md) (IPX-9498)
- [ ] T026 [US1] GREEN: `src/users/users-me.route.ts`. `POST /v1/users/me` reads only
  `req.verifiedToken` (set by the auth middleware), **never** `req.body`, `req.query` or other
  headers. It answers `201` or `200` with `{ userId, created }`. Mount it in `src/app.ts` behind the
  auth middleware (T022 passes) (IPX-9498)

**Checkpoint**: The MVP flow works with a stubbed verifier: create once, resolve forever, race-safe.

---

## Phase 4: User Story 2 — Only a sign-in the service checks itself is accepted (P1)

**Goal**: Real in-service token verification (TRU.IAM.R67) and subject-from-token only (R53), with
no bypass.

**Independent Test**: Every malformed, forged, expired, wrongly issued or wrongly addressed token, or
one with an unexpected algorithm, gets `401 invalid_token` with no repository call. A body naming
another subject changes nothing.

### Tests for User Story 2 (write first, must fail) ⚠️

- [ ] T027 [P] [US2] RED: `tests/unit/token-verifier.test.ts`, using `tests/support/keys.ts` and
  `createLocalJWKSet`:
  - Valid token → `{issuer, subject, raw}`.
  - Bad signature (another key), `iss` differing by one character (including a missing trailing
    slash), `aud` without `svc-identity`, `exp` in the past, `alg: none`, `alg: HS256` (signed with a
    shared secret), and an unknown `kid` → `InvalidTokenError` with the matching reason code from
    `{missing, malformed, bad_signature, wrong_issuer, wrong_audience, expired, wrong_algorithm,
    unknown_kid}` ("Done when" items 3 and 4) (IPX-9498)
- [ ] T028 [P] [US2] RED: `tests/unit/require-verified-token.test.ts`:
  - No `Authorization` header, a non-Bearer scheme, or an empty token → `401 invalid_token` with no
    verifier or repository call ("Done when" item 5).
  - The WARN log carries only the reason code (IPX-9498)
- [ ] T029 [P] [US2] RED: `tests/integration/users-me.auth.test.ts` (real `JoseTokenVerifier` against
  `tests/support/jwks-server.ts`, real database):
  - Each refusal from T027 → `401`, with the database row count unchanged.
  - A valid token for subject A with body `{"sub": "B", "subject": "B", "provider": "x"}` and header
    `X-User-Id: B` resolves A, and no row for B exists ("Done when" item 2, SC-003) (IPX-9498)
- [ ] T030 [P] [US2] RED: `tests/unit/no-bypass.test.ts`. Starting the app with `IDENTITY_ISSUER`
  unset fails. No environment variable (`AUTH_DISABLED`, `AUTH_BYPASS`, `SKIP_AUTH`, `NODE_ENV=test`)
  lets an unauthenticated `POST /v1/users/me` succeed (FR-007) (IPX-9498)

### Implementation for User Story 2

- [ ] T031 [US2] GREEN: `src/auth/token-verifier.ts`. The `TokenVerifier` interface, and
  `JoseTokenVerifier` using `createRemoteJWKSet(new URL(config.jwksUrl), { timeoutDuration: 3000 })`
  and `jwtVerify(token, jwks, { algorithms: ['RS256'], issuer: config.issuer, audience:
  config.audience })`. Map jose errors to `InvalidTokenError` reason codes. A JWKS network failure or
  timeout maps to `JwksUnavailableError`, not `401`. Returns `{issuer: payload.iss, subject:
  payload.sub, raw}` (T027 passes) (IPX-9498)
- [ ] T032 [US2] GREEN: `src/auth/require-verified-token.ts`. Parse `Authorization: Bearer <jws>` with
  zod, call the verifier, and set `req.verifiedToken`. Never read the body. Wire the real
  `JoseTokenVerifier` in `src/index.ts`; tests inject the local one (T028, T029, T030 pass)
  (IPX-9498)

**Checkpoint**: US1 and US2 together are the full happy path with real verification.

---

## Phase 5: User Story 3 — A disabled platform user is refused (P2)

**Goal**: The platform record, not Auth0, decides whether a user may act (R63 AC2).

**Independent Test**: Set a user's `status` to `DISABLED` in the database; a valid token for them gets
`403 user_disabled`, and the row is unchanged.

- [ ] T033 [P] [US3] RED: `tests/integration/users-me.disabled.test.ts`. Seed a linked user, set
  `status = 'DISABLED'` directly, then call → `403 user_disabled`. Afterwards there is still one user
  (still `DISABLED`, `updated_at` unchanged) and one link, with no `/userinfo` call ("Done when" item
  6) (IPX-9498)
- [ ] T034 [US3] GREEN: in `src/users/resolve-me.service.ts`, a found link whose user is `DISABLED`
  throws `UserDisabledError` (→ `403 user_disabled`, WARN log, no Sentry). Never update, re-enable or
  re-create (FR-010) (T033 passes) (IPX-9498)

---

## Phase 6: User Story 4 — Dependency failures leave nothing half-done and are diagnosable (P2)

**Goal**: Every failure path F4 to F9 in `docs/sequences/ipx-9498-resolve-me.md` behaves as
`docs/observability/ipx-9498-observability.md` states.

**Independent Test**: Make each dependency fail in turn (quickstart step 2). Each gets the expected
status, zero partial rows remain, and Sentry is called with the expected tags.

### Tests for User Story 4 (write first, must fail) ⚠️

- [ ] T035 [P] [US4] RED: `tests/integration/users-me.profile-failures.test.ts` against
  `tests/support/userinfo-stub.ts`:
  - First login with the stub hanging past 3 s, answering 5xx, or answering 429 →
    `503 profile_unavailable` with `Retry-After: 5`.
  - The stub answering 401, 403 or 200 without `email` → `502 profile_invalid`.
  - Every case leaves zero rows, and a Sentry spy is called with `flow.step=fetch_profile`,
    `target.service=auth0-userinfo` and `target.statusCode` ("Done when" items 9 and 10)
  (IPX-9498)
- [ ] T036 [P] [US4] RED: `tests/integration/users-me.jwks.test.ts` against
  `tests/support/jwks-server.ts`:
  - With the server stopped before any fetch (cold cache) → `503 identity_provider_unavailable` with
    `Retry-After: 5`, no database query, and Sentry tagged `flow.step=verify_token`,
    `target.service=auth0-jwks`.
  - After one successful call (warm cache), stopping the server → an existing user still gets `200`.
  - A token with a new `kid` while stopped → `503` ("Done when" item 8, SC-007) (IPX-9498)
- [ ] T037 [P] [US4] RED: `tests/integration/users-me.database.test.ts`. With the database stopped or
  unreachable → `503 database_unavailable` with `Retry-After: 5`, and Sentry tagged
  `target.service=postgres`. A create interrupted after the user insert (failure injected through the
  repository) leaves zero rows ("Done when" item 11; F9 rollback) (IPX-9498)
- [ ] T038 [P] [US4] RED: `tests/integration/no-pii-in-logs.test.ts`:
  - Capture pino output and Sentry events across one run of every scenario in T022, T029, T033 and
    T035 to T037. Assert that none contains the raw token, the `sub`, the email or the name.
  - Every log line has `correlationId`.
  - The JWKS and `/userinfo` stubs received `traceparent` and `X-Correlation-Id` ("Done when" item
    13, SC-006) (IPX-9498)

### Implementation for User Story 4

- [ ] T039 [US4] GREEN: extend `src/profile/auth0-profile-client.ts`:
  - A timeout, a network error, 5xx or 429 → `ProfileUnavailableError`.
  - 401, 403, or a zod parse failure (no `email`) → `ProfileInvalidError`.

  The client is called before any write, so failures leave no rows (T035 passes) (IPX-9498)
- [ ] T040 [US4] GREEN: `src/errors/handler.ts` and `src/instrument.ts`. On each `5xx` error, call
  `Sentry.captureException` with tags `flow.name`, `flow.step`, `entity.userId` (when known),
  `entity.created`, `target.service`, `target.statusCode`, `auth.issuer` and `correlationId`. Never
  tag the token, `sub`, email or name. Emit the breadcrumb log lines from the observability spec at
  each step (T036, T037, T038 pass) (IPX-9498)

**Checkpoint**: All of IPX-9498's "Done when" items 1 to 13 are covered by passing tests.

---

## Phase 7: Polish & cross-cutting

- [ ] T041 [P] Via `ipx-fix`: `scripts/generate-openapi.ts` (zod-to-openapi) writes `docs/openapi.yaml`
  for `POST /v1/users/me` and `GET /health`, matching
  [contracts/resolve-me-api.md](contracts/resolve-me-api.md). The `contracts` CI lane runs
  `generate:openapi` and `check:generated-clean` (IPX-9498)
- [ ] T042 [P] Via `ipx-fix`: a `README.md` (run, test, configuration keys, link to the LLD pointer and
  ADR-0001). Reconcile the discuss design docs (`CONTEXT.md`, `docs/adr/0001-…`, `docs/erd/…`,
  `docs/sequences/…`, `docs/observability/…`, `docs/architecture/…`, `docs/LLD.md`) with the final
  code, and commit them on `feat/ipx-9498-svc-identity` (`design.same_repo_docs`) ("Done when" item
  14) (IPX-9498)
- [ ] T043 Data contract (research R8), after the first commit is pushed:
  - In a `domain-docs` worktree at `repos/domain-docs-9498`, on `docs/ipx-9498-data-contracts`, add
    `svc-identity` to `data-contracts/services.yaml` (`canon_domain: [TRU]`,
    `repository: ipxos-ai/svc-identity`, `observed_at: <the pushed commit SHA>`).
  - Draft `contracts/svc-identity.platform-user-id.yaml` (`contract_type: identifier`,
    `service: svc-identity`, `semantic_type: uuid`, `status: proposed`, `agreed_in: IPX-9498`),
    following `ipx-discuss/references/draft-data-contract.md` (duplicate check, `generate.py
    --root`, `--check`).
  - Record `design.contract_drafts[]`, then open the `domain-docs` PR (land-the-design-docs worktree
    sub-path). **Do not merge** (IPX-9498)
- [ ] T044 [P] Run `/ipxos-skills:service-lld update svc-identity` against the final code: patch
  §4 (runtime), §5 (ingress), §7 (data), §8 (config keys from `src/config.ts`) and §10 (health) of
  `docs/services/svc-identity.md` in `repos/ipx-cd-9498`, as a new commit on
  `docs/ipx-9498-svc-identity-lld` (PR ipxos-ai/ipx-cd#1802). Write through the branch, never with
  `gh api` to `main` (IPX-9498)
- [ ] T045 Run [quickstart.md](quickstart.md) steps 1 to 3 and step 5 (optionally step 4 against
  `dev-ipxos-play`). Record pass counts and the measured p95 latencies (SC-004) for the progress
  comment (IPX-9498)
- [ ] T046 Run the remaining non-deploying governance turns from `repos/svc-identity` via
  `/ipxos-skills:ipx-next`: `audit`, `verify-qa`, `pr`. `pr` pushes `feat/ipx-9498-svc-identity` and
  opens the PR, which moves Linear to In Review. Stop before `merge` (IPX-9498)
- [ ] T047 Post the `[Speckit] implement` progress comment on IPX-9498: completed task IDs, commit
  SHAs, the PR links (svc-identity, ipx-cd#1802, domain-docs), the T045 results, and "HELD: T048".
  If the endpoint or error codes changed, post a short note on IPX-9500 too (IPX-9498, IPX-9500)
- [ ] T048 HELD. After approval: merge the svc-identity PR via `ipx-merge`, then ipx-cd#1802 and the
  `domain-docs` contract PR. Merging deploys nothing (no deploy job, research R5); deployment is
  IPX-9499 (IPX-9498)

---

## Dependencies & execution order

- **T001 blocks everything in the service repo.** Until it passes, only spec-side work (this file,
  `/speckit-analyze`) can proceed.
- **Phase 1 → Phase 2 → stories.** T006 must reach the `fix` turn before any `ipx-fix` task. T019's
  green CI gates the story phases.
- **US1 (T020–T026)** depends only on Phase 2. It uses a stub `TokenVerifier`, so it does not wait
  for US2.
- **US2 (T027–T032)** depends only on Phase 2. T026 and T032 both touch `src/app.ts` wiring:
  serialise them.
- **US3 (T033–T034)** depends on US1 (the resolve service and route).
- **US4 (T035–T040)** depends on US1, and on US2 for T036 (the real JWKS path).
- **Phase 7**: T041 and T042 after all stories; T043 after the first push (T019); T044 after T041;
  T045 after all stories; T046 after T041 to T045; T047 after T046; T048 HELD.

## Parallel opportunities

- Phase 2: T009, T010, T011, T012, T014, T015, T016 and T017 touch different files.
- Within each story, the RED test tasks marked [P] together.
- US1 and US2 implementation can run in parallel (different files) up to the `src/app.ts` wiring.
- Phase 7: T041, T042 and T044.

```text
# After T019:
ipx-fix: T020 ∥ T021 ∥ T022 → T023 → T024 → T025 → T026   (US1)
ipx-fix: T027 ∥ T028 ∥ T029 ∥ T030 → T031 → T032          (US2)
then:    T033 → T034                                       (US3)
then:    T035 ∥ T036 ∥ T037 ∥ T038 → T039 → T040           (US4)
```

## Implementation strategy

- **MVP**: Phases 1 and 2, then US1 and US2 (T001–T032). A verified operator gets one lasting
  platform user. That is enough for IPX-9500 to integrate against.
- **Increment 2**: US3 and US4 (T033–T040), which close the failure and disabled-user acceptance
  criteria.
- **Increment 3**: Phase 7 up to the open PRs (T041–T047). T048 only after approval.

## Notes

- 48 tasks: 1 BLOCKED gate (T001, which in practice blocks T002–T047 as well) and 1 HELD (T048).
- Each user story's tests map to IPX-9498 "Done when": US1 → 1, 7; US2 → 2, 3, 4, 5; US3 → 6;
  US4 → 8, 9, 10, 11, 13; config → 12 (T008); docs → 14 (T042).
- Linear state: `ipx-branch` (T006) → In Progress, `ipx-pr` (T046) → In Review,
  `ipx-merge` (T048, HELD) → Done. Spec Kit only comments.
