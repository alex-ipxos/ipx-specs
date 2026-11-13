# Specification Quality Checklist: Ops Portal on Auth0, running beside the current portal

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-11-13
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Validation Notes

### Iteration 3 (2026-11-13) — all items pass

Scope settled with the developer across three decisions:

1. **Environments (FR-005)**: dev only. `ipx-ops` is deployed only to dev today
   (`ipx-cd/dev-ipxosai-services/values-dev.yaml`; `stgcore-ipxosai-services/values-stg.yaml` does
   not carry it), so dev is both the smallest slice and the only like-for-like comparison available.
2. **Backing services (FR-022)**: shared with the current dev portal, on real dev data.
3. **Scope (new "Scope boundary" section)**: this ticket is strand **S1** — operator sign-in and the
   platform user record. The service-call token (S2), the actor identifier (S3) and where operator
   roles come from (S4) are named as separate strands with forced sequencing.

### A premise that was checked and corrected

The developer's stated reason for accepting shared data was that "the backend doesn't verify the
token". Checking it changed two requirements, so it is recorded here:

- **Partly false.** The factory cohort does verify — `svc-commission-factory/src/middleware/auth.ts`
  is the reference implementation (copied by svc-ledger, svc-party-factory, svc-policy-factory,
  svc-product-factory; parity pinned by the IPX-1921 conformance suite): HS256 with mandatory `iss`,
  `aud`, `exp`, `serviceId` and a non-empty `sub`, then `requireRole(...)` on the route. In deployed
  dev it is switched off for product, policy, ledger, party, commission, payment, business-date and
  document, and left on for notification, claims, actuarial, reinsurance, underwriting, ref, crm and
  finance. FR-022's rationale was reworded to rest on dev data being expendable, not on the absence
  of checking.
- **An earlier draft of this spec then over-corrected** and predicted that role-gated screens would
  break under Auth0. That was wrong, and FR-025 and SC-003a were resized accordingly.
  `service-token.server.ts:288` documents, with a live verification dated 2026-07-23, that Authentik
  issues an **empty** `roles` claim for real operators; the cohort role set is a portal-side constant
  applied unconditionally to every authenticated session, and the portal has no per-operator
  authorisation. Roles are therefore not coupled to the identity provider, and the swap does not
  affect them. The outbound issuer is `FACTORY_TOKEN_ISSUER`, a dedicated variable already decoupled
  from the login issuer, so it is unaffected too.
- **What remains**, and is the whole backend-visible delta: the actor subject. An Auth0 subject
  flows into `did:authentik:<sub>` audit columns. FR-024 accepts it, FR-026 makes those rows
  identifiable, and S3 fixes it. FR-027 was added to stop the platform user identifier being
  substituted for the provider subject, which would stamp a platform identifier inside the
  provider's namespace and pre-empt S3.

### Deliberately left to `/speckit-plan`

- Whether the parallel portal reuses the existing Auth0 application registration or gets its own
  (bounded by FR-003 and FR-019).
- Session idle and absolute limits (FR-015; the current portal uses an 8-hour session).
- The timeout before a slow identity service becomes a refusal (FR-013).
- The wording and placement of the Auth0-portal marker (FR-006).
- How a parallel-portal write is made recognisable in shared dev data (FR-026).
- **Tracing the two dev-only paths** that reference the current provider's actor form (the
  dev-officer switch and the dev-persona actor type, ipx-ops ADR-0014). Flagged in Open Questions;
  not traced during specification.

### Governance items, to close before `/speckit-plan`

- No `/ipx-discuss` record exists for IPX-9500 (constitution Principle II, non-waivable).
- The canon identifiers are inherited from IPX-9497/9498 rather than confirmed against `domain-docs`
  (Principle I).
- The Principle VII Linear comment on IPX-9500 for this specify step is still owed; no Linear tool
  was available in the session that produced the spec.
- **S3 and S4 have no Linear tickets.** Both are prerequisites for retiring the current portal, and
  S4 gates S2.

- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`
