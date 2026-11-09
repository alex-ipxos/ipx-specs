/**
 * Restrict to ipxos.ai — Auth0 Login / Post Login Action (Node 22).
 *
 * Pasted verbatim into each Ops Portal tenant (ipxos-dev, ipxos-stg). The deployed copy must match
 * this file byte for byte (FR-015). Deny-only: it never adds claims or metadata (TRU.IAM.R63,
 * ipx-ops ADR-0040 decision 5).
 */
exports.onExecutePostLogin = async (event, api) => {
  if (event.user.idp_tenant_domain !== 'ipxos.ai') {
    api.access.deny('Only ipxos.ai accounts can sign in to IPX Ops.');
  }
};
