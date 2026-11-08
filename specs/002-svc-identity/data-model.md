# Data model: Platform user record (svc-identity)

The full Prisma schema, field notes and constraints are in the svc-identity ERD
(`docs/erd/ipx-9498-erd.md`, landing with the first code PR). This file states what the spec's
requirements need from it.

**Naming** (constitution, Persistence): Prisma models are PascalCase and fields camelCase, mapped
with `@@map`/`@map` to snake_case tables and columns (`platformUserId` → `platform_user_id`,
`createdAt` → `created_at`). Only `IdentityRepository` reads or writes these tables. Every schema
change is a new migration, applied by `npm run db:migrate`, never on boot.

## PlatformUser (`platform_user`)

| Field | Type | Rule | Requirement |
|---|---|---|---|
| `id` | UUID, generated | Platform-issued; never the provider's subject; documented style-guide exception | FR-001, US1 scenario 4 |
| `email` | text, required | From `/userinfo` at creation only; PII; never logged; never a lookup key | FR-008, FR-011, FR-014 |
| `name` | text, required | From `/userinfo` at creation only; PII; never logged | FR-008, FR-014 |
| `status` | `ACTIVE` \| `DISABLED`, default `ACTIVE` | `DISABLED` refuses with `403 user_disabled` | FR-010 |
| `createdAt`, `updatedAt` | timestamps | Standard audit columns | — |
| `deletedAt` | timestamp, nullable | Soft delete (PII); not used in this slice | — |

## IdentityLink (`identity_link`)

| Field | Type | Rule | Requirement |
|---|---|---|---|
| `id` | cuid(2) | Style-guide default | — |
| `provider` | text, required | The verified `iss`, byte-exact | FR-002, FR-016 |
| `subject` | text, required | The verified `sub`; personal data; never logged | FR-002, FR-014 |
| `platformUserId` | FK → `platform_user.id` | `Restrict` on delete and update | FR-002 |
| `createdAt`, `updatedAt`, `deletedAt` | timestamps | `deletedAt` reserved for re-pointing (later) | — |

**Constraint**: `UNIQUE (provider, subject)`. It enforces TRU.IAM.R66, decides the concurrent
first-login race (research R4) and serves the resolve lookup.

## State

```text
(no record) --first login, profile ok--> ACTIVE
ACTIVE --manual change (this slice)--> DISABLED
DISABLED --any request--> refused 403, unchanged
```

There is no transition back to `ACTIVE` through the service in this slice, and no deletion. The
service never writes `status`, so this slice needs no state-machine class (research R10). The
`ACTIVE → DISABLED` change is an operator's direct database update, tested by setting the row in
the integration test.

## Validation at the boundary (zod)

- Configuration: `ENVIRONMENT`, issuer URL (ends with `/`; `https`, or localhost only when
  `ENVIRONMENT=local`), audience, database URL, port, log level (research R6).
- `Authorization` header: `Bearer <compact JWS>`. Anything else is `401 invalid_token`.
- `/userinfo` response: `email` (non-empty string) and `name` (non-empty string, falling back to
  the email when the provider omits it). Missing `email` is `502 profile_invalid`.
- The request body is never parsed.
