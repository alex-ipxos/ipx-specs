# Feature Specification: Ops Portal on Auth0, running beside the current portal

**Feature Branch**: `feat/ipx-9500-ops-portal-auth0` (in `ipxos-ai/ipx`)

**Created**: 2026-11-13

**Status**: Draft

**Input**: User description: "I would like to start with IPX-9500, migration of ipx-ops portal to
auth0. I do not want to interrupt current ipx-ops portal and I would like to deploy it in parallel to
the current one, just with Auth0 authentification enabled."

**Linear**: [IPX-9500](https://linear.app/ipxos-ai/issue/IPX-9500) · **Canon**: TRU.IAM.R63 (sign-in
without roles), TRU.IAM.R67 (the portal's server side verifies what it is given), TRU.IAM.R53 (the
acting subject comes from the token) · **Depends on**:
[IPX-9497](../001-ops-auth0-tenants/spec.md) (Auth0 tenants, delivered by hand),
[IPX-9498](../002-svc-identity/README.md) (svc-identity, delivered)

## Why this is a parallel deployment

The Ops Portal is the only way operators do their work today, and it signs them in through
Authentik. Replacing sign-in in place would make a failed sign-in change an outage. So this feature
stands up a **second, separately addressed instance of the same portal** whose only difference is
that operators sign in with Auth0 and are bound to a platform user record. The current portal and
its Authentik sign-in are not changed, not restarted and not re-pointed. Retiring the Authentik
portal, and production, are separate tickets (IPX-9504).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - An operator signs in to the parallel portal with Auth0 (Priority: P1)

An operator opens the parallel portal's address, is taken to Auth0, signs in with their existing
ipxos.ai Google account, and lands inside the portal already signed in — on the same screens and
with the same portal features they use today. Nothing asks them to create an account or set a
password.

**Why this priority**: This is the whole point of the feature. Until an operator can sign in and
land inside the portal, nothing about the Auth0 route can be judged, demonstrated or compared with
today's portal.

**Independent Test**: Deploy the parallel portal, have an ipxos.ai operator open its address, and
confirm they complete sign-in and reach the portal's landing screen with their name shown and the
portal's normal navigation available.

**Acceptance Scenarios**:

1. **Given** the parallel portal is running and the operator has no session, **When** they open any
   portal address, **Then** they are sent to Auth0 to sign in and, after signing in with their
   ipxos.ai Google account, are returned to the page they originally asked for, signed in.
2. **Given** an operator who has just signed in, **When** the portal shows them who they are,
   **Then** it shows the name and email the identity provider reported, taken from the verified
   sign-in result and not from anything the browser supplied.
3. **Given** a signed-in operator, **When** they reload, navigate the portal, or return in a new tab
   within the session lifetime, **Then** they stay signed in without signing in again.
4. **Given** a signed-in operator, **When** they choose to sign out, **Then** their portal session
   ends, their Auth0 session for the portal ends, and opening a portal address sends them back to
   sign-in.

---

### User Story 2 - The current portal is not disturbed (Priority: P1)

Operators who keep using today's portal address see no change at all: the same address, the same
Authentik sign-in, the same sessions. Sessions that were open before the parallel portal was
deployed stay open.

**Why this priority**: The user's explicit constraint, and the reason the work is shaped this way. A
regression here is an outage for every operator, which is strictly worse than the feature not
shipping.

**Independent Test**: With the parallel portal deployed and in use, sign in to the current portal
address, use it, and confirm its sign-in route, address and behaviour are unchanged, and that a
session opened before the deployment is still valid.

**Acceptance Scenarios**:

1. **Given** the parallel portal has been deployed, **When** an operator signs in at the current
   portal's address, **Then** they are taken to Authentik exactly as before and reach the portal
   signed in.
2. **Given** an operator had an open session on the current portal before the parallel portal was
   deployed, **When** they continue working, **Then** their session is still valid and they are not
   asked to sign in again.
3. **Given** the parallel portal is stopped, broken, or its Auth0 tenant is unavailable, **When**
   operators use the current portal, **Then** it is unaffected.
4. **Given** either portal, **When** an operator signs out of one, **Then** their session on the
   other is unaffected.

---

### User Story 3 - The signed-in operator is bound to their platform user record (Priority: P2)

On a successful Auth0 sign-in, the portal's server side asks the platform's identity service who
this person is in platform terms, and holds that platform user identifier for the session. The
operator sees nothing of this; it is what later work (roles, assignments, audit trails) will attach
to.

**Why this priority**: It is the reason the migration exists rather than being a change of sign-in
screen, but an operator can be shown signing in (Story 1) before it is in place.

**Independent Test**: Sign in a person who has never signed in before, then sign in again, and
confirm the portal holds the same platform user identifier both times and that the identifier is the
platform's own, not the identity provider's subject.

**Acceptance Scenarios**:

1. **Given** an operator signing in for the first time, **When** sign-in completes, **Then** the
   portal's server side obtains a platform user identifier for them and keeps it for the session.
2. **Given** the same operator signing in again later, **When** sign-in completes, **Then** the
   portal holds the same platform user identifier as before.
3. **Given** a session, **When** its contents are inspected, **Then** the platform user identifier
   it holds is the platform's own identifier and is never the identity provider's subject value.
4. **Given** the identity service answers that the person's platform user is disabled, **When**
   sign-in completes at the identity provider, **Then** the portal refuses entry and shows a message
   that says access is not available and whom to contact, with no portal screen reachable.

---

### User Story 4 - Entry is refused when it cannot be proven (fails closed) (Priority: P2)

Anyone who cannot be proven to be an authorised operator does not get in, and the portal says so
plainly rather than half-working. This covers an outsider, a tampered or expired sign-in result, and
every dependency being unavailable.

**Why this priority**: The portal is the operations console for a regulated platform. Failing open,
even for a minute during an outage, is unacceptable; but it does not block demonstrating Story 1.

**Independent Test**: Attempt entry with a personal Google account, with an altered or expired
sign-in result, and with the identity provider and the identity service each made unavailable in
turn; confirm every attempt ends outside the portal with an explanatory message.

**Acceptance Scenarios**:

1. **Given** a Google account outside ipxos.ai, **When** its owner tries to sign in to the parallel
   portal, **Then** sign-in is refused, no portal screen is reachable, and the portal shows that
   access is limited to ipxos.ai accounts.
2. **Given** a sign-in result that has been altered, is expired, was issued by another provider, or
   was issued for another application, **When** it is presented to the portal, **Then** the portal
   rejects it and the operator stays outside the portal.
3. **Given** the identity provider is unavailable, **When** an operator tries to sign in, **Then**
   entry is refused with a message saying sign-in is temporarily unavailable, and no portal screen
   is reachable.
4. **Given** the identity service is unavailable or answers with an error, **When** an operator
   completes sign-in at the identity provider, **Then** entry is refused with a message inviting
   them to retry, and no portal screen is reachable.
5. **Given** any refusal, **When** the portal's records are reviewed, **Then** the attempt is
   recorded with a reason, a correlation identifier and a timestamp, and contains no token, secret
   or personal data beyond identifiers already held.

---

### User Story 5 - An operator and an administrator can tell the two portals apart, and the parallel one can be withdrawn (Priority: P3)

Because two portals are live at once, an operator can see which one they are on, and an
administrator can check the parallel portal against a written checklist and withdraw it without
touching the current portal.

**Why this priority**: It is what makes running two portals safe to operate for weeks, but the
feature can be demonstrated without it.

**Independent Test**: An administrator who did not deploy it runs the checklist against the parallel
portal and every item passes; they then withdraw it and confirm the current portal is unaffected.

**Acceptance Scenarios**:

1. **Given** the parallel portal, **When** an operator is on any of its screens, **Then** a visible
   marker identifies it as the Auth0 portal, distinguishable from the current portal at a glance.
2. **Given** the written checklist, **When** an administrator who did not deploy the parallel portal
   runs it, **Then** every item passes, including that the current portal's sign-in route and
   address are unchanged.
3. **Given** the parallel portal is withdrawn, **When** operators use the current portal, **Then**
   it is unaffected, and nothing needs to be changed or redeployed on it.
4. **Given** the two portals are running, **When** their configuration is compared, **Then** neither
   shares a session store, a session cookie name or a sign-in callback address with the other.

---

### Edge Cases

- **An operator is signed in to both portals at once.** Each session is independent; actions taken
  in each are attributed to whoever that portal signed in, and signing out of one leaves the other
  alone.
- **An operator signs in to the parallel portal for the first time ever.** A platform user record is
  created for them at that moment (by the identity service). The first sign-in is therefore slower
  than later ones; it must still complete within the Story 1 timing.
- **Two sign-ins for the same brand-new person land at the same time** (two tabs, a retried
  callback). Exactly one platform user is created and both sessions end up with the same platform
  user identifier.
- **A sign-in callback is replayed, arrives late, or arrives with a mismatched state.** It is
  rejected and the operator is returned to sign-in, with no session created.
- **An operator's ipxos.ai account is suspended while they hold a portal session.** Their session
  keeps working until it expires (the accepted risk recorded in IPX-9497); no new sign-in succeeds.
- **The identity provider's signing keys rotate mid-session.** Later sign-ins keep working without a
  redeploy or a configuration change.
- **The identity service is reachable but slow.** Sign-in waits only up to a stated limit, then
  refuses entry rather than hanging; the operator can retry.
- **The parallel portal's address is opened by a search engine, a monitor or a link preview.** It
  gets a sign-in redirect, never portal content, and the portal's health check stays reachable
  without signing in.
- **A dependency of the portal that is slow or returns errors.** The parallel portal shows the same
  behaviour the current portal shows for that dependency; this feature changes sign-in only.
- **A portal screen is backed by a service that checks the caller's role.** It keeps working. The
  roles on the outbound service-call token do not come from the identity provider: the Authentik
  session already carries an empty `roles` claim, and the cohort role set is a portal-side constant
  applied to every authenticated session. Changing the identity provider therefore changes nothing
  about roles. This is verified rather than assumed (FR-025).
- **Both portals write to the same dev data at once.** This is accepted (FR-022). The two writes
  carry different actor subjects — one an Authentik subject, one an Auth0 subject — into the same
  audit columns, so rows written from the parallel portal are distinguishable (FR-026) and dev audit
  history is read as mixed from the moment the parallel portal is deployed.
- **The platform user identifier is mistaken for the actor subject.** If the platform identifier were
  put where the session holds the operator's provider subject, it would flow into the outbound
  service-call token and be stamped as a provider-issued actor, which is a worse mismatch than the
  honest one above and pre-empts the actor-identifier strand. FR-027 keeps the two values apart.
- **The parallel portal is deployed but its Auth0 registration lacks its callback address.** Every
  sign-in fails at the provider. The checklist item for callback addresses catches it before
  operators are invited.

## Requirements *(mandatory)*

### Functional Requirements

**The parallel deployment**

- **FR-001**: The portal MUST be deployed as a second, independently addressed instance running the
  same portal features as the current portal, differing only in how operators are signed in and in
  the platform user binding of FR-010.
- **FR-002**: The current portal MUST NOT be changed, restarted, re-pointed or taken out of service
  by this feature: its address, its Authentik sign-in route, its sessions and its configuration stay
  as they are. Shared source code MAY be changed only in ways that leave the current portal's
  behaviour identical, proven by its existing automated checks.
- **FR-003**: The two portals MUST NOT share a session store, a session cookie name, a sign-in
  callback address or any identity-provider registration. Ending a session on one MUST have no
  effect on the other.
- **FR-004**: The parallel portal MUST be withdrawable at any time without any change to, or
  redeployment of, the current portal.
- **FR-005**: The parallel portal MUST be deployed in the **dev environment only** (decided
  2026-11-13). Staging and production are out of scope; the current portal is not deployed to
  staging today, and production is IPX-9504.
- **FR-006**: Every portal screen in the parallel portal MUST carry a visible marker identifying it
  as the Auth0 portal.

**Sign-in**

- **FR-007**: The parallel portal MUST sign operators in through the Auth0 tenant for its
  environment, using the ipxos.ai Google Workspace route configured in IPX-9497, and MUST offer no
  other sign-in route, including no password route and no Authentik route.
- **FR-008**: Every portal screen and every portal data request MUST require a valid session; an
  unauthenticated request MUST be refused and the operator sent to sign in, and MUST NOT return
  portal content. The health check MUST remain reachable without signing in and MUST reveal nothing
  about operators.
- **FR-009**: The portal's server side MUST verify the sign-in result it receives itself — signature,
  issuing provider, intended recipient, expiry and not-before — before creating a session, and MUST
  reject anything unverifiable, expired or wrongly addressed (TRU.IAM.R67). There MUST be no setting,
  in any environment, that switches this verification off.
- **FR-010**: On a verified sign-in the portal's server side MUST obtain the operator's platform user
  identifier from the platform identity service and hold it for the session. If that identifier
  cannot be obtained, or the person's platform user is disabled, entry MUST be refused.
- **FR-011**: The acting operator for anything the portal records or sends onward MUST be taken from
  the verified sign-in result and the platform user identifier derived from it, never from a request
  body, query string, path parameter or header supplied by the browser (TRU.IAM.R53).
- **FR-012**: The session MUST NOT carry roles, groups, permissions or any access decision beyond
  "this person is an authenticated operator" (TRU.IAM.R63, constitution Principle VI). No
  role-based or permission-based authorisation is built in this feature.
- **FR-013**: The portal MUST fail closed: when the identity provider or the identity service is
  unavailable, slow beyond a stated limit, or answers with an error, entry MUST be refused with an
  explanatory message, and no portal screen MUST become reachable.
- **FR-014**: Operators MUST be able to sign out, which MUST end the portal session and the
  operator's Auth0 session for the portal.
- **FR-015**: A session MUST expire after a stated period of inactivity and a stated absolute
  lifetime, after which the operator MUST sign in again.

**Operating two portals**

- **FR-016**: Operator-facing refusal messages MUST say what to do next (retry, or who to contact)
  and MUST NOT disclose provider names, configuration values, tokens or internal error text.
- **FR-017**: Every sign-in outcome — admitted, refused, and the reason for a refusal — MUST be
  recorded with a correlation identifier and a timestamp, and MUST NOT contain tokens, secrets,
  authorisation codes or personal data beyond identifiers already held by the platform.
- **FR-018**: The portal's identity settings (provider address, application identity, intended
  recipient, identity service address) MUST come from validated environment configuration, never
  from values written into the code, and the parallel portal MUST refuse to start when any of them
  is missing or malformed.
- **FR-019**: The parallel portal's client credentials MUST be stored in the secrets manager under
  their own keys, separate from the current portal's, and MUST NOT appear in the repository, in
  logs, or anywhere reachable by the browser.
- **FR-020**: The feature MUST deliver a written deployment-and-verification checklist covering
  FR-001 to FR-019 and FR-024 to FR-027, runnable by an administrator who did not perform the deployment, plus the
  procedure for withdrawing the parallel portal.
- **FR-021**: The parallel portal MUST be able to be run on a developer workstation, signing in
  against a local identity provider stub and a locally running identity service, with no cloud
  account and no live tenant (constitution Principle VIII).
- **FR-022**: The parallel portal MUST use the **same backing services and the same data as the
  current dev portal** (decided 2026-11-13), so the two can be compared directly on real dev
  content. No portal feature is added, removed or redesigned by this feature, and portal features
  other than sign-in MUST behave the same as in the current portal.

**Calling the backing services from the parallel portal**

- **FR-024**: This feature MUST NOT change the token the portal sends to a backing service, nor any
  backing service's code or configuration (decided 2026-11-13). The outbound service-call mechanism
  stays exactly as it is today — the same shared signing secret, the same configured outbound
  issuer, the same audience, and the same portal-side role set — so every backing service verifies
  the call exactly as it does now. The operator's provider subject from the Auth0 sign-in flows
  through as the actor subject, and that is the only difference a backing service can observe. The
  asymmetric end-state is ADR-PLATFORM-004 §D2 / IPX-1932 and is explicitly not this ticket.
- **FR-025**: Every portal screen MUST be exercised on the parallel portal and recorded as working
  or not working, with the reason, in the feature's verification checklist. The expectation is that
  all of them work, because nothing below sign-in changes (FR-024); the sweep exists to prove that
  rather than to assume it. Any screen found not working MUST either be fixed or shown to the
  operator as unavailable on this portal, never left to fail silently or to show empty data as if it
  were real.
- **FR-026**: Writes made from the parallel portal MUST be recognisable afterwards in the shared dev
  data, so that audit rows attributed to an Auth0 sign-in can be told apart from rows written through
  the current portal.
- **FR-027**: The session MUST hold the operator's provider subject and their platform user
  identifier as two separate values. The provider subject is what the outbound service-call token
  carries as the actor (FR-024); the platform user identifier is held for later work (FR-010) and
  MUST NOT be substituted for the provider subject anywhere a service call is made.
- **FR-028**: This feature's code MUST NOT be merged to `main` while the two portals run side by side
  (decided 2026-11-19). The parallel portal runs an image built from the feature branch, and the
  current portal's image tag, configuration and pods stay exactly as they are. Merging is a
  separate, later decision taken when the switch-over is decided (IPX-9504), not part of this feature.
- **FR-023**: Decommissioning the Authentik portal, migrating anything held against Authentik
  identities, and production rollout are out of scope and MUST be left to IPX-9504.

### Key Entities

- **Parallel Ops Portal instance**: The second deployment. Has its own address, its own Auth0
  application registration, its own session store and cookie, its own secrets entries, and a visible
  marker. Runs the same portal features as the current portal.
- **Current Ops Portal instance**: Today's deployment on Authentik. Untouched by this feature; its
  continued, unchanged behaviour is an acceptance criterion.
- **Operator session**: What the portal holds between sign-ins. Carries who the operator is (name
  and email as reported at sign-in), the operator's provider subject, the platform user identifier as
  a separate value (FR-027), and expiry. Carries no roles beyond the portal-side constant that is
  already sent today, and no access decision.
- **Sign-in outcome record**: One record per admission or refusal, with reason code, correlation
  identifier and timestamp. Holds no tokens, secrets or personal data beyond held identifiers.
- **Portal identity settings**: The per-environment values the portal needs to sign operators in and
  to reach the identity service. Validated at start-up; secrets live in the secrets manager.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An ipxos.ai operator signs in to the parallel portal and reaches its landing screen on
  the first attempt in under 30 seconds, with no account creation step and no password.
- **SC-002**: Zero operator-visible changes on the current portal while the parallel portal is
  deployed, in use and later withdrawn: its address, sign-in route and open sessions all continue to
  work, confirmed before, during and after.
- **SC-003a**: Every portal screen has been exercised on the parallel portal and recorded in the
  checklist, with no screen unverified, and any screen found not working either fixed or shown to
  the operator as unavailable.
- **SC-003**: 100% of entry attempts that cannot be proven are refused and reach no portal screen,
  across every case in Story 4 (outsider account, altered result, expired result, wrong recipient,
  provider unavailable, identity service unavailable or erroring).
- **SC-004**: Every operator admitted to the parallel portal has a platform user identifier held for
  their session, and the same person receives the same identifier on every later sign-in — 100% of
  sign-ins across at least 10 sign-ins by at least 3 people, including one first-ever sign-in.
- **SC-005**: Zero roles, groups or permissions appear in any session the parallel portal creates.
- **SC-006**: Every item on the deployment-and-verification checklist passes, run by an
  administrator who did not perform the deployment.
- **SC-007**: The parallel portal can be withdrawn and the current portal confirmed healthy within
  15 minutes, with no change to the current portal.
- **SC-008**: A developer runs the parallel portal and completes a sign-in on a clean workstation,
  from the written quickstart alone, without a cloud account or a live tenant.
- **SC-009**: Zero tokens, secrets, authorisation codes or unheld personal data appear in the
  portal's records, checked across a run of at least 20 sign-in attempts covering admissions and
  every refusal reason.

## Assumptions

- **The portal is the existing `ipx-ops` application** in the `ipxos-ai/ipx` repository, served to
  operators as web pages with a server side of its own. "Parallel deployment" means a second
  deployment of that same application with different configuration, not a rewrite or a fork of its
  features.
- **The Auth0 tenants already exist** for dev and staging, configured by hand in IPX-9497: one
  sign-in route (ipxos.ai Google Workspace), one refusal check that admits only the ipxos.ai domain,
  no roles in what they issue. This feature consumes them and does not re-specify them. It will add
  the parallel portal's callback addresses to the existing Ops Portal application registration, or
  register the parallel portal as its own application — a planning decision, either way covered by
  FR-003 and the IPX-9497 checklist.
- **The platform identity service (svc-identity) is the source of the platform user identifier**, via
  its single "resolve or create me" operation, which creates the platform user on a person's first
  sign-in. Its behaviour, including every refusal and error answer the portal must fail closed on,
  is given in
  [its contract](../002-svc-identity/contracts/resolve-me-api.md).
- **svc-identity deployment is IPX-9499 and is not part of this feature.** Where it is not yet
  deployed for an environment, the parallel portal is demonstrated against a locally or otherwise
  reachable instance; FR-010 is met in an environment only once svc-identity is reachable there.
- **Sign-in happens at the portal's server side**, so no token, client credential or
  authorisation code is handled in, or reachable by, the browser.
- **Session lifetimes** default to the identity provider's current settings (3 days idle, 30 days
  absolute, recorded in IPX-9497) unless planning sets shorter portal-side limits. The leaver
  exposure this creates is the accepted risk already recorded in IPX-9497.
- **The backing services' verification posture in dev is mixed, and is taken as given.** As
  configured on 2026-11-13, verification is off for svc-product-factory, svc-policy-factory,
  svc-ledger, svc-party-factory, svc-commission-factory, svc-payment-factory, svc-business-date and
  svc-document, and on for svc-notification, svc-claims-factory, svc-actuarial-factory,
  svc-reinsurance, svc-underwriting, svc-ref, svc-crm-factory and the finance service. This feature
  neither relies on a service's verification being off nor changes any of it. Reading the shared dev
  data as expendable is what makes FR-022 acceptable, not the absence of checking.
- **Roles are not tied to the identity provider, so the provider swap does not affect them.** The
  Authentik session already carries an empty `roles` claim for real operators, and the cohort role
  set the outbound token carries is a portal-side constant applied to every authenticated session;
  the portal has no per-operator authorisation. An Auth0 session produces the same outcome. Where
  operator roles should ultimately come from is a canon question (constitution Principle VI) and is
  out of scope here.
- **Exactly one Auth0-issued token exists in this feature**: the operator access token addressed to
  the identity service, used once during the sign-in callback. The portal session is the portal's
  own, and the service-call token is minted by the portal under the interim scheme (FR-024). No
  Auth0 token needs to be stored beyond the callback.
- **Access is domain-only**: every ipxos.ai Workspace member who can sign in today can sign in to
  the parallel portal. Narrowing that is a later platform-role concern (constitution Principle VI).
- **Operators are told which address to use and when**, by the team; inviting operators onto the
  parallel portal is an operational step, not a product feature.
- **Nothing is merged or deployed until the developer explicitly approves it** (constitution
  Development Workflow item 8), including the parallel deployment itself.

## Dependencies

| Dependency | Status | What this feature needs from it |
|---|---|---|
| IPX-9497 — Auth0 tenants (dev, staging) | Delivered by hand; checklist in `001-ops-auth0-tenants/runbook.md` | A sign-in route for ipxos.ai operators, the portal's callback addresses registered, and the issuer and intended-recipient values in the secrets manager |
| IPX-9498 — svc-identity | Delivered (merged, not deployed) | The platform user identifier, from its "resolve or create me" operation |
| IPX-9499 — svc-identity deployment | Not done | A reachable identity service in each environment where FR-010 must hold |
| IPX-9504 — production and Authentik retirement | Not started | Takes over production rollout and decommissioning; this feature must not pre-empt either |
| IPX-1932 — asymmetric service-call tokens (ADR-PLATFORM-004 §D2) | Not started; every factory service's JWKS reference is a deferral comment, no implementation | Owns the end-state for service-call tokens. This feature keeps the interim scheme untouched (FR-024) |

## Scope boundary: this feature is strand S1 of four

The developer scoped this ticket to S1 on 2026-11-13. The other strands are named here so they are
owned rather than rediscovered, and because the sequencing is forced by the no-interruption
constraint.

| Strand | What it does | Touches | State |
|---|---|---|---|
| **S1 — this feature** | Operator sign-in moves to Auth0; the platform user record is created and held | `ipx` (ipx-ops) only | Specified here |
| S2 — service-call tokens | Portal-minted shared-secret tokens become asymmetric tokens verified against the provider's published keys | Portal plus every factory service, and a shared verifier | ADR-PLATFORM-004 §D2 / IPX-1932. Not started |
| S3 — actor identity | The recorded actor becomes the platform user identifier instead of a provider subject | `domain-docs` identifier contract, the shared contracts package, every service's audit columns, plus a backfill or dual-read | **Unowned — needs its own ticket** |
| S4 — operator roles | Decides where operator roles come from once the provider issues none | Canon first, then wherever roles are provisioned | **Unowned — a canon question, not an engineering one** |

Sequencing, and why: S1 stands alone and changes nothing below sign-in. **S4 gates S2**, because a
provider-issued token carries no roles while backing services still gate routes on them. S2 must give
each service a transitional posture that accepts both the old and the new token, or the current
portal breaks the moment a service moves. S3 follows, and only then can the provider-shaped actor
form and the interim signing scheme be deleted. Retiring the current portal (IPX-9504) depends on
S3, not on S1.

## Open Questions

- **Governance (constitution Principle II)**: no `/ipx-discuss` record exists for IPX-9500 in this
  repository, and the discuss skill was not available in the session that produced this spec. This
  spec was written from the user's instruction and the delivered IPX-9497 and IPX-9498 artifacts, and
  MUST be reconciled with the discuss output for IPX-9500 before `/speckit-plan`.
  **Answered (2026-11-19):** `/ipx-discuss IPX-9500` ran on 2026-11-13 and produced ipx-ops ADR-0051
  (decisions D1–D5), the sequence and architecture docs, and the merged LLD change ipx-cd#2199. The
  plan is built from that output. ⚠️ The ADR, the docs and the governance binding exist only on the
  workstation that ran discuss: none of them is on this machine or on the `ipx` remote. The number
  0051 has since been taken on `ipx` `main` (#4681), so the ADR needs a new number when it lands
  (tasks.md T001).
- **S3 and S4 have no tickets.** Both are prerequisites for retiring the current portal, and S4
  gates S2. They should be filed before IPX-9504 is planned, not during it.
- **Two dev-only paths reference the current provider's actor form** (the dev-officer switch and the
  dev-persona actor type, ipx-ops ADR-0014). Whether they still behave on an Auth0 session has not
  been traced and MUST be checked in `/speckit-plan`.
  **Traced (2026-11-19, research.md R12):** they **do** reach an Auth0 session. The current dev
  release sets `AUTH_BYPASS=1` with the entry gate on (IPX-9880), and in that posture the bypass
  identity replaces the signed-in session. The parallel release must therefore run with
  `AUTH_BYPASS` off, as the developer decided on 2026-11-19 (tasks.md T068).
- **Canon**: the identifiers cited (TRU.IAM.R63, R67, R53) are inherited from IPX-9497 and IPX-9498.
  Whether IPX-9500 carries further canon requirements — in particular anything on portal session
  handling — needs confirming against `domain-docs` (constitution Principle I).
