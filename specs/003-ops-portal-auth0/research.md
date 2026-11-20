# Research: Ops Portal on Auth0, running beside the current portal

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Linear**: IPX-9500 ·
**Design record**: ipx-ops ADR-0051

Phase 0 output. Every Technical Context unknown is resolved below. Two things are deliberately
**not** resolved here and are carried as named open items instead of guesses: the Principle VIII
gate **G-VIII-a** (plan.md Constitution Check) and the deployment-shape question inside **R8**.

Every finding was read from the code at `ipxos-ai/ipx` `bf7eb66c3` (2026-11-13) and
`ipxos-ai/ipx-cd` `01304217`, not inferred from the ticket.

---

## R1 — `AUTH_PROVIDER` defaults to `authentik`; it is not a bare required setting

**Decision**: `AUTH_PROVIDER` is read as `authentik | auth0` with **`authentik` as the default when
unset or empty**. A value that is set but unrecognised is a start-up refusal, not a silent fallback.

**Rationale**: ADR-0051 decision 2/8 called it "a new required setting" whose absence refuses
start-up. That is wrong, and it would have caused exactly the outage FR-002 exists to prevent: the
current deployment's environment is enumerated explicitly in
`ipx-cd/dev-ipxosai-services/values-dev.yaml` (the `web-ipx-ops` release's `env:` block, ~line 820)
and would not carry the new key, so the next image bump of the **current** portal would refuse to
start. Defaulting to `authentik` makes the current deployment's configuration literally unchanged —
which is also what makes AC-8 provable by its existing tests, since no test fixture needs the new
key either. The new key is then set explicitly on the parallel release only. The ADR and the LLD
§8.1 row are to be amended to this wording.

**Alternatives rejected**: (a) required with no default — the start-up break above; (b) inferring
the provider from "are the Auth0 variables present?" — a typo in a secret name silently changes
which identity provider a deployment trusts, which is the worst possible failure mode for this
setting; (c) a second build or image tag per provider — two artefacts to keep in step, and FR-002
asks for shared source changed in behaviour-preserving ways, not forked source.

---

## R2 — The svc-identity call belongs in the Auth.js `jwt` callback, on the sign-in pass only

**Decision**: call `POST /v1/users/me` inside `getAuthConfig().callbacks.jwt`, in the branch that
already runs only when `profile`/`account` are present (the sign-in pass), and put the result on the
JWT. Do **not** call it in the `session` callback, and do not call it on subsequent `jwt`
invocations.

**Rationale**: `config.ts`'s `jwt` callback already distinguishes the sign-in pass
(`if (profile) { hydrateTokenFromAuthentikProfile(...) }`) from every later call, and the
`account.access_token` — the Auth0 access token addressed to `audience=svc-identity`, which is the
only credential svc-identity accepts — is available only on that first pass. The `session` callback
runs on every session read (`/api/auth/session`, every server function via
`getAuthenticatedOpsSessionData`, 536 call sites), so calling svc-identity there would turn one
resolve per sign-in into one resolve per request and make a svc-identity blip log every signed-in
operator out. Resolving once at sign-in is also what makes "fail closed" meaningful: refusing
*during the callback* means no cookie is ever set.

**Consequence recorded**: a session therefore keeps working for its lifetime after svc-identity goes
down — stated in the LLD §13 row and the ADR, and consistent with the spec's edge case for a
suspended account.

**Alternatives rejected**: the `signIn` callback (it cannot write to the token, so the id would have
to be stashed somewhere request-scoped and picked up later — more moving parts, same timing); a
lazy resolve on first use (every call site would need a failure path, and "no portal screen is
reachable" would become "some screens fail", contradicting FR-013).

---

## R3 — `platformUserId` travels on the JWT, exposed through the `session` callback

**Decision**: the `jwt` callback writes `token.platformUserId` (a UUID string); the `session`
callback copies it to `session.user.platformUserId`, the same shape `hydrateSessionUser` already
uses for `id`, `name`, `groups`, `roles` and `entitlements`. `session.user.id` keeps being
`token.sub`, untouched.

**Rationale**: the app runs `session: { strategy: 'jwt' }` with an 8-hour `maxAge` and no database
adapter, so the encrypted JWT cookie is the only place session state can live. Mirroring the
existing hydration pattern means no new transport, no new storage and no second lookup. The
separation is the load-bearing part of ADR-0051 decision 3: `mintFactoryServiceToken` reads
`session.user.id` for the outbound actor `sub`, and nothing reads `platformUserId` in this feature.

**Alternatives rejected**: a separate cookie (two things to expire, and the same secret protects
both anyway); re-resolving from svc-identity whenever the id is wanted (R2); replacing
`session.user.id` (ADR-0051 decision 3 rejected it — the `did:authentik:<sub>` actor form every
factory derives from that value is estate-wide state).

---

## R4 — Configuration is validated at the first server entry, and the refusal is loud

**Decision**: validate the identity configuration **once per server process**, at module scope of
the auth-config module (which `src/server.ts`'s entry imports transitively on the first request),
and throw a single error naming every missing or malformed key — never its value. Keep every
`process.env` read for identity configuration inside that one module plus the new svc-identity
client's own configuration function.

**Rationale**: there is no Express `index.ts` boot phase to hang a guard on. `src/server.ts` is a
TanStack Start `createServerEntry` wrapper; `instrument.server.mjs` runs before it but exists for
Sentry and is a `.mjs` outside the typed source. Today `config.ts` validates lazily and
per-request: `getRequiredEnv('AUTH_SECRET')` throws when `getAuthConfig()` is first called, and
`getAuthentikIssuer()` returns `undefined` rather than throwing. A module-scope validation in the
auth-config module runs exactly once per process, on the first request that touches auth — which,
with the entry middleware gating every route, is the first request of any kind. That satisfies
FR-018's "refuses to start when any of them is missing or malformed" in the only place this runtime
offers, and is honest about the one-request delay.

**Alternatives rejected**: a `prestart` script (it would not run in the container, which starts
through the built server bundle); validating in `instrument.server.mjs` (untyped, Sentry-owned, and
it would duplicate the schema); leaving it lazy and per-request (a misconfigured deployment would
serve the sign-in redirect and fail deep inside the callback — the configuration error becomes an
operator-facing refusal instead of a deployment failure).

**Note**: `zod` is already a dependency of the app's server code, so the schema is a zod object,
matching the constitution's "validate every external input at the boundary".

---

## R5 — The local profile uses a JWKS + `/userinfo` stub and a locally run svc-identity

**Decision**: `pnpm dev:ipx-ops` with `AUTH_BYPASS=0` runs against either (a) the real `ipxos-dev`
tenant once it exists, or (b) a local OIDC stub serving discovery, `/authorize`, `/oauth/token`,
`/jwks.json` and `/userinfo` with locally generated RS256 keys. svc-identity runs locally from its
own repository (`npm run db:up` → `db:migrate` → `dev`, its quickstart) and is pointed at the same
stub, so one key set signs the token both sides verify.

**Rationale**: constitution Principle VIII — no cloud account, no live tenant, no Infisical. The
tenants do not exist yet (IPX-9497 is held until deployment approval) and svc-identity is deployed
nowhere (IPX-9499), so the stub is not a nicety: without it this feature cannot be developed or
tested at all before those two unblock. svc-identity's own local profile already expects a JWKS stub
(its LLD §6.2 and the constitution's "stubs for an external HTTP dependency such as a JWKS endpoint
or `/userinfo`"), so the stub is shared, not invented twice.

**Alternatives rejected**: mocking at the HTTP-client level inside ipx-ops (it would not exercise
Auth.js's own verification, which is the thing FR-009 asserts); relying on `AUTH_BYPASS=1` for local
work (it skips sign-in entirely, so it proves nothing about this feature and is the subject of
gate G-VIII-a).

---

## R6 — `platformUserId` is optional on the type, mandatory at the guard

**Decision**: declare `platformUserId?: string` on `OpsSession['user']`, and enforce its presence in
`getAuthenticatedOpsSessionData` — a real (non-bypass) session without it is treated as no session.
The dev-bypass session (`devBypassSession` in `session-data.server.ts`) deliberately has none.

**Rationale**: 95 test files construct session objects literally (`{ user: { id, groups, roles,
entitlements } }`) and 536 call sites read a session. A required field would fail 95 files' type
checks for no behavioural gain, and would force a fake UUID into fixtures that have nothing to do
with sign-in — fabricated test data is worse than an optional field. Putting the mandate in the
guard instead means the fail-closed rule is enforced in exactly one place, by behaviour, with a test
("a real session with no platformUserId is refused") rather than by the type system. The dev-bypass
session must not carry one: there is no platform user behind `dev-operator`, and inventing a UUID
for it would make the bypass look like a resolved operator.

**Alternatives rejected**: required on the type (above); a discriminated union of bypass vs real
session (correct in the abstract, but it re-types all 536 call sites for one new field, which is a
refactor with its own ticket, not part of a sign-in change).

---

## R7 — `/sign-in` gains a rendered refusal state; Auth.js `pages.error` points at it

**Decision**: `/sign-in` keeps redirecting straight to the provider when it has no `error` search
param, and **renders** a refusal page when it does. `getAuthConfig().pages` gains
`error: authRoutes.signIn`. The reason codes are a fixed, closed set mapped to fixed operator-facing
text:

| `?error=` | Operator-facing text | Source |
|---|---|---|
| `domain_refused` | "Access is limited to ipxos.ai accounts." | Auth0 `access_denied` from the deny-only Action |
| `provider_unavailable` | "Sign-in is temporarily unavailable. Try again shortly." | discovery / token-exchange failure |
| `callback_rejected` | the sign-in page itself, no message | replayed, late or state-mismatched callback |
| `identity_unavailable` | "We could not complete sign-in. Please try again." | svc-identity unreachable, timeout, 401, 502, 503 |
| `access_not_available` | "Your access is not available. Contact the platform team." | svc-identity `403 user_disabled` |

**Rationale**: `src/routes/sign-in.tsx` today throws `redirect()` unconditionally in `beforeLoad`,
so **there is currently nowhere to tell an operator anything** — a refusal would either bounce them
into an infinite provider round-trip or land on a generic error boundary. FR-013, FR-016 and AC-4/5/6
all require operator-facing text, so a rendered state is a precondition, not polish. Collapsing the
five internal svc-identity codes into two operator messages honours FR-016 (no provider names,
configuration values, tokens or internal error text) while keeping `403 user_disabled` distinct,
because "contact someone" and "try again" are different instructions and the spec calls that out
(Story 3 scenario 4).

**Alternatives rejected**: a separate `/sign-in/unavailable` route (a second route to keep in step
with the provider redirect, and Auth.js's `pages.error` wants one target); reusing the app's generic
error boundary (it shows internal error text, which FR-016 forbids); `signIn` callback returning
`false` with no page (Auth.js then redirects to a default error URL outside the app's control).

---

## R8 — Two Helm releases in one values file; one open question on the Auth0 application

**Decision**: the parallel portal is a **second Helm release** in
`ipx-cd/dev-ipxosai-services/values-dev.yaml` (working name `web-ipx-ops-auth0`) beside the existing
`web-ipx-ops`: the same image repository and tag, its own `virtualService.host` (e.g.
`ops-auth0.ipxos.dev`), its own `env:` block with `AUTH_PROVIDER=auth0` and the Auth0 keys, and its
own Infisical secret reference. `AUTH_PROVIDER=authentik` is added explicitly to the existing
release's `env:` block in the same change (belt and braces over R1's default). The two must not
share a session cookie name, so the parallel release sets a distinct Auth.js cookie prefix.

**Rationale**: a second release is the only shape that satisfies FR-003 (no shared session store,
cookie name, callback address or provider registration) and FR-004 (withdrawable by deleting one
release, with no change to the other). The repository already runs many releases from this one
values file, so this is the house pattern rather than a new mechanism. Sharing the image repository and source is what
makes "the same portal features" true (FR-001, FR-022). *Superseded in part by R11: the tag is built from the feature branch, not shared with the current release.*

**✅ Settled 2026-11-19 (developer): its own Auth0 application.** The parallel portal gets `ipx-ops-auth0`, a Regular Web Application in `ipxos-dev` only, with its own client id, client secret and Infisical path `/web-ipx-ops-auth0`. Setup, verification and withdrawal are in [auth0-application-setup.md](./auth0-application-setup.md). One consequence for IPX-9497: the Workspace connection becomes enabled for two applications, not one (tasks.md T061). The original question follows for the record.

**Original open question, for the developer or whoever holds IPX-9497**: does the parallel portal get its
**own Auth0 application** (own client id and secret) or an **additional callback URL on the existing
Ops Portal application**? The spec leaves this open by design ("a planning decision, either way
covered by FR-003 and the IPX-9497 checklist"). It cannot be settled from this repository, because
the tenants do not exist yet. Its only effect on the plan is how many secrets are provisioned, so
`tasks.md` carries it as a configuration task with both arms; **the recommendation is its own
application**, because FR-003 says the two portals share no identity-provider registration, and a
shared application with two callbacks shares one client secret and one set of tenant-side settings.

---

## R9 — The Auth0-portal marker is a shell-level band, driven by the same provider id

**Decision**: render a persistent marker in the app shell (the chrome that mounts once, ADR-0041)
whenever the resolved provider id is `auth0` — not behind a separate flag or a hard-coded
environment check.

**Rationale**: FR-006/AC-13 want every screen to carry it, and the shell is the one place that
mounts on every screen. Deriving it from the provider id means it is impossible for a deployment to
be on Auth0 without the marker, or to show the marker while on Authentik — a separate flag could
drift from reality, which defeats the point of a marker that exists to stop an operator confusing
the two portals.

**Alternatives rejected**: a per-route banner (fourteen-odd mount points to keep in step); an
`ENVIRONMENT`-based check (both portals run in the same environment, so it cannot tell them apart);
a favicon or title-only change (not visible on the screen an operator is looking at).

---

## R10 — Proving the current portal unchanged, and the one dependency fact that was unverified

**Decision**: AC-8 is proved by three things, in this order: (1) `apps/ipx-ops`'s existing Vitest and
Playwright suites pass **unmodified** with no new environment key set — which R1's default is what
makes possible; (2) a new test asserts `getAuthConfig()` registers the `authentik` provider, and only
that provider, when `AUTH_PROVIDER` is unset; (3) a new test asserts `signFactoryServiceToken` is
called with `subject: session.user.id` and that `platformUserId` appears nowhere in the minted token
(AC-3). The current deployment is not redeployed as part of this feature.

**Verified during this phase**: `@auth/core@0.41.2` **does** ship the `auth0` provider
(`providers/auth0`, an `OIDCConfig` with the standard `authorization` override, so
`audience=svc-identity` and `scope=openid profile email` are passed as `authorization.params` exactly
as the existing Authentik provider passes its scopes). This was an unverified assumption in the
discuss turn — there are no installed `node_modules` in this checkout — and is now checked against
the published package.

**Alternatives rejected**: snapshotting the whole auth config (a snapshot would pass while the
provider silently changed identity); manual verification against the deployed portal (it cannot run
in CI, and the current portal is not redeployed here anyway).

---

## R11 — The parallel portal runs an image built from the feature branch; nothing merges to `main`

**Decision** (developer, 2026-11-19): this feature's code is **not merged** to `ipx` `main` while the
two portals run side by side (FR-028). The parallel release runs an image built from
`feat/ipx-9500-ops-portal-auth0`.

**Why merging would disturb the current portal**: `publish-ipx-ops.yml` runs on every push to
`main` touching `apps/ipx-ops/**` or `packages/**`. Its `dispatch-dev-image` job then calls
ipx-cd's `image-update.yml` with `service: web-ipx-ops`, which rewrites
`services["web-ipx-ops"].image.tag` in `values-dev.yaml` and restarts the current portal on the new
code. That breaks FR-002, which says the current portal is not restarted, even though the
Authentik behaviour itself stays identical.

**How the branch image is built**, read from `publish-ipx-ops.yml` on `main`:
- The workflow has a `workflow_dispatch` trigger. A hand dispatch on the feature branch builds and
  pushes `web-ipx-ops:<pkg>-<sha7>` and `web-ipx-ops:<sha7>`.
- `dispatch-dev-image` runs only when `github.event_name == 'push' && github.ref == 'refs/heads/main'`,
  so a branch dispatch **never** bumps the current release.
- It also pushes `web-ipx-ops:latest`. No deployment reads `latest`: every ipx-cd release pins an
  exact tag. Even so, a branch image must not take that name, so T062 changes the workflow, on the
  feature branch only, to skip `latest` on a non-`main` ref. A dispatch runs the workflow file from
  the ref it is started on, so the change has effect without reaching `main`.
- The Sentry release and the Slack notification still fire. They are harmless and help trace the
  parallel portal.

**How the parallel release is updated**: dev `image-update.yml` accepts only `repository_dispatch`
(its `workflow_dispatch` is staging-only). The `web-ipx-ops-auth0` tag is therefore set by hand in an
ipx-cd PR, and image automation never touches it, because automation is keyed by service name.

**Drift**: the branch falls behind `main` as others merge into ipx-ops. To refresh it, rebase onto
`main`, rerun Phase 3's unchanged suites, re-dispatch the build, and bump only the parallel
release's tag (T064).

**Alternatives rejected**: (A) merge and let the normal pipeline redeploy the current portal. The
developer rejected it on 2026-11-19 because it restarts the current portal. (B′) a separate image
repository (`web-ipx-ops-auth0`): it needs a new GHCR package, permissions and a second Dockerfile
path for no isolation gain, since tags are already pinned per release.

---

## R12 — The dev bypass paths **do** reach an Auth0 session (T054)

**Finding** (read from `ipxos-ai/ipx` `origin/main` on 2026-11-19, and already true at the plan's
snapshot `bf7eb66c3`): `getCurrentOpsSessionData` in `apps/ipx-ops/src/server/auth/session-data.server.ts`
has two arms.
- **Entry gate on** (`AUTH_ENTRY_GATE_ENABLED !== '0'`, IPX-9880 #4274): a real session is required
  first, then `return (await getDevBypassSession()) ?? session`. Whenever the bypass is available
  (`AUTH_BYPASS=1` and `ENVIRONMENT ∈ {local, development, staging, test}`), the **bypass identity
  replaces** the signed-in one: `user.id` becomes `dev-operator`, a seeded officer or the system
  operator.
- **Entry gate off**: the bypass session is returned without any sign-in.

The current dev release `web-ipx-ops` sets `ENVIRONMENT: "development"`, `AUTH_ENTRY_GATE_ENABLED: "1"`
and `AUTH_BYPASS: "1"` (ipx-cd `values-dev.yaml`). A parallel release that copied that `env:` block
would sign the operator in through Auth0 and then:
- drop the Auth0 session in favour of `devBypassSession`, which has **no `platformUserId`** (data-model
  E1 rule 2), so US3/AC-2 are never observable;
- mint factory tokens with `sub = dev-operator` or an officer id, not the Auth0 subject, which breaks
  AC-3/FR-024 as the plan states them; and the underwriting calls carry `actorType: dev_persona`
  (`devPersonaActorTypeFor`) on top.

The dev-officer override and `dev_persona` therefore are **not** fenced away from an Auth0 session.
They are fenced only by `AUTH_BYPASS`.

**Decision (T068, developer, 2026-11-19): bypass off on the parallel release.** the parallel release sets `AUTH_BYPASS: "0"`, or leaves it unset, so the
Auth0 sign-in is what the portal uses. The cost is that the officer switch (three-way capsule approval)
and the demo personas are unavailable on the parallel portal, and those flows are tested on the current
portal only. The alternative is to keep the bypass and accept that the Auth0 portal proves only the
sign-in, not the binding or the actor. That would hollow out US3, so it is not recommended. Either way
the current release is untouched. This also bears on IPX-10983: on today's `main` the bypass is
already "demo identities behind a real sign-in", not "auth off", whenever the entry gate is on.

**Test consequence**: T026's AC-9 case (the bypass session is admitted and has no `platformUserId`)
still holds. Add one case to T026: with `AUTH_BYPASS` unset and the entry gate on, an Auth0 session
carrying `platformUserId` is returned **as is** by `getCurrentOpsSessionData`.

---

## R13 — IPX-9501 is already satisfied (T055); FR-026's weakness recorded (T056)

**IPX-9501** ("give the factory-token issuer its own setting, keeping today's value"):
`mintFactoryServiceToken` in `apps/ipx-ops/src/server/service-token.server.ts` reads
`process.env.FACTORY_TOKEN_ISSUER`, which has been independent of the login provider since IPX-2123
(#2135, commit `7a43aa806`). The current dev release sets it to
`https://auth.ipxos.dev/application/o/ipx-ops-dev/`, today's value. Nothing in this feature reads
the login issuer for outbound tokens. **IPX-9501 can be closed as already delivered.** It is still
open (Backlog), and closing it is the developer's call.

**FR-026, a known weakness**: rows written from the parallel portal can be told apart only by the
**shape** of the actor subject: an Auth0 `sub` (e.g. `google-apps|…`) against an Authentik one. There
is no explicit marker. The same person also appears as two different actors across the two portals,
so "is this mine" checks treat the other portal's rows as someone else's. The checks are in
`src/server/product-factory-approval-data.server.ts` (self-approval and "you wrote this"),
`src/lib/hierarchy-copy.ts` and `src/lib/actor-label.ts`, all on `main`. Example: an operator who
drafts on the current portal and opens the item on the parallel one is not recognised as its author.
This is acceptable for a dev-only side-by-side run, and it must be stated in the T046 checklist.
**IPX-9503** ("handle pre-cutover Authentik actor ids and drop `did:authentik:` comparisons") is
where it gets fixed. Its premise is a single-provider cutover, so it needs re-scoping around two
providers live at once.

