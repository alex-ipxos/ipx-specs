# svc-identity: the platform user record

**Status**: delivered and closed (2026-11-09) · **Linear**: [IPX-9498](https://linear.app/ipxos-ai/issue/IPX-9498)
· **Code**: [ipxos-ai/svc-identity](https://github.com/ipxos-ai/svc-identity) (PR #1, merge `a0a1d136`)
· **Canon**: TRU.IAM.R63, R66, R67, R53

## What it does

svc-identity is the platform's own record of who its users are. Auth0 handles sign-in; svc-identity
turns an Auth0 identity into a **platform user** that the platform owns, so roles, assignments and
audit trails can attach to an ID that is ours and does not change if the identity provider changes.

It has one operation:

```
POST /v1/users/me
Authorization: Bearer <Auth0 access token>
```

1. **Verify the token inside the service.** Signature (RS256 only), exact issuer, audience
   `svc-identity`, and expiry. Anything missing, forged, expired, wrongly addressed or using another
   algorithm (including `none`) gets `401 invalid_token` before any database read. There is no
   setting that turns verification off, in any environment.
2. **Resolve the person.** The token's issuer and `sub` are looked up as an **identity link**.
3. **Create on first sign-in.** If no link exists, the service fetches name and email from the
   provider's `/userinfo`, then creates one platform user and one link. It answers `201` with
   `{ "userId": "<uuid>", "created": true }`.
4. **Return the same user afterwards.** Every later sign-in by that person answers `200` with the same
   `userId` and `created: false`, and writes nothing.

The request body is ignored. A caller cannot name another person; the answer is always about the
token's own subject. Two simultaneous first sign-ins for the same person still produce exactly one
user, because `(provider, subject)` is unique.

## Data

| Table | Holds |
|---|---|
| `platform_user` | Platform-issued UUID (never the provider's ID), name and email as reported at creation, status (`ACTIVE`/`DISABLED`), soft-delete column |
| `identity_link` | Provider (verified `iss`), subject (verified `sub`), and the platform user it belongs to; unique on provider + subject |

Name, email and subject are personal data: they are never logged and never used as lookup keys
(apart from the subject in the link lookup). The platform user ID is registered as an identifier
contract in `domain-docs` because other services (ipx-ops first) will hold it.

## Who uses it

- **Ops Portal (IPX-9500)** calls `POST /v1/users/me` after an operator signs in, to get their platform
  user ID.
- **Deployment** is out of scope here and is tracked in IPX-9499. Merging deploys nothing; the repo has
  no image-push or deploy job.

## Stack and quality

Node 22, TypeScript, Express, Prisma on Postgres, zod (which also generates `docs/openapi.yaml`), jose
for token checks, Jest. It runs locally with Docker Compose: Postgres plus a local identity provider
that issues real signed tokens (see [quickstart.md](quickstart.md)).

At delivery: 136 unit and 44 integration tests passing, with acceptance tests named after AC-1 to
AC-15; line coverage 89.8%; p95 latency 4.5 ms for a returning user and 10.7 ms for a first sign-in.

## Known follow-ups (from the audit, none blocking)

- A malformed JSON body returns 400 before authentication runs (low).
- The `Bearer` prefix match is case-sensitive (low).
- The link lookup does not exclude soft-deleted links (low).
- There is no data-subject-access or retention flow for the stored personal data yet (needs its own
  ticket).

## Documents in this folder

| File | Contents |
|---|---|
| [spec.md](spec.md) | User stories, acceptance criteria, success criteria |
| [plan.md](plan.md) | Technical plan and constitution check |
| [research.md](research.md) | Decisions and the alternatives rejected |
| [data-model.md](data-model.md) | Entities and rules |
| [contracts/](contracts/) | API contract |
| [quickstart.md](quickstart.md) | Run and verify it locally |
| [tasks.md](tasks.md) | Task list T001–T050, all done |
