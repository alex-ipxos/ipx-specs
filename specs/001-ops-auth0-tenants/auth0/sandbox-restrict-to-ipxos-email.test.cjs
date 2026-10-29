// Tests for the SANDBOX-only email Action.
// Run (from the ipx-specs root): node --test 'specs/001-ops-auth0-tenants/auth0/*.test.cjs'
const test = require('node:test');
const assert = require('node:assert/strict');
const { onExecutePostLogin } = require('./sandbox-restrict-to-ipxos-email.cjs');

const MEMBERS = [
  'access.deny',
  'idToken.setCustomClaim',
  'accessToken.setCustomClaim',
  'user.setAppMetadata',
  'user.setUserMetadata',
  'multifactor.enable',
  'redirect.sendUserTo',
];

async function run(user) {
  const calls = [];
  const api = {};
  for (const name of MEMBERS) {
    const [group, fn] = name.split('.');
    api[group] ??= {};
    api[group][fn] = (...args) => calls.push({ name, args });
  }
  await onExecutePostLogin({ user }, api);
  return calls;
}

test('admit: verified alex@ipxos.ai, no api call', async () => {
  assert.deepEqual(await run({ email: 'alex@ipxos.ai', email_verified: true }), []);
});

const denied = [
  ['unverified ipxos.ai', { email: 'alex@ipxos.ai', email_verified: false }],
  ['email_verified missing', { email: 'alex@ipxos.ai' }],
  ['email_verified as string', { email: 'alex@ipxos.ai', email_verified: 'true' }],
  ['gmail', { email: 'alex@gmail.com', email_verified: true }],
  ['subdomain', { email: 'alex@sub.ipxos.ai', email_verified: true }],
  ['suffix attack', { email: 'alex@ipxos.ai.evil.com', email_verified: true }],
  ['lookalike', { email: 'alex@evilipxos.ai', email_verified: true }],
  ['upper case domain', { email: 'alex@IPXOS.AI', email_verified: true }],
  ['empty local part', { email: '@ipxos.ai', email_verified: true }],
  ['two @', { email: 'a@b@ipxos.ai', email_verified: true }],
  ['no email', { email_verified: true }],
  ['null email', { email: null, email_verified: true }],
  ['empty email', { email: '', email_verified: true }],
];
for (const [label, user] of denied) {
  test(`deny: ${label}, once, reason has no user data`, async () => {
    const calls = await run(user);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].name, 'access.deny');
    if (typeof user.email === 'string' && user.email) assert.ok(!calls[0].args[0].includes(user.email));
  });
}
