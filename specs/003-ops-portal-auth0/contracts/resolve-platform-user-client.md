# Contract: the ipx-ops client for svc-identity `POST /v1/users/me`

**Consumer**: `apps/ipx-ops` server layer (new module `src/server/auth/platform-user.server.ts`).
**Producer**: svc-identity — the authoritative contract is
[`specs/002-svc-identity/contracts/resolve-me-api.md`](../../002-svc-identity/contracts/resolve-me-api.md),
and it is **cited, not restated**: where the two ever disagree, the producer's contract wins.
**Token contract**: [`specs/001-ops-auth0-tenants/contracts/access-token-for-svc-identity.md`](../../001-ops-auth0-tenants/contracts/access-token-for-svc-identity.md).

This document states only what the **consumer** promises: when it calls, what it sends, how long it
waits, and what it does with every answer.

## When it is called

Exactly once per sign-in, inside `getAuthConfig().callbacks.jwt`, on the sign-in pass only (the
branch where `profile`/`account` are present — research.md R2). Never on a later `jwt` call, never
in the `session` callback, never lazily from a page or a server function.

## What it sends

```http
POST {SVC_IDENTITY_API_URL}/v1/users/me
Authorization: Bearer <the operator's Auth0 access token, from account.access_token>
X-Correlation-Id: <the BFF correlation id for this request>
```

- **No request body.** Not `{}`, not `null` — no body at all. A malformed JSON body is refused
  `400 invalid_request` before the token is read (svc-identity audit finding AUD-1), and sending one
  would make a configuration error look like an auth error.
- No other header names the subject; the token is the only credential.
- The access token is the one obtained with `audience=svc-identity` and
  `scope=openid profile email`. Without those scopes a first login gets `502 profile_invalid`,
  because svc-identity reads email and name from Auth0 `/userinfo` with the same token.

## Timeout and retries

| Property | Value | Why |
|---|---|---|
| Timeout | **3 s** | Matches every other ipx-ops egress (LLD §6.1) and sits inside SC-001's 30 s budget with room for the first-login `/userinfo` hop |
| Retries | **none, in-request** | FR-013 is fail-closed; a retry inside the sign-in callback multiplies the operator's wait and can double a first-login create. The operator retries by signing in again |
| `Retry-After` | read, surfaced in words only | Never used to sleep or re-call inside the callback |
| Circuit breaker | none | One call per sign-in; there is nothing to trip |

## What it returns to the caller

```text
{ ok: true,  userId: string, created: boolean }
{ ok: false, reason: ResolveFailure, retryAfterSeconds?: number }
```

## How every answer is handled

| svc-identity answer | Client result | Session | Operator sees | Log / Sentry |
|---|---|---|---|---|
| `201 { userId, created: true }` | `ok`, `created: true` | created, `platformUserId` set | the portal | `identity.resolve=created`; no Sentry |
| `200 { userId, created: false }` | `ok`, `created: false` | created, `platformUserId` set | the portal | `identity.resolve=existing`; no Sentry |
| `401 invalid_token` | `invalid_token` | **none** | "We could not complete sign-in. Please try again." | `error`; **Sentry** — nearly always an audience/issuer misconfiguration, runbook R3 |
| `403 user_disabled` | `user_disabled` | **none** | "Your access is not available. Contact the platform team." | `info`; **no Sentry** (an expected refusal) |
| `502 profile_invalid` | `profile_invalid` | **none** | the retry message | `error`; **Sentry** — the requested scopes are wrong, runbook R4 |
| `503 profile_unavailable` | `profile_unavailable` | **none** | the retry message | `warn`; **Sentry** |
| `503 identity_provider_unavailable` | same | **none** | the retry message | `warn`; **Sentry** |
| `503 database_unavailable` | same | **none** | the retry message | `warn`; **Sentry** |
| `500 internal_error` | `internal_error` | **none** | the retry message | `error`; **Sentry** |
| `400 invalid_request` | `internal_error` | **none** | the retry message | `error`; **Sentry** — this client sends no body, so it means the client itself is wrong |
| timeout, DNS failure, connection refused | `unavailable` | **none** | the retry message | `warn`; **Sentry**, runbook R2 (is svc-identity deployed here — IPX-9499) |
| any other status, or an unparseable body | `internal_error` | **none** | the retry message | `error`; **Sentry** — never admitted on an answer that was not understood |

**The invariant**: anything other than `200`/`201` with a parseable `userId` means **no session and
no portal screen** (FR-010, FR-013).

## Response validation

The success body is parsed with a zod schema at the boundary: `userId` must be a UUID string;
`created` must be a boolean. `created` is additive and is used only as a log field, so a body
carrying only `userId` still parses — but a `userId` that is absent, empty or not a UUID is
`internal_error`, not an admission. The error body is parsed as the estate shape
`{ code, message, statusCode }`; an unrecognised `code` maps to `internal_error`, and the producer's
`message` is **never** shown to the operator (FR-016).

## What this client never does

- Send a body, a subject, an email or any identifier — the token is the only input.
- Log, capture or return the access token, the authorisation code, or svc-identity's `message`.
- Store `userId` anywhere but the session (no database, no cache, no cookie of its own).
- Compare `userId` with the Auth0 `sub`, or substitute it for `session.user.id` (FR-027, AC-3).
- Call svc-identity on any path other than sign-in.
