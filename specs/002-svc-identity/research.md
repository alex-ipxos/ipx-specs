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
  `src/instrument.ts` Sentry bootstrap. Pin the same major versions.
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
  - **Local manual runs**: point configuration at the sandbox tenant
    `https://dev-ipxos-play.eu.auth0.com/` (IPX-9497 sandbox).
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

- **Decision**: One zod schema parses the environment at startup: `IDENTITY_ISSUER` (URL, must end
  in `/`), `IDENTITY_AUDIENCE` (default `svc-identity`), `DATABASE_URL`, `PORT` (default `4024`),
  `SENTRY_DSN` (optional), `LOG_LEVEL`. The JWKS and `/userinfo` URLs are derived from the issuer.
  Names are this service's own; ipx-ops's names belong to IPX-9500. A failure exits non-zero,
  naming the key and never printing the value.
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

## Sources

- svc-identity ADR-0001 and its ERD, sequences, observability spec, class diagram and contract map
  (placeholder repository, landing with the first code PR).
- LLD: `ipxos-ai/ipx-cd#1802`.
- Token contract: `specs/001-ops-auth0-tenants/contracts/access-token-for-svc-identity.md`.
- Precedent code: `svc-crm-factory/package.json` and `.github/workflows/ci.yml`;
  `svc-document/src/middleware/jwt-auth.ts`; `svc-product-factory/src/routes/health.ts`.
- `skills/docs/data-model-style-guide.md`; `github-configuration` `inventory/repositories.yaml`
  policy contracts.
