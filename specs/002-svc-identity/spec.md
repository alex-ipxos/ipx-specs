# Feature Specification: Platform user record (svc-identity)

**Feature Branch**: `002-svc-identity` (spec, in `ipx-specs`); delivery in `ipxos-ai/svc-identity`
(repository requested in `ipxos-ai/github-configuration#56`)

**Created**: 2026-10-29

**Status**: Draft

**Input**: User description: "specify using those decisions" — the IPX-9498 design agreed in the
`/ipx-discuss` turn on 2026-10-29 (decisions D1 to D9, recorded in svc-identity ADR-0001 and the
IPX-9498 design-decisions comment).

**Linear**: [IPX-9498](https://linear.app/ipxos-ai/issue/IPX-9498) · **Canon**: TRU.IAM.R63,
TRU.IAM.R66, TRU.IAM.R67, TRU.IAM.R53 (TRU.IAM.R1 and R52 for the actor identifier; TRU.IAM.R68
deferred to IPX-9499) · **Design record**: svc-identity ADR-0001

## User Scenarios & Testing *(mandatory)*

### User Story 1 - An operator's first sign-in gives them one lasting platform user (Priority: P1)

An ipxos.ai operator signs in to the Ops Portal through the identity provider. The portal asks the
platform's identity service who this is. The first time, the identity service creates the
operator's **platform user**, records their name and email as the identity provider reports them,
and links their sign-in to that user. Every later sign-in by the same person resolves to the same
platform user.

**Why this priority**: Every later piece of access control (roles, assignments, audit of who acted)
hangs off a platform user that the platform itself owns (TRU.IAM.R63). Without it, the Ops Portal
switch-over (IPX-9500) cannot be built.

**Independent Test**: Present a valid sign-in for a person the service has never seen: one platform
user and one link are created, and the platform user's identifier is returned, marked as new. Present
it again: the same identifier is returned, marked as existing, and nothing new is created.

**Acceptance Scenarios**:

1. **Given** a valid sign-in for a person with no platform user, **When** the portal asks who they
   are, **Then** one platform user and one link are created, the user holds the name and email the
   identity provider reports, and the answer says a user was created.
2. **Given** that person signs in again, on the same or another day, **When** the portal asks again,
   **Then** the same platform user identifier is returned and nothing is created.
3. **Given** two requests for the same new person arrive at the same moment, **When** both complete,
   **Then** exactly one platform user and one link exist, and both requests return the same
   identifier.
4. **Given** a platform user exists, **When** its identifier is inspected, **Then** it is issued by
   the platform and is not, and does not contain, the identity provider's own identifier for the
   person.

---

### User Story 2 - Only a sign-in the service checks itself is accepted, and nobody can name someone else (Priority: P1)

The identity service accepts a request only with a proof of identity it has checked itself: issued
by the one identity provider environment it is configured for, intended for the identity service,
signed by the one expected method, and not expired. Whatever else the request says about who the
caller is, the service ignores it.

**Why this priority**: The identity service is the authority on who people are. If it trusted
anything other than its own check, anyone able to reach it could create users or act as another
person (TRU.IAM.R67, TRU.IAM.R53). Equal in priority to Story 1.

**Independent Test**: Requests with a missing, forged, expired, wrongly addressed or
wrongly issued proof, or one naming an unexpected signing method, are all refused without the
service reading or writing any user. A valid proof sent with a request that also names a different
person resolves only the proof's own person.

**Acceptance Scenarios**:

1. **Given** a request with no proof of identity, or one that cannot be read, **When** it arrives,
   **Then** it is refused as unauthenticated and no user is read or written.
2. **Given** a proof with a bad signature, from a different issuer, intended for a different
   recipient, or expired, **When** it arrives, **Then** it is refused as unauthenticated before any
   user is read.
3. **Given** a proof that names a signing method other than the expected one, including "none",
   **When** it arrives, **Then** it is refused as unauthenticated.
4. **Given** a valid proof for person A in a request whose content names person B, **When** it
   arrives, **Then** the answer is about person A, and nothing about person B is read, created or
   changed.
5. **Given** any environment, including local development and tests, **When** the service runs,
   **Then** there is no setting that switches the check off.

---

### User Story 3 - A disabled platform user is refused even when the identity provider still lets them in (Priority: P2)

An administrator marks a platform user as disabled (by hand in this first slice). From then on, the
identity service refuses that user, even though the identity provider still completes their sign-in.

**Why this priority**: The platform's record, not the identity provider, decides whether a user may
act (TRU.IAM.R63 acceptance criterion 2). Needed before real roles exist, but it does not block a
normal sign-in (Story 1).

**Independent Test**: Mark an existing platform user as disabled, then present a valid sign-in for
that person: it is refused as forbidden, the user stays disabled, and no second user is created.

**Acceptance Scenarios**:

1. **Given** a platform user marked disabled, **When** that person signs in and the portal asks who
   they are, **Then** the request is refused as forbidden with a fixed reason.
2. **Given** that refusal, **When** the records are inspected, **Then** the user is still disabled
   and no new user or link was created for the same sign-in.

---

### User Story 4 - When a dependency fails, nothing is left half-done and the on-call engineer can tell why (Priority: P2)

The identity service depends on the identity provider (for its published signing keys and, on a
first sign-in, the person's name and email) and on its own database. When any of them fails, the
service refuses the request with a reason the caller can retry on, writes nothing partial, and
raises an alert an on-call engineer can act on from the alert alone.

**Why this priority**: A first sign-in that half-completed would leave users without a name or email,
or a sign-in linked to nobody. Required for operation, but it does not change the normal flows in
Stories 1 to 3.

**Independent Test**: Make each dependency fail in turn (signing keys unreachable, profile lookup
unreachable, profile lookup refusing, database unreachable) and check that each request is refused
with the expected kind of answer, no user or link is left behind, and an alert with the failing step
and dependency is raised.

**Acceptance Scenarios**:

1. **Given** the identity provider's profile lookup is down or slow on a first sign-in, **When** the
   portal asks who the person is, **Then** the request is refused as temporarily unavailable with a
   suggested retry time, no user or link is created, and an alert names the profile lookup.
2. **Given** the profile lookup refuses the sign-in or returns no email, **When** the portal asks,
   **Then** the request is refused as a bad answer from the identity provider, nothing is created, and
   an alert is raised.
3. **Given** the identity provider's signing keys cannot be fetched and the service holds no usable
   copy, **When** a request arrives, **Then** it is refused as temporarily unavailable, no user is
   read, and an alert names the signing keys.
4. **Given** the service already holds the signing keys a request needs, **When** the identity
   provider is down, **Then** existing platform users are still resolved normally.
5. **Given** the database is unreachable, **When** a request arrives, **Then** it is refused as
   temporarily unavailable, any unfinished write leaves nothing behind, and an alert is raised.
6. **Given** the service stops abruptly while creating a user, or the answer is lost on the way back,
   **When** the portal asks again, **Then** it receives either a newly created user or the one already
   created, never a duplicate.
7. **Given** any log line or alert, **When** it is inspected, **Then** it contains neither the proof of
   identity, nor the identity provider's identifier for the person, nor their email or name, and it
   carries a correlation identifier shared with the calls the service made.

---

### Edge Cases

- **The identity provider environment changes** (a new tenant, including moving off the sandbox, or a
  different provider). Every sign-in arrives with a new provider identifier, so the service would
  create a second platform user for each person. Re-pointing a link to a new identifier (TRU.IAM.R66
  acceptance criterion 4) must ship before any such switch; until then the service accepts exactly one
  configured issuer.
- **Two people share an email address**, or one person's email changes. Email is profile data only;
  it never decides which platform user a sign-in is.
- **A sign-in from an issuer the service is not configured for**, even a genuine ipxos tenant, is
  refused as unauthenticated.
- **The service is started with its issuer, intended-recipient name or signing-key location missing or
  malformed.** It refuses to start, naming the missing setting but never its value.
- **A leaver.** Disabling them in the platform record does not yet block them at the identity provider
  or revoke their sessions (TRU.IAM.R63 acceptance criterion 4, out of scope). Their requests to this
  service are refused once they are disabled.
- **The calling service is not itself identified.** Service-to-service identity by mutual TLS
  (TRU.IAM.R68) is not in force until deployment (IPX-9499); until then only the person's proof of
  identity is checked, and the calling service is not recorded as a second actor.
- **Someone presents the proof of identity of a person who exists at the identity provider but whose
  sign-in this service has never seen**, from a permitted tenant. They become a platform user: access
  is domain-wide by the IPX-9497 decision, and the identity provider's refusal check is what keeps
  outsiders out.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The service MUST keep the platform's own record of platform users. Each has a
  platform-issued identifier, a name, an email and a status of active or disabled (TRU.IAM.R63).
- **FR-002**: The service MUST keep links from an identity provider identity (the issuer plus the
  provider's identifier for the person) to exactly one platform user. A second link for the same
  identity MUST be impossible, including under concurrent requests (TRU.IAM.R66).
- **FR-003**: The service MUST offer one operation, "resolve or create me", to server-side callers.
  It takes only the caller's proof of identity, returns the platform user's identifier, and says
  whether the user was created by this call.
- **FR-004**: "Resolve or create me" MUST be safe to repeat: the same identity always returns the same
  platform user, and a repeated or concurrent request never creates a second one.
- **FR-005**: On every request the service MUST check the proof of identity itself: its signature
  against the configured identity provider's published keys, the signing method fixed by
  configuration and never taken from the proof, the issuer equal character for character to the
  configured issuer, the intended recipient naming the identity service, and the expiry
  (TRU.IAM.R67). A failed check MUST be refused before any user is read.
- **FR-006**: The service MUST take the person's identity only from the checked proof. A request body,
  header or parameter naming a person MUST be ignored (TRU.IAM.R53).
- **FR-007**: The service MUST have no way to switch the identity check off, in any environment.
- **FR-008**: When it creates a platform user, the service MUST obtain the name and email from the
  identity provider's profile lookup, using the same already checked proof, and MUST NOT take them
  from the request. It MUST NOT look up the profile when the user already exists.
- **FR-009**: If the profile lookup fails, times out or returns no email, the service MUST create
  nothing and refuse the request, distinguishing "temporarily unavailable, retry" from "bad answer
  from the identity provider".
- **FR-010**: The service MUST refuse a disabled platform user as forbidden, with a fixed reason, and
  MUST NOT re-enable or re-create them (TRU.IAM.R63 acceptance criterion 2).
- **FR-011**: The service MUST never find or match a platform user by email.
- **FR-012**: The service MUST keep using the identity provider's signing keys it already holds when
  the provider is unreachable, and fetch them again when a proof names a key it does not hold.
- **FR-013**: On a failure of the signing keys, the profile lookup or the database, the service MUST
  refuse with a "temporarily unavailable" answer carrying a suggested retry time, leave no partial
  record, and raise an operational alert naming the failing step and dependency. Refusals caused by
  the caller (unauthenticated, forbidden) MUST be logged but MUST NOT raise an alert.
- **FR-014**: Logs and alerts MUST NOT contain the proof of identity, the provider's identifier for the
  person, or their email or name. Every log line MUST carry a correlation identifier, which the
  service MUST also pass on its calls to the identity provider.
- **FR-015**: The service MUST refuse to start when its issuer, intended-recipient name or signing-key
  location is missing or malformed, naming the setting but not its value.
- **FR-016**: The service MUST accept proofs from exactly one configured identity provider issuer per
  environment.
- **FR-017**: The service's decision record MUST record the choice of identity provider, the
  service's scope, and the decisions behind FR-001 to FR-016 (IPX-9498 acceptance criterion 14).

### Key Entities

- **Platform User**: A person the platform knows. Holds a platform-issued identifier, a name and an
  email (profile data reported by the identity provider at creation), a status (active or disabled)
  and when it was created and changed. It is not a Party and is not the identity provider's login
  record.
- **Identity Link**: Joins one identity provider identity (issuer plus the provider's identifier for
  the person) to exactly one Platform User. A Platform User has one link today and may gain more after
  a provider change (once re-pointing exists).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of repeated sign-ins by the same person resolve to the same platform user across a
  test run of at least 1,000 requests, including at least 50 pairs of simultaneous first sign-ins, with
  zero duplicate users or links.
- **SC-002**: 100% of requests with a missing, forged, expired, wrongly issued or wrongly addressed
  proof, or an unexpected signing method, are refused, and none of them reads or writes a user.
- **SC-003**: 100% of requests naming a person other than the proof's own person resolve only the
  proof's person.
- **SC-004**: For a person who already has a platform user, the answer arrives in under 0.15 seconds
  for 95% of requests; a first sign-in completes in under 1 second for 95% of requests.
- **SC-005**: Under each simulated dependency failure (signing keys, profile lookup, database), 100%
  of affected requests are refused with the expected kind of answer, zero partial users or links remain,
  and every alert names the failing step and dependency.
- **SC-006**: Zero log lines or alerts produced across the full test suite contain a proof of identity,
  a provider identifier for a person, an email or a name.
- **SC-007**: While the identity provider is down, existing platform users are still resolved in
  100% of requests whose signing key the service already holds.

## Assumptions

- **Canon is the authority** (constitution Principle I). TRU.IAM.R63, R66 and R67 (product owner,
  18 October 2026) take precedence over the earlier proposed ADR-PLATFORM-006 (an Auth Broker that
  issues tokens) and ADR-014 (`svc-auth`, a central gateway). The service issues no proofs of identity;
  the identity provider (Auth0, IPX-9497) does. `svc-auth` is unchanged.
- **The caller** is the Ops Portal's server side (IPX-9500). It asks the identity provider for a proof
  intended for the identity service with the name, email and basic identity scopes; without them the
  profile lookup fails (FR-009). The browser never calls the service.
- **Access is domain-wide** (IPX-9497 decision D3): any ipxos.ai Workspace member who completes sign-in
  becomes a platform user. The identity provider's refusal check keeps outsiders out.
- **The platform user identifier** is a standard, widely validated identifier format, because other
  services will hold it. The platform's actor identifier for humans is still built by the estate's
  shared builder in a provider-named form (`did:authentik:…`), against TRU.IAM.R1 and R66. This
  feature returns only the platform user identifier and builds no actor identifiers; changing the
  builder is a follow-up. The discrepancy is raised on IPX-9498.
- **Disabling** a user is a manual change to the record in this slice; there is no operation for it.
- **Service-to-service identity** (TRU.IAM.R68) is not met by this feature. The cluster has no mesh
  mutual TLS or workload-identity authority yet; it is enforced at deployment (IPX-9499).
- **Out of scope**: roles, permissions and assignments (TRU.IAM.R65); blocking users at the identity
  provider and revoking sessions (TRU.IAM.R63 acceptance criterion 4); re-pointing links (TRU.IAM.R66
  acceptance criterion 4); linking a platform user to a Party; refreshing a user's name or email after
  creation; erasure of personal data beyond keeping the record shape ready for it; deployment
  (IPX-9499); service events.
- **Personal data**: name and email are personal data, and the provider's identifier for a person is
  treated as personal data. Records are kept until the leaver and erasure work defines removal.
- **Scale**: fewer than 100 operators in this slice (the ipxos.ai Workspace).
- **Environments**: tests and local runs use keys generated on the developer's machine, served by a
  local stand-in for the identity provider, so the service runs with no live tenant (constitution
  Principle VIII). The proof is still checked in full; nothing is switched off. The sandbox tenant
  `dev-ipxos-play` is an optional extra check. Dev and staging use the IPX-9497 tenants once they
  exist (on hold for an Auth0 Team Owner).
- **Repository**: `ipxos-ai/svc-identity` does not exist yet (requested in
  `ipxos-ai/github-configuration#56`). Design documents wait in a local placeholder repository and land
  with the first code change. Implementation starts only once the repository exists.
- **Exact interface details** (operation path, answer codes, storage names, timeouts, alert tags) are
  recorded in svc-identity ADR-0001, its observability spec and the LLD (`ipxos-ai/ipx-cd#1802`), and in
  the plan, not in this specification.
- **Constitution Principle III applies**: all service code is written through `ipx-fix`.
