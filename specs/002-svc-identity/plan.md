# Implementation Plan: Platform user record (svc-identity)

**Branch**: `002-svc-identity` (spec, in `ipx-specs`); delivery branch `feat/ipx-9498-svc-identity`
(in `ipxos-ai/svc-identity`) | **Date**: 2026-10-29, revised 2026-11-05 for constitution v1.2.0 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-svc-identity/spec.md`. Linear IPX-9498. Canon
TRU.IAM.R63, R66, R67, R53. Design record: svc-identity ADR-0001 (discuss decisions D1 to D9).

## Summary

Build **svc-identity**, a new Node/TypeScript service that keeps the platform's own record of users.
It has one operation, `POST /v1/users/me`:

1. Verify the caller's Auth0 access token inside the service, with `jose` (RS256 only, exact issuer,
   audience `svc-identity`, expiry, cached JWKS).
2. Resolve the token's `(iss, sub)` to a platform user through `identity_link`.
3. On first login, fetch name and email from Auth0 `/userinfo`, then create the `platform_user` and
   link in one transaction.

The answer is `201` or `200` with `{userId, created}`. A disabled user is refused, dependency
failures write nothing, and there is no authentication bypass. The repository is new, so this plan
also bootstraps it: the stack and CI are copied from `svc-crm-factory`, with no deploy jobs.

**Revision 2026-11-05 (constitution v1.2.0)**:

- The service runs on a workstation with the local profile (`ENVIRONMENT=local`). Its
  dependencies, Postgres and a local identity-provider stub, come from `docker-compose.db.yml`
  (research R9). The sandbox tenant becomes optional.
- The code layout is now routes → services → repositories with a composition root.
- Errors use the estate `{code, message, statusCode}` body (research R10).
- knip, husky, a 70% coverage floor and `AC-N:` test tags are added.

Behaviour and the acceptance criteria are unchanged.

## Technical Context

**Language/Version**: TypeScript 6 (ESM), Node 22 (research R1).

**Primary Dependencies**: Express 5, Prisma 7 (`@prisma/adapter-pg`), zod 4, pino 10 and pino-http,
`@sentry/node` 10 with `@ipxos-ai/sentry-scrubber`, `@ipxos-ai/environment`, helmet,
express-rate-limit, `jose` 6, and dotenv for local and test files only (research R1, R2).
Tooling: ESLint 10 with Prettier, knip, husky, Jest 30 with ts-jest, supertest and jest-junit.

**Storage**: PostgreSQL, one database per environment. Tables `platform_user` and `identity_link`
([data-model.md](data-model.md)).

**Testing**: Jest 30 (ts-jest ESM preset) and supertest, in two lanes.

- **Unit**: test-generated RS256 keys and a local JWKS.
- **Integration**: the Compose Postgres (database `svc_identity_test`) and the local-idp stub
  in-process with fault injection, run serially (research R3, R9).
- Acceptance tests are named `AC-N: …`, and the integration lane emits JUnit for `ipx-verify-qa`.
- Line coverage is at least 70%. See [quickstart.md](quickstart.md).

**Target Platform**: Linux container in the dev and staging clusters, later (IPX-9499).

**Local profile** (Principle VIII):

- `ENVIRONMENT=local`, from `.env.example` unchanged.
- The service runs on the host (`npm run dev`, port `4024`).
- `docker-compose.db.yml` runs `postgres:16-alpine` on host `5446` and `local-idp` (issuer
  `http://localhost:9024/`) on `9024`.
- No cloud account, cluster, Infisical or live tenant is needed. The sandbox tenant
  `dev-ipxos-play` is an optional extra check (quickstart step 6).

**Project Type**: Web service (HTTP API), a single project.

**Performance Goals**: Existing user p95 < 150 ms; first login p95 < 1 s (SC-004).

**Constraints**:
- No personal data or tokens in logs or alerts.
- 3 s timeout on each Auth0 call.
- No queueing: a failing dependency answers `503` with `Retry-After: 5`.
- One configured issuer per environment.
- No authentication bypass, in any environment, including local.
- A deployed build (`NODE_ENV=production`) with `ENVIRONMENT=local` refuses to start. A localhost
  issuer is refused outside `local`.

**Scale/Scope**: Fewer than 100 operators. One endpoint plus health. Two tables.

No NEEDS CLARIFICATION remains: every unknown is resolved in [research.md](research.md) (R1 to R10).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Checked against constitution **v1.2.0**.

| Principle | Pre-research | Post-design |
|---|---|---|
| I. Canon is the source | PASS: TRU.IAM.R63/R66/R67/R53 cited; no requirement invented | PASS: the discrepancy between the actor-id builder (`did:authentik:`) and R1/R66 is raised on IPX-9498, not resolved silently; R68 gap recorded. The 2026-11-05 revision adds no requirement |
| II. ipx-discuss first | PASS: `/ipx-discuss IPX-9498` completed 2026-10-29 | PASS: D1 to D9 carried into ADR-0001 and this plan |
| III. Code only through ipx-fix | PASS: no code yet | PASS: every source, test, schema, stub, Compose, CI and Dockerfile task runs through `ipx-fix`, test-first |
| IV. Tokens verified inside the service | PASS: D4/R67 | PASS: `jose` `jwtVerify` with `algorithms: ['RS256']`, exact issuer and audience, cached JWKS refetched on an unknown `kid`; unverifiable tokens get `401` before any database access. Local runs verify local-idp tokens through the same path; the stub is an identity provider, not a bypass (R9) |
| V. Subject from the token | PASS: R53 | PASS: the body is never parsed; the subject comes from the verified `sub` only (contract) |
| VI. No roles yet | PASS | PASS: no roles, permissions or claims read or returned |
| VII. Progress visible in Linear | PASS: discuss and specify comments posted on IPX-9498 | PASS: checkpoints listed below, including the error-body note to IPX-9500 |
| VIII. Runs locally (non-negotiable) | PASS: required, designed in R9 | PASS: `ENVIRONMENT=local` default; `docker-compose.db.yml` (header, pinned tags, healthchecks, `--wait`, host ports 5446/9024 unused across the estate, named volume); service on the host; `.env.example` works unchanged; localhost issuer refused outside `local`; production boot guard; scripts `db:up`, `db:down`, `db:migrate`, `dev`, `test`, `test:integration`; clean-clone sequence in quickstart step 1; no auth switch |
| IX. Strict, layered, tested | PASS | PASS: test-first slices; strict tsconfig, no `any`; routes → services → repositories (only `IdentityRepository` uses Prisma); `container.ts` constructor injection; `process.env` read only in `src/config`; typed errors → `{code, message, statusCode}` in one `errorHandler`; no state-machine class needed (status is never written, R10) |
| Backend Stack and Coding Standards | PASS | PASS: Node 22, TS 6 ESM, Express 5, Prisma 7 + adapter-pg, zod 4, pino 10, Sentry 10, `jose`; estate layout; `GET /health` per `svc-product-factory`; zod at every boundary; no PII in logs; snake_case via `@map`; migrations never on boot; Jest 30 two lanes, `AC-N:` tags, JUnit, 70% coverage; lint/typecheck/knip/coverage gates and husky; non-root multi-stage Dockerfile with `HEALTHCHECK`. No deviations |

No violations. Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/002-svc-identity/
├── plan.md              # This file
├── research.md          # Phase 0: R1 to R8
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   └── resolve-me-api.md
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks; not created here)
```

### Source Code (`ipxos-ai/svc-identity`, worktree `repos/svc-identity`)

```text
├── CONTEXT.md                         # glossary (written in discuss)
├── package.json, package-lock.json, .nvmrc (22), .npmrc
├── tsconfig.json, config/tsconfig.json (estate strict options), tsconfig.typecheck.json
├── eslint.config.js, .prettierrc, knip.config.ts, .husky/pre-commit (lint, typecheck)
├── jest.config.ts (unit), jest.integration.config.ts (serial, jest-junit)
├── .env.example (local profile, committed), .env.test (committed), .env (gitignored)
├── docker-compose.db.yml              # LOCAL DEVELOPMENT ONLY: postgres :5446, local-idp :9024
├── Dockerfile, start.sh               # non-root, dumb-init, HEALTHCHECK; start.sh never migrates
├── .github/workflows/                 # ci.yml (six lanes + quality; no deploy jobs), codeql.yml,
│                                      #   require-linear-reference.yml
├── prisma/schema.prisma, prisma/migrations/, prisma.config.ts
├── scripts/setup-test-db.ts, scripts/local-token.ts, scripts/generate-openapi.ts
├── src/
│   ├── index.ts                       # listen only
│   ├── app.ts                         # builds the Express app (used by supertest)
│   ├── instrument.ts                  # Sentry, loaded with --import
│   ├── container.ts                   # composition root, constructor injection
│   ├── logger.ts                      # pino, redaction (singleton)
│   ├── config/index.ts                # zod schema, ENVIRONMENT guards (research R6)
│   ├── routes/health.ts, routes/usersMe.ts
│   ├── middleware/requireVerifiedToken.ts, correlation.ts, requestLogging.ts, errorHandler.ts
│   ├── services/ResolveMeService.ts
│   ├── services/TokenVerifier.ts      # interface + JoseTokenVerifier
│   ├── services/ProfileClient.ts      # interface + Auth0ProfileClient
│   ├── repositories/IdentityRepository.ts   # the only Prisma user
│   ├── models/PlatformUser.ts, models/IdentityLink.ts
│   ├── errors/                        # typed errors and the code/status table
│   └── db/prisma.ts                   # PrismaClient with @prisma/adapter-pg
├── tests/setup.ts, tests/unit/, tests/integration/
├── tests/support/keys.ts, tests/support/local-idp/  # JWKS, /userinfo, /oauth/token; also run by Compose
└── docs/                              # adr/0001, erd, sequences, observability, architecture,
                                       #   LLD.md (pointer), openapi.yaml (generated)
```

**Structure Decision**: A single-service repository in the estate layout (constitution, Backend
Stack and Coding Standards), copied from `svc-crm-factory`, with `svc-party-factory`'s
`docker-compose.db.yml` and test-database pattern. The design docs
already written in the placeholder ride the first code PR (`design.same_repo_docs`).

## Local profile (constitution Principle VIII)

| Item | Value |
|---|---|
| Profile | `ENVIRONMENT=local` (default). `NODE_ENV` never selects a profile |
| Service | Host process, `npm run dev`, `http://localhost:4024` |
| Compose file | `docker-compose.db.yml`, `LOCAL DEVELOPMENT ONLY` header, named volume `postgres_data` |
| Postgres | `postgres:16-alpine`, host `5446` (5432 to 5445 are used by other services), `pg_isready` healthcheck; databases `svc_identity_dev` and `svc_identity_test` |
| Identity provider stub | `local-idp`, `node:22.23.4-alpine` running `tests/support/local-idp/server.ts` (no dependencies), host `9024`, issuer `http://localhost:9024/`; serves `/.well-known/jwks.json`, `/userinfo`, `/oauth/token` |
| Other IPX services | None called in this slice |
| Configuration | `.env.example` works unchanged (`cp .env.example .env`). Local-only values (localhost issuer) are refused in `staging` and `production` |
| Deployed guard | `NODE_ENV=production` with `ENVIRONMENT=local` refuses to start |
| Scripts | `db:up`, `db:down`, `db:migrate`, `dev`, `setup:test-db`, `test`, `test:unit`, `test:integration`, `test:coverage`, `lint`, `typecheck`, `knip`, `build`, `start`, `local:token`, `generate:openapi` |
| Proof | Clean clone: `npm ci` → `cp .env.example .env` → `npm run db:up` → `npm run db:migrate` → `npm run dev` → `GET /health` `200` ([quickstart.md](quickstart.md) step 1). Required before any task phase is reported complete (Workflow 9) |

## Workspace

All work for this feature happens in git worktrees inside `ipx-specs`, under `repos/`, which is
gitignored. Nothing in a worktree is committed to `ipx-specs`.

| Worktree | Repository | Branch | What changes there |
|---|---|---|---|
| `repos/svc-identity` | `ipxos-ai/svc-identity` (main checkout `../svc-identity`, once cloned) | `feat/ipx-9498-svc-identity` | All service code, CI, design docs, task evidence (`.planning/evidence/tasks/IPX-9498.json`). **Today a local placeholder** (no commits); converted by research R7 once `github-configuration#56` is applied |
| `repos/ipx-cd-9498` | `ipxos-ai/ipx-cd` | `docs/ipx-9498-svc-identity-lld` (PR ipxos-ai/ipx-cd#1802) | LLD only |
| `repos/github-configuration` | `ipxos-ai/github-configuration` | `chore/provision-svc-identity` (PR #56) | Repository request only |
| `repos/domain-docs-9498` (later) | `ipxos-ai/domain-docs` | `docs/ipx-9498-data-contracts` | Service declaration and `identifier` contract (research R8) |

- Governance evidence resolves from `repos/svc-identity/.planning`. The workspace and active-task
  pointers are registered for that path. Run `ipx-*` turns from inside it.
- Not touched: `ipx` (ipx-ops is IPX-9500; the actor-id builder is a follow-up), `svc-auth`,
  `platform-docs` (seeded later by `ipx-fix` docs sync), `iac-*`.

## Delivery constraints

- **Branches only.** Every change is a commit on a feature or docs branch. Nothing is committed to
  `main` in any repository, including `ipx-specs`, whose spec work is on `002-svc-identity`.
- **Nothing is deployed.**
  - svc-identity's CI has no image-push or `dispatch-image-update` job (research R5). Deployment is
    IPX-9499.
  - Branches may be pushed and PRs opened (CI only). **No PR is merged** in `svc-identity`,
    `ipx-cd` (#1802) or `domain-docs` until the developer approves.
  - `github-configuration#56` is applied by an organisation admin; this feature does not merge or
    apply it.
- **No live identity-provider or secret changes.** No Infisical writes. The sandbox tenant is used
  read-only, for local manual runs only.
- **Implementation is blocked** until `ipxos-ai/svc-identity` exists (#56 applied). Until then only
  the spec work, tasks and governance prep turns can proceed.

## Delivery order

1. **Repository ready** (after #56): convert the placeholder into a worktree at the same path
   (research R7). Re-run repo-convention detection (`config.json`) now that rulesets exist.
2. **Governance prep**: `ipx-readiness`, then `ipx-implementation-plan` (risk tier and approval),
   then `ipx-branch`.
3. **`ipx-fix`, test-first**, in slices:
   1. Scaffold:
      - package, strict tsconfig, ESLint with Prettier, knip, husky;
      - Jest unit and integration configs, with jest-junit;
      - `app.ts`, `index.ts`, `container.ts`, health, the zod config with the `ENVIRONMENT` guards,
        logging, Sentry and the error handler;
      - `.env.example`, `.env.test`, `docker-compose.db.yml` with Postgres, the npm scripts;
      - CI without deploy jobs, Dockerfile, `start.sh`.

      Done when quickstart step 1 reaches `/health` and steps 4 and 5 pass.
   2. Schema and migration (snake_case via `@map`), `setup:test-db`.
   3. The local-idp stub (`tests/support/local-idp`) in Compose and in-process, plus
      `local:token`.
   4. Token verification (unit: every refusal).
   5. Resolve-or-create (unit and integration: idempotency, race, disabled).
   6. Profile client and the failure paths.
   7. OpenAPI generation (`contracts` lane). Finish with the whole quickstart, steps 1 to 5.
4. **Data contract** (research R8): its own `domain-docs` PR.
5. **audit, verify-qa, pr**: open the svc-identity PR with the design docs. **Do not merge.**

### Linear checkpoints (constitution Principle VII)

| When | On | What |
|---|---|---|
| `/speckit-plan` done | IPX-9498 | `[Speckit] plan` comment: stack, structure, the repo-bootstrap dependency |
| `/speckit-plan` revised (2026-11-05) | IPX-9498 | `[Speckit] plan` comment: constitution v1.2.0 changes (local profile, layout, error body, gates); acceptance criteria unchanged |
| Error body changed (2026-11-05) | IPX-9500 | Note: errors are now `{code, message, statusCode}`; codes unchanged |
| `/speckit-tasks`, `/speckit-analyze` done | IPX-9498 | Task count and phases; findings |
| Each `/speckit-implement` phase | IPX-9498 | Completed tasks with commit SHAs on `feat/ipx-9498-svc-identity` |
| PR opened | IPX-9498 | PR link (`ipx-pr` moves the state to In Review) |
| Contract or endpoint change | IPX-9500, IPX-9499 | A short note |

## Complexity Tracking

None. No constitution violations and no stack deviations. (`jose` is a named stack library, and
the local-idp stub uses Node only.)
