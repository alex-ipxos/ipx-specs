# Data model: Ops Portal on Auth0, running beside the current portal

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Research**: [research.md](./research.md)

## This feature stores nothing

There is **no database table, no Prisma model, no migration and no ERD** in this feature, and that
is a decision rather than an omission:

- The platform user record is **svc-identity's**. `platform_user` and `identity_link` are both
  owned by svc-identity in `domain-docs/taxonomy/ownership-register.md` (entity ownership index,
  2026-11-13). ipx-ops holds the id, fetched per sign-in, and stores neither entity — the
  store-the-id-and-fetch-at-read-time default of the Phase 3c overreach rule.
- The operator session lives only in the encrypted Auth.js JWT cookie (`strategy: 'jwt'`, no
  database adapter, 8-hour `maxAge`).
- The app's one database (`AI_SESSION_STATE_DATABASE_URL`, Sona chat state) is untouched.
- No domain event is produced or consumed.

The spec's five "Key Entities" are therefore conceptual. What each one actually is in this codebase
is below, with the validation rules that the requirements impose on it.

---

## E1 — Operator session (`OpsSession`)

Where: `apps/ipx-ops/src/server/auth/config.ts`, the exported `OpsSession` type, carried in the
Auth.js JWT cookie. Lifetime: 8 hours (`session.maxAge`), per deployment.

| Field | Type | On an Auth0 session | On an Authentik session | Notes |
|---|---|---|---|---|
| `user.id` | `string`, non-empty | the Auth0 provider `sub` (e.g. `google-apps\|…`) | the Authentik OIDC `sub` | **Unchanged in meaning.** This is the outbound actor: `mintFactoryServiceToken` signs it as the token `subject`, and each factory derives `did:authentik:<sub>` from it. ADR-0051 decision 3. |
| `user.platformUserId` | `string` UUID, **optional on the type** | the svc-identity `userId` | absent | NEW. Held only — no outbound call, audit column or comparison reads it in this feature (FR-027). Optional on the type, mandatory at the guard: research.md R6. |
| `user.name` | `string`, optional | the Auth0 `name` claim | the Authentik `name` claim | Display only, never attribution (ADR-0026). Fail-soft: a missing claim simply sets no name. |
| `user.groups` | `string[]` | **always empty** — Auth0 sends no `groups` claim | the Authentik `groups` claim | Consequence: the party-operator cohort and the system-operator gate resolve to non-membership on the parallel portal. ADR-0051 decision 5; IPX-9502 owns the replacement. |
| `user.roles` | `string[]` | **always empty** | empty in practice too (verified 2026-07-23) | FR-012: no role, group or permission from the provider. The portal-side constant role set on the outbound token is applied at mint time, not held here, and is unchanged (FR-024). |
| `user.entitlements` | `string[]` | **always empty** | the Authentik claim | Same as `groups`. |
| `expires` | ISO 8601 string | Auth.js-managed | Auth.js-managed | FR-015. |

**Validation rules**

1. A **real** (non-bypass) session with no `user.platformUserId` is treated as unauthenticated:
   `getAuthenticatedOpsSessionData` returns `null`, the entry middleware refuses, and no portal
   screen renders (FR-010, FR-013).
2. The **dev-bypass** session (`devBypassSession`, `AUTH_BYPASS=1` and `ENVIRONMENT ∈ {local,
   development, staging, test}`) deliberately carries **no** `platformUserId` and is exempt from
   rule 1 — there is no platform user behind `dev-operator` (ADR-0014, ADR-0051 decision 4, FR-021).
3. `user.platformUserId` MUST NOT be substituted for `user.id` anywhere a service call is made
   (FR-027). Asserted by a test, AC-3.
4. `user.id` is never read from a request body, query string, path parameter or non-bearer header
   (FR-011, constitution Principle V).

**State transitions**: none — a session is created at sign-in, read until it expires or is signed
out, and never mutated in place. The one exception already in the code is the dev-officer cookie
override of `user.id` under the bypass posture (ADR-0014), which this feature does not extend.

---

## E2 — Portal identity configuration

Where: parsed once per server process at the auth-config module's scope with zod (research.md R4).
Source: environment, injected from Infisical `/web-ipx-ops` in the cluster and from
`apps/ipx-ops/.env.example` → `.env.local` locally.

| Key | Type / rule | Required | Default |
|---|---|---|---|
| `AUTH_PROVIDER` | `'authentik' \| 'auth0'` | no | **`authentik`** (research.md R1). A set-but-unrecognised value is a start-up refusal. |
| `AUTH_AUTH0_ISSUER` | absolute URL, **byte-exact including the trailing slash** | when `AUTH_PROVIDER=auth0` | — |
| `AUTH_AUTH0_ID` | non-empty string | when `AUTH_PROVIDER=auth0` | — |
| `AUTH_AUTH0_SECRET` | non-empty string, secret | when `AUTH_PROVIDER=auth0` | — |
| `AUTH_AUTH0_AUDIENCE` | non-empty string | when `AUTH_PROVIDER=auth0` | `svc-identity` |
| `SVC_IDENTITY_API_URL` | absolute URL | when `AUTH_PROVIDER=auth0` | — |
| `AUTH_AUTHENTIK_ISSUER` / `_ID` / `_SECRET` | as today | when `AUTH_PROVIDER=authentik` | — (unchanged) |
| `AUTH_SECRET`, `APP_URL`, `AUTH_TRUST_HOST` | as today | yes | — (unchanged) |
| `FACTORY_TOKEN_ISSUER`, `JWT_SECRET` | as today | for factory calls | — (**unchanged**, IPX-2123; both deployments keep the same values so no factory service is reconfigured — AC-3) |

**Validation rules**

1. Missing or malformed values for the **active** provider refuse start-up, naming every offending
   key and **never its value** (FR-018, AC-7).
2. The inactive provider's keys are not required — this is what lets one build serve both
   deployments.
3. `alg` is **not** configuration read from the token: RS256 is pinned in code (FR-009).
4. No secret appears in a log line, a Sentry event, an error message or anywhere the browser can
   reach (FR-019, SC-009).

---

## E3 — Platform-user resolve result (transient)

Where: the return value of the new `apps/ipx-ops/src/server/auth/platform-user.server.ts`, living
only for the duration of the sign-in callback. Never stored.

```text
{ ok: true,  userId: string, created: boolean }
{ ok: false, reason: 'unavailable' | 'invalid_token' | 'user_disabled'
                   | 'profile_invalid' | 'profile_unavailable'
                   | 'identity_provider_unavailable' | 'database_unavailable'
                   | 'internal_error',
             retryAfterSeconds?: number }
```

Rules: `ok: false` always means no session (FR-013). `created` comes from svc-identity's response
body and is used only for a log field. `retryAfterSeconds` is surfaced in operator-facing words
only and never drives an in-request retry. The reason is mapped to one of the two operator messages
of research.md R7 — `user_disabled` to "access not available", everything else to "try again" —
so no internal code reaches the operator. Full response shape:
[contracts/resolve-platform-user-client.md](./contracts/resolve-platform-user-client.md).

---

## E4 — Sign-in outcome record (a log line, not a row)

Where: `#/lib/logger` (structured) plus a Sentry event on the unexpected paths only. One record per
admission or refusal.

| Field | Example | Notes |
|---|---|---|
| `auth.provider` | `auth0` | the resolved provider id |
| `auth.outcome` | `admitted` \| `refused` | |
| `auth.refusal` | `domain_refused`, `provider_unavailable`, `callback_rejected`, `platform_user_missing` | absent when admitted |
| `identity.resolve` | `created` \| `existing` \| `invalid_token` \| `user_disabled` \| `profile_invalid` \| `profile_unavailable` \| `identity_provider_unavailable` \| `database_unavailable` \| `timeout` \| `unreachable` | the svc-identity outcome |
| `identity.duration_ms` | `412` | the resolve call's duration |
| `correlation_id` | — | the existing BFF correlation id (`src/server/bff-entry`) |

**Rules**: no token, authorisation code, client secret, or personal data beyond identifiers the
platform already holds — so no email and no `name` (FR-017, SC-009). `domain_refused` and
`user_disabled` are **expected** refusals: logged, but no Sentry event, because an outsider trying
the door is not an incident. Every other refusal raises one. Runbooks R1–R4 are in ADR-0051's
failure table.

**PII classification**: the record holds an operator's provider `sub` and platform user id —
identifiers the platform already holds, classified as INTERNAL, consistent with the LLD §7.4 line
for existing auth logs. No new data classification is introduced, and no erasure mechanism is
needed because nothing is persisted by this feature.

---

## E5 — The two portal deployments

Not application data — configuration, in `ipx-cd/dev-ipxosai-services/values-dev.yaml`
(research.md R8). Recorded here because FR-003 makes their separation an acceptance criterion.

| Property | Current (`web-ipx-ops`) | Parallel (`web-ipx-ops-auth0`) |
|---|---|---|
| Image | `web-ipx-ops:<tag>` | **the same repository and tag** (FR-001, FR-022) |
| Host | `ops.ipxos.dev` | its own, e.g. `ops-auth0.ipxos.dev` |
| `AUTH_PROVIDER` | `authentik` (set explicitly; also the default) | `auth0` |
| Session cookie | as today | **a distinct name** (FR-003) |
| Auth callback | `/api/auth/callback/authentik` | `/api/auth/callback/auth0` |
| Secrets | `web-ipx-ops-secrets` | its own secret reference, own keys (FR-019) |
| Provider registration | the Authentik Ops Portal client | its own Auth0 application — **recommended, open question in research.md R8** |
| Backing services | the dev factories | **the same ones, the same data** (FR-022) |
| Withdrawal | — | delete this release only; nothing changes on the other (FR-004, AC-14) |

---

## Completeness check against the spec

| Requirement | Covered by | Note |
|---|---|---|
| FR-001…FR-006 (the parallel deployment) | E5 | FR-005 dev-only; FR-006 marker driven by the provider id (research.md R9) |
| FR-007…FR-009 (sign-in, session required, in-service verification) | E2, E1 | FR-009's RS256 pin is code, not configuration |
| FR-010 (obtain the platform user id, or refuse) | E1 rules 1–2, E3 | |
| FR-011, FR-027 (the actor, and the two values kept apart) | E1 rules 3–4 | asserted by AC-3's test |
| FR-012 (no roles in the session) | E1 `roles`/`groups`/`entitlements` rows | |
| FR-013, FR-016 (fail closed, plain refusals) | E3, research.md R7 | |
| FR-014, FR-015 (sign-out, expiry) | E1 `expires` | existing Auth.js behaviour, unchanged |
| FR-017 (every outcome recorded, nothing sensitive) | E4 | |
| FR-018, FR-019 (validated configuration, own secrets) | E2 | |
| FR-020, FR-025 (checklist, screen sweep) | — | deliverables of `tasks.md`, not data |
| FR-021 (runs on a workstation) | E1 rule 2, [quickstart.md](./quickstart.md) | |
| FR-022, FR-024, FR-026 (same data, unchanged token, writes recognisable) | E5, E1 `user.id` row | FR-026 holds because the parallel portal's actor `sub` is Auth0-shaped; this is implicit in the value rather than an explicit marker — recorded as a known weakness in the discuss findings |
| FR-023 (out of scope) | — | IPX-9504 |

**No gap is left unresolved**: every requirement maps to an entity, a contract, a research decision,
or an explicitly named deliverable of `tasks.md`.

## Query patterns and indexes

Not applicable — nothing is queried and nothing is indexed. The one read in this feature is a single
HTTP call to another service, keyed by the bearer token rather than by any identifier this app holds.
