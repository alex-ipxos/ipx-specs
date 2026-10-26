# Tasks: Ops Portal identity provider tenants

**Input**: Design documents from `specs/001-ops-auth0-tenants/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Linear**: every task belongs to [IPX-9497](https://linear.app/ipxos-ai/issue/IPX-9497) unless it
says otherwise (constitution Principle VII).

**Tests**: Required. FR-015 needs automated tests for the Action, and `ipx-fix` works test-first
(RED commit before GREEN).

**Organization**: Tasks are grouped by user story so each story can be built and checked on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: the user story the task serves (US1 to US4, from spec.md)
- **HELD**: changes live configuration (Auth0 tenants, Infisical) or merges a PR. It does not start
  until the developer explicitly approves deployment (plan.md "Delivery constraints"). Every
  non-HELD task stops at commits on a branch, or at an open, unmerged PR.

## Rules for every task

- Paths are relative to the `ipx-specs` root. `repos/ipx` is the `ipxos-ai/ipx` worktree on
  `feat/ipx-9497-auth0-tenants`. `repos/ipx-cd` is the `ipxos-ai/ipx-cd` worktree on
  `docs/ipx-9497-auth0-tenants`.
- Any change under `repos/ipx/apps/ipx-ops/` other than evidence and the design docs is made **only
  through `ipx-fix`** (constitution Principle III). Run `ipx-*` turns from
  `repos/ipx/apps/ipx-ops`.
- Never commit to `main`. Never merge. Never dispatch `publish-*`, `release`, `prerelease` or
  `image-update` workflows.
- Commit subjects follow Conventional Commits with a lowercase subject (`.husky/commit-msg`). Stage
  files by name, never with `git add -A`.

---

## Phase 1: Setup (shared)

**Purpose**: Make the worktree runnable and bring the governance workflow up to the `fix` turn.

- [ ] T001 Confirm the worktrees: `git -C repos/ipx branch --show-current` prints
  `feat/ipx-9497-auth0-tenants`, `git -C repos/ipx-cd branch --show-current` prints
  `docs/ipx-9497-auth0-tenants`, and `git -C . check-ignore repos/ipx repos/ipx-cd` lists both
  (IPX-9497)
- [ ] T002 Switch to Node 24.22.1 (`repos/ipx/.nvmrc`; local Node is 22.15.0 today), then run
  `pnpm install --frozen-lockfile` in `repos/ipx` (IPX-9497)
- [ ] T003 Prove the baseline is green before any change: `pnpm --filter ipx-ops test` in
  `repos/ipx` passes. Record the pass or fail count in the IPX-9497 progress comment (IPX-9497)
- [ ] T004 From `repos/ipx/apps/ipx-ops`, run `/ipxos-skills:ipx-status`. It must resolve the task as
  `IPX-9497` with evidence root `apps/ipx-ops/.planning` (pointer source `pointer-keyed`). Then run
  `/ipxos-skills:ipx-next` through the turns before `fix` (`design` if derived, `branch`,
  `readiness`, `plan` as the orchestrator derives them). `ipx-branch` owns the Linear move to In
  Progress. Spec Kit does not make it (IPX-9497)

**Checkpoint**: The worktree builds and tests, and the orchestrator's next turn is `fix`.

---

## Phase 2: Foundational (blocking)

**Purpose**: The README section every story writes into, and the Action's home.

- [ ] T005 Via `ipx-fix`: in `repos/ipx/apps/ipx-ops/README.md`, add an `## Auth0 setup` section
  **above** the existing `## Authentik setup` section, and leave the Authentik section unchanged
  (FR-013: Authentik stays in use until IPX-9500/IPX-9504). Open it with one paragraph: Auth0
  authenticates only and grants no roles (TRU.IAM.R63); the tenants are hand-configured (ADR-0040
  decision 1); the production tenant is IPX-9504's. Add empty sub-headings in this order:
  `### Tenants`, `### Google Workspace connection`, `### svc-identity API`, `### ipx-ops application`,
  `### Restrict to ipxos.ai Action`, `### Secrets`, `### Verification checklist`, `### Runbooks`
  (IPX-9497)
- [ ] T006 Via `ipx-fix`: create the directory `repos/ipx/apps/ipx-ops/auth0/actions/`, with a short
  `repos/ipx/apps/ipx-ops/auth0/README.md`. It states that these files are the exact source pasted
  into each Auth0 tenant, are changed only through `ipx-fix`, and that each tenant's deployed copy
  must match byte for byte (FR-015) (IPX-9497)

**Checkpoint**: The README skeleton and the Action directory exist on the branch.

---

## Phase 3: User Story 1 — An ipxos.ai operator signs in (P1) 🎯 MVP

**Goal**: An administrator can create a tenant in which an ipxos.ai operator completes sign-in to the
Ops Portal.

**Independent Test**: The README alone is enough to stand up a tenant (SC-006). Once live (HELD), an
ipxos.ai operator signs in to the dev and staging portals in under a minute (SC-001).

### Implementation for User Story 1

- [ ] T007 [US1] Via `ipx-fix`, fill `### Tenants` in `repos/ipx/apps/ipx-ops/README.md` from
  data-model.md. State the setup order explicitly: create the tenant, Workspace connection, API and
  application with **no** connection enabled for the application; deploy, bind and diff the Action;
  only then enable the Workspace connection for ipx-ops (analysis S1). Also cover:
  - names `ipxos-dev` / `ipxos-stg`;
  - "region: AU — Fixed at creation; the domain ends `.au.auth0.com`";
  - set **Enable Application Connections: off** (Settings > Advanced) **before** creating any
    application (research R2);
  - keep the default session lifetimes and write the observed idle and maximum values into the
    checklist (D6, research R3);
  - no custom domain (IPX-9497)
- [ ] T008 [US1] Via `ipx-fix`, fill `### Google Workspace connection` in
  `repos/ipx/apps/ipx-ops/README.md`:
  - In Google Cloud, create one OAuth client per tenant. Authorised redirect URI
    `https://<tenant>.au.auth0.com/login/callback`, JavaScript origin `https://<tenant>.au.auth0.com`.
    Enable the Admin SDK API. Add `auth0.com` to the consent screen's authorised domains.
  - In Auth0, create a Google Workspace enterprise connection with "Google Workspace domain:
    `ipxos.ai`", enabled for ipx-ops only.
  - On `Username-Password-Authentication`, turn on **Disable Sign Ups** and enable it for no
    application.
  - Disable `google-oauth2`, or enable it for no application.
  - State plainly that the domain field alone does not refuse other Google accounts, which is why the
    Action exists (research R1).

  (IPX-9497)
- [ ] T009 [US1] Via `ipx-fix`, fill `### ipx-ops application` in `repos/ipx/apps/ipx-ops/README.md`:
  - type Regular Web Application;
  - dev callbacks `https://ops.ipxos.dev/api/auth/callback/auth0` and
    `https://ipx-ops.localhost/api/auth/callback/auth0`; staging callback
    `https://ops.ipxos.app/api/auth/callback/auth0`;
  - logout URLs and web origins are the matching app roots, with no other entries;
  - enabled connections: "exactly one: the ipxos.ai Google Workspace connection";
  - the callback path is the Auth.js `auth0` provider path that IPX-9500 adopts.

  (IPX-9497)

### Live configuration for User Story 1 (HELD — deployment approval required)

- [ ] T010 [US1] HELD. Operator: create tenant `ipxos-dev` in AU and follow T007 to T009, then create
  `ipxos-stg` the same way, with one exception. **Leave the ipx-ops application with no connection
  enabled.** Create the Workspace connection but do not enable it for ipx-ops; T016 does that after
  the Action is bound and verified. With no connection, nobody can sign in, so no Google account can
  get through before the Action exists. Do not write secrets in this task (IPX-9497)

**Checkpoint**: The README covers tenant, connection and application setup (all repo work for US1 is
done). After T010 the tenants exist but nobody can sign in, because the application has no connection.
US1 goes live at T016, once the Action is bound and verified, and is proven with US2's T017 and T018.

---

## Phase 4: User Story 2 — Nobody outside ipxos.ai can get in or create an account (P1)

**Goal**: A tested deny-only Action, and setup steps that make self-registration impossible.

**Independent Test**: `pnpm --filter ipx-ops exec vitest run auth0/actions` passes every contract case.
Once live (HELD), a personal Google account is refused with `error=access_denied`, and a database
sign-up attempt is refused (SC-002).

### Tests for User Story 2 (write first, must fail) ⚠️

- [ ] T011 [US2] Via `ipx-fix` (RED commit): create
  `repos/ipx/apps/ipx-ops/auth0/actions/restrict-to-ipxos-domain.test.ts` with
  `// @vitest-environment node` on line 1. Load the source with
  `createRequire(import.meta.url)('./restrict-to-ipxos-domain.cjs')`. Build a fake `event`
  (`{ user: { idp_tenant_domain } }`) and a spy `api` whose every member (`access.deny`,
  `idToken.setCustomClaim`, `accessToken.setCustomClaim`, `user.setAppMetadata`,
  `user.setUserMetadata`, `multifactor.enable`, `redirect.sendUserTo`) is a `vi.fn()`. Assert, per
  [contracts/restrict-to-ipxos-domain-action.md](contracts/restrict-to-ipxos-domain-action.md):
  - **A1**: `'ipxos.ai'` → `access.deny` not called, and no `api` member called.
  - **D1**: each of `'example.com'`, `'IPXOS.AI'`, `'sub.ipxos.ai'`, `'ipxos.ai.evil.com'` →
    `access.deny` called exactly once, with a string reason that contains none of the input.
  - **D2**: missing key, `null`, `undefined`, `''` → `access.deny` called exactly once.
  - **All cases**: no `api` member other than `access.deny` is ever called.

  Run it and confirm it fails because the source file does not exist (IPX-9497)

### Implementation for User Story 2

- [ ] T012 [US2] Via `ipx-fix` (GREEN commit): create
  `repos/ipx/apps/ipx-ops/auth0/actions/restrict-to-ipxos-domain.cjs`:
  - CommonJS, about 10 lines, no `require`, no network, no logging of user data.
  - `exports.onExecutePostLogin = async (event, api) => { if (event.user.idp_tenant_domain !== 'ipxos.ai') { api.access.deny('<fixed reason>'); } };`
  - The fixed reason is plain words with no user data, e.g. `'Only ipxos.ai accounts can sign in to IPX Ops.'`.
  - A header comment cites ADR-0040 decision 5 and TRU.IAM.R63, and says the file is pasted verbatim
    into each tenant.

  T011 passes (IPX-9497)
- [ ] T013 [US2] Run the whole `ipx-ops` gate in `repos/ipx`:
  - `pnpm --filter ipx-ops test`: no regressions against T003.
  - `pnpm --filter ipx-ops typecheck`.
  - Formatting: `oxfmt` via lint-staged on commit.

  Fix anything the new files break, through `ipx-fix` (IPX-9497)
- [ ] T014 [US2] Via `ipx-fix`, fill `### Restrict to ipxos.ai Action` in
  `repos/ipx/apps/ipx-ops/README.md`:
  1. Actions > Library > Build Custom, Login / Post Login trigger, Node 22, name
     `Restrict to ipxos.ai`.
  2. Paste the full contents of `auth0/actions/restrict-to-ipxos-domain.cjs`, with no edits. No
     secrets and no dependencies.
  3. Deploy it.
  4. Actions > Flows > Login: make it the **only** Action in the flow, then Apply.

  State that any change goes through `ipx-fix` first and is then re-pasted (IPX-9497)

### Live configuration for User Story 2 (HELD — deployment approval required)

- [ ] T015 [US2] HELD. Operator: in each tenant, create, deploy and bind the Action per T014 (IPX-9497)
- [ ] T016 [US2] HELD. In each tenant, run the deployed-code check: copy the code from the Auth0
  editor to `/tmp/deployed.cjs`, then
  `diff /tmp/deployed.cjs repos/ipx/apps/ipx-ops/auth0/actions/restrict-to-ipxos-domain.cjs`. It prints
  nothing (failure mode 13). Only then, in the same tenant, enable the ipxos.ai Workspace connection
  for the ipx-ops application (Applications > ipx-ops > Connections), and confirm it is the only
  enabled connection. This is the first moment anyone can sign in to that tenant (IPX-9497)
- [ ] T017 [US2] HELD. In each tenant, probe with a personal Google account. The callback carries
  `error=access_denied` and no `code`, and Monitoring > Logs shows a failed login with the Action's
  reason (failure mode 1) (IPX-9497)
- [ ] T018 [US2] HELD. In each tenant, run the quickstart step 5 sign-up probe
  (`POST https://<tenant>.au.auth0.com/dbconnections/signup` with the ipx-ops client id and connection
  `Username-Password-Authentication`). It is refused, and Logs shows a failed sign-up (failure
  mode 2). US1 and US2 are live together only after this passes (IPX-9497)

**Checkpoint**: The Action is tested on the branch. Once T015 to T018 run, outsiders are provably
refused.

---

## Phase 5: User Story 3 — svc-identity can trust what the provider issues (P2)

**Goal**: The API registration and the secrets svc-identity and ipx-ops need, documented so that the
token matches [contracts/access-token-for-svc-identity.md](contracts/access-token-for-svc-identity.md).

**Independent Test**: Once live (HELD), a token obtained with `audience=svc-identity` has `alg`
RS256, `aud` containing `svc-identity`, `iss` equal to the discovery issuer, and no permission or role
claims (SC-004). The four stored issuer values match byte for byte (SC-005).

### Implementation for User Story 3

- [ ] T019 [P] [US3] Via `ipx-fix`, fill `### svc-identity API` in `repos/ipx/apps/ipx-ops/README.md`:
  - "identifier (audience): `svc-identity`" and "signing algorithm: RS256" (one value in both tenants;
    the issuer, not the audience, tells environments apart);
  - Enable RBAC off, Add Permissions in the Access Token off, Allow Offline Access off;
  - no Actions or rules add claims (TRU.IAM.R63).

  (IPX-9497)
- [ ] T020 [P] [US3] Via `ipx-fix`, fill `### Secrets` in `repos/ipx/apps/ipx-ops/README.md` with the
  data-model.md table:
  - `/web-ipx-ops`: client id, client secret and issuer.
  - `/svc-identity`: issuer and audience `svc-identity`, with "**no** client credentials".
  - The issuer is copied from the tenant's `/.well-known/openid-configuration` `issuer` field, "byte
    exact", trailing slash included (ADR-0040 decision 8).
  - Variable names are set by IPX-9500 (ipx-ops) and IPX-9498 (svc-identity), so mark them as
    pending rather than inventing them.

  (IPX-9497)

### Live configuration for User Story 3 (HELD — deployment approval required)

- [ ] T021 [US3] HELD. Operator: in each tenant, create the API per T019 (IPX-9497)
- [ ] T022 [US3] HELD. Operator: write the Infisical entries for dev and staging per T020. Then run
  quickstart step 7: all four issuer values equal the step 1 issuer byte for byte, and
  `/svc-identity` holds no client id or secret (failure mode 5) (IPX-9497)
- [ ] T023 [US3] HELD. In each tenant, sign in as an ipxos.ai operator with `audience=svc-identity` and
  run quickstart step 6 on the access token: `alg`=`RS256`, `aud` ∋ `svc-identity`, `iss` = the
  discovery issuer, and no `permissions`, `roles`, `groups` or custom claims (IPX-9497)

**Checkpoint**: svc-identity (IPX-9498) has everything it needs to verify tokens itself, once live.

---

## Phase 6: User Story 4 — An administrator can check each environment (P2)

**Goal**: A checklist and runbooks in the README that catch drift and guide recovery.

**Independent Test**: An administrator who did not do the setup runs the README checklist against a
tenant and every item passes. Switching on an extra connection makes the connections item fail
(SC-003).

### Implementation for User Story 4

- [ ] T024 [US4] Via `ipx-fix`, fill `### Verification checklist` in `repos/ipx/apps/ipx-ops/README.md`
  by transcribing [quickstart.md](quickstart.md) steps 1 to 7 as checkbox items, with each item's
  failure-mode number from ADR-0040 (1, 2, 3, 5, 12, 13). End with "Record the date, tenant and checker
  on IPX-9497 (or the tenant's ticket)". The README copy is the one maintained from now on (IPX-9497)
- [ ] T025 [US4] Via `ipx-fix`, fill `### Runbooks` in `repos/ipx/apps/ipx-ops/README.md` with
  ADR-0040's runbooks:
  - **R1, logins fail on a tenant**: filter the logs on the Workspace connection, then check or rotate
    that tenant's Google OAuth client.
  - **R2, ipx-ops client secret exposed**: rotate it in Auth0, update `/web-ipx-ops`, then redeploy
    once deployment is allowed.
  - **R3, an operator leaves**: suspend the Workspace account, then block the user in each tenant
    (the accepted risk until TRU.IAM.R63 AC4).

  Link ADR-0040 (IPX-9497)

### Live configuration for User Story 4 (HELD — deployment approval required)

- [ ] T026 [US4] HELD. An administrator who did not do the setup runs the README checklist against
  `ipxos-dev` and `ipxos-stg`. Record PASS (or the failing items) with date, tenant and checker on
  IPX-9497 (IPX-9497)

**Checkpoint**: The README is the complete operator guide. After T026, both tenants are proven.

---

## Phase 7: Polish & cross-cutting

- [ ] T027 [P] Via `ipx-fix` (constitution Principle III): reconcile
  `repos/ipx/apps/ipx-ops/docs/adr/0040-auth0-tenants-for-ipx-ops-hand-configured-google-workspace-au-region.md`,
  `repos/ipx/apps/ipx-ops/docs/sequences/ipx-9497-auth0-login.md` and
  `repos/ipx/apps/ipx-ops/docs/architecture/ipx-9497-system-architecture.md` against the finished
  README and Action, and commit them on `feat/ipx-9497-auth0-tenants`. They are the
  `design.same_repo_docs`, and they still carry the uncommitted `/speckit-plan` amendments (ADR-0040
  decisions 4, 5 and 9, failure modes 1, 9 and 13, sequence failure 1), which this turn commits. Also add
  "Allow Offline Access: off" to ADR-0040 decision 7, to match data-model.md (IPX-9497)
- [ ] T028 [P] Check that `repos/ipx-cd/docs/services/ipx-ops.md` (PR ipxos-ai/ipx-cd#1639) still
  matches the final design. Any fix is a new commit on `docs/ipx-9497-auth0-tenants`. **Do not merge
  #1639** (IPX-9497)
- [ ] T029 Local Ops Portal regression run (FR-013: the portal is unchanged and still signs in through
  Authentik). In `repos/ipx`, run `pnpm dev:ipx-ops` and open `https://ipx-ops.localhost` (portless).
  1. With `AUTH_BYPASS=1` in `apps/ipx-ops/.env.local`, the dev picker loads and `/products` renders.
  2. With `AUTH_BYPASS=0` and the existing Authentik settings, sign-in still goes to Authentik and
     returns to `https://ipx-ops.localhost/api/auth/callback/authentik`.
  3. Run `pnpm --filter ipx-ops test:e2e` (Playwright) locally, and it passes as on `main`.

  Record the results (pass counts, a screenshot of the signed-in portal) in the IPX-9497 progress
  comment. Never commit `.env.local` (IPX-9497)
- [ ] T030 Run the remaining non-deploying governance turns from `repos/ipx/apps/ipx-ops` via
  `/ipxos-skills:ipx-next`: `audit`, `verify-qa`, `pr`. `pr` pushes `feat/ipx-9497-auth0-tenants` and
  opens the PR. It moves Linear to In Review. Stop before `merge`: do **not** run `ipx-merge`, merge
  the PR, or dispatch any workflow (IPX-9497)
- [ ] T031 Post the `[Speckit] implement` progress comment on IPX-9497: completed task IDs, commit
  SHAs on `feat/ipx-9497-auth0-tenants`, the PR link, the T003/T013/T029 results, and "HELD: T010,
  T015–T018, T021–T023, T026, T032 and both merges await deployment approval". If the Action or
  token contract changed during implementation, post a short note on IPX-9498 and IPX-9500 too
  (IPX-9497, IPX-9498, IPX-9500)
- [ ] T032 HELD. Local callback check against the live `ipxos-dev` tenant (proves the local
  development path in FR-003 before IPX-9500 wires the portal). With `pnpm dev:ipx-ops` running,
  open
  `https://ipxos-dev.au.auth0.com/authorize?response_type=code&client_id=<ipx-ops dev client id>&redirect_uri=https://ipx-ops.localhost/api/auth/callback/auth0&scope=openid%20profile%20email&audience=svc-identity&state=probe`
  in a browser.
  1. With an ipxos.ai account, Auth0 redirects to `https://ipx-ops.localhost/api/auth/callback/auth0?code=…&state=probe`.
     The portal itself answers with an error, which is expected: its Auth0 provider arrives in
     IPX-9500. The redirect with a `code` is the pass.
  2. With a personal Google account, the redirect carries `error=access_denied` and no `code`.
  3. A `redirect_uri` that is not registered (e.g. `https://evil.localhost/…`) is rejected by Auth0
     and never redirected.

  Record the results on IPX-9497 (IPX-9497)
- [ ] T033 HELD. After deployment approval and T026 and T032 PASS: merge the IPX-9497 PR via
  `ipx-merge`, and merge ipxos-ai/ipx-cd#1639. Note that the `ipx` merge publishes `web-ipx-ops` to dev
  (`publish-ipx-ops.yml`); its code is unchanged by this feature apart from docs and the Action
  files (IPX-9497)

---

## Dependencies & execution order

- **Phase 1 → Phase 2 → stories.** T004 must reach the `fix` turn before any `ipx-fix` task.
- **US1 (T007–T009) and US2 (T011–T014)** both depend only on Phase 2. Within US2, T011 (RED) comes
  before T012 (GREEN), then T013 and T014.
- **US3 (T019, T020)** depends only on Phase 2, and can run alongside US1 and US2. Both its tasks
  edit different README sub-sections, so they are [P] with each other. Serialise commits if one
  `ipx-fix` run is doing both.
- **US4 (T024, T025)** depends on US1 to US3's README sections being final, because it transcribes
  them.
- **Phase 7**: T027 and T028 after all stories; T029 (local portal run) after T013; T030 after T027
  and T029; T031 after T030.
- **HELD tasks**, in this order once approved: T010 → T015 → T016 → T017 → T018 → T021 → T022 → T023 →
  T026 → T032 → T033. No tenant can admit a sign-in before T016: the ipx-ops application has no
  connection enabled until the Action is bound and its deployed code matches the source.
- **The full local Ops Portal sign-in through Auth0** (the portal's own login code exchanging the
  code and landing signed in at `https://ipx-ops.localhost`) needs IPX-9500's provider change, so it
  is tracked as an acceptance criterion on IPX-9500, not here.

## Parallel opportunities

- T019 and T020 (US3) together.
- T027 and T028 (polish) together.
- US1, US2 and US3 README work can be split across people. They all edit one file
  (`repos/ipx/apps/ipx-ops/README.md`), so merge sub-sections in order.

```text
# After Phase 2:
ipx-fix: T011 → T012 → T013 → T014   (US2: the only code)
ipx-fix: T007, T008, T009            (US1 README)
ipx-fix: T019 ∥ T020                 (US3 README)
then:    T024, T025                  (US4 README)
```

## Implementation strategy

- **MVP (deliverable now, no deployment)**: Phases 1 and 2, US1 and US2 repo tasks (T001–T009,
  T011–T014). The branch then holds the tested Action and enough README to stand up a tenant that
  refuses outsiders.
- **Increment 2**: US3 and US4 README tasks (T019, T020, T024, T025), then Phase 7 up to the open PR
  (T027–T031), including the local portal regression run (T029).
- **After approval only**: every HELD task. A tenant is never reachable without the Action: its
  application gets its connection only in T016, after T015 binds the Action and T016's diff passes.

## Notes

- 33 tasks. 22 are deliverable now; 11 are HELD (T010, T015–T018, T021–T023, T026, T032, T033).
- Local testing: T003 and T013 (unit and typecheck gate), T029 (portal regression in the browser and
  Playwright, now), T032 (local callback against the dev tenant, HELD). The full local Auth0 sign-in
  is IPX-9500's.
- Linear state: `ipx-branch` (T004) → In Progress, `ipx-pr` (T030) → In Review, `ipx-merge` (T033, HELD) → Done.
  Spec Kit only comments.
