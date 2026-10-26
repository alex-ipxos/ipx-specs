# Implementation Plan: Ops Portal identity provider tenants

**Branch**: `001-ops-auth0-tenants` (spec, in `ipx-specs`); delivery branch
`feat/ipx-9497-auth0-tenants` (in `ipxos-ai/ipx`) | **Date**: 2026-10-26 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-ops-auth0-tenants/spec.md`. Linear IPX-9497. Canon
TRU.IAM.R63. Design record: ipx-ops ADR-0040, amended in this plan.

## Summary

Stand up two hand-configured Auth0 tenants, `ipxos-dev` and `ipxos-stg`, in the AU region, as the
Ops Portal's identity provider. Each tenant has:

- one Regular Web Application for ipx-ops;
- one API with audience `svc-identity` (RS256);
- the ipxos.ai Google Workspace connection as the application's only connection;
- one deny-only post-login Action that admits only `idp_tenant_domain === 'ipxos.ai'`;
- no roles or permission claims.

Secrets go to Infisical. svc-identity gets the issuer and audience only.

The repository deliverables, all through `ipx-fix`, are:

1. The Action source and its unit test in `apps/ipx-ops/auth0/actions/`.
2. A README section with the setup steps, the verification checklist and runbooks R1 to R3.
3. The design docs already drafted (ADR-0040, the sequence diagrams, the contract map).

The tenants themselves are an operator action outside the codebase. They are proven by the
[quickstart](quickstart.md) checklist.

## Technical Context

**Language/Version**: JavaScript (CommonJS) for the Auth0 Action on the Auth0 Actions Node 22
runtime. TypeScript for its test. Node 24.22.1 for the repo (`.nvmrc`).

**Primary Dependencies**: None at runtime: the Action requires no modules. Vitest is the
`ipx-ops` test runner.

**Storage**: N/A. Configuration lives in Auth0; secrets live in Infisical (`/web-ipx-ops`,
`/svc-identity`).

**Testing**:
- Vitest (`pnpm --filter ipx-ops test`) for the Action contract.
- **Local Ops Portal regression run** (tasks T029, before the PR): `pnpm dev:ipx-ops` at
  `https://ipx-ops.localhost`, the `AUTH_BYPASS=1` picker, Authentik sign-in unchanged, and
  `pnpm --filter ipx-ops test:e2e` (Playwright) locally.
- **Local callback check** against the live dev tenant (T032, held).
- The manual quickstart checklist for each tenant (T026, held).

The full local Auth0 sign-in into the portal is IPX-9500's.

**Target Platform**: Auth0 public cloud, AU region. Google Workspace (`ipxos.ai`). Infisical.

**Project Type**: Infrastructure configuration plus a small serverless hook, inside the `ipx`
monorepo's `apps/ipx-ops`.

**Performance Goals**: Operator sign-in completes in under a minute (SC-001). The Action does no I/O.

**Constraints**:
- No roles or claims (R63).
- The Action may only call `api.access.deny`.
- Issuer values are byte-exact.
- The region is fixed at creation.
- Hand configuration, so the checklist is the drift control.

**Scale/Scope**: Two tenants. Fewer than 100 operators (the ipxos.ai Workspace). One Action of about
10 lines.

All earlier unknowns are resolved in [research.md](research.md), R1 to R5.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Pre-research | Post-design |
|---|---|---|
| I. Canon is the source | PASS: TRU.IAM.R63 cited; the IPX-9497 scope mirrors it | PASS: amendments recorded on IPX-9497 and in ADR-0040; no requirement invented |
| II. ipx-discuss first | PASS: `/ipx-discuss IPX-9497` completed 2026-10-26 | PASS: design amendment R1 recorded as a discuss-decision change (Linear comment 2026-10-26) |
| III. Code only through ipx-fix | PASS: no code in scope at discuss time | PASS: the Action `.cjs`, its test and the README are written only through `ipx-fix`. The tenants are an operator action, not code |
| IV. In-service token verification | N/A for this feature (no service). Supplies issuer and audience for IPX-9498 | PASS: [token contract](contracts/access-token-for-svc-identity.md) fixes `alg`, `iss`, `aud`; svc-identity verifies them itself |
| V. Subject from token | N/A (no service) | PASS: the token contract says identity comes from `sub` and never from an email claim |
| VI. No roles yet | PASS: no roles, claims or RBAC | PASS: the only Action is deny-only; its contract forbids every claim or metadata call |
| VII. Progress visible in Linear (constitution 1.1.0) | Added after research | PASS: specify and plan progress posted on IPX-9497 (2026-10-26); IPX-9497 moved Backlog → Todo and assigned; consumers IPX-9498 and IPX-9500 told about the token contract; Linear checkpoints listed in Delivery order |
| Stack (Express/Prisma/zod/pino/Sentry, health) | N/A: no service built | N/A |

No violations. Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-ops-auth0-tenants/
├── plan.md              # This file
├── research.md          # Phase 0: R1 to R5, including the domain-Action correction
├── data-model.md        # Phase 1: tenant, application, API, connection, Action, secrets
├── quickstart.md        # Phase 1: per-tenant verification checklist
├── contracts/
│   ├── restrict-to-ipxos-domain-action.md
│   └── access-token-for-svc-identity.md
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks; not created here)
```

### Source Code (`ipxos-ai/ipx`, worktree `repos/ipx`)

```text
apps/ipx-ops/
├── auth0/
│   └── actions/
│       ├── restrict-to-ipxos-domain.cjs        # NEW: exact text deployed in each tenant
│       └── restrict-to-ipxos-domain.test.ts    # NEW: Vitest, node environment, contract cases
├── README.md                                   # CHANGED: "Auth0 setup" section (steps, checklist, R1–R3);
│                                               #   Authentik section kept until IPX-9500/9504
└── docs/
    ├── adr/0040-auth0-tenants-for-ipx-ops-…md  # NEW (drafted in discuss, amended in plan)
    ├── sequences/ipx-9497-auth0-login.md       # NEW
    └── architecture/ipx-9497-system-architecture.md  # NEW
```

The LLD is `ipx-cd/docs/services/ipx-ops.md`, in its own PR, ipxos-ai/ipx-cd#1639.

**Structure Decision**: everything goes in the existing `apps/ipx-ops` package. The Action lives
beside the app it protects, so it rides the IPX-9497 PR and the app's existing test gate. No new
package or tooling is added.

## Workspace

All work for this feature happens in git worktrees inside this repository, under `repos/`. That
directory is gitignored (`/repos/` in `.gitignore`), so the worktrees are never committed to
`ipx-specs`.

| Worktree | Repository | Branch | What changes there |
|---|---|---|---|
| `repos/ipx` | `ipxos-ai/ipx` (main checkout `../ipx`) | `feat/ipx-9497-auth0-tenants` | Action source and test, README, ADR-0040, sequences, contract map, task evidence (`apps/ipx-ops/.planning/evidence/tasks/IPX-9497.json`) |
| `repos/ipx-cd` | `ipxos-ai/ipx-cd` (main checkout `../ipx-cd`) | `docs/ipx-9497-auth0-tenants` (PR ipxos-ai/ipx-cd#1639) | ipx-ops LLD only (`docs/services/ipx-ops.md`) |

- Create a worktree with `git -C ../<repo> worktree add <abs>/ipx-specs/repos/<repo> <branch>`.
  Remove it, once its branch merges or is abandoned, with `git -C ../<repo> worktree remove …` then
  `git -C ../<repo> worktree prune`.
- The main checkouts (`../ipx`, `../ipx-cd`) stay on `main` and are not edited for this feature.
- Governance evidence for IPX-9497 resolves from `repos/ipx/apps/ipx-ops/.planning`. The user-local
  workspace and active-task pointers were re-registered for that worktree on 2026-10-26. Run
  `ipx-*` turns from inside `repos/ipx/apps/ipx-ops`.
- `repos/ipx` has no `node_modules`. Run `pnpm install` there before the Vitest gate (Node 24.22.1,
  per `.nvmrc`).
- Not needed for this feature: `domain-docs` (no canon change), `iac-core-platform` (D1: no
  Terraform), and svc-identity (not created yet; IPX-9498 adds its worktree when that feature
  starts).

## Delivery constraints

- **Branches only.** Every change is a commit on a feature or docs branch in a worktree above.
  Nothing is committed to `main` in any repository, including this one: the spec work for this
  feature lives on `ipx-specs` branch `001-ops-auth0-tenants`.
- **Nothing is deployed.** In `ipxos-ai/ipx`, a push to `main` touching `apps/ipx-ops/**` runs
  `publish-ipx-ops.yml`. That builds the image and dispatches `image-update` to `ipx-cd`, which
  deploys `web-ipx-ops` to dev. So:
  - Branches may be pushed and PRs opened. That runs CI only: `ci.yml` on `pull_request`, and
    `e2e.yml`.
  - **No PR is merged in `ipx` or `ipx-cd`** for this feature until deployment is explicitly
    approved. That includes ipx-cd#1639.
  - No `workflow_dispatch` of `publish-*`, `release`, `prerelease` or `ipx-cd` `image-update`.
  - The `ipx-merge` and `ipx-deploy-record` turns are not run.
- **No Auth0 or Infisical changes yet.** Creating the tenants, pasting the Action and writing
  Infisical entries (delivery steps 3 and 4) put configuration live. They are held until deployment
  is approved, alongside the merge.

## Delivery order

1. `ipx-fix` in `repos/ipx`, test first: write the Action test (RED), then the `.cjs` (GREEN), per
   the [Action contract](contracts/restrict-to-ipxos-domain-action.md).
2. `ipx-fix` in `repos/ipx`: add the README "Auth0 setup" section, built from
   [data-model.md](data-model.md), [quickstart.md](quickstart.md) and ADR-0040's runbooks. Commit
   the design docs through `ipx-fix` too (T027). Run the local Ops Portal regression (T029). Push the
   branch and open the IPX-9497 PR. **Do not merge.**
3. **Held until deployment is approved.** Operator, outside the codebase: create `ipxos-dev`, then
   `ipxos-stg`, following the README. That means the Google OAuth client per tenant, the Workspace
   connection, the API, and the application **with no connection enabled**. Then paste, bind and diff
   the Action, and only then enable the Workspace connection for ipx-ops, so no tenant is ever
   reachable without the Action. Then the Infisical entries.
4. **Held until deployment is approved.** Run the quickstart against both tenants and the local
   callback check (T032), and record PASS on IPX-9497. Then merge the ipx PR and ipx-cd#1639.

### Linear checkpoints (constitution Principle VII)

| When | On | What |
|---|---|---|
| `/speckit-tasks` done | IPX-9497 | `[Speckit] tasks` comment with the task list and phase count |
| `/speckit-analyze` done | IPX-9497 | Findings summary, and a description update if anything changed |
| Each `/speckit-implement` phase done | IPX-9497 | Which tasks completed, with commit SHAs on `feat/ipx-9497-auth0-tenants` |
| PR opened (step 2) | IPX-9497 | PR link. The `ipx-pr` turn moves the state to In Review |
| Step 4 PASS (after approval) | IPX-9497 | Checklist result per tenant, date and checker |
| Token contract or Action contract changes | IPX-9498, IPX-9500 | A short note naming the change |
| Production tenant scope | IPX-9504 | Already recorded (2026-10-26 comment) |

State moves beyond Todo are left to `ipx-branch` (In Progress), `ipx-pr` (In Review) and
`ipx-merge` (Done).

## Complexity Tracking

None. No constitution violations.
