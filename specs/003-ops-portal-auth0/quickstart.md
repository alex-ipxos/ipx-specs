# Quickstart: validating the parallel Auth0 Ops Portal

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Contracts**: [contracts/](./contracts)

A validation and run guide: how to bring the parallel portal up on a workstation and prove it
behaves, without a cloud account, a live Auth0 tenant or the dev cluster (constitution Principle
VIII). Implementation belongs in `tasks.md` and in `ipx-fix`; nothing here is code to copy.

Every scenario names the acceptance criteria it proves. Scenarios 1–3 can be run today; 4 needs the
Auth0 tenants (IPX-9497, held) and 5 needs svc-identity deployed in dev (IPX-9499).

---

## Prerequisites

| | |
|---|---|
| Node | **24.22.1** (`nvm use`, from `ipx/.nvmrc`) |
| Package manager | **pnpm 10.33.0** (`packageManager` in `ipx/package.json`) |
| Docker | for svc-identity's Postgres and the OIDC stub |
| Repositories | `ipxos-ai/ipx` (branch `feat/ipx-9500-ops-portal-auth0`), `ipxos-ai/svc-identity` (`main`) |
| Hosts | `https://ipx-ops.localhost` is served by `portless`, which the app's `dev` script starts |

No Infisical login, no `gcloud`, no cluster access, no live tenant.

---

## The clean-clone sequence (Principle VIII)

```bash
# 1 — the portal
cd ipx
nvm use                                   # 24.22.1
pnpm install
cp apps/ipx-ops/.env.example apps/ipx-ops/.env.local

# 2 — the platform user record it resolves against
cd ../svc-identity
cp .env.example .env
npm ci
npm run db:up                             # compose Postgres, waits for health
npm run db:migrate
npm run dev                               # serves /health

# 3 — the identity provider, locally
#     The OIDC stub serves discovery, /authorize, /oauth/token, /jwks.json and /userinfo
#     with locally generated RS256 keys. Point BOTH the portal and svc-identity at it,
#     so one key set signs the token both sides verify (research.md R5).

# 4 — the portal, on the Auth0 arm
cd ../ipx
# in apps/ipx-ops/.env.local:
#   AUTH_PROVIDER=auth0
#   AUTH_AUTH0_ISSUER=<stub issuer, trailing slash included>
#   AUTH_AUTH0_ID / AUTH_AUTH0_SECRET=<stub client>
#   AUTH_AUTH0_AUDIENCE=svc-identity
#   SVC_IDENTITY_API_URL=http://localhost:<svc-identity port>
#   AUTH_BYPASS=0
pnpm dev:ipx-ops
```

Expected: `https://ipx-ops.localhost` redirects to the stub, and after signing in lands on
`/monitor` with the Auth0-portal marker visible.

---

## Scenario 1 — the current portal is untouched (**AC-8**)

```bash
cd ipx
pnpm --filter @ipx/ipx-ops test           # vitest, unmodified suites
pnpm --filter @ipx/ipx-ops typecheck
pnpm --filter @ipx/ipx-ops test:e2e       # playwright
```

Expected: every suite passes **with no new environment key set**. That is the point — `AUTH_PROVIDER`
defaults to `authentik` (research.md R1), so no fixture and no values file needs the new key, and
"the current portal's behaviour is unchanged" is proved by its own existing checks rather than
asserted.

Then, with `.env.local` carrying no `AUTH_PROVIDER` at all, `pnpm dev:ipx-ops` must still start on
the Authentik arm.

---

## Scenario 2 — the outbound token did not change (**AC-3**)

```bash
pnpm --filter @ipx/ipx-ops test -- service-token
```

Expected: the factory token is still signed with `subject: session.user.id` (the provider subject),
with the same `iss` from `FACTORY_TOKEN_ISSUER`, the same `ipx-factory-services` audience and the
same role set — and `platformUserId` appears **nowhere** in the minted token. This is the test that
stops a later change quietly turning the platform user id into the estate's actor identifier
([contracts/operator-session.md](./contracts/operator-session.md), FR-027).

---

## Scenario 3 — refusals, with the stub (**AC-4, AC-5, AC-6, AC-7, AC-9**)

| Make this happen | Expected | Proves |
|---|---|---|
| Sign in with a stub account outside `ipxos.ai` (the stub returns `error=access_denied`) | the rendered sign-in page says "Access is limited to ipxos.ai accounts"; no portal screen; logged `auth.refusal=domain_refused`; **no Sentry event** | AC-4 |
| Stop svc-identity, then sign in | "We could not complete sign-in. Please try again."; no session cookie is set; logged `identity.resolve=unreachable` with a duration; Sentry event | AC-5 |
| Make svc-identity answer `403 user_disabled` (disable the user in its database) | the distinct "Your access is not available. Contact the platform team."; no Sentry event | AC-5 |
| Hold svc-identity past 3 s | the retry message, after ~3 s, not a hang | AC-5 |
| Stop the OIDC stub, then sign in | "Sign-in is temporarily unavailable. Try again shortly." | AC-6 |
| Re-open a used callback URL, or tamper with `state` | back to sign-in, no session | AC-6 |
| Unset `AUTH_AUTH0_ISSUER` with `AUTH_PROVIDER=auth0` | the process refuses to serve, naming the key and **not** its value | AC-7 |
| Set `AUTH_PROVIDER=auth-zero` | refuses to serve; never falls back to Authentik | AC-7 |
| `AUTH_BYPASS=1`, `ENVIRONMENT=development` | the dev picker works as today, no Auth0 or svc-identity call, no `platformUserId` on the session | AC-9 |

In every refusal row, check the logs for what must **not** be there: no access token, no
authorisation code, no client secret, no email, no `name` (**AC-12**, SC-009).

---

## Scenario 4 — a real operator on the real tenant (**AC-1, AC-2, AC-10**)

**The pre-deployment gate (tasks.md T065).** Nothing is deployed until this passes.

Needs the `ipxos-dev` tenant (IPX-9497) and the parallel portal's own application,
`ipx-ops-auth0`, set up per [auth0-application-setup.md](./auth0-application-setup.md), with its
`https://ipx-ops.localhost/api/auth/callback/auth0` callback. Make these changes:
- **The portal's `.env.local`:** point it at the tenant instead of the stub. Use
  `AUTH_PROVIDER=auth0`, `AUTH_AUTH0_ISSUER=https://ipxos-dev.au.auth0.com/` (byte-exact), and the
  `AUTH_AUTH0_ID` and `AUTH_AUTH0_SECRET` of `ipx-ops-auth0` copied from Infisical
  `/web-ipx-ops-auth0`. Never commit them.
- **svc-identity:** keep it local, but point its issuer and JWKS at the same tenant, so it verifies a
  **real** Auth0 access token.

Run the portal from the **feature branch at the exact commit that T063 will build**.

1. An `ipxos.ai` operator signs in and lands in the portal — no account creation, no password
   (**AC-1**, and SC-001's under-30-seconds on a first-ever sign-in).
2. Sign out, sign in again: `/api/auth/session` shows the **same** `platformUserId`, and it is a
   UUID, not the Auth0 `sub` (**AC-2**).
3. A personal Google account at the same URL is refused and sees the refusal page, not an error
   page (**AC-10**).
4. The access token the portal received has `aud` containing `svc-identity`, and svc-identity
   accepted it. Its log shows a `200` or `201` for `POST /v1/users/me`, not a `401`. This proves
   T058.
5. Record the commit SHA, the date, who ran it and the result on IPX-9500. T063 builds **that**
   SHA.

---

## Scenario 5 — the deployed parallel portal (**AC-11, AC-13, AC-14**)

Needs the `ipx-cd` second release and svc-identity reachable in dev (IPX-9499). **Not to be
deployed until the developer approves it** (plan.md, Delivery constraints).

1. Both portals answer on their own hosts; signing out of one leaves the other signed in; neither
   shares a cookie name or a callback address (**AC-8**, FR-003).
2. Walk every portal screen on the parallel portal and record each as working, or refused with its
   reason. The cohort-gated and system-operator-gated screens (hierarchy read and write, the
   retention/compliance screen, the CRM cases/case/run/calendar screens) are expected to show their
   plain-words notice, **pending IPX-9502** — recorded as refused, not as a defect (**AC-11**).
3. The Auth0-portal marker is on every one of those screens (**AC-13**).
4. Someone who did not deploy it runs the checklist end to end, then withdraws the release and
   confirms the current portal is healthy with no change and no redeploy (**AC-14**, SC-007).

---

## Quality gates before any task phase is reported complete

```bash
cd ipx
pnpm --filter @ipx/ipx-ops typecheck
pnpm --filter @ipx/ipx-ops test
pnpm --filter @ipx/ipx-ops test:e2e
```

All three must pass on the workstation, with the same commands CI runs (constitution Development
Workflow item 9). Each test that proves an acceptance criterion starts with its tag — `it('AC-5: …')`
for Vitest, `{ tag: '@AC-5' }` for Playwright — so `ipx-verify-qa` can read coverage back.

## What this guide cannot prove yet

- **Nothing in Scenario 4 or 5**, until the Auth0 tenants are created (IPX-9497, held until
  deployment approval) and svc-identity is deployed in dev (IPX-9499).
- **AC-11's full sweep** is incomplete by design until IPX-9502 re-sources the cohort and
  system-operator gates; the gated screens are recorded as refused, with the reason, rather than
  marked as failures.
