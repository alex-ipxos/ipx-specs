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
values file, so this is the house pattern rather than a new mechanism. Sharing the image tag is what
makes "the same portal features" true by construction (FR-001, FR-022).

**⚠️ Open question, for the developer or whoever holds IPX-9497**: does the parallel portal get its
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
