# Runbook: the parallel Auth0 Ops Portal (`web-ipx-ops-auth0`, dev only)

**Feature**: [spec.md](./spec.md) · **Quickstart**: [quickstart.md](./quickstart.md) ·
**Auth0 setup**: [auth0-application-setup.md](./auth0-application-setup.md) · **Decisions**: ipx-ops
ADR-0052

This runbook is the deployment-and-verification checklist of FR-020 (tasks T046 and T064). An
administrator who did not perform the deployment can run it. It holds:

1. [Before anything goes live](#1-before-anything-goes-live): the three human sign-offs and the order they come in.
2. [The deployment](#2-the-deployment-t063-t044-t067): build, the ipx-cd PR and approval.
3. [The verification checklist](#3-verification-checklist-fr-001fr-019-fr-024fr-027): FR-001–FR-019 and FR-024–FR-027.
4. [The screen sweep](#4-screen-sweep-fr-025-ac-11-t047): FR-025, AC-11 (T047).
5. [Withdrawal](#5-withdrawal-fr-004-ac-14-t048): FR-004, AC-14 (T048).
6. [Refresh](#6-refresh-t064): bringing the parallel portal up to date with `main` (T064).
7. [Sign-off record](#7-sign-off-record): the comment format for IPX-9500.

**Rules that hold throughout**

- The current portal, `web-ipx-ops`, is never changed, restarted or redeployed. No step here edits a line of its release.
- The feature branch `feat/ipx-9500-ops-portal-auth0` is **never merged to `main`** while both portals run (FR-028, ADR-0052 decision 10). The parallel image is built from the branch.
- `[HUMAN]` steps are carried out and signed off by a person. An agent never runs or ticks them.
- Never paste a client secret, `AUTH_SECRET`, token or authorisation code into a comment, a PR, a log excerpt or this file.

---

## 1. Before anything goes live

The order, from tasks.md Phase 7. Each `[HUMAN]` step blocks everything after it until its sign-off
comment on IPX-9500 says **PASS**.

| # | Step | Who | Gate |
|---|---|---|---|
| 1 | **T066 [HUMAN] Sign-off 1.** On a workstation, from the feature branch: quickstart clean-clone sequence, Scenarios 1–3, sign in through the stub, click through landing, the marker, a sample screen per workspace, sign out and in; then `AUTH_PROVIDER` unset → Authentik/dev behaves as today | a person | nothing live before this |
| 2 | T045, T058, T059, T060: Auth0 application, audience access, connection, Infisical `/web-ipx-ops-auth0` | administrator | after T066 PASS |
| 3 | **T065 [HUMAN] Sign-off 2.** Quickstart Scenario 4 against the real `ipxos-dev` tenant, all five steps. The comment names the exact SHA | a person, own `@ipxos.ai` and a personal Google account | nothing is built or merged before this |
| 4 | T063: build that SHA | administrator | §2 |
| 5 | **T067 [HUMAN] Sign-off 3.** Approval to deploy | a person | §2 |

### T065 extra check: cookies behind HTTPS (audit finding F6)

The stub runs over plain http, so the automated suites never see the cookie prefixes. In the T065
run, at `https://ipx-ops.localhost`, open the browser's developer tools → Application → Cookies,
and after a successful sign-in confirm:

- [ ] `__Secure-ipx-ops-auth0.session-token` is present, marked **Secure** and **HttpOnly**.
- [ ] During sign-in, `__Host-ipx-ops-auth0.csrf-token` was set, marked **Secure**, with path `/` and no domain.
- [ ] No cookie named `authjs.*` or `__Secure-authjs.*` comes from this portal. Those names belong to the current portal.

If sign-in fails with Auth.js `MissingCSRF` or the browser drops a `__Host-` cookie, the server
thinks the request is http while `APP_URL` is https. Check that `AUTH_TRUST_HOST=true` is set and
that the proxy forwards `x-forwarded-proto: https`. The same check is repeated on the deployed host
in §3 (FR-003).

---

## 2. The deployment (T063, T044, T067)

1. **Record the current portal first**, so T048 can compare it later:
   ```bash
   # ipx-cd main: the current portal's tag
   yq '.services["web-ipx-ops"].image.tag' dev-ipxosai-services/values-dev.yaml
   # cluster: pod names and start times
   kubectl -n <namespace> get pods -l app.kubernetes.io/instance=web-ipx-ops \
     -o custom-columns=NAME:.metadata.name,STARTED:.status.startTime
   ```
   Write both into the T067 sign-off comment.
2. **T063: build.** In GitHub Actions, dispatch `publish-ipx-ops.yml` on
   `feat/ipx-9500-ops-portal-auth0`, at the SHA that T065 signed off. Confirm:
   - [ ] the run pushed `<pkg>-<sha7>` and `<sha7>` and **did not** push `latest`
   - [ ] no `dispatch-dev-image` job ran, and no image-update run appeared in ipx-cd
   - [ ] `services["web-ipx-ops"].image.tag` on ipx-cd `main` is unchanged
3. **T044: the ipx-cd PR.** It adds the release `web-ipx-ops-auth0` to
   `dev-ipxosai-services/values-dev.yaml`. Check its diff for each of these:

   | Key | Expected | |
   |---|---|---|
   | image repository | the same as `web-ipx-ops` | [ ] |
   | image tag | `<pkg>-<sha7>` from step 2. Never `latest`, never the current release's tag | [ ] |
   | `virtualService.host` | its own host, not the current portal's | [ ] |
   | `AUTH_PROVIDER` | `auth0` | [ ] |
   | `AUTH_AUTH0_AUDIENCE` | `svc-identity` | [ ] |
   | `SVC_IDENTITY_API_URL` | the in-cluster svc-identity address (IPX-9499) | [ ] |
   | `APP_URL`, `AUTH_URL` | `https://<its own host>` | [ ] |
   | `AUTH_TRUST_HOST` | `"true"` (F6: the server must see https behind the ingress) | [ ] |
   | `AUTH_BYPASS` | `"0"` or absent (T068). The officer switch and demo personas are **unavailable** on this portal | [ ] |
   | `ENVIRONMENT` | `development` | [ ] |
   | `AUTH_ENTRY_GATE_ENABLED` | `"1"` | [ ] |
   | secret reference | Infisical `/web-ipx-ops-auth0`, holding `AUTH_AUTH0_ID`, `AUTH_AUTH0_SECRET`, `AUTH_AUTH0_ISSUER`, its own new `AUTH_SECRET` and copies of the other `/web-ipx-ops` keys (identical `JWT_SECRET`), with no `AUTH_AUTHENTIK_*` key | [ ] |

   - [ ] `git diff main -- dev-ipxosai-services/values-dev.yaml` changes **no line** of the `web-ipx-ops` release.
4. **T067 [HUMAN] Sign-off 3.** Confirm the following, then record the sign-off and merge:
   - T066 and T065 are PASS.
   - T065's SHA is the one T063 built.
   - Step 3's diff is clean.
   - Step 1's tag and pod times are recorded.

   The merge is the deployment.

---

## 3. Verification checklist (FR-001–FR-019, FR-024–FR-027)

Run on the deployed parallel portal, `https://<T044 host>`, after Argo CD reports the release
`Healthy`. Fill in each Result: **pass**, or **fail** with what was seen.

| FR | Check | How | Expected | Result |
|---|---|---|---|---|
| FR-001 | Same features as the current portal | Compare the nav and one screen per workspace with the current portal | Same workspaces and screens. Only sign-in differs | |
| FR-002 | Current portal untouched | Its tag and pod start times against §2 step 1 | Identical | |
| FR-003 | No shared cookie, session or callback | Sign in to both. Sign out of the parallel portal | The current portal stays signed in. The cookie names differ (`ipx-ops-auth0.*` against `authjs.*`). The callback is `/api/auth/callback/auth0` on the parallel host only. Repeat the §1 cookie flags check on the deployed host | |
| FR-004 | Withdrawable | §5 | | |
| FR-005 | Dev only | ipx-cd: the release exists only in `values-dev.yaml` | No staging or production entry | |
| FR-006 | Marker on every screen | §4, column "Marker" | "Auth0 portal" is visible on every screen | |
| FR-007 | Auth0 only | Signed out, open any screen | Redirect to `ipxos-dev.au.auth0.com`, with Google Workspace the only option. No Authentik and no password form | |
| FR-008 | Session required | Signed out: `curl -sI https://<host>/monitor` and a server-function URL. Then `curl -s https://<host>/api/health` | A redirect to sign-in or a refusal, with no portal content. Health answers 200 and names no operator | |
| FR-009 | Verification can't be switched off | Search the release env for any setting that disables verification | None exists. RS256 is pinned in code, and the issuer is compared byte-exact | |
| FR-010 | Platform user bound | Signed in: open `/api/auth/session` | `user.platformUserId` is a UUID and `user.id` is the Auth0 `sub` | |
| FR-011 | Actor comes from the session | Have the person who did the code review confirm it | No actor is read from the body, query, path or headers (code review, AC-3 test) | |
| FR-012 | No roles in the session | `/api/auth/session` | `groups`, `roles` and `entitlements` are empty | |
| FR-013 | Fails closed | Only with the svc-identity owner's agreement: scale svc-identity to 0 or point the release at a dead URL, then sign in. Undo it afterwards | "We could not complete sign-in. Please try again." No screen is reachable | |
| FR-014 | Sign-out | Sign out, then open a screen | The browser passes through `ipxos-dev.au.auth0.com/v2/logout` and back to the portal root. The next visit asks for the Google sign-in again, not a silent sign-in (T069). The current portal's sign-out is unchanged | |
| FR-015 | Expiry | Session cookie expiry in the developer tools; the 12-hour limit is proven by unit tests (T070), not by waiting | 8 hours of inactivity (sliding). A session 12 hours past sign-in is refused and the operator signs in again | |
| FR-016 | Refusal messages | quickstart Scenario 3 texts, as seen on the deployed host where safe (a personal Google account) | Each message says what to do next. No provider name, configuration value or internal error appears | |
| FR-017 | Outcome record | Search the logs for one sign-in: `auth.outcome` | One record with `auth.provider`, `auth.outcome`, `identity.resolve`, `identity.duration_ms` and `correlation_id`. No token, code, secret, email or name | |
| FR-018 | Validated configuration | Read the pod log at start | Starts clean. (The refusals to start are covered by AC-7 in CI.) | |
| FR-019 | Credentials kept apart | Infisical | `/web-ipx-ops-auth0` holds the secrets. `/web-ipx-ops` is unchanged. No secret is in the repo, the logs or the browser (view source, `/api/auth/session`) | |
| FR-024 | Outbound token unchanged | Load a factory-backed screen | It loads. The factories accept the token, and their configuration is unchanged | |
| FR-025 | Every screen | §4 | | |
| FR-026 | Writes recognisable | Make one harmless dev write, such as a note, then look at its audit row | The actor is an Auth0 `sub` (`google-apps\|…`), not an Authentik one | |
| FR-027 | Subject and platform id kept apart | `/api/auth/session` against a factory request's actor | The factory sees the Auth0 `sub`. `platformUserId` appears in no outbound call | |

---

## 4. Screen sweep (FR-025, AC-11, T047)

**[HUMAN] T047.** Visit every screen of the parallel portal, signed in with an `@ipxos.ai` account.
For each screen, record one of these:

- **works:** real data, or a genuine empty state.
- **refused:** its plain-words notice is shown, with the reason.
- **fails:** an error, a blank screen, or empty data presented as real. Each failure must be fixed or shown as unavailable, never left (FR-025).

Detail screens (`$id`) are checked by opening one record from their list. The "Marker" column is the
FR-006 / AC-13 check.

Screens marked **expected refused** are behind the party-operator cohort or the system-operator gate.
An Auth0 session carries no `groups`, so they show their existing notice until **IPX-9502**. Record
them as refused, not as a defect.

| Workspace | Screen (route) | Expected | Result | Marker |
|---|---|---|---|---|
| Home | `/`, `/monitor`, `/portfolio` | works | | |
| Inbox | `/inbox`, `/inbox/$itemId` | works | | |
| Approvals | `/approvals`, `/approvals/$capsuleVersionId` | works | | |
| Products | `/products`, `/products/$productId`, versions (view, new, edit), compare, capsules compare, `/products/new`, new base product, new conversation, import, analytics, fact pools, recommendation rules | works | | |
| Product hierarchy | `/product-hierarchy`, `$productId`, versions, components, `new`, widget preview | works | | |
| Product capsules | `/product-capsules`, `$productId`, components | works | | |
| Capsules | `/capsules`, `$capsuleId/versions/$versionId`, compare | works | | |
| Lineage | `/lineage`, capsules, products | works | | |
| Policies | `/policies`, `/policies/$policyId` | works | | |
| Parties | `/parties`, `/parties/$partyId` | works | | |
| Claims | `/claims`, claim detail, analytics | works | | |
| Commissions | `/commissions`, policy, run, run values, analytics, counterparties, hierarchies (list, version, tree), plans (list, new, plan, version), queue (list, exception) | works | | |
| Agency | `/agency`, activity, agents (list, agent), decision engine, event explorer, extraction intelligence, fact pools, recommendation rules | works | | |
| Agency hierarchy | `/agency/hierarchy`, `/agency/hierarchy/$personId`, and the hierarchy writes | **expected refused** (cohort gate, IPX-9502) | | |
| CRM | `/crm` (cases), `/crm/$opportunityId` (case), `/crm/$opportunityId/runs/$runId` (run), `/crm/calendar`, `/crm/appointments/$calendarEventId` | **expected refused** (cohort gate, IPX-9502) | | |
| Compliance | `/compliance/retention-schedule` | **expected refused** (system-operator gate, IPX-9502) | | |
| Demand signals | `/demand-signals`, `$signalId` | works | | |
| Queues | appeals, arrears, claims, conduct, lapse, stranded claims (list and detail each), `/appeals/$appealId` | works | | |
| Underwriting | `/underwriting`, clinic checks (list, detail), referrals (list, detail) | works | | |
| Operations | `/operations`, activity, business date, decision engine, event explorer (list, event), extraction intelligence, ledger (list, collection, policy, policy audit), propagation | works | | |
| Documents | analytics, analyzer, health, pipeline, prompts | works | | |
| Payments | analytics, transactions | works | | |
| Reinsurance, finance registry, wealth config | `/reinsurance`, `/finance-registry`, `/wealth-config` (list, new) | works | | |
| Actuarial | `/actuarial`, product pricing, runs | works | | |
| Model gateway | `/model-gateway`, analytics, avatar playground, leaderboards, models | works | | |
| Sessions | conversation, draft | works | | |
| Audit | `/audit/export` | works | | |
| Sona, components | `/sona`, `/sona-gallery`, `/component-library` (list, component, widget preview), `/component-audit`, `/figma-make` | works | | |
| Dev screens | `/dev/*` | works, or hidden as on the current portal | | |
| Officer switch, demo personas | | **unavailable**: `AUTH_BYPASS` is off (T068) | | |

Any screen the current portal hides behind a LaunchDarkly flag is recorded as "hidden by flag
`<name>`", the same as on the current portal.

---

## 5. Withdrawal (FR-004, AC-14, T048)

**[HUMAN] T048.** Someone who did not deploy the portal runs §3, then withdraws it. Target: within
15 minutes, with no change to the current portal (SC-007).

- **R1. Note the current portal.** Note its tag and pod start times, as in §2 step 1. They must match the values recorded at T067.
- **R2. Remove the parallel release.** Open an ipx-cd PR that deletes **only** the `web-ipx-ops-auth0` block from `dev-ipxosai-services/values-dev.yaml`. Its `git diff` touches no line of `web-ipx-ops`. Merge it, then confirm Argo CD prunes the release, its pods, its VirtualService and its secret sync:
  ```bash
  kubectl -n <namespace> get all,virtualservice -l app.kubernetes.io/instance=web-ipx-ops-auth0   # → nothing
  ```
- **R3. Confirm the current portal.** Its tag and pod start times are the same as in R1. No pod restarted. An Authentik sign-in at its host works.
- **R4. Withdraw on the Auth0 side.** Follow [auth0-application-setup.md → Withdrawal](./auth0-application-setup.md#withdrawal):
  1. Disable the Workspace connection for `ipx-ops-auth0`.
  2. Delete the application.
  3. Delete the Infisical path `/web-ipx-ops-auth0`.

Record the start time, the finish time, and each of R1–R4 as pass or fail in the T048 sign-off.

---

## 6. Refresh (T064)

Run this when the parallel portal should catch up with `main` (FR-001). It does this without merging
the code (FR-028).

1. Rebase `feat/ipx-9500-ops-portal-auth0` onto `origin/main` in the ipx worktree. Resolve conflicts on the branch, then `git push --force-with-lease`. The PR stays open, unmerged, labelled `do-not-merge`.
2. Rerun T014's unchanged suites with no new key set: `pnpm --filter @ipx/ipx-ops test`, `typecheck` and `test:e2e`. CI on the PR must be green, including the `auth0-portal` project.
3. **[HUMAN] Rerun T065** on the rebased SHA, including the §1 cookie check. The comment names that SHA.
4. Re-dispatch T063 on that SHA, with the same checks as §2 step 2.
5. Open an ipx-cd PR that changes **only** `services["web-ipx-ops-auth0"].image.tag`, plus any `env:` key `main` added to or changed in `web-ipx-ops` since the last refresh (compare the two blocks; the deliberate differences are listed in ipx-cd#2405).
   Before it merges, an Infisical writer compares `/web-ipx-ops` with `/web-ipx-ops-auth0` and copies across any shared key that was added or changed, never `AUTH_SECRET` or an `AUTH_AUTHENTIK_*` key. `JWT_SECRET` must match exactly.
6. **[HUMAN] Fresh T067** for that PR, then merge it.
7. Rerun §3 rows FR-002, FR-003 and FR-010, and §4 for any screen that `main` added or changed since the last sweep.

---

## 7. Sign-off record

Post each sign-off as a comment on IPX-9500, in this form:

```text
[HUMAN SIGN-OFF] <T066 | T065 | T067 | T047 | T048> — PASS | FAIL
SHA: <full sha of feat/ipx-9500-ops-portal-auth0 that was run>
Run by: <name>   Date: <YYYY-MM-DD HH:MM TZ>
Checks: <the rows above, each pass/fail, or a link to the filled-in copy of this checklist>
Notes: <anything seen that is not a pass>
```

A FAIL blocks every step after it until a later PASS on the same task.
