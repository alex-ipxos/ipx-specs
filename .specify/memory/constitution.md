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

## Estate Stack and Service Standards

- Runtime and libraries: Node.js/TypeScript with Express (HTTP), Prisma (persistence), zod (input
  and config validation), pino (structured logging) and Sentry (error reporting). Deviations MUST be
  justified in the plan's complexity section.
- Identity provider: Auth0. Auth0 tenant, audience and issuer values come from validated (zod)
  configuration, never from code literals.
- Health endpoints MUST follow the `svc-product-factory` pattern: `GET /health` returns
  `{ service, version, status: "ok" }`, needs no authentication and is exempt from rate limiting.
- Logging MUST NOT include tokens, secrets or personal data. Auth failures are logged with a reason
  code, not the token.
- All external input MUST be validated with zod at the boundary.

## Development Workflow

1. Pick the Linear ticket (first: IPX-9497, then IPX-9498).
2. Run `ipx-discuss` for the ticket (Principle II).
3. `/speckit-specify` from the discuss output, citing canon identifiers (Principle I).
4. `/speckit-clarify` for remaining gaps; `/speckit-plan`; `/speckit-tasks`; `/speckit-analyze`.
5. Implement only through `ipx-fix` (Principle III).
6. Every plan MUST include a Constitution Check that confirms Principles I–VII before Phase 0 and
   again after design.
7. After every Spec Kit step, post the Linear progress comment and update the ticket (Principle VII).
8. Work only on branches, in git worktrees under `ipx-specs/repos/<repo>` (gitignored), with the
   spec work itself on an `ipx-specs` feature branch. Nothing is merged to `main` or deployed
   (including no publish, release or image-update workflow and no live identity-provider or secret
   changes) until the developer explicitly approves deployment. Every plan MUST carry "Workspace"
   and "Delivery constraints" sections stating this.

## Governance

- This constitution supersedes other practices in this repository. Where an estate-wide standard
  (ADR, engineering-standards) is stricter, the stricter rule applies.
- Amendments are made via `/speckit-constitution`, recorded with a Sync Impact Report and committed
  with a message stating the version change.
- Versioning: MAJOR for removing or redefining a principle; MINOR for adding a principle or section
  or materially expanding guidance; PATCH for clarifications and wording.
- Compliance: every spec, plan and review MUST check these principles. Violations are either fixed
  or justified in the plan's Complexity Tracking table; Principles II, III, IV and V cannot be
  waived by justification.

**Version**: 1.1.0 | **Ratified**: 2026-10-26 | **Last Amended**: 2026-10-26
