<!--
Sync Impact Report
- Version change: 1.1.0 → 1.2.0 (MINOR: two principles added, stack section materially expanded)
- Modified principles: none renamed or redefined (I–VII unchanged)
- Added principles:
  - VIII. Every Service Runs Locally (NON-NEGOTIABLE)
  - IX. Code Is Strict, Layered and Tested
- Modified sections:
  - "Estate Stack and Service Standards" → "Backend Stack and Coding Standards" (pinned
    versions, project layout, configuration, persistence, errors, quality gates, container)
  - Development Workflow: Constitution Check now covers I–IX; quickstart must prove local run
  - Governance: Principle VIII added to the non-waivable list
- Removed sections: none
- Sources surveyed: engineering-standards/docs/coding-standards.md; ADR-PLATFORM-004 §D4;
  svc-party-factory, svc-product-factory, svc-crm-factory and the other Express/Prisma
  factory services (dependency versions, config, compose, Jest lanes, Dockerfile)
- Deliberate divergence from the estate: the factory `<SVC>_AUTH_ENABLED=false` local lever is
  NOT adopted, because it conflicts with Principle IV; local runs verify tokens against a local
  JWKS stub instead.
- Templates: not modified (scope of this command). plan-template's Constitution Check reads
  this file at runtime.
- Follow-up TODOs: none
-->
# IPXos Specs Constitution

## Core Principles

### I. Canon Is the Source of Requirements

- The `domain-docs` repository (the IPX Canon) MUST be the single source of truth for requirements.
- Every spec, plan and task MUST trace to one or more fully-qualified canon identifiers
  (`{DOMAIN}.{SUBDOMAIN}.R{n}`). Work with no canon identifier MUST NOT be specified or built.
- Linear is the project-management system of record for tickets (e.g. IPX-9497, IPX-9498). Linear
  tickets track work; they do not override canon. Where a ticket and canon disagree, canon wins and
  the discrepancy MUST be raised, not silently resolved.
- Requirements MUST NOT be invented in specs. A gap in canon is recorded as an open question and
  routed back to canon authoring.

Rationale: one source of truth prevents drift between tickets, specs and code across the estate.

### II. Discuss Every Ticket Before Building (NON-NEGOTIABLE)

- The `ipx-discuss` skill MUST be run for every Linear ticket before `/speckit-specify` or any
  planning for that ticket begins.
- The output of `ipx-discuss` (resolved decisions, open questions, canon references) MUST feed the
  spec. A spec produced without a completed discuss step is non-compliant.

Rationale: surfacing ambiguity before specification is cheaper than discovering it in review.

### III. Code Is Written Only Through ipx-fix (NON-NEGOTIABLE)

- Application code MUST be written, changed or deleted only through the `ipx-fix` skill.
- Spec Kit commands in this repository produce specifications, plans and tasks. `/speckit-implement`
  and similar steps MUST delegate code changes to `ipx-fix` rather than editing service code
  directly.
- Hand edits to service repositories outside `ipx-fix` are non-compliant and MUST be reverted or
  re-applied through `ipx-fix`.

Rationale: `ipx-fix` carries the estate's governance evidence, branching and verification gates.

### IV. Tokens Are Verified Inside the Service

- Each service MUST verify every access token itself (TRU.IAM.R67): signature against the Auth0
  tenant's JWKS, issuer, audience, expiry and not-before.
- Trust MUST NOT be delegated to a gateway, proxy, the browser or an upstream service. A token
  forwarded by another component is verified again on arrival.
- An unverifiable, expired or malformed token MUST yield `401` with no partial processing.
- Signing keys MUST be fetched from JWKS with caching and rotation support; no keys are hard-coded.

Rationale: in-service verification keeps every service safe even when the network edge is wrong.

### V. The Subject Comes From the Token, Never From the Request

- The acting subject (actor identifier) MUST be taken from the verified token's `sub` claim
  (TRU.IAM.R53).
- Request bodies, query strings, path parameters and headers (other than the bearer token) MUST NOT
  be read as the actor's identity. Any such field claiming an actor MUST be ignored or rejected.
- Every recorded "who acted" value MUST originate from the verified token.

Rationale: a caller who can name the actor can impersonate anyone.

### VI. No Roles Until Canon Requires Them

- The first auth feature (ops portal on Auth0) MUST implement authentication only: a verified token
  means an authenticated operator. Role- or permission-based authorisation MUST NOT be built yet.
- Role and scope handling (e.g. TRU.IAM.R54, R56, R57) is added only when a ticket in scope cites
  those requirements, through the normal discuss → specify → plan → ipx-fix flow.

Rationale: building authorisation ahead of its requirements creates untested, unowned policy.

### VII. Progress Is Visible in Linear

- Every Spec Kit step that produces or changes an artifact for a ticket (`/speckit-specify`,
  `/speckit-clarify`, `/speckit-plan`, `/speckit-tasks`, `/speckit-analyze`, `/speckit-converge`,
  and each completed task phase of `/speckit-implement`) MUST post a comment on every Linear ticket
  in scope. Each comment starts with `**[Speckit] <step> — <date>**` and states:
  - what was produced, with its repository, branch and path;
  - what changed in scope, acceptance criteria or design, and why;
  - what is next.
- When a step changes scope or acceptance criteria, the ticket's description MUST be updated in the
  same step, so the description always shows the current agreed state. An artifact never silently
  disagrees with its ticket.
- Linear state: Spec Kit moves a ticket from Backlog to **Todo** once its plan exists, and assigns it
  to the developer doing the work. Every other transition (In Progress, In Review, Done) belongs to
  the `ipx-*` governance turns (`ipx-branch`, `ipx-pr`, `ipx-merge`). Spec Kit never makes those
  moves.
- Every task in `tasks.md` names its Linear ticket. A task that has no ticket is either filed as a
  sub-issue or justified in the task line.
- Sibling tickets that consume an artifact (a contract, a token shape) get a short comment naming it
  when the artifact is first produced or materially changed.

Rationale: Linear is the team's view of the work. Progress that lives only in a local spec
directory is invisible to everyone else.

### VIII. Every Service Runs Locally (NON-NEGOTIABLE)

- Every service MUST start and serve requests on a developer workstation with the **local
  profile**, using only the repository, Docker and Node. It MUST NOT need a cloud account, the
  shared development cluster, Minikube, Infisical or a live identity-provider tenant.
- The profile is selected by `ENVIRONMENT` (`local | development | staging | production`,
  ADR-PLATFORM-004 §D4), defaulting to `local`. `NODE_ENV` (`development | test | production`)
  only describes the build; it MUST NOT be used to choose a profile or relax a guard.
- Every backing dependency (PostgreSQL, Redis, a message broker, and stubs for an external HTTP
  dependency such as a JWKS endpoint or `/userinfo`) MUST run from the repository's
  `docker-compose.db.yml`. That compose file:
  - starts with `# LOCAL DEVELOPMENT ONLY — credentials here must never be used in staging or
    production`;
  - pins every image to an explicit tag (e.g. `postgres:16-alpine`), never `latest`;
  - gives every service a healthcheck, so `docker compose -f docker-compose.db.yml up -d --wait`
    returns only when dependencies are ready;
  - publishes a host port that is unique to this service across the estate (check sibling
    services' compose files before choosing one) and uses named volumes.
- The service itself runs on the host (`npm run dev`, tsx in watch mode), not inside Compose.
- Calls to another IPX service default to a `localhost` URL and MUST have a stub or fake, in
  Compose or in-process, so the service runs when the other service is absent.
- Local auth still obeys Principle IV: tokens are verified against a local JWKS stub with
  locally generated keys. An "auth off" switch MUST NOT exist, in any profile.
- The repository MUST commit a `.env.example` whose values work unchanged for the local profile
  (`cp .env.example .env` is the only setup step for configuration). `.env` is gitignored, and
  `.env` and `.env.test` are loaded only when `NODE_ENV !== "production"`.
- Local-only defaults (dev secrets, peppers, test keys) are permitted only when
  `ENVIRONMENT=local`. The zod configuration schema MUST reject them when `ENVIRONMENT` is
  `staging` or `production`.
- Fail-safe boot guard: when `NODE_ENV=production` and `ENVIRONMENT` resolves to `local`, the
  service MUST refuse to start (ADR-PLATFORM-004 §D4 amendment).
- Standard npm scripts MUST exist, with these names: `db:up` (compose up with `--wait`), `db:down`,
  `db:migrate`, `dev`, `test`, `test:integration`. From a clean clone, the sequence `npm ci` →
  `cp .env.example .env` → `npm run db:up` → `npm run db:migrate` → `npm run dev` MUST produce a
  passing `GET /health`. The feature's `quickstart.md` MUST state this sequence.

Rationale: a service that only runs in a cluster cannot be developed test-first, debugged or
reviewed quickly. Making the local profile explicit, and guarding against it in deployed builds,
keeps local convenience from ever reaching staging or production.

### IX. Code Is Strict, Layered and Tested

- Code changes are written test-first: a failing test, then the code that makes it pass (the
  RED/GREEN cycle `ipx-fix` records).
- TypeScript runs in strict mode with the estate compiler options (see the stack section). `any`
  is forbidden, `type` is preferred over `interface` for object shapes, and unused names are
  prefixed with `_`.
- Layering is one-directional: `routes` (HTTP only: parse, validate, call a service, shape the
  response) → `services` (business rules) → `repositories` (the only code that uses Prisma). A
  route never touches Prisma, and a repository never imports Express.
- Dependencies are wired by constructor injection in a single composition root
  (`src/container.ts`). No module-level singletons except the parsed configuration and the
  logger.
- `process.env` is read in exactly one place: `src/config` parses it once with zod at boot and
  exits with a readable error on failure. Everything else receives typed configuration.
- Errors are typed domain errors (e.g. `NotFoundError` 404, `ValidationError` 400,
  `ConflictError` 409) and are mapped to HTTP in one error-handling middleware. Every error
  response has the structure `{ code, message, statusCode }` and never includes a stack trace,
  token or personal data.
- Entity status changes go through the owning state-machine class, never by setting a field
  directly.

Rationale: these are the estate's existing coding standards (engineering-standards
`coding-standards.md`), stated here as testable rules so plans and reviews can check them.

## Backend Stack and Coding Standards

The backend stack is the one most IPXos factory services share (e.g. `svc-party-factory`,
`svc-product-factory`, `svc-crm-factory`). A new service copies its scaffolding from one of those
services. Any deviation (another framework such as Fastify or Nest, another test runner such as
Vitest, another ORM) MUST be justified in the plan's Complexity Tracking table.

- **Runtime and language**: Node.js 22 LTS (`.nvmrc` = `22`, `engines.node` = `>=22.0.0`);
  TypeScript 6; ES modules (`"type": "module"`, `module`/`moduleResolution` `NodeNext`, relative
  imports end in `.js`).
- **Libraries**: Express 5 (HTTP) with `helmet` and `express-rate-limit`; Prisma 7 with
  `@prisma/adapter-pg` (persistence); zod 4 (configuration and input validation); pino 10 with
  pino-http (structured logs); `@sentry/node` 10, loaded with `node --import ./src/instrument.ts`
  before the app; `jose` for JWT/JWKS; `dotenv` for local and test environment files only.
- **Compiler options**: `strict`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`,
  `noFallthroughCasesInSwitch`, `forceConsistentCasingInFileNames`, target ES2022.
- **Project layout**:
  `src/{index.ts, app.ts, instrument.ts, container.ts, config/, routes/, middleware/, services/,
  repositories/, models/, errors/, db/}`, plus `prisma/`, `tests/{unit,integration,support}/`,
  `scripts/`, `Dockerfile`, `docker-compose.db.yml`, `.env.example` and `.env.test`. `app.ts` builds
  the Express app without listening, so tests use it through supertest; `index.ts` only listens.
- **Identity provider**: Auth0. Tenant, audience and issuer come from validated configuration,
  never from code literals.
- **Health**: `GET /health` returns `{ service, version, status: "ok" }`, needs no authentication
  and is exempt from rate limiting (the `svc-product-factory` pattern).
- **Input**: every external input (body, query, params, headers, upstream responses) is validated
  with zod at the boundary.
- **Logging**: every log line is pino JSON with a correlation id. Logs MUST NOT contain tokens,
  secrets or personal data, only references (ids). Auth failures are logged with a reason code,
  not the token.
- **Persistence**:
  - Tables and columns use snake_case (Prisma `@@map`/`@map`), models use PascalCase.
  - Only parameterised queries, through Prisma.
  - An existing migration is never edited; every change gets a new migration.
  - Migrations run as a separate step (`npm run db:migrate`, which is `prisma migrate deploy`;
    a Kubernetes Job when deployed), never on application boot.
- **Testing**:
  - Jest 30 with ts-jest (ESM preset) and supertest, in two lanes. `test` is unit tests with no
    I/O. `test:integration` runs against the Compose Postgres in a dedicated test database
    (created by a `setup:test-db` script), serially, cleaning data per test.
  - `DATABASE_URL` comes from the environment, with a local default only when it is unset, so CI
    can supply its own.
  - Each test that proves an acceptance criterion starts with its tag (`it("AC-3: …")`), and the
    integration lane emits JUnit for `ipx-verify-qa`.
  - Line coverage is at least 70%.
- **Quality gates**: `lint` (ESLint 10 + Prettier, `no-explicit-any` as an error), `typecheck`
  (`tsc --noEmit`), `knip`, `test`, `test:integration` and `test:coverage` MUST pass locally with
  the same commands CI runs. A husky pre-commit hook runs lint and typecheck (ADR-016).
- **Container**: a multi-stage `Dockerfile` on a pinned `node:22.x-alpine` image that runs as a
  non-root user under `dumb-init`, has a `HEALTHCHECK` on `/health`, sets `NODE_ENV=production`
  and starts through `start.sh`, which does not migrate.

## Development Workflow

1. Pick the Linear ticket (first: IPX-9497, then IPX-9498).
2. Run `ipx-discuss` for the ticket (Principle II).
3. `/speckit-specify` from the discuss output, citing canon identifiers (Principle I).
4. `/speckit-clarify` for remaining gaps; `/speckit-plan`; `/speckit-tasks`; `/speckit-analyze`.
5. Implement only through `ipx-fix` (Principle III), test-first (Principle IX).
6. Every plan MUST include a Constitution Check that confirms Principles I–IX and the Backend Stack
   and Coding Standards before Phase 0 and again after design. A plan for a service MUST name its
   Compose dependencies, the host port it chose, and its local stubs (Principle VIII).
7. After every Spec Kit step, post the Linear progress comment and update the ticket (Principle VII).
8. Work only on branches, in git worktrees under `ipx-specs/repos/<repo>` (gitignored), with the
   spec work itself on an `ipx-specs` feature branch. Nothing is merged to `main` or deployed
   (including no publish, release or image-update workflow and no live identity-provider or secret
   changes) until the developer explicitly approves deployment. Every plan MUST carry "Workspace"
   and "Delivery constraints" sections stating this.
9. Before a task phase is reported complete, the local sequence of Principle VIII and all quality
   gates MUST have passed on a workstation.

## Governance

- This constitution supersedes other practices in this repository. Where an estate-wide standard
  (ADR, engineering-standards) is stricter, the stricter rule applies.
- Amendments are made via `/speckit-constitution`, recorded with a Sync Impact Report and committed
  with a message stating the version change.
- Versioning: MAJOR for removing or redefining a principle; MINOR for adding a principle or section
  or materially expanding guidance; PATCH for clarifications and wording.
- Compliance: every spec, plan and review MUST check these principles. Violations are either fixed
  or justified in the plan's Complexity Tracking table; Principles II, III, IV, V and VIII cannot be
  waived by justification.

**Version**: 1.2.0 | **Ratified**: 2026-10-26 | **Last Amended**: 2026-11-05
