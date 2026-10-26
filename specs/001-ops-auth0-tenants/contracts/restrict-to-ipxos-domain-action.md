# Contract: "Restrict to ipxos.ai" post-login Action

**Source of truth**: `apps/ipx-ops/auth0/actions/restrict-to-ipxos-domain.cjs` (`ipxos-ai/ipx`),
written through `ipx-fix`. The text deployed in each tenant matches this file byte for byte.
**Decision**: ipx-ops ADR-0040 decision 5. **Requirements**: FR-005, FR-014, FR-015, TRU.IAM.R63.

## Interface

Auth0 Actions, Login / Post Login trigger, Node 22, CommonJS:

```text
exports.onExecutePostLogin = async (event, api) => { … }
```

## Inputs read

| Input | Meaning |
|---|---|
| `event.user.idp_tenant_domain` | The Google organisation domain Google reports for the user. Absent for personal Google accounts |

Nothing else is read. In particular, not email, connection name, metadata or app.

## Behaviour

| Case | `idp_tenant_domain` | Result |
|---|---|---|
| A1 admit | exactly `ipxos.ai` | Returns without calling `api`. The login continues unchanged |
| D1 other organisation | any other non-empty value (e.g. `example.com`, `IPXOS.AI`, `ipxos.ai.evil.com`, `sub.ipxos.ai`) | `api.access.deny(<reason>)`, once |
| D2 no organisation | absent, `null`, `undefined` or `''` | `api.access.deny(<reason>)`, once |

- The comparison is **exact and case-sensitive** against the constant `ipxos.ai`. Google reports the
  verified domain in lower case. Anything else is refused rather than normalised.
- It applies to **every** connection strategy, not only Google (research R1).
- The deny reason is a fixed, human-readable string that contains no user data.

## Must never

- Call `api.idToken.setCustomClaim`, `api.accessToken.setCustomClaim`, `api.user.setAppMetadata`,
  `api.user.setUserMetadata`, `api.multifactor.*`, `api.redirect.*` or any other `api` member except
  `api.access.deny` (R63: the Action grants nothing and adds nothing).
- Read secrets, call the network or require modules.
- Log the user's email or any other identifier.

## Test obligations (FR-015)

The colocated `restrict-to-ipxos-domain.test.ts` runs under the `ipx-ops` Vitest gate and asserts,
with a fake `event` and a spy `api`:

1. A1: `idp_tenant_domain: 'ipxos.ai'` → `api.access.deny` not called, and no other `api` member called.
2. D1: each of `example.com`, `IPXOS.AI`, `sub.ipxos.ai`, `ipxos.ai.evil.com` → `deny` called exactly once.
3. D2: missing, `null`, `undefined`, `''` → `deny` called exactly once.
4. The `api` spy records no call other than `access.deny` in any case.
