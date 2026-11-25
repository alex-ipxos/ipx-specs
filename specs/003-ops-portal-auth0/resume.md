# Resume here: IPX-9500 status at pause (2026-11-25, after the sandbox rehearsal)

Read this first in a new session, then [tasks.md](./tasks.md) and [runbook.md](./runbook.md).
When the work below is done, update this file or delete it. It is a pointer, not a status ledger.

## Where things stand

| Piece | State |
|---|---|
| Code, `ipxos-ai/ipx` PR #4687 (`feat/ipx-9500-ops-portal-auth0`) | Ready for review, **do-not-merge** (FR-028). Head is now **`34c9504`** (Try-again fix from the sandbox rehearsal, below); CI to be checked on it. Governance was signed at `88627a8`, so **the bundle is stale: re-run pre-audit → audit → verify-qa → verify-gov on the new head**. **0 unresolved review threads**: Sentry (double `normalizeAuthRequestUrl`, harmless on Node 22) and CodeQL (test-only stub redirect) were both answered and resolved on 2026-11-25. CodeQL alert #61 itself is **not** dismissed yet |
| Delivery, `ipxos-ai/ipx-cd` draft PR #2405 (`chore/ipx-9500-web-ipx-ops-auth0`) | T044 + T068 written. `web-ipx-ops-auth0` on `ops-auth0.ipxos.dev`, `enabled: false`, tag `PENDING-T063`. 0 lines of `web-ipx-ops` changed. **Do not merge before T067** |
| Specs (this branch) | T062, T068 ticked. Decisions recorded: host `ops-auth0.ipxos.dev`; `/web-ipx-ops-auth0` holds **copies** of the shared `/web-ipx-ops` keys (not a second mount) |
| T066 [HUMAN] | **PASS at `88627a8` on 2026-11-25. Sign-off posted on IPX-9500** (comment `b224c6fb`). Unit 24371 passed, typecheck pass. **The developer ticks the box** (an agent never ticks a [HUMAN] task) |
| Code tasks T002–T043, T069, T070 | Built on the code branch but still unticked in tasks.md. Tick them after a per-task check |

## Next steps, in order

0. **Housekeeping first** (developer):
   - **reboot the Mac** (54 days up; TIME_WAIT sockets were stuck, and the stopgap `portrange.first=16384` is lost on reboot anyway)
   - after the reboot, start the proxy again if a local run is needed
   - delete the sandbox app `ipx-ops-auth0` in `dev-ipxos-play` once no further sandbox runs are wanted
   - delete the scratchpad `sandbox-auth0-creds.txt`
1. **Check CI on `34c9504`** (PR #4687). At pause: Seer, dependency-review and linear-reference passed; E2E, CodeQL and detect-changes were pending. The full unit suite has **not** run locally on `34c9504` (it was stopped when the Mac ran out of ports), so CI is the evidence. If E2E fails, look first at the new `@AC-4 … Try again asks the provider for its login page` test in `e2e/auth0-refusals.spec.ts`.

1a. **Tick T066 in tasks.md** (the developer does this; the sign-off is already posted).
2. **Re-run the governance chain on `34c9504`** (pre-audit, audit, verify-qa, verify-gov) and check CI on it. T066 was signed at `88627a8`; decide whether the Try-again change needs a T066 re-run (it touches the refusal path, AC-4/AC-6).
3. **Get the developer's approval for the live steps**, then T045 (the Auth0 `ipx-ops-auth0` app in `ipxos-dev`, callbacks `https://ops-auth0.ipxos.dev/api/auth/callback/auth0` and `https://ipx-ops.localhost/api/auth/callback/auth0`), T058 (`svc-identity` audience), T059 (Workspace connection) and T060 (Infisical `/web-ipx-ops-auth0`: Auth0 id, secret and issuer, a new `AUTH_SECRET`, copies of the shared keys, no `AUTH_AUTHENTIK_*`). See [auth0-application-setup.md](./auth0-application-setup.md). It is not yet known whether the agent has Auth0 or Infisical access, or whether the developer does these by hand.
4. **T065 [HUMAN]**: a local run against the real tenant (blocked until IPX-9497 creates `ipxos-dev`; the sandbox rehearsal above passed), using the same setup as T066 (below), with the issuer switched to `https://ipxos-dev.au.auth0.com/` on both the portal and svc-identity.
5. Then T063 (build the T065 SHA), fill in T044's tag and `enabled: true`, **T067 [HUMAN]** approval, merge (that is the deployment), T047, T048.

**External blocker:** IPX-9499 (svc-identity to dev, owned by a teammate, In Progress) must land before T067. Its dev AuthorizationPolicy also needs the `web-ipx-ops-auth0` principal (noted in ipx-cd#2405).

## Sandbox rehearsal of T065 (2026-11-25, does **not** count as T065)

`ipxos-dev` does not exist yet (IPX-9497 T006 open, needs a Team Owner; `ipxos-dev.au.auth0.com` answers "Unknown host"). The developer chose to rehearse T065 against the EU sandbox `dev-ipxos-play` instead. It is the wrong region and signs in through the `google-oauth2` social connection, not Workspace, so it is a rehearsal, not the sign-off.

- Sandbox app `ipx-ops-auth0` created by the developer: localhost callback/logout/origin only, Authorization Code only, RS256, OIDC Conformant, `google-oauth2` the only connection; `svc-identity` **User-delegated Access** authorised (Client Access off). Probe: registered callback → `/u/login`; unregistered → 403.
- Local: ipx-t066 portal on the Auth0 arm (`AUTH_AUTH0_ISSUER=https://dev-ipxos-play.eu.auth0.com/`, entry gate on, bypass off), svc-identity-t066 with the same `IDENTITY_ISSUER`.
- Results: real ipxos.ai sign-in admitted (`identity.resolve` created, 578 ms); repeat sign-in `existing` (244 ms), DB shows one `google-oauth2` link → one platform user; personal Google account refused `domain_refused` at info; svc-identity accepted the real token on both resolves (issuer, `aud` ∋ `svc-identity`, RS256).
- **Bug found and fixed**: after a refusal, Try again restarted sign-in with no prompt, so Auth0/Google silently reused the refused account and the operator bounced back to the refusal page (an apparent loop). Fix `34c9504` (RED `8da5b9b`): on auth0, Try again → `/api/auth/signin/auth0?callbackUrl=%2Fmonitor&prompt=login`; the re-posted sign-in forwards **only** an allow-listed `prompt=login` (Auth.js copies every query param into the authorize URL, so `connection`, `audience`, `redirect_uri`, `callbackUrl` from a link no longer reach Auth0). Authentik arm unchanged. Verified on the sandbox: Try again shows the Auth0 login page, then Google's account picker. **No tenant change needed** (no Google `prompt` upstream param).
- Sandbox creds: in the scratchpad `sandbox-auth0-creds.txt` and the ipx-t066 `.env.local` (gitignored). The portal `.env.local` before the rehearsal is in the scratchpad as `env.local.before-sandbox`. Delete the sandbox app when done with it.

## Open findings from T066 (none blocking)

1. **E4 log values:** a stopped svc-identity and a timeout both log `identity.resolve=unavailable`; data-model E4 expects `unreachable` and `timeout` (`apps/ipx-ops/src/server/auth/platform-user.server.ts:96-98`). Fix at the next T064 refresh, not on the signed SHA.
2. **Health check:** a misconfigured portal still answers `/api/health` 200 while every gated route answers 500 (config is parsed on the first gated request, research R4). Decide whether that is acceptable or file a follow-up.
3. **Triple records:** in two refusal rows (access_denied, user_disabled), three sign-in attempts were logged about 1.2 s apart, possibly from a single click. Watch for it in T065.
4. **Tidy-up at the next refresh:** handle the double request copy in `apps/ipx-ops/src/routes/api/auth/$.ts`.
5. **(rehearsal)** A session cookie from the stub run stayed valid after the issuer was switched to the sandbox, because `AUTH_SECRET` was unchanged (the session is not bound to the issuer). Cannot happen deployed (new `AUTH_SECRET`); for local runs, change `AUTH_SECRET` or clear cookies when switching issuer.
6. **(rehearsal)** The `svc-identity` API's access policy on a tenant can be **per-app authorisation**: setup-guide step 4 is then required (authorise User-delegated Access, not Client Access). Expect the same on `ipxos-dev`.
7. **T049 quickstart and `.env.example` fixes:**
   - `sudo pnpm exec portless proxy start --https` must run first
   - local svc-identity listens on `4024`, not `localhost:3000`
   - the AC-9 row needs `AUTH_ENTRY_GATE_ENABLED=0`
   - svc-identity needs `IDENTITY_ISSUER=http://127.0.0.1:3026/` for the stub
   - restarting the stub needs a svc-identity restart (new signing key)
   - the replay row cannot be run from browser history, because sign-out immediately starts a new sign-in; use a direct request
   - a Mac up for more than ~49.7 days stops reaping TIME_WAIT sockets; a long local run (or the full unit suite) then exhausts ephemeral ports and everything fails with `EADDRNOTAVAIL`. Reboot, or `sudo sysctl -w net.inet.ip.portrange.first=16384` as a stopgap (applied 2026-11-25, lasts until reboot)
   - the repo's hooks need Node 24 (`~/.nvm/versions/node/v24.22.1`); on Node 22 the oxlint plugin fails to load

## Deferred by the developer

- **Login page branding (IPX Insure logo and name):** not now. When it is wanted, it is tenant-wide Auth0 config, not code:
  - Settings > General > Friendly Name `IPX Insure`
  - Branding > Universal Login: logo at a public HTTPS URL (PNG about 150×150; artwork in `packages/logos/assets/ipx-combined.svg`, not yet hosted anywhere public)
  - optionally, the login prompt text
  - do **not** add it to the IPX-9497 runbook until the developer asks

## Local state at pause

- Stopped: portal, svc-identity. Still running: the portless proxy (root) and the `svc-identity-t066` Postgres container (`npm run db:down` to stop).
- ipx-t066 is detached at **`34c9504`**, and its `.env.local` is on the **sandbox Auth0 arm**:
  - `AUTH_PROVIDER=auth0`
  - issuer `https://dev-ipxos-play.eu.auth0.com/`, with the sandbox client id and secret
  - entry gate on, bypass off
- svc-identity-t066 `.env` has `IDENTITY_ISSUER=https://dev-ipxos-play.eu.auth0.com/`. Point both back at `http://127.0.0.1:3026/` for stub runs.
- The DB holds the sandbox platform user `46459f2a-…` (one `google-oauth2` link) next to the stub user `62ddfe1c-…`.
- Use Node 24 (`~/.nvm/versions/node/v24.22.1/bin`) for git hooks in the ipx repo.

## The T066/T065 local setup (to rebuild it)

- Worktrees: `ipx-specs/repos/ipx-t066` (ipx at `88627a8`) and `ipx-specs/repos/svc-identity-t066` (svc-identity `origin/main`, `a2bc94f`). `~/ipxos/svc-identity` itself is stale at "Initial commit".
- Proxy: `sudo pnpm exec portless proxy start --https` from `ipx-t066/apps/ipx-ops`, run by the developer in their own terminal.
- Stub: `node e2e/support/upstreams/oidc-stub.mjs 3026`. Control it with `POST /__control {"mode":...}` and `{"reset":true}`.
- svc-identity: in `.env`, set `IDENTITY_ISSUER=http://127.0.0.1:3026/` and `ENVIRONMENT=local`, then `npm run db:up && npm run db:migrate && npm run dev` (port 4024, DB container `svc-identity-t066-postgres-1`).
- Portal `.env.local` (Auth0 arm):
  - `AUTH_PROVIDER=auth0`
  - `AUTH_AUTH0_ISSUER=http://127.0.0.1:3026/`
  - `AUTH_AUTH0_ID=ipx-ops-auth0-e2e`
  - `AUTH_AUTH0_SECRET=local-stub-secret`
  - `AUTH_AUTH0_AUDIENCE=svc-identity`
  - `SVC_IDENTITY_API_URL=http://127.0.0.1:4024`
  - `AUTH_BYPASS=0`
  - a generated `AUTH_SECRET`

  At pause it was left on the **Authentik arm**: no `AUTH_PROVIDER`, `AUTH_BYPASS=1`, `AUTH_ENTRY_GATE_ENABLED=0`.
- `test:e2e` cannot run locally without `ldcli`. Use CI's E2E run on the same SHA (run 44916151224 for `88627a8`).

## T066 sign-off as posted (IPX-9500 comment b224c6fb; the unit result there reads 1809 files, 24371 passed)

```
[HUMAN SIGN-OFF] T066 — Alexander Valyalkin, 2026-11-25, 88627a844eca05e970d8fd8087ca3126562ec086, PASS, local setup against the stub

Setup: clean worktrees, ipx at 88627a8 (verify-gov signed head), svc-identity origin/main (a2bc94f) with IDENTITY_ISSUER=http://127.0.0.1:3026/, ENVIRONMENT=local. In-repo OIDC stub on 3026, real svc-identity on 4024, portal at https://ipx-ops.localhost. The agent ran the setup commands and the stub/svc-identity switches at my request; I did every browser check and judged each result.

Auth0 arm (AUTH_PROVIDER=auth0, AUTH_BYPASS=0)
- Sign-in through the stub: no form, no account creation, landed on /monitor in under 30 s (SC-001). "Auth0 portal" marker present on a sample screen in each workspace.
- /api/auth/session: user.id is the provider subject, platformUserId a separate UUID; the same platformUserId after signing out and back in (log: identity.resolve created, then existing).
- Session cookie ipx-ops-auth0.session-token; no authjs.* cookie from this portal.
- Refusals, each ending outside the portal with no session cookie:
  - access_denied → "Access is limited to ipxos.ai accounts", domain_refused, info level (no Sentry) — AC-4
  - svc-identity stopped → "We could not complete sign-in. Please try again.", platform_user_missing, warn — AC-5
  - user DISABLED → "Your access is not available. Contact the platform team.", identity.resolve=user_disabled, info — AC-5
  - svc-identity frozen → retry message after 3.0 s (identity.duration_ms 3005), no hang — AC-5
  - stub stopped → "Sign-in is temporarily unavailable. Try again shortly.", provider_unavailable, warn — AC-6
  - replayed callback → 302 /sign-in?error=callback_rejected, logged callback_rejected. Verified by a direct request; the browser-history variant was inconclusive because sign-out immediately starts a new sign-in — AC-6
- Config: AUTH_AUTH0_ISSUER removed → refuses to serve, the error names the key only; AUTH_PROVIDER=auth-zero → refuses ("must be one of: authentik, auth0"), no Authentik fallback — AC-7
- AUTH_BYPASS=1, ENVIRONMENT=development, entry gate off → dev picker works, zero stub authorize calls, zero svc-identity calls — AC-9
- Log scan: no token, authorisation code, client secret, email or name in any portal log line — AC-12

Current portal (AUTH_PROVIDER unset): sign-in path /api/auth/signin/authentik, dev bypass and officer switch as today, no Auth0 marker, no ipx-ops-auth0.* cookie — AC-8

Suites (no new env key, TZ=UTC): typecheck pass; unit <RESULT>; test:e2e not run locally (ldcli not installed), CI E2E green on this SHA (run 44916151224, including the auth0-portal project).

Findings, none blocking: (1) identity.resolve logs "unavailable" for both down and timeout; E4 expects unreachable/timeout (platform-user.server.ts:96-98). (2) A misconfigured portal still answers /api/health 200 while gated routes 500. (3) Two refusal rows logged three attempts about 1.2 s apart; watch in T065. (4) Quickstart and .env.example fixes for T049: sudo portless proxy start, svc-identity port 4024 (not 3000), AC-9 needs AUTH_ENTRY_GATE_ENABLED=0, svc-identity issuer pointed at the stub, a stub restart needs a svc-identity restart.
```
