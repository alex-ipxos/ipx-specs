---

description: "Task list for 003-ops-portal-auth0"
---

# Tasks: Ops Portal on Auth0, running beside the current portal

**Input**: Design documents from `/specs/003-ops-portal-auth0/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts)

**Linear**: every task below belongs to **IPX-9500** unless its line names another ticket.

**Tests**: **included and mandatory.** Not optional here — constitution Principle IX requires
test-first (the RED → GREEN cycle `ipx-fix` records), and every test that proves an acceptance
criterion starts with its tag (`it('AC-5: …')` for Vitest, `{ tag: '@AC-5' }` for Playwright) so
`ipx-verify-qa` can read coverage back (ADR-0013).

**Organization**: grouped by the five user stories of spec.md, in priority order.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1–US5, mapping to spec.md's user stories
- Every task names its exact file path

## Path conventions

Three repositories, each on its own branch (plan.md → Workspace):

- **Code** — `ipxos-ai/ipx`, branch `feat/ipx-9500-ops-portal-auth0`. Paths below starting
  `apps/ipx-ops/` are in this repo.
- **Delivery** — `ipxos-ai/ipx-cd`. Paths starting `dev-ipxosai-services/` or `docs/services/`.
- **Specs** — `alex-ipxos/ipx-specs`, branch `003-ops-portal-auth0`. Paths starting `specs/`.

## ⚠️ Two gates before Phase 3

Both are the developer's to clear; neither blocks Phase 1 or 2.

- **G-VIII-a** (plan.md Constitution Check): `AUTH_BYPASS=1` is an "auth off" switch, which
  Principle VIII forbids in any profile and which **cannot be waived by justification**. Resolve by
  amending the constitution (`/speckit-constitution`) or filing its removal as its own ticket.
  T003 records the outcome.
- **R8** (research.md): own Auth0 application for the parallel portal, or an extra callback URL on
  the existing one? T004 carries both arms.

---

## Phase 1: Setup

**Purpose**: branches, configuration surface, and a local environment that can run this feature at
all (the Auth0 tenants do not exist yet and svc-identity is deployed nowhere).

- [ ] T001 Cut the code branch `feat/ipx-9500-ops-portal-auth0` in `ipxos-ai/ipx` via `/ipx-branch`, staging the three design docs `/ipx-discuss` left untracked: `apps/ipx-ops/docs/adr/0051-ops-portal-auth0-parallel-deployment-and-platform-user-binding.md`, `apps/ipx-ops/docs/sequences/ipx-9500-auth0-sign-in-and-platform-user-binding.md`, `apps/ipx-ops/docs/architecture/ipx-9500-system-architecture.md` (recorded in the governance bundle's `design.same_repo_docs[]`)
- [ ] T002 [P] Add the new keys to `apps/ipx-ops/.env.example` with working local-profile values and one comment line each: `AUTH_PROVIDER` (`authentik|auth0`, **defaults to `authentik`** when unset), `AUTH_AUTH0_ISSUER` (absolute https URL, **byte-exact including the trailing slash**), `AUTH_AUTH0_ID`, `AUTH_AUTH0_SECRET`, `AUTH_AUTH0_AUDIENCE` (default `svc-identity`), `SVC_IDENTITY_API_URL` (absolute URL, **no** trailing slash) — per `specs/003-ops-portal-auth0/contracts/portal-configuration.md`
- [ ] T003 [P] Record the outcome of gate **G-VIII-a** in `specs/003-ops-portal-auth0/plan.md` (constitution amended, or a ticket filed for removing `AUTH_BYPASS`) — a one-line amendment to the Constitution Check row, not a justification in Complexity Tracking, because Principle VIII cannot be waived
- [ ] T004 [P] Settle research.md **R8** and record it in `specs/003-ops-portal-auth0/research.md`: the parallel portal gets **(a)** its own Auth0 application (own client id and secret — **recommended**, FR-003 says the two portals share no provider registration) or **(b)** an extra callback URL on the existing Ops Portal application. Needs whoever holds **IPX-9497**; the only downstream effect is how many secrets T030 provisions
- [ ] T005 [P] Stand up the local OIDC stub for development (discovery, `/authorize`, `/oauth/token`, `/jwks.json`, `/userinfo`, locally generated RS256 keys) and document its start command in `specs/003-ops-portal-auth0/quickstart.md` — research.md R5. Shared with svc-identity's own local profile, so one key set signs the token both sides verify
- [ ] T006 [P] Verify svc-identity runs locally from its own repo (`npm run db:up` → `db:migrate` → `dev`, its quickstart) against the T005 stub, and note the port it serves on in `specs/003-ops-portal-auth0/quickstart.md`

**Checkpoint**: both branches exist, the configuration surface is written down, and a workstation can run a provider and a platform user record without a cloud account.

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: provider selection and validated configuration. **Every user story depends on this
phase**, because until the provider is selectable there is no Auth0 arm to sign in on and no
Authentik arm to prove unchanged.

**⚠️ CRITICAL**: no user story work begins until this phase is complete.

### Tests first (RED)

- [ ] T007 [P] Write failing tests for the provider resolver in `apps/ipx-ops/src/lib/auth-provider.test.ts`: unset → `authentik`; empty-after-trim → `authentik`; `auth0` → `auth0`; `authentik` → `authentik`; **set-but-unrecognised (e.g. `auth-zero`) throws** and never falls back (contracts/portal-configuration.md validation rules 3–4)
- [ ] T008 [P] Write failing tests for configuration validation in `apps/ipx-ops/src/server/auth/config.test.ts`: with `AUTH_PROVIDER=auth0`, each of `AUTH_AUTH0_ISSUER`/`AUTH_AUTH0_ID`/`AUTH_AUTH0_SECRET`/`SVC_IDENTITY_API_URL` missing or malformed throws **one** error naming **every** offending key and **never its value**; `AUTH_AUTH0_AUDIENCE` defaults to `svc-identity`; a non-URL issuer is malformed; the inactive provider's keys are **not** required on either arm (**AC-7**)

### Implementation (GREEN)

- [ ] T009 Create the client-safe provider resolver in `apps/ipx-ops/src/lib/auth-provider.ts`: export the `'authentik' | 'auth0'` type, the provider-id resolver (default `authentik`, trim, throw on an unrecognised value) and nothing server-only — `auth-routes.ts` imports it and must stay client-safe
- [ ] T010 Add the zod configuration schema to `apps/ipx-ops/src/server/auth/config.ts`, parsed **once at module scope** (research.md R4 — there is no Express boot phase; module scope runs once per server process, on the first request the entry middleware gates). Required keys depend on the resolved provider; the error names keys, never values
- [ ] T011 Register **exactly one** provider in `getAuthConfig()` in `apps/ipx-ops/src/server/auth/config.ts`: the existing `Authentik({...})` on the `authentik` arm, unchanged; on the `auth0` arm `Auth0({ clientId, clientSecret, issuer, authorization: { params: { audience: AUTH_AUTH0_AUDIENCE, scope: 'openid profile email' } } })` from `@auth/core/providers/auth0`. Pin RS256 in configuration; **never** read `alg` from the token (FR-009)
- [ ] T012 [P] Derive `signInOAuth` from the resolved provider id in `apps/ipx-ops/src/lib/auth-routes.ts`, replacing the `'/api/auth/signin/authentik'` literal. Keep the module client-safe (no server-only imports)
- [ ] T013 [P] Derive the sign-in redirect from the resolved provider id in `apps/ipx-ops/src/server/auth/entry-middleware.ts`, replacing the second `'/api/auth/signin/authentik'` literal, and extend `apps/ipx-ops/src/server/auth/entry-middleware.test.ts` for both arms (the `/api/health` and `/api/auth/*` exemptions and the `AUTH_REQUIRED` JSON arm stay as they are)

**Checkpoint**: one build serves both arms; `AUTH_PROVIDER` unset behaves exactly as today.

---

## Phase 3: User Story 2 — the current portal is not disturbed (Priority: P1)

**Goal**: prove that nothing an operator touches today changed. Taken **before** US1 deliberately:
it is the constraint that shaped the whole feature, and it is cheapest to prove while the Auth0 arm
is still inert.

**Independent Test**: with no new environment key set anywhere, the existing suites pass unmodified
and the app still starts on the Authentik arm.

- [ ] T014 [US2] Run `pnpm --filter @ipx/ipx-ops test`, `typecheck` and `test:e2e` **unmodified, with no new environment key set**, and record the result in the governance bundle. A failure here means the Phase 2 default is wrong, not that a test needs editing (**AC-8**)
- [ ] T015 [P] [US2] Add `it('AC-8: …')` to `apps/ipx-ops/src/server/auth/config.test.ts` asserting that with `AUTH_PROVIDER` unset `getAuthConfig()` registers the **Authentik** provider and **only** that provider (one entry in `providers`), and that the returned config is otherwise equal to today's — basePath, `session.strategy: 'jwt'`, `maxAge: 8 * 60 * 60`, `pages.signIn`, and the three callbacks present
- [ ] T016 [P] [US2] Add `it('AC-3: …')` to `apps/ipx-ops/src/server/service-token.server.test.ts` asserting `signFactoryServiceToken` is called with `subject: session.user.id` (the provider subject), the same `iss` from `FACTORY_TOKEN_ISSUER`, audience `ipx-factory-services` and the same role set — and that **`platformUserId` appears nowhere in the minted token or its claims** (FR-027, contracts/operator-session.md)
- [ ] T017 [P] [US2] Add `AUTH_PROVIDER: "authentik"` explicitly to the existing `web-ipx-ops` release's `env:` block in `dev-ipxosai-services/values-dev.yaml` (`ipx-cd`) — belt and braces over the Phase 2 default, so the current deployment's provider is stated rather than inferred

**Checkpoint**: the current portal's behaviour is provably unchanged, by its own existing checks.

---

## Phase 4: User Story 1 — an operator signs in to the parallel portal with Auth0 (Priority: P1) 🎯 MVP

**Goal**: an `ipxos.ai` operator reaches the portal through Auth0 and lands on the same screens they
use today.

**Independent Test**: with `AUTH_PROVIDER=auth0` pointed at the T005 stub (or the real `ipxos-dev`
tenant once it exists), an operator signs in and reaches `/monitor`.

### Tests first (RED)

- [ ] T018 [P] [US1] Write failing tests in `apps/ipx-ops/src/server/auth/config.test.ts` for the `auth0` arm: `providers` holds exactly one Auth0 provider; `authorization.params.audience` is the configured audience and `scope` is exactly `openid profile email`; the issuer is passed **byte-exact, trailing slash preserved**; the client secret never appears in the returned object's enumerable string values
- [ ] T019 [P] [US1] Write a failing Playwright spec `apps/ipx-ops/e2e/auth0-sign-in.spec.ts` tagged `@AC-1`: against the stub, an `ipxos.ai` operator completes sign-in and lands on `/monitor` with the portal's navigation present and no account-creation or password step

### Implementation (GREEN)

- [ ] T020 [US1] Point Auth.js at the sign-in page for errors in `apps/ipx-ops/src/server/auth/config.ts`: add `error: authRoutes.signIn` to `pages`, so a refusal has somewhere to land (research.md R7 — prerequisite for US4, done here because it is one line in the same object)
- [ ] T021 [US1] Hydrate the token from the Auth0 profile in the `jwt` callback in `apps/ipx-ops/src/server/auth/config.ts`: assert a non-empty `sub` and that `account.providerAccountId` matches it (the existing `assertAuthentikSubject` shape, generalised per provider), map the display-only `name` claim, and set `groups`/`roles`/`entitlements` to **empty arrays** — Auth0 issues no such claims (FR-012, data-model.md E1)
- [ ] T022 [US1] Expose the Auth0 session through the `session` callback in `apps/ipx-ops/src/server/auth/config.ts`: `user.id = token.sub` exactly as today, `name` fail-soft, the three claim arrays empty. **Do not change what `user.id` holds** (ADR-0051 decision 3)
- [ ] T023 [US1] Run the quickstart Scenario 4 sign-in by hand against the stub and record the outcome, including the end-to-end duration against SC-001's 30 s budget, in the governance bundle

**Checkpoint**: an operator can sign in on the Auth0 arm. The session does not yet carry a platform user id.

---

## Phase 5: User Story 3 — the signed-in operator is bound to their platform user record (Priority: P2)

**Goal**: sign-in resolves the operator to a svc-identity platform user id, held beside the provider
subject, and nobody gets in without one.

**Independent Test**: sign a brand-new person in, then again; `/api/auth/session` shows the same
`platformUserId` both times, and it is a UUID rather than the Auth0 `sub`.

### Tests first (RED)

- [ ] T024 [P] [US3] Write failing tests for the svc-identity client in `apps/ipx-ops/src/server/auth/platform-user.server.test.ts`, one per row of `specs/003-ops-portal-auth0/contracts/resolve-platform-user-client.md`: `201 {userId, created:true}` → `ok`; `200 {userId, created:false}` → `ok`; `401`/`403`/`502 profile_invalid`/`502 profile_unavailable`/`503 identity_provider_unavailable`/`503 database_unavailable`/`500`/`400`/timeout/connection-refused/unknown-status/unparseable-body → the matching failure reason; **a 200 whose `userId` is absent, empty or not a UUID is `internal_error`, never an admission**; `Retry-After` is parsed into `retryAfterSeconds` and **never** triggers a second call
- [ ] T025 [P] [US3] Write failing tests in the same file asserting the request shape: `POST {SVC_IDENTITY_API_URL}/v1/users/me`, `Authorization: Bearer <account.access_token>`, the BFF correlation id header, **no request body at all** (not `{}`, not `null`), and a **3 s** timeout with **no retry**
- [ ] T026 [P] [US3] Write failing tests in `apps/ipx-ops/src/server/auth/session-data.server.test.ts`: a **real** session with no `platformUserId` is refused by `getAuthenticatedOpsSessionData` (returns `null`); a real session with one is returned; the **dev-bypass** session has **no** `platformUserId` and is still returned under `AUTH_BYPASS=1` with `ENVIRONMENT=development` (data-model.md E1 rules 1–2, **AC-9**)
- [ ] T027 [P] [US3] Write a failing Playwright spec in `apps/ipx-ops/e2e/auth0-sign-in.spec.ts` tagged `@AC-2`: the same stub operator signing in twice gets the same `platformUserId` from `/api/auth/session`, the value is a UUID, and it differs from `user.id`

### Implementation (GREEN)

- [ ] T028 [US3] Create the client in `apps/ipx-ops/src/server/auth/platform-user.server.ts`: its own configuration function reading `SVC_IDENTITY_API_URL` (the only `process.env` read in the module), a zod schema for the success body (`userId` UUID required, `created` boolean), a zod schema for the estate error body `{ code, message, statusCode }` mapping an unrecognised `code` to `internal_error`, a 3 s `AbortSignal.timeout`, and the discriminated result of data-model.md E3. It **never** logs or returns the token, the authorisation code or svc-identity's `message`
- [ ] T029 [US3] Call it from the `jwt` callback's sign-in pass in `apps/ipx-ops/src/server/auth/config.ts` (the branch where `profile`/`account` are present — research.md R2, **never** the `session` callback and never on a later `jwt` call), set `token.platformUserId` on success, and **throw to refuse the sign-in** on any failure so no cookie is set (FR-010, FR-013)
- [ ] T030 [US3] Add `platformUserId?: string` to `OpsSession['user']` in `apps/ipx-ops/src/server/auth/config.ts` and copy it through in `hydrateSessionUser` beside `id`/`name`/`groups`/`roles`/`entitlements`. **Optional on the type, mandatory at the guard** — research.md R6, so the 95 existing session fixtures keep compiling without fabricated UUIDs
- [ ] T031 [US3] Enforce it in `apps/ipx-ops/src/server/auth/session-data.server.ts`: `getAuthenticatedOpsSessionData` treats a real session with no `platformUserId` as no session, and `devBypassSession` deliberately carries none (ADR-0014's `ENVIRONMENT` guard decides which case applies)

**Checkpoint**: a real session always carries a platform user id, and the outbound token still carries the provider subject (T016 still passes).

---

## Phase 6: User Story 4 — entry is refused when it cannot be proven (Priority: P2)

**Goal**: every unprovable entry ends outside the portal with words an operator can act on, and
every outcome is recorded without anything sensitive in it.

**Independent Test**: each refusal in quickstart.md Scenario 3 ends outside the portal with the
right message, and the logs carry no token, code, secret or email.

### Tests first (RED)

- [ ] T032 [P] [US4] Write failing tests for the refusal surface in `apps/ipx-ops/src/routes/-sign-in.test.ts`: with no `error` search param `/sign-in` still redirects to `signInOAuth` with the normalised `callbackUrl` (today's behaviour, unchanged); with each of `domain_refused`, `provider_unavailable`, `callback_rejected`, `identity_unavailable`, `access_not_available` it **renders** and shows exactly the mapped text from research.md R7's table — and **no** provider name, configuration value, internal error text or reason code reaches the page (FR-016)
- [ ] T033 [P] [US4] Write failing tests in `apps/ipx-ops/src/server/auth/config.test.ts` for the refusal mapping: Auth0 `access_denied` → `domain_refused`; a discovery or token-exchange failure → `provider_unavailable`; a state-mismatched, replayed or late callback → `callback_rejected`; svc-identity `user_disabled` → `access_not_available`; **every other** svc-identity failure → `identity_unavailable`
- [ ] T034 [P] [US4] Write failing tests for the sign-in outcome record in `apps/ipx-ops/src/server/auth/config.test.ts` covering data-model.md E4: the fields `auth.provider`, `auth.outcome`, `auth.refusal`, `identity.resolve`, `identity.duration_ms` and the correlation id are present as specified; **no access token, id token, authorisation code, client secret, email or `name` appears in any log argument or Sentry event** (**AC-12**, SC-009); `domain_refused` and `user_disabled` raise **no** Sentry event while every other refusal raises exactly one
- [ ] T035 [P] [US4] Write failing Playwright specs in `apps/ipx-ops/e2e/auth0-refusals.spec.ts` tagged `@AC-4`, `@AC-5`, `@AC-6`: a stub account outside `ipxos.ai`; svc-identity stopped; svc-identity answering `403 user_disabled`; svc-identity held past 3 s; the stub stopped; a replayed callback URL. Each ends outside the portal with the mapped message and sets no session cookie

### Implementation (GREEN)

- [ ] T036 [US4] Render the refusal state in `apps/ipx-ops/src/routes/sign-in.tsx`: `validateSearch` gains the closed `error` union; `beforeLoad` throws `redirect()` **only** when `error` is absent; the component renders the mapped text for each reason, with the existing `removeQueries` session-cache clear kept on the redirect path (IPX-1218/IPX-1295)
- [ ] T037 [US4] Map every failure to its reason code and redirect to `/sign-in?error=<reason>` from the `jwt`/`signIn` callbacks and the Auth0 error path in `apps/ipx-ops/src/server/auth/config.ts`, collapsing the five svc-identity failure reasons into `identity_unavailable` and keeping `user_disabled` distinct as `access_not_available`
- [ ] T038 [US4] Add the structured sign-in outcome record to `apps/ipx-ops/src/server/auth/config.ts` via `#/lib/logger` and the existing BFF correlation id: one line per admission or refusal with the data-model.md E4 fields, Sentry on the unexpected paths only, and nothing sensitive in either — reuse `logAuthClaims`'s count-not-content discipline
- [ ] T039 [US4] Surface `retryAfterSeconds` in the `identity_unavailable` message as approximate minutes, in words only, and assert in `apps/ipx-ops/src/server/auth/platform-user.server.test.ts` that no second request is made

**Checkpoint**: every path in the sequence diagram's refusal section behaves as drawn, and the logs are clean.

---

## Phase 7: User Story 5 — tell the two portals apart, and withdraw the parallel one (Priority: P3)

**Goal**: an operator always knows which portal they are on, and an administrator can verify and
withdraw the parallel one without touching the current one.

**Independent Test**: an administrator who did not deploy it runs the checklist end to end, every
item passes, then withdraws the release and confirms the current portal is healthy and unchanged.

### Tests first (RED)

- [ ] T040 [P] [US5] Write a failing test in `apps/ipx-ops/src/components/shell/portal-provider-marker.test.tsx`: the marker renders when the resolved provider id is `auth0` and renders **nothing** when it is `authentik` — driven by the provider id, never by a separate flag or an `ENVIRONMENT` check (research.md R9, both portals share one environment)
- [ ] T041 [P] [US5] Write a failing Playwright spec `apps/ipx-ops/e2e/auth0-portal-marker.spec.ts` tagged `@AC-13`: the marker is present on the landing screen and on a sample of screens from each workspace, and absent on the Authentik arm

### Implementation (GREEN)

- [ ] T042 [US5] Create `apps/ipx-ops/src/components/shell/portal-provider-marker.tsx` — a persistent, non-dismissable marker reading "Auth0 portal", following `build-stamp.tsx`'s shape as the existing precedent for a permanent shell marker
- [ ] T043 [US5] Mount it once in `apps/ipx-ops/src/components/shell/workspace-shell.tsx` (the chrome that mounts once, ADR-0041), so every screen carries it with no per-route wiring (**AC-13**)

### Delivery (not deployed until the developer approves — plan.md Delivery constraints)

- [ ] T044 [US5] Add the second Helm release `web-ipx-ops-auth0` to `dev-ipxosai-services/values-dev.yaml` (`ipx-cd`): the **same** image repository and tag as `web-ipx-ops`, its own `virtualService.host`, its own `env:` block with `AUTH_PROVIDER=auth0` plus the four `AUTH_AUTH0_*` keys and `SVC_IDENTITY_API_URL`, its own Infisical secret reference, its own `AUTH_SECRET`, and **a distinct Auth.js session cookie name** — the two must share no session store, cookie name, callback address or provider registration (FR-003, data-model.md E5)
- [ ] T045 [US5] Register the parallel portal's callback `https://<its host>/api/auth/callback/auth0` on the Auth0 application chosen in T004, and provision its secrets under their own Infisical `/web-ipx-ops` keys, separate from the current portal's (FR-019). Depends on the `ipxos-dev` tenant existing — **IPX-9497**, held until deployment approval
- [ ] T046 [US5] Write the deployment-and-verification checklist and the withdrawal procedure at `specs/003-ops-portal-auth0/runbook.md`, covering FR-001–FR-019 and FR-024–FR-027, runnable by an administrator who did not perform the deployment, and including the screen sweep of T047 and the "delete this release only" withdrawal (FR-020, **AC-14**)
- [ ] T047 [US5] Run the FR-025 screen sweep on the parallel portal and record **every** screen in the T046 checklist as working, or refused with its reason. The cohort-gated and system-operator-gated screens (hierarchy read and write, the retention/compliance screen, the CRM cases/case/run/calendar screens) are expected to show their existing plain-words notice **pending IPX-9502** — recorded as refused, not as a defect, and never left unverified or showing empty data as if it were real (**AC-11**)
- [ ] T048 [US5] Have someone who did not deploy it run the T046 checklist end to end, then withdraw the release and confirm the current portal is healthy with no change and no redeploy, within SC-007's 15 minutes (**AC-14**)

**Checkpoint**: two portals run side by side, distinguishable at a glance, and the parallel one is withdrawable.

---

## Phase 8: Polish & cross-cutting concerns

- [ ] T049 [P] Run the full quickstart Scenario 1–3 sequence from a clean clone and confirm `specs/003-ops-portal-auth0/quickstart.md` is accurate command-for-command (constitution Principle VIII, FR-021, **AC-10**)
- [ ] T050 [P] Update `apps/ipx-ops/CONTEXT.md` and `apps/ipx-ops/README.md`: the provider is selected by `AUTH_PROVIDER`, the session carries `platformUserId` beside `user.id`, and the README's `OPS_SYSTEM_OPERATOR_SUBS` paragraph names that those values are **provider subjects** on either arm — not platform user ids (the correction IPX-9502 now depends on)
- [ ] T051 [P] Update `docs/services/ipx-ops.md` (`ipx-cd`) from design to as-built once the code PR merges: §1 the review row, §6.1 the svc-identity row's client and timeout as shipped, §8.1/§8.2 the keys as shipped, §13 the two failure rows, §19 the change-log entry. Lands as a separate doc PR, as PR #2199 did
- [ ] T052 [P] Correct the dead `ipx-ops ADR-0040` citations in `specs/001-ops-auth0-tenants/plan.md` and `specs/001-ops-auth0-tenants/data-model.md` to `ipx-ops ADR-0051` — the file they name does not exist on `ipx` `main`, and 0040 is the Standard-UX ADR (discuss finding F1, owner of **IPX-9497**)
- [ ] T053 [P] Update the Open Questions section of `specs/003-ops-portal-auth0/spec.md`: the governance question is answered (ADR-0051 and decisions D1–D5), and the dev-officer / dev-persona question is traced — see T054
- [ ] T054 Trace the two dev-only paths that reference the current provider's actor form against an Auth0 session and record the outcome in `specs/003-ops-portal-auth0/research.md`: the dev-officer switch (`apps/ipx-ops/src/lib/dev-officer.ts`, which overrides `session.user.id` with a seeded `did:authentik:<id>` subject) and the `dev_persona` actor type (`apps/ipx-ops/src/server/service-token.server.ts`). Both are fenced to the `AUTH_BYPASS` posture, so neither should reach an Auth0 session — **verify rather than assume** (the spec's own third Open Question)
- [ ] T055 [P] Verify **IPX-9501** is already satisfied by `apps/ipx-ops/src/server/service-token.server.ts` reading `process.env.FACTORY_TOKEN_ISSUER` independently of the login provider (IPX-2123), and close it rather than building it — **IPX-9504** lists it as a blocker (discuss finding F2)
- [ ] T056 Record the FR-026 weakness in `specs/003-ops-portal-auth0/research.md`: writes from the parallel portal are distinguishable only by the **shape** of the actor subject (Auth0 vs Authentik), not by an explicit marker, and the same human reads as two different actors across the two portals — so "is this mine" checks (`product-factory-approval-data.server.ts`, `hierarchy-copy.ts`, `actor-label.ts`) see another person's rows on the other portal. Name it, and name **IPX-9503** as needing re-scoping around it
- [ ] T057 Post the `**[Speckit] /speckit-implement — <date>**` comment on IPX-9500 at each completed task phase (constitution Principle VII), naming what was produced, what changed and what is next

---

## Dependencies & execution order

### Phase dependencies

- **Phase 1 (Setup)**: no dependencies. T003 and T004 are the developer's gates and do not block Phase 2
- **Phase 2 (Foundational)**: depends on T001 (branch) and T002 (keys). **Blocks every user story**
- **Phase 3 (US2)**: depends on Phase 2. Deliberately first of the stories
- **Phase 4 (US1)**: depends on Phase 2. T020 is shared groundwork for US4
- **Phase 5 (US3)**: depends on Phase 4 (there must be an Auth0 sign-in before there is anything to resolve)
- **Phase 6 (US4)**: depends on Phase 5 for the svc-identity refusals (T037, T039) and on T020 for the error page; the Auth0-side refusals (T033's first three rows, T035's provider rows) need only Phase 4
- **Phase 7 (US5)**: the marker (T040–T043) depends only on Phase 2; the delivery tasks (T044–T048) depend on **every** story, on T004, and on **IPX-9497** and **IPX-9499**
- **Phase 8 (Polish)**: T049 depends on Phases 2–6; T051 depends on the code PR merging; T052, T053, T055, T056 are independent and can run at any time

### Story dependencies

- **US2 (P1)** — independent. Proves the absence of change; needs no Auth0 arm to work
- **US1 (P1)** — independent of US2
- **US3 (P2)** — **depends on US1**. Not independently testable before it: there is no sign-in to bind
- **US4 (P2)** — partially depends on US3 (the svc-identity refusal rows). Its Auth0-side and configuration rows stand alone
- **US5 (P3)** — the marker is independent; the delivery half depends on all of the above plus two external tickets

### Within each story

Tests are written and **fail** before the implementation that makes them pass (Principle IX,
RED → GREEN, recorded by `ipx-fix`). Configuration before providers; the client before its caller;
the session shape before the guard that enforces it.

### Parallel opportunities

- **Phase 1**: T002–T006 all parallel (different files, different repos)
- **Phase 2**: T007 ∥ T008 (RED); then T012 ∥ T013 after T009
- **Phase 3**: T015 ∥ T016 ∥ T017 after T014
- **Phase 4**: T018 ∥ T019 (RED)
- **Phase 5**: T024 ∥ T025 ∥ T026 ∥ T027 (RED)
- **Phase 6**: T032 ∥ T033 ∥ T034 ∥ T035 (RED)
- **Phase 7**: T040 ∥ T041 (RED)
- **Phase 8**: T049 ∥ T050 ∥ T051 ∥ T052 ∥ T053 ∥ T055
- **Across stories**: once Phase 2 lands, US2, US1 and US5's marker can proceed in parallel. US3 and US4 are a sequence

### Same-file contention (do **not** parallelise)

`apps/ipx-ops/src/server/auth/config.ts` is touched by T010, T011, T020, T021, T022, T029, T030,
T037, T038 — nine tasks, one file, **sequential**. Its test file
(`config.test.ts`) is touched by T008, T015, T018, T033, T034 — parallel only across different
`describe` blocks, and T015's AC-8 assertions must not be edited by the later tasks.

---

## Parallel example: User Story 3 (RED phase)

```bash
# Launch all four failing-test tasks together — four different files:
Task: "T024 svc-identity client response mapping in apps/ipx-ops/src/server/auth/platform-user.server.test.ts"
Task: "T025 svc-identity client request shape in apps/ipx-ops/src/server/auth/platform-user.server.test.ts"
Task: "T026 session guard in apps/ipx-ops/src/server/auth/session-data.server.test.ts"
Task: "T027 @AC-2 repeat sign-in in apps/ipx-ops/e2e/auth0-sign-in.spec.ts"
```

(T024 and T025 share a file — run them as one unit or in sequence.)

---

## Implementation strategy

### MVP

**Phase 1 + Phase 2 + Phase 3 (US2) + Phase 4 (US1)** — an operator signs in through Auth0 on a
second deployment, and the current portal is provably untouched. That is the smallest increment
worth showing, and it is demonstrable against the local stub **before** the Auth0 tenants exist.

US3 is what makes the feature worth doing rather than a change of sign-in screen, so it follows
immediately; but it cannot be demonstrated without a reachable svc-identity.

### Incremental delivery

1. Setup + Foundational → one build, two arms, nothing behaviourally different
2. **+ US2** → the no-regression claim is evidence, not assertion
3. **+ US1** → sign-in works on the Auth0 arm (**MVP**)
4. **+ US3** → the session is bound to a platform user
5. **+ US4** → every refusal is honest and recorded
6. **+ US5** → two portals, distinguishable and withdrawable → deploy **only** on the developer's explicit approval

### What is blocked outside this plan

| Blocked on | What it blocks | Status |
|---|---|---|
| **IPX-9497** — Auth0 tenants created, parallel callback registered | T045, and the real-tenant half of T023/T047/T048 | held until deployment is approved |
| **IPX-9499** — svc-identity deployed in dev | T047, T048 in a deployed environment | In Progress |
| **G-VIII-a** — the `AUTH_BYPASS` constitution gate | nothing technically; the plan's compliance claim | needs the developer |
| **R8** — which Auth0 application | T045's secret count | needs IPX-9497's owner |
| **IPX-9502** — the real cohort/system-operator source | the gated screens in T047's sweep | Backlog, **needs re-scoping** (its premise changed) |

---

## Notes

- **Every code task lands through `/ipx-fix`, test-first** (constitution Principle III and IX). No
  task here authorises a hand edit to a service repository
- `[P]` means different files and no dependency on an incomplete task — check the same-file
  contention list above before launching any pair
- Every task belongs to **IPX-9500** unless its line names another ticket (T045 → IPX-9497,
  T052 → IPX-9497, T055 → IPX-9501)
- Nothing is merged or deployed until the developer explicitly approves it, including the parallel
  deployment itself
