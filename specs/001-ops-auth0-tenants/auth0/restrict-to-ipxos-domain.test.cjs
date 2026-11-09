// Contract tests for restrict-to-ipxos-domain.cjs (contracts/restrict-to-ipxos-domain-action.md).
// Run (from the ipx-specs root): node --test 'specs/001-ops-auth0-tenants/auth0/*.test.cjs'
const test = require('node:test');
const assert = require('node:assert/strict');
const { onExecutePostLogin } = require('./restrict-to-ipxos-domain.cjs');

const MEMBERS = [
  'access.deny',
  'idToken.setCustomClaim',
  'accessToken.setCustomClaim',
  'user.setAppMetadata',
  'user.setUserMetadata',
  'multifactor.enable',
  'redirect.sendUserTo',
];

function spyApi() {
  const calls = [];
  const api = {};
  for (const name of MEMBERS) {
    const [group, fn] = name.split('.');
    api[group] ??= {};
    api[group][fn] = (...args) => calls.push({ name, args });
  }
  return { api, calls };
}

async function run(user) {
  const { api, calls } = spyApi();
  await onExecutePostLogin({ user }, api);
  return calls;
}

test('A1: ipxos.ai is admitted and no api member is called', async () => {
  assert.deepEqual(await run({ idp_tenant_domain: 'ipxos.ai' }), []);
});

for (const domain of ['example.com', 'IPXOS.AI', 'sub.ipxos.ai', 'ipxos.ai.evil.com']) {
  test(`D1: ${domain} is denied once, reason carries no input`, async () => {
    const calls = await run({ idp_tenant_domain: domain });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].name, 'access.deny');
    assert.equal(typeof calls[0].args[0], 'string');
    assert.ok(!calls[0].args[0].includes(domain));
  });
}

for (const [label, user] of [
  ['missing', {}],
  ['null', { idp_tenant_domain: null }],
  ['undefined', { idp_tenant_domain: undefined }],
  ['empty', { idp_tenant_domain: '' }],
]) {
  test(`D2: ${label} domain is denied once`, async () => {
    const calls = await run(user);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].name, 'access.deny');
  });
}
