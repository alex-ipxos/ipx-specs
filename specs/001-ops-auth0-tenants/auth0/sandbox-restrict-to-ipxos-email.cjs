/**
 * SANDBOX ONLY: Restrict to ipxos.ai by verified email. Auth0 Login / Post Login Action (Node 22).
 *
 * For tenant dev-ipxos-play, which signs in through the google-oauth2 social connection on Auth0
 * developer keys. That connection does not set idp_tenant_domain, so the real Action
 * (restrict-to-ipxos-domain.cjs) would refuse everyone there. Never deploy this to ipxos-dev,
 * ipxos-stg or production: those use the Workspace connection and the real Action (FR-014).
 * Deny-only: it never adds claims or metadata (TRU.IAM.R63).
 */
exports.onExecutePostLogin = async (event, api) => {
  const email = event.user.email;
  const parts = typeof email === 'string' ? email.split('@') : [];
  const ok =
    event.user.email_verified === true && parts.length === 2 && parts[0] !== '' && parts[1] === 'ipxos.ai';
  if (!ok) {
    api.access.deny('Only ipxos.ai accounts can sign in to IPX Ops.');
  }
};
