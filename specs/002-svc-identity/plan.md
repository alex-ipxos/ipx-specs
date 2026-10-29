# Implementation Plan: Platform user record (svc-identity)

**Branch**: `002-svc-identity` (spec, in `ipx-specs`); delivery branch `feat/ipx-9498-svc-identity`
(in `ipxos-ai/svc-identity`) | **Date**: 2026-10-29 | **Spec**: [spec.md](spec.md)

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

## Technical Context

**Language/Version**: TypeScript 6 (ESM), Node 22 (research R1).

**Primary Dependencies**: Express 5, Prisma 7 (`@prisma/adapter-pg`), zod 4, pino 10 and pino-http,
`@sentry/node` 10 with `@ipxos-ai/sentry-scrubber`, helmet, `jose` 6 (research R2).

**Storage**: PostgreSQL, one database per environment. Tables `platform_user` and `identity_link`
([data-model.md](data-model.md)).

**Testing**: Jest 30 with ts-jest and supertest. Unit tests use test-generated RS256 keys and a
local JWKS. Integration tests use a Compose Postgres, a local JWKS server and a `/userinfo` stub
(research R3). See [quickstart.md](quickstart.md).

**Target Platform**: Linux container in the dev and staging clusters, later (IPX-9499). Locally,
the sandbox tenant `dev-ipxos-play`.

**Project Type**: Web service (HTTP API), a single project.

**Performance Goals**: Existing user p95 < 150 ms; first login p95 < 1 s (SC-004).

**Constraints**:
- No personal data or tokens in logs or alerts.
- 3 s timeout on each Auth0 call.
- No queueing: a failing dependency answers `503` with `Retry-After: 5`.
- One configured issuer per environment.
- No authentication bypass.

**Scale/Scope**: Fewer than 100 operators. One endpoint plus health. Two tables.

No NEEDS CLARIFICATION remains: every unknown is resolved in [research.md](research.md) (R1 to R8).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Pre-research | Post-design |
|---|---|---|
| I. Canon is the source | PASS: TRU.IAM.R63/R66/R67/R53 cited; no requirement invented | PASS: the discrepancy between the actor-id builder (`did:authentik:`) and R1/R66 is raised on IPX-9498, not resolved silently; R68 gap recorded |
| II. ipx-discuss first | PASS: `/ipx-discuss IPX-9498` completed 2026-10-29 | PASS: D1 to D9 carried into ADR-0001 and this plan |
| III. Code only through ipx-fix | PASS: no code yet | PASS: every source, test, schema, CI and Dockerfile task runs through `ipx-fix`, test-first |
| IV. Tokens verified inside the service | PASS: D4/R67 | PASS: `jose` `jwtVerify` with `algorithms: ['RS256']`, exact issuer and audience, cached JWKS refetched on an unknown `kid`; unverifiable tokens get `401` before any database access |
| V. Subject from the token | PASS: R53 | PASS: the body is never parsed; the subject comes from the verified `sub` only (contract) |
| VI. No roles yet | PASS | PASS: no roles, permissions or claims read or returned |
| VII. Progress visible in Linear | PASS: discuss and specify comments posted on IPX-9498 | PASS: checkpoints listed below |
| Stack (Express/Prisma/zod/pino/Sentry, health, logging, zod at boundary) | PASS | PASS: exact stack; `GET /health` per `svc-product-factory`; zod for configuration, the header and `/userinfo`; no PII in logs. `jose` is an addition for JWKS, not a deviation |

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
├── package.json, tsconfig.json, eslint.config.js, jest.config.ts, jest.integration.config.ts
├── Dockerfile, docker-compose.db.yml
├── .github/workflows/                 # ci.yml (six lanes + quality; no deploy jobs), codeql.yml,
│                                      #   require-linear-reference.yml
├── prisma/schema.prisma, prisma/migrations/
├── src/
│   ├── index.ts, app.ts, instrument.ts
│   ├── config.ts                      # zod environment schema (research R6)
│   ├── auth/token-verifier.ts         # TokenVerifier + JoseTokenVerifier
│   ├── auth/require-verified-token.ts # middleware → req.verifiedToken
│   ├── profile/auth0-profile-client.ts
│   ├── users/resolve-me.service.ts, users/identity.repository.ts, users/users-me.route.ts
│   ├── routes/health.ts
│   ├── errors/                        # typed errors → status and code mapping
│   └── logging/                       # pino, correlation id, redaction
├── tests/unit/, tests/integration/, tests/support/ (keys, JWKS server, userinfo stub)
└── docs/                              # adr/0001, erd, sequences, observability, architecture,
                                       #   LLD.md (pointer), openapi.yaml (generated)
```

**Structure Decision**: A single-service repository in the `svc-crm-factory` layout. The design docs
already written in the placeholder ride the first code PR (`design.same_repo_docs`).

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
   1. Scaffold: package, tsconfig, lint, Jest, health, config, logging and Sentry, CI without deploy
      jobs.
   2. Schema and migration.
   3. Token verification (unit: every refusal).
   4. Resolve-or-create (unit and integration: idempotency, race, disabled).
   5. Profile client and the failure paths.
   6. OpenAPI generation (`contracts` lane).
4. **Data contract** (research R8): its own `domain-docs` PR.
5. **audit, verify-qa, pr**: open the svc-identity PR with the design docs. **Do not merge.**

### Linear checkpoints (constitution Principle VII)

| When | On | What |
|---|---|---|
| `/speckit-plan` done | IPX-9498 | `[Speckit] plan` comment: stack, structure, the repo-bootstrap dependency |
| `/speckit-tasks`, `/speckit-analyze` done | IPX-9498 | Task count and phases; findings |
| Each `/speckit-implement` phase | IPX-9498 | Completed tasks with commit SHAs on `feat/ipx-9498-svc-identity` |
| PR opened | IPX-9498 | PR link (`ipx-pr` moves the state to In Review) |
| Contract or endpoint change | IPX-9500, IPX-9499 | A short note |

## Complexity Tracking

None. No constitution violations.
