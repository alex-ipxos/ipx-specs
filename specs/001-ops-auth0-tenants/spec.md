# Feature Specification: Ops Portal identity provider tenants

**Feature Branch**: `feat/ipx-9497-auth0-tenants` (in `ipxos-ai/ipx`)

**Created**: 2026-10-26

**Status**: Draft

**Input**: User description: "Scope above" — the agreed IPX-9497 scope from the `/ipx-discuss` turn:
set up Auth0 as the Ops Portal's identity provider (dev and staging), admitting the ipxos.ai Google
Workspace only, authenticating without granting any roles, with each environment's settings
verifiable against a written checklist.

**Linear**: [IPX-9497](https://linear.app/ipxos-ai/issue/IPX-9497) · **Canon**: TRU.IAM.R63 (with
TRU.IAM.R66 and TRU.IAM.R67 for the consumers) · **Design record**: ipx-ops ADR-0040

## User Scenarios & Testing *(mandatory)*

### User Story 1 - An ipxos.ai operator signs in through the new identity provider (Priority: P1)

An operator with an ipxos.ai Google Workspace account opens the Ops Portal's sign-in in the dev or
staging environment, chooses Google, and completes sign-in with the same Google account they use
today. The identity provider confirms who they are and nothing else: it does not say what they may do.

**Why this priority**: Without a working sign-in for the people who use the portal today, none of the
later work (the platform's own user record in IPX-9498, the portal switch-over in IPX-9500) can be
built or tested.

**Independent Test**: In each environment, an ipxos.ai operator completes sign-in against the Ops
Portal's registration at the identity provider and is returned to the portal's address for that
environment with proof of identity.

**Acceptance Scenarios**:

1. **Given** the dev environment's identity provider is set up, **When** an ipxos.ai operator signs in
   with Google, **Then** sign-in completes and the operator is redirected to the dev portal's sign-in
   callback address (or the local development address) with a sign-in code.
2. **Given** the staging environment's identity provider is set up, **When** the same operator signs
   in, **Then** sign-in completes and the operator is redirected to the staging portal's sign-in
   callback address with a sign-in code.

Landing in the portal signed in needs the portal's own login change, which belongs to IPX-9500 and is
outside this feature. Until then the portal does not yet accept the code.
3. **Given** an operator has signed in, **When** the proof of identity issued to the portal is
   inspected, **Then** it names the operator and carries no roles, groups or permissions.

---

### User Story 2 - Nobody outside ipxos.ai can sign in or self-register (Priority: P1)

A person without an ipxos.ai Workspace account tries to sign in with a personal Google account, or
tries to register a new account by any other route. Both are refused. The sign-in never completes,
no proof of identity reaches the portal, and self-registration creates no account.

**Why this priority**: The platform creates its own user record on a person's first sign-in
(IPX-9498). Any route that lets an outsider complete sign-in would make them a platform user, so this
boundary is a security requirement, equal in priority to Story 1.

**Independent Test**: In each environment, a personal Google account and a self-registration attempt
are both refused, neither reaches the portal, and the refusals appear in the provider's activity log.

**Acceptance Scenarios**:

1. **Given** a Google account outside ipxos.ai (a personal account or another organisation's),
   **When** its owner tries to sign in to the portal, **Then** sign-in is refused and the portal
   receives no proof of identity.
2. **Given** any self-registration route the identity provider offers, **When** someone tries to
   register, **Then** registration is refused and no account is created.
3. **Given** either refusal, **When** an administrator reviews the identity provider's activity log,
   **Then** the refused attempt is recorded.

---

### User Story 3 - The platform's identity service can trust what the provider issues (Priority: P2)

The platform's identity service (built in IPX-9498) needs to check, on its own, every proof of
identity the portal presents. For that it needs to know exactly which provider issued it and that it
was issued for the identity service. This story gives the identity service those reference values
and nothing secret.

**Why this priority**: Required before IPX-9498 can verify tokens, but it does not block an operator
signing in (Story 1).

**Independent Test**: The proof of identity issued to the portal for the identity service names the
identity service as its intended recipient and names the issuing provider exactly as the stored
reference values say.

**Acceptance Scenarios**:

1. **Given** an operator has signed in, **When** the portal obtains proof of identity for the identity
   service, **Then** it names the identity service as its intended recipient and is signed with the
   single expected signing method.
2. **Given** the stored reference values for each environment, **When** they are compared with what
   the provider publishes about itself, **Then** they match exactly, character for character.
3. **Given** the identity service's stored settings, **When** they are reviewed, **Then** they contain
   no client credentials, only the issuer and the intended-recipient values.

---

### User Story 4 - An administrator can check that each environment is set up correctly (Priority: P2)

Because the environments are set up by hand, an administrator follows written setup steps and then
runs a written checklist against each environment to prove it matches the agreed configuration. The
checklist is re-run after any later change.

**Why this priority**: Hand configuration can drift between environments. The checklist is the only
control that catches drift, such as a default sign-in route left switched on.

**Independent Test**: An administrator who did not do the setup runs the checklist against dev and
staging and every item passes. Deliberately switching on a disallowed sign-in route makes the
relevant item fail.

**Acceptance Scenarios**:

1. **Given** the written setup steps, **When** an administrator follows them for a new environment,
   **Then** the result passes every checklist item.
2. **Given** a configured environment, **When** an extra sign-in route is switched on, **Then** the
   checklist item for sign-in routes fails.
3. **Given** the operational guides, **When** sign-in breaks, a client credential is exposed, or an
   operator leaves, **Then** there is a written recovery procedure for each.

---

### Edge Cases

- **An operator leaves ipxos.ai.** Their Workspace account is suspended, but an existing identity
  provider session can keep issuing proof of identity without asking Google again, for up to 3 days
  idle or 30 days absolute. This is an accepted risk until user blocking and revocation ship
  (TRU.IAM.R63 acceptance criterion 4). Until then the leaver procedure blocks them by hand.
- **Google sign-in is misconfigured or its credentials expire.** Every sign-in in that environment
  fails. Operators already signed in carry on until their portal session ends. The recovery procedure
  covers it.
- **The identity provider is down.** New sign-ins fail and the portal refuses entry (fails closed, per
  IPX-9500). Existing sessions carry on until they expire.
- **The stored issuer differs from the published one**, even by a trailing character. The identity
  service would refuse every request, so checklist items compare them exactly.
- **An environment is created in the wrong region.** The region cannot be changed afterwards, so the
  environment must be deleted and recreated before anyone signs in. The checklist checks the region.
- **The refusal check is missing, switched off, or differs from the codebase copy in one
  environment.** Any Google account could complete sign-in there and become a platform user on first
  sign-in. The checklist compares the deployed check with the source.
- **A refused outsider still leaves an account record at the provider.** The provider may record the
  person at the Google step before the refusal check runs. That record grants nothing, and no proof
  of identity reaches the portal.
- **The provider rotates its signing keys.** The identity service must pick up the new keys
  (IPX-9498). Nothing in this feature changes.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: There MUST be exactly two identity provider environments for the Ops Portal in this
  feature, dev and staging. Production is out of scope (IPX-9504).
- **FR-002**: Each environment MUST be hosted in the identity provider's Australian region.
- **FR-003**: Each environment MUST register the Ops Portal as an application that may return
  signed-in operators only to that environment's portal addresses (dev: the dev portal and the local
  development address; staging: the staging portal).
- **FR-004**: Each environment MUST offer the Ops Portal exactly one sign-in route: the ipxos.ai
  Google Workspace. No other sign-in route may be enabled for the Ops Portal.
- **FR-005**: Each environment MUST refuse self-registration on every route, creating no account, and
  MUST NOT let anyone outside the ipxos.ai Workspace complete sign-in or receive any proof of identity.
  A provider-side record created for an outsider before the refusal check runs grants nothing and is
  acceptable. *(Reworded 2026-10-26 after `/speckit-analyze` I1: the earlier wording "MUST NOT create
  an account for anyone outside the ipxos.ai Workspace" could not be met by the provider's design.)*
- **FR-006**: Each environment MUST register the platform's identity service as the intended
  recipient of the proof of identity the portal obtains, under one fixed name used in every
  environment, signed by one fixed signing method.
- **FR-007**: The proof of identity MUST NOT carry roles, groups, permissions or any other access
  decision (TRU.IAM.R63). The only custom sign-in logic allowed is a single refusal check (FR-014).
- **FR-014**: Each environment MUST run exactly one refusal check at sign-in. It admits a person only
  when Google reports their organisation domain as exactly ipxos.ai, and refuses everyone else,
  including personal Google accounts with no organisation domain. It adds nothing to the proof of
  identity. The provider's domain setting alone does not refuse other Google accounts, so this
  check is what enforces FR-005.
- **FR-015**: The refusal check's source MUST be kept in the codebase with automated tests covering
  admit, refuse-other-domain and refuse-no-domain, changed only through the governed workflow. The
  copy running in each environment MUST match it exactly.
- **FR-008**: The portal's client credentials and the issuer MUST be stored in the secrets manager
  under the portal's existing location for each environment.
- **FR-009**: The identity service's issuer and intended-recipient values MUST be stored in the
  secrets manager under the identity service's location for each environment, with no client
  credentials.
- **FR-010**: Each stored issuer value MUST equal, character for character, the issuer the provider
  publishes for that environment.
- **FR-011**: The Ops Portal's setup documentation MUST include the setup steps for an environment, a
  verification checklist covering FR-002 to FR-010 and FR-014 to FR-015, and recovery procedures for: sign-in failing in
  an environment, an exposed client credential, and an operator leaving.
- **FR-012**: The identity provider's default session lifetimes MUST be kept, and the resulting leaver
  exposure MUST be recorded as an accepted risk in the design record.
- **FR-013**: The current sign-in provider (Authentik) MUST remain unchanged and in use by the portal.
  Switching the portal over is IPX-9500 and IPX-9504.

### Key Entities

- **Identity provider environment**: One isolated configuration per platform environment (dev,
  staging). It has a name, a region, and the address it publishes as its issuer.
- **Ops Portal application**: The portal's registration in an environment, with the addresses it may
  return to, its single sign-in route, and its client credentials.
- **Identity service registration**: The identity service as the intended recipient of proof of
  identity, with a fixed name and signing method. It holds no credentials.
- **Operator account**: Created at the identity provider on a person's first sign-in. It holds a
  name, an email and a Google identity, and grants nothing. The platform's own user record lives in
  the identity service (IPX-9498), not here.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An ipxos.ai operator completes sign-in in both dev and staging on the first attempt, in
  under one minute each, using only their existing Google account, and reaches that environment's
  portal callback address with a sign-in code. Landing in the portal is measured in IPX-9500.
- **SC-002**: 100% of sign-in and self-registration attempts from outside the ipxos.ai Workspace are
  refused in both environments, and none of them reaches the portal.
- **SC-003**: Every item on the verification checklist passes in both environments, run by an
  administrator who did not perform the setup.
- **SC-004**: Zero roles, groups or permissions appear in any proof of identity issued in either
  environment.
- **SC-005**: The stored issuer values match the published ones in 100% of comparisons (4 values:
  portal and identity service, in two environments).
- **SC-006**: A new administrator can stand up a further environment from the written steps alone, and
  it passes the checklist without help. This is verified when the production tenant is built from
  the README in IPX-9504 by someone who did not write it. That is the next environment to be created,
  and the criterion is carried on that ticket.

## Assumptions

- The identity provider is Auth0, chosen for TRU.IAM. Sign-in uses Google Workspace, so operators
  keep today's Google sign-in experience.
- Access is domain-only by decision (D3, 2026-10-26): every ipxos.ai Workspace member can sign in,
  the same reach as today. Narrowing access below that is a later platform-role concern, not this
  feature's.
- The environments are set up by hand (D1). The verification checklist, not tooling, is the control
  against drift.
- The Australian region is an explicit choice for operator (staff) data, the closest available to
  Singapore and Hong Kong (D4). It does not set a precedent for customer data.
- Someone with rights to create identity provider environments, and someone with Google Workspace and
  Google Cloud admin rights, are available to do the setup.
- The portal's dev and staging addresses are those in the deployment configuration today. Production
  has no address yet.
- Exact settings (callback paths, the identity service's registered name, signing method, secrets
  locations) are recorded in ipx-ops ADR-0040 and the plan, not in this specification.
- Constitution Principle III applies: the documentation changes are made through `ipx-fix`. The
  identity provider configuration is an operator action outside the codebase.
