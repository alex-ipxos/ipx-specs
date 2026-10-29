# Contract: `POST /v1/users/me` ("resolve or create me")

**Producer**: svc-identity. **Consumer**: the ipx-ops server layer (IPX-9500, planned). The
machine-readable form is `docs/openapi.yaml` in svc-identity, generated from the zod schemas and
checked by the `contracts` CI lane. Paths: svc-identity `docs/sequences/ipx-9498-resolve-me.md`.

## Request

```http
POST /v1/users/me
Authorization: Bearer <Auth0 access token>
X-Correlation-Id: <uuid>        (optional; minted when absent)
traceparent: <W3C trace context> (optional)
```

- The token must meet the [IPX-9497 token contract](../../001-ops-auth0-tenants/contracts/access-token-for-svc-identity.md):
  RS256, `iss` = the configured issuer, `aud` ∋ `svc-identity`, not expired.
- The caller must have requested `scope=openid profile email`, or a first login gets
  `502 profile_invalid`.
- **The body is ignored.** No field in the body, query or headers can name the subject.

## Responses

All responses carry `X-Correlation-Id`. Errors are `{ "error": { "code": "<code>", "message": "<fixed text>" } }`,
never echoing input.

| Status | Body / code | When |
|---|---|---|
| `201` | `{ "userId": "<uuid>", "created": true }` | First login: user and link created |
| `200` | `{ "userId": "<uuid>", "created": false }` | Subject already linked, user active; also the loser of a concurrent first login |
| `401` | `invalid_token` | Missing or malformed header; bad signature; wrong issuer or audience; expired; algorithm not RS256 (including `none`); unknown `kid` after a successful refetch |
| `403` | `user_disabled` | Linked user is `DISABLED` |
| `502` | `profile_invalid` | First login: `/userinfo` answered 401/403, or with no email |
| `503` | `identity_provider_unavailable` | JWKS unreachable on a cold cache or an unknown `kid`. `Retry-After: 5` |
| `503` | `profile_unavailable` | First login: `/userinfo` timed out, 5xx or 429. `Retry-After: 5` |
| `503` | `database_unavailable` | Postgres unreachable. `Retry-After: 5` |
| `500` | `internal_error` | Unhandled error (Sentry) |

`userId` is the platform user id (a UUID). It is **not** the Auth0 `sub` and must not be compared
with it.

## Guarantees

- **Idempotent**: the same subject always returns the same `userId`. Safe to retry on any `5xx`
  without a client key.
- **No partial state**: a non-`2xx` answer never leaves a user without a link, or a link without a
  user.
- **No personal data in errors or logs.**

## Not provided

- No way to disable, re-enable, delete or re-point a user in this slice.
- No roles, permissions or actor identifiers in the response.
- Service-to-service mutual TLS (TRU.IAM.R68) is enforced at deployment (IPX-9499), not here.

## Health

`GET /health` → `200 { "service": "svc-identity", "version": "<package version>", "status": "ok" }`,
unauthenticated, exempt from rate limiting, with no dependency checks (constitution).
