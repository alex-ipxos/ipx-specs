# Implementation Plan: Ops Portal on Auth0, running beside the current portal

**Branch**: `003-ops-portal-auth0` (specs) · `feat/ipx-9500-ops-portal-auth0` (code, in `ipxos-ai/ipx`) | **Date**: 2026-11-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-ops-portal-auth0/spec.md`

**Linear**: [IPX-9500](https://linear.app/ipxos-ai/issue/IPX-9500) · **Canon**: TRU.IAM.R63, TRU.IAM.R66, TRU.IAM.R67, TRU.IAM.R53 · **Design record**: ipx-ops ADR-0051

## Summary

Operators reach the Ops Portal through Authentik today, and it is the only console they have. This
feature therefore stands up a **second, parallel deployment of the same `ipx-ops` application** in
the dev environment, identical except that operators sign in through the `ipxos-dev` Auth0 tenant
and the server-side session additionally carries the operator's svc-identity **platform user id**.
The current deployment is not changed, restarted or re-pointed, and the parallel one can be
withdrawn without touching it.

Technical approach, settled in `/ipx-discuss` on 2026-11-13 (ipx-ops ADR-0051) and refined in
[research.md](./research.md):

1. **One build, one provider per deployment.** Both Auth.js providers stay in the source;
   `getAuthConfig()` registers exactly one, chosen by `AUTH_PROVIDER` (`authentik` | `auth0`,
   **defaulting to `authentik`** so the current deployment's unchanged configuration keeps
   working). `authRoutes.signInOAuth` and the entry middleware's redirect derive from the same
   value instead of the hard-coded `authentik` literal.
2. **The platform user id is held beside the provider subject.** `session.user.id` stays the
   provider `sub` — it is what `mintFactoryServiceToken` signs as the outbound actor and what every
   factory turns into `did:authentik:<sub>` — and the svc-identity id is held as a new, separate
   `session.user.platformUserId`. Nothing in this feature reads it. (ADR-0051 decision 3.)
3. **Sign-in resolves the platform user, or nobody gets in.** The Auth.js `jwt` callback calls
   svc-identity `POST /v1/users/me` once with the operator's Auth0 access token, 3 s, no retry, and
   fails closed on anything but `2xx`.
4. **A real refusal surface.** `/sign-in` currently redirects straight to the provider, so there is
   nowhere to tell an operator why they were refused. It gains a rendered state driven by
   `?error=<reason>`, with Auth.js `pages.error` pointed at it.
5. **Separate everything that must not be shared.** Own Auth0 application/callback, own cookie
   name, own Infisical keys, own ingress host, a visible Auth0-portal marker on every screen.

No new persistence, no domain event, and no change to the outbound factory token, to any factory
service, or to the recorded actor identifier.

## Technical Context

**Language/Version**: TypeScript 5.x, strict; ES modules. Node **24.22.1** (`ipx/.nvmrc`;
`engines.node >=24.22.1 <25`) — not the constitution's Node 22, see Complexity Tracking.

**Primary Dependencies**: `@tanstack/react-start` 1.169.3 (server functions + file routes, built
with Vite — the LLD's "Next.js 16" line in §1 is stale), React 19.2, `@auth/core` ^0.41.2 (the
`auth0` provider is confirmed present at 0.41.2: `providers/auth0`), `@ipx/auth` (Authentik claim
extraction), `jsonwebtoken` (the interim HS256 factory token), `@sentry/*`, pino-style `#/lib/logger`.

**Storage**: **None for this feature.** The platform user record (`platform_user`, `identity_link`)
is owned by svc-identity; the platform user id lives only in the encrypted Auth.js JWT session
cookie. The app's one database (`AI_SESSION_STATE_DATABASE_URL`, Sona chat state) is untouched.

**Testing**: Vitest 5.0.4 (`pnpm --filter ipx-ops test`), Playwright 1.59.1
(`test:e2e`, `test:e2e:layout`), `typecheck` (`tsc --noEmit`). Not Jest — see Complexity Tracking.

**Target Platform**: Kubernetes (dev: `dev-ipxosai-services`, Helm values in `ipxos-ai/ipx-cd`),
served over HTTPS behind an Istio VirtualService; local dev at `https://ipx-ops.localhost` via
`portless` + Vite.

**Project Type**: Web application — a server-rendered React app with its own server side (the BFF),
deployed as one container. This feature touches only its sign-in path and its configuration.

**Performance Goals**: SC-001 — first sign-in completes in under 30 s end to end, including the
first-ever svc-identity resolve (which also calls Auth0 `/userinfo`). The svc-identity call carries
a 3 s timeout, in line with every other ipx-ops egress.

**Constraints**: Fail closed on every refusal (FR-013). No `Authorization` header, token,
authorisation code, client secret or unheld personal data in any log, Sentry event or breadcrumb
(FR-017, SC-009). The current deployment's behaviour must be provably unchanged (FR-002, AC-8). No
in-request retry of svc-identity. Dev-only scope (FR-005).

**Scale/Scope**: ~12 operators. Roughly 15 source files changed in `apps/ipx-ops` (auth config,
auth routes, entry middleware, session types and session-data, the sign-in route, a portal marker,
a new svc-identity client module, `.env.example`) plus `ipx-cd` Helm values for the second
deployment. 95 test files construct session objects and 536 call sites read the session, so the
session type change is additive and optional-by-construction (see research.md R6).

## Constitution Check

*GATE: checked before Phase 0 and again after Phase 1 design.*

Constitution v1.2.0. Pre-design result: **PASS with one unresolved gate (G-VIII-a) that needs the
developer's decision, and three justified deviations** recorded in Complexity Tracking. *Update 2026-11-19: G-VIII-a resolved by filing IPX-10983.*

| Principle | Verdict | Evidence |
|---|---|---|
| **I. Canon is the source of requirements** | PASS, with a recorded gap | Every FR traces to TRU.IAM.R63 (sign-in without roles), R66 (a provider subject maps to exactly one platform user), R67 (the service verifies what it is given), R53 (the subject comes from the token). `canon_ref` on the governance bundle links IPX-9495 (R66) and IPX-9494 (R63). ⚠️ **`canon_sha` is not recorded** — there is no `domain-docs` checkout on this workstation, so no canon text was read and no criteria are pinned. The ticket's original claim on **TRU.IAM.R52** is explicitly *not* delivered (ADR-0051 decision 3) and is raised, not silently resolved. |
| **II. Discuss every ticket before building** | PASS | `/ipx-discuss IPX-9500` ran on 2026-11-13: binding at `ipx/apps/ipx-ops/.planning/evidence/tasks/IPX-9500.json`, ADR-0051, sequence and contract-map docs, LLD PR [ipx-cd#2199](https://github.com/ipxos-ai/ipx-cd/pull/2199), Linear description rewritten and a design-decisions comment posted. This plan is built from that output; the spec's own Open Question about the missing discuss record is now answered. |
| **III. Code only through `ipx-fix`** | PASS | This plan writes no application code. Every change lands through `ipx-branch` → `ipx-fix` on `feat/ipx-9500-ops-portal-auth0`. `tasks.md` will name `ipx-fix` as the only writer. |
| **IV. Tokens are verified inside the service** | PASS | FR-009: the portal's server side verifies signature, issuer, audience, expiry and not-before itself before creating a session; `alg` is pinned to RS256 in configuration and never read from the token; JWKS is fetched and cached by the provider with rotation support. svc-identity independently verifies the same access token on arrival (it does not trust ipx-ops). There is no setting that switches verification off. |
| **V. The subject comes from the token** | PASS | FR-011 and ADR-0051 decision 3: `session.user.id` is the verified provider `sub`; `platformUserId` is derived from that token via svc-identity. No request body, query string, path parameter or non-bearer header is read as identity. The existing dev-officer override stays confined to the dev-bypass posture. |
| **VI. No roles until canon requires them** | PASS | FR-012: the session carries no roles, groups, permissions or access decision from Auth0. The pre-existing portal-side constant role set on the outbound token is unchanged (FR-024) and is not an authorisation decision made here. The cohort and system-operator gates are **not** re-sourced in this feature (ADR-0051 decision 5, IPX-9502 owns that). |
| **VII. Progress is visible in Linear** | PASS | A `**[Speckit] /speckit-plan — 2026-11-13**` comment is posted on IPX-9500, and short consumer notes on IPX-9502 and IPX-9503 whose premises this plan changes (see "Linear" below). The description was rewritten during discuss and needs no further scope change at this step. **Linear state:** the constitution has Spec Kit move Backlog → Todo once a plan exists; IPX-9500 is already **In Progress**, so this step makes no transition — moving it backwards is not Spec Kit's to do. |
| **VIII. Every service runs locally** | ✅ **GATE G-VIII-a — resolved 2026-11-19 by arm (b): removal filed as IPX-10983** | The local-run requirement itself is met (FR-021, [quickstart.md](./quickstart.md)): the parallel portal runs from the repo with `pnpm dev:ipx-ops`, and research.md R5 specifies a local JWKS + `/userinfo` stub and a locally run svc-identity so no cloud account or live tenant is needed. **But** this principle also says "an *auth off* switch MUST NOT exist, in any profile", and `AUTH_BYPASS=1` is exactly that switch. It pre-dates this feature (ADR-0014), is guarded to `ENVIRONMENT ∈ {local, development, staging, test}`, and **the spec and the ticket both require it to keep working** (FR-021, AC-9). Principles II, III, IV, V and VIII cannot be waived by justification, so this plan does not justify it: it records the conflict and asks for one of (a) amend the constitution via `/speckit-constitution` to scope the "auth off" clause to backend services, or (b) file removal of `AUTH_BYPASS` as its own ticket and keep it in scope here meanwhile. **Nothing in this feature extends or deepens the bypass**, and no new bypass of token verification is added. **Outcome (T003):** the developer chose (b). Removing `AUTH_BYPASS` is **IPX-10983**, related to IPX-9880, and the bypass stays in scope here unchanged until that ticket lands. |
| **IX. Code is strict, layered and tested** | PASS | Test-first through `ipx-fix` (RED → GREEN). Strict TypeScript, no `any`. Configuration is parsed once at boot and validated (FR-018); `process.env` reads stay inside the auth-config module and the new svc-identity client's configuration function. Errors are typed and mapped in one place; the refusal surface shows fixed operator-facing text with no internal detail (FR-016). The backend layering rules (routes → services → repositories, Prisma, `src/container.ts`) describe Express factory services and do not map onto a TanStack Start app — see Complexity Tracking. |

**Backend Stack and Coding Standards**: this section describes new Express/Prisma factory services.
`ipx-ops` is an existing React web application in another repository and copies none of that
scaffolding. The three material deviations (runtime version, framework, test runner) are in
Complexity Tracking; the standards that *do* apply irrespective of stack — strict TypeScript,
zod-validated boundaries, correlation-id structured logs with no tokens or personal data, the
`{ code, message, statusCode }` error shape at the boundary, AC-tagged tests, `.env.example` that
works unchanged locally — are all carried into this plan.

**Post-design re-check (after Phase 1): PASS, unchanged.** No design artefact introduced a new
principle conflict. Specifically: data-model.md adds no persistence and no new data classification;
`contracts/` adds no new ingress to ipx-ops and no new egress beyond the one svc-identity call
already registered in the LLD; quickstart.md proves the Principle VIII local sequence; and the
`AUTH_PROVIDER` default settled in research.md (R1) *removes* a start-up break the ADR's original
"required, no default" wording would have caused on the current deployment, which is the FR-002
protection working as intended. G-VIII-a is unchanged by the design. It was resolved on 2026-11-19 by filing IPX-10983.

## Project Structure

### Documentation (this feature)

```text
specs/003-ops-portal-auth0/
├── plan.md                               # This file
├── spec.md                               # /speckit-specify output
├── research.md                           # Phase 0 output
├── data-model.md                         # Phase 1 output
├── quickstart.md                         # Phase 1 output
├── contracts/
│   ├── resolve-platform-user-client.md   # ipx-ops's side of svc-identity POST /v1/users/me
│   ├── operator-session.md               # the session contract the app's own code consumes
│   └── portal-configuration.md           # the validated environment contract (start-up guard)
├── checklists/
│   └── requirements.md                   # /speckit-checklist output (16/16 passing)
└── tasks.md                              # /speckit-tasks output — NOT created here
```

### Source Code (the code repository, `ipxos-ai/ipx`)

```text
apps/ipx-ops/
├── src/
│   ├── server/
│   │   ├── auth/
│   │   │   ├── config.ts                 # CHANGED: AUTH_PROVIDER selects one provider; auth0
│   │   │   │                             #   provider with audience + scopes; jwt callback resolves
│   │   │   │                             #   and carries platformUserId; session callback exposes it
│   │   │   ├── config.test.ts            # CHANGED: both provider arms, start-up guard
│   │   │   ├── entry-middleware.ts       # CHANGED: redirect uses the configured provider id
│   │   │   ├── session-data.server.ts    # CHANGED: platformUserId required on a real session,
│   │   │   │                             #   absent under the dev-bypass posture
│   │   │   └── platform-user.server.ts   # NEW: the svc-identity POST /v1/users/me client
│   │   └── service-token.server.ts       # UNCHANGED (asserted by a new test, AC-3)
│   ├── lib/
│   │   ├── auth-routes.ts                # CHANGED: signInOAuth derives from the provider id
│   │   └── auth-provider.ts              # NEW: the provider-id resolver, client-safe
│   ├── routes/
│   │   └── sign-in.tsx                   # CHANGED: renders refusals on ?error=, else redirects
│   └── components/
│       └── shell/                        # CHANGED: the Auth0-portal marker (FR-006, AC-13)
├── .env.example                          # CHANGED: the new keys, local-profile values
├── e2e/ or playwright/                   # CHANGED: refusal + bypass regression specs
└── docs/
    ├── adr/0051-ops-portal-auth0-parallel-deployment-and-platform-user-binding.md   # written in discuss
    ├── sequences/ipx-9500-auth0-sign-in-and-platform-user-binding.md               # written in discuss
    └── architecture/ipx-9500-system-architecture.md                                 # written in discuss
```

```text
ipxos-ai/ipx-cd/
├── docs/services/ipx-ops.md              # LLD — landed in PR #2199
└── dev-ipxosai-services/values-dev.yaml  # NEW second deployment (web-ipx-ops-auth0):
                                          #   own host, own env block, own secret ref;
                                          #   AUTH_PROVIDER=authentik added to the existing block
```

**Structure Decision**: this feature adds no new project. It changes the sign-in path of one
existing application (`apps/ipx-ops` in `ipxos-ai/ipx`) and adds one Helm release beside the
existing one (`ipxos-ai/ipx-cd`). Each repository is worked in its own branch, and the spec work
itself stays on the `003-ops-portal-auth0` branch of `alex-ipxos/ipx-specs`.

## Workspace

Per constitution Development Workflow item 8:

| Repository | Branch | What lands there | State |
|---|---|---|---|
| `alex-ipxos/ipx-specs` | `003-ops-portal-auth0` | this plan and its Phase 0/1 artefacts | created 2026-11-13 |
| `ipxos-ai/ipx` | `feat/ipx-9500-ops-portal-auth0` | the app change, plus the three design docs discuss left untracked (`design.same_repo_docs[]`) | **not yet created** — `ipx-branch` cuts it |
| `ipxos-ai/ipx` | `chore/governance-evidence-sync-ipx-9500` | the governance evidence commit from discuss | exists, local only |
| `ipxos-ai/ipx-cd` | `docs/ipx-9500-ops-portal-auth0-lld` | the LLD update | PR [#2199](https://github.com/ipxos-ai/ipx-cd/pull/2199) open |
| `ipxos-ai/ipx-cd` | a second branch, at deployment time | the parallel Helm release | not yet created |

Code worktrees belong under `ipx-specs/repos/<repo>` (gitignored). The checkouts actually used in
this session are the developer's existing clones at `~/Documents/insuranceos/{ipx,ipx-cd}`; both
were returned to `main` after the discuss turn.

## Delivery constraints

- **Nothing is merged or deployed until the developer explicitly approves it** (constitution
  Development Workflow item 8) — including the parallel deployment itself, any image publish or
  release workflow, any `ipx-cd` values change reaching the cluster, and any live Auth0 tenant or
  Infisical secret change.
- **The Auth0 tenants do not exist yet.** IPX-9497 created their design and runbook but creation is
  held until deployment is approved. The parallel portal's callback address must be registered on
  the application before AC-1 can be demonstrated.
- **svc-identity is deployed nowhere** (IPX-9499, In Progress). Until it is reachable in dev, AC-1,
  AC-2 and AC-10 are demonstrated against a locally run svc-identity, and FR-010 holds in an
  environment only once svc-identity answers there.
- **Dev only** (FR-005). Staging and production are IPX-9504.
- **A person confirms the local setup before any deployment step.** There are three [HUMAN]
  sign-offs, each recorded as a comment on IPX-9500 and never run or ticked by an agent: T066 (local
  run against the stub, before any live Auth0, Infisical, image or ipx-cd change), T065 (local run
  against the real `ipxos-dev` tenant, naming the SHA that may be built) and T067 (approval to merge
  the ipx-cd PR, which is the deployment). The same gates apply to every refresh.
- **The code stays off `main`** (FR-028, research.md R11). The `ipx` PR stays a draft and is not
  merged. A push to `main` would run `publish-ipx-ops.yml`, whose `dispatch-dev-image` job bumps
  `web-ipx-ops` and restarts the current portal. The parallel portal's image is built by dispatching
  that workflow by hand on the feature branch, and the ipx-cd change touches no line of the
  `web-ipx-ops` release.
- Application code is written only through `ipx-fix`, test-first.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Node 24.22.1, not the constitution's Node 22 LTS | `apps/ipx-ops` lives in the `ipxos-ai/ipx` monorepo, which pins 24.22.1 in `.nvmrc` and `engines.node` for every app. This feature cannot pick its own runtime. | Downgrading one app in a pnpm monorepo to Node 22 is not possible without downgrading the monorepo, which is a far larger change than this feature and unrelated to it. |
| TanStack Start + Vite + React 19, not Express 5 | The application already exists and is a server-rendered React portal; this feature changes its sign-in path. | Rewriting the portal onto Express is absurd for a sign-in change, and the constitution's stack section explicitly governs *new* factory services copying their scaffolding from a sibling service. |
| Vitest + Playwright, not Jest 30 + supertest | Same reason: the app's existing two test lanes, with 95 session-constructing test files already written against them. | Introducing a second test runner into one app to satisfy a backend standard would add a toolchain, not coverage; AC-tagged test names and the JUnit output `ipx-verify-qa` reads are both already available from the existing lanes. |
| The layering rule (routes → services → repositories, Prisma, `src/container.ts`) is not followed | There is no Prisma and no repository layer in this feature; the app's equivalent boundary is route → server function → typed client, which it already uses consistently. | Inventing a container and a repository layer for one HTTP call that owns no data would be ceremony with no reader. The spirit — HTTP handling separate from the call, configuration parsed once, no `process.env` reads scattered through the app — is kept (research.md R2, R4). |
| **Not a justification — an open gate.** `AUTH_BYPASS=1` is an "auth off" switch, which Principle VIII forbids in any profile and which cannot be waived | It pre-exists (ADR-0014), is `ENVIRONMENT`-fenced, and both the spec (FR-021) and the ticket (AC-9) require it to keep working. | Removing it inside this feature would break the local and demo workflow the rest of the team relies on, and is a decision about the app's dev posture rather than about Auth0 sign-in. Recorded as **G-VIII-a** above. Resolved by filing its own ticket, **IPX-10983**. |

## Phase 0 and Phase 1 outputs

- [research.md](./research.md) — 10 decisions (R1–R10), each with rationale and rejected
  alternatives. All Technical Context unknowns are resolved; **no `NEEDS CLARIFICATION` markers
  remain**, and the two questions that could not be settled from the code are recorded as the
  open gate G-VIII-a and the deployment-shape question R8 rather than guessed.
- [data-model.md](./data-model.md) — the five conceptual entities of the spec expressed as what
  they actually are here: a session shape, a validated configuration shape, a transient resolve
  result, a log record, and the two Helm releases. No database, no migration, no ERD.
- [contracts/](./contracts) — three contracts: the svc-identity client, the operator session, and
  the portal configuration.
- [quickstart.md](./quickstart.md) — the runnable local validation sequence, Principle VIII's
  clean-clone path included, and which acceptance criteria each step proves.

## Linear

- `**[Speckit] /speckit-plan — 2026-11-13**` on IPX-9500: what was produced, where, what changed,
  what is next.
- Consumer notes on **IPX-9502** and **IPX-9503**: both were written assuming `session.user.id`
  becomes the platform user id. ADR-0051 decision 3 settled otherwise, so 9502's "comma-separated
  platform user ids" and 9503's "no `did:authentik:` string is built in ipx-ops" no longer follow
  from this ticket. Each needs re-scoping before it is picked up.
- No Linear state transition at this step (the ticket is already In Progress; see Principle VII
  above).
