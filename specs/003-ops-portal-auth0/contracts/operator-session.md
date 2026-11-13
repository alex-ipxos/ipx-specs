# Contract: the operator session (`OpsSession`)

**Producer**: `apps/ipx-ops/src/server/auth/config.ts` (the Auth.js `jwt` and `session` callbacks).
**Consumers**: every server function and route in `apps/ipx-ops` — 536 call sites through
`getCurrentOpsSessionData` / `getAuthenticatedOpsSessionData` / `requireOpsSessionData`, plus
`mintFactoryServiceToken`, the party-operator cohort, the system-operator gate and the shell's user
control.

This is an **internal** contract: no other service reads it. It is written down because changing it
is how this feature could break 536 call sites, and because the separation of two of its fields is
the load-bearing decision of the whole ticket (ADR-0051 decision 3).

## Shape

```ts
type OpsSession = {
  user: {
    id: string                   // the provider sub — the outbound actor
    platformUserId?: string      // NEW: the svc-identity platform user id (UUID), held only
    name?: string                // display only
    groups: string[]
    roles: string[]
    entitlements: string[]
  }
  expires: string                // ISO 8601
}
```

The only change this feature makes is the added, optional `platformUserId`. Every other field keeps
its current type and meaning.

## The two identifiers, and which is which

| | `user.id` | `user.platformUserId` |
|---|---|---|
| What it is | the identity provider's subject (`google-apps\|…` on Auth0, the Authentik `sub` today) | svc-identity's platform user id, a UUID |
| Who mints it | the identity provider | svc-identity, from the verified token |
| Sent to backing services | **yes** — `mintFactoryServiceToken` signs it as the token `subject`, and each factory derives `did:authentik:<sub>` from it inside `@ipxos-ai/domain-contracts` | **no** — nothing in this feature reads it |
| Compared against stored actors | yes (`product-factory-approval-data.server.ts`, `hierarchy-copy.ts`, `actor-label.ts`) | no |
| Read by the operator lists | yes (`OPS_SYSTEM_OPERATOR_SUBS`, ADR-0034) | no |
| May one be substituted for the other? | **never** (FR-027). Asserted by a test, AC-3 | |

## Guarantees

1. **A real session always carries `platformUserId`.** `getAuthenticatedOpsSessionData` returns
   `null` for a non-bypass session without one, so no consumer ever sees a half-resolved operator
   (FR-010, FR-013). The field is optional on the *type* only, so that 95 existing test fixtures
   keep compiling without fabricated UUIDs (research.md R6).
2. **A dev-bypass session never carries one.** Under `AUTH_BYPASS=1` with
   `ENVIRONMENT ∈ {local, development, staging, test}` (ADR-0014's guard), `devBypassSession` has no
   `platformUserId` and is exempt from guarantee 1 — there is no platform user behind
   `dev-operator`, and inventing one would make the bypass look like a resolved operator (FR-021,
   AC-9).
3. **`user.id` is unchanged for every existing consumer.** No call site needs editing for this
   feature; the outbound token, the operator lists and the actor comparisons all keep reading the
   provider subject they read today (AC-3, AC-8).
4. **No authorisation data arrives from Auth0.** On an Auth0 session `groups`, `roles` and
   `entitlements` are always empty, because the tenant issues no such claims (FR-012, TRU.IAM.R63).
5. **`name` stays display-only** and is fail-soft: a missing claim sets no name (ADR-0026).
6. **Nothing in the session is read from the request.** Every field derives from the verified token
   or from svc-identity's answer about that token (FR-011, constitution Principle V).

## Consequence for the gated surfaces

Guarantee 4 means that, on the parallel portal, the party-operator cohort (ADR-0025) and the
system-operator arm of the hierarchy/CRM gate (ADR-0034) resolve to **non-membership** for a real
Auth0 session, exactly as an Authentik session with an empty `groups` claim does. Those screens show
their existing plain-words notice. **Nothing is ungated** — the gates are untouched and still
fail closed. The replacement source (configured platform-user-id lists) is **IPX-9502**, which was
written assuming `user.id` becomes the platform user id and therefore needs re-scoping against this
contract before it is picked up.

## Versioning

Additive only. A consumer that does not know about `platformUserId` is unaffected, which is what
lets this change land without touching 536 call sites. A future change that makes the platform user
id the outbound actor is **not** a change to this contract alone — it is the estate-wide S3 strand
(the `did:authentik:` form in `@ipxos-ai/domain-contracts`, every factory's audit columns, and a
backfill or dual-read), and it has no ticket yet.
