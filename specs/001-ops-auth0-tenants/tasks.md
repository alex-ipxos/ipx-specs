# Tasks: Ops Portal identity provider tenants

**Input**: Design documents from `specs/001-ops-auth0-tenants/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md),
[runbook.md](runbook.md)

**Linear**: every task belongs to [IPX-9497](https://linear.app/ipxos-ai/issue/IPX-9497) unless it
says otherwise (constitution Principle VII).

**Scope change (2026-10-29)**: the Auth0 tenants are configured **by hand**, and `ipxos-ai/ipx`
(`apps/ipx-ops`) and `ipxos-ai/ipx-cd` are **not touched** for now. The Action source, its tests and
the operator guide live in this spec folder. The `ipx-ops` README copy, the Vitest-gated Action in
`apps/ipx-ops`, the ADR-0040 commit, the LLD PR and the governance turns move to a follow-up ticket
(see Deferred). This replaces the 33-task plan of 2026-10-26 (commit `42603e8`).

## Format: `[ID] [Story] Description`

- **[Story]**: the user story the task serves (US1 to US4, from spec.md).
- **MANUAL**: you do it by hand in the Auth0 dashboard, Google Cloud or Infisical. It puts
  configuration live.

## Rules for every task

- Paths are relative to the `ipx-specs` root. No changes in `repos/ipx` or `repos/ipx-cd`. The
  uncommitted ADR-0040, sequence and architecture drafts in `repos/ipx` stay as they are.
- Never commit to `main`. Never merge or dispatch workflows in `ipx` or `ipx-cd`.
- Never write secrets into this repository or into Linear.

---

## Phase 1: Spec-side deliverables

- [x] T001 [US2] Action source `specs/001-ops-auth0-tenants/auth0/restrict-to-ipxos-domain.cjs`, per
  [contracts/restrict-to-ipxos-domain-action.md](contracts/restrict-to-ipxos-domain-action.md):
  deny-only, no `require`, no network, fixed reason with no user data (FR-014)
- [x] T002 [US2] Contract tests `specs/001-ops-auth0-tenants/auth0/restrict-to-ipxos-domain.test.cjs`
  on Node's built-in runner (A1, D1, D2, no other `api` call). Run with
  `node --test 'specs/001-ops-auth0-tenants/auth0/*.test.cjs'`: 9/9 pass (FR-015, interim home)
- [x] T003 [US1–US4] Operator guide [runbook.md](runbook.md): setup order, Action paste and diff,
  secrets, link to the [quickstart.md](quickstart.md) checklist, runbooks R1 to R3 (FR-011, interim
  home)
- [x] T004 Post a `[Speckit] scope change` comment on IPX-9497: manual Auth0 setup, ipx-ops and
  ipx-cd untouched, interim homes for FR-011 and FR-015, and the deferred list below. Update the
  ticket description to match (Principle VII) (IPX-9497)
- [x] T005 Create the follow-up Linear ticket for the Deferred items, linked to IPX-9497, IPX-9500
  and IPX-9504: [IPX-9772](https://linear.app/ipxos-ai/issue/IPX-9772) (IPX-9497)

**Checkpoint**: Everything you need to configure a tenant by hand is in this folder and tested.

---

## Phase 2: Tenant `ipxos-dev` (MANUAL, follow runbook.md)

- [ ] T006 [US1] MANUAL. Runbook steps 1 to 4: tenant in AU, Enable Application Connections off,
  Google OAuth client and Workspace connection (enabled for no app), database sign-ups disabled,
  `google-oauth2` off, `svc-identity` API, ipx-ops application with **no** connection enabled
- [ ] T007 [US2] MANUAL. Runbook step 5: create, deploy and bind `Restrict to ipxos.ai` as the only
  Login-flow Action
- [ ] T008 [US2] MANUAL. Runbook step 6: the deployed-code diff prints nothing (failure mode 13)
- [ ] T009 [US1] MANUAL. Runbook step 7: enable the Workspace connection for ipx-ops, and only it
- [ ] T010 [US2] MANUAL. Probes (quickstart step 5): an ipxos.ai account gets a `code`; a personal
  Google account gets `error=access_denied` and a failed-login log; the `dbconnections/signup` probe
  is refused (SC-001, SC-002)
- [ ] T011 [US1] MANUAL. Local callback check: open
  `https://ipxos-dev.au.auth0.com/authorize?response_type=code&client_id=<dev client id>&redirect_uri=https://ipx-ops.localhost/api/auth/callback/auth0&scope=openid%20profile%20email&audience=svc-identity&state=probe`.
  An ipxos.ai account is redirected to that URL with `code` and `state=probe` (the page itself need
  not load: the portal's Auth0 provider is IPX-9500's). A personal account gets `error=access_denied`.
  An unregistered `redirect_uri` is rejected by Auth0 (FR-003)
- [ ] T012 [US3] MANUAL. Quickstart step 6 on the access token: `alg` RS256, `aud` ∋ `svc-identity`,
  `iss` = discovery issuer, no `permissions`, `roles`, `groups` or custom claims (SC-004)

## Phase 3: Tenant `ipxos-stg` (MANUAL, follow runbook.md)

- [ ] T013 [US1] MANUAL. Repeat T006 to T010 and T012 for `ipxos-stg` (staging callback only; no
  localhost entry, so skip T011)

## Phase 4: Secrets (MANUAL)

- [ ] T014 [US3] MANUAL. Runbook step 8 for dev and staging. Variable names belong to IPX-9500 and
  IPX-9498: if they are not fixed yet, hold this task rather than invent names. Then quickstart
  step 7: four issuer values byte-equal, `/svc-identity` has no client credentials (FR-008 to
  FR-010, SC-005)

## Phase 5: Verification and record

- [ ] T015 [US4] Someone who did not do the setup runs [quickstart.md](quickstart.md) against both
  tenants (SC-003). Record PASS or the failing items, with date, tenant and checker, on IPX-9497
- [ ] T016 Post the results comment on IPX-9497 (tenants live, checklist results, session lifetimes
  observed). Tell IPX-9498 and IPX-9500 the issuer and audience are available (values in Infisical,
  never in Linear) (IPX-9497, IPX-9498, IPX-9500)

---

## Deferred ([IPX-9772](https://linear.app/ipxos-ai/issue/IPX-9772))

These were tasks in the 2026-10-26 plan. They need `ipxos-ai/ipx` or `ipxos-ai/ipx-cd` and go
through the governed workflow (`ipx-fix`, Principle III) when picked up.

- Move the Action into `apps/ipx-ops/auth0/actions/restrict-to-ipxos-domain.cjs` with a Vitest test
  (default jsdom environment; no node pragma) under `test:ci`; format and lint the `.cjs` by hand;
  add a patch changeset for `@ipx/ipx-ops`. The deployed copies must still diff clean against it.
  FR-015's "in the codebase … through the governed workflow" is met only then.
- Add the `## Auth0 setup` README section in `apps/ipx-ops` from [runbook.md](runbook.md) and
  [quickstart.md](quickstart.md). FR-011's "Ops Portal's setup documentation" is met only then.
- Commit ADR-0040 (add "Allow Offline Access: off" to decision 7), the IPX-9497 sequence and
  architecture docs.
- Re-check and merge the ipx-ops LLD, ipxos-ai/ipx-cd#1639 (left open, untouched).
- The governance turns from `repos/ipx/apps/ipx-ops`: tech-lead approval of the implementation plan
  (already posted, rev 2), `branch`, `fix`, `audit`, `verify-qa`, `pr`, `merge`.
- The local Ops Portal regression run (FR-013: Authentik unchanged). Nothing in this scope touches
  the portal, so FR-013 holds by construction until then.

## Dependencies & execution order

- T004 and T005 before Phase 2, so Linear shows the new scope first.
- Phase 2 order is strict: T006 → T007 → T008 → T009. No tenant is reachable before T009.
- Phase 3 after Phase 2 passes. T014 needs the client ids and secrets from Phases 2 and 3.
- T015 after T014. T016 last.

## Notes

- 16 tasks: 5 done (3 spec-side, 2 Linear), 11 manual. No code is deployed and no PR is opened in this scope.
- If you change the Action, change `auth0/restrict-to-ipxos-domain.cjs` first, run the tests, then
  re-paste into each tenant and re-run the diff.
