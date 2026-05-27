const test = require('node:test');
const assert = require('node:assert/strict');
const { shouldBlock, isEnabled, blockMessage, ENV_FLAG, REDIRECT_MSG } = require('../scripts/global/hamr-fleet-direct-block.js');

test('isEnabled: env=1 returns true', () => assert.equal(isEnabled({ MEGINGJORD_FLEET_DIRECT_BLOCK: '1' }), true));
test('isEnabled: env=0 returns false', () => assert.equal(isEnabled({ MEGINGJORD_FLEET_DIRECT_BLOCK: '0' }), false));
test('isEnabled: missing returns false', () => assert.equal(isEnabled({}), false));

test('shouldBlock: env off + fleet-bypass = no block', () => {
  const r = shouldBlock({ detection: { detected: true, severity: 'fleet-bypass' }, env: {} });
  assert.equal(r.block, false);
  assert.equal(r.reason, 'env-flag-off');
});

test('shouldBlock: env on + fleet-bypass = BLOCK', () => {
  const r = shouldBlock({ detection: { detected: true, severity: 'fleet-bypass' }, env: { MEGINGJORD_FLEET_DIRECT_BLOCK: '1' } });
  assert.equal(r.block, true);
  assert.match(r.message, /Use scripts\/global\/fleet-red-team-dispatch/);
});

test('shouldBlock: env on + paid-bypass = NOT block (out of scope)', () => {
  const r = shouldBlock({ detection: { detected: true, severity: 'paid-bypass' }, env: { MEGINGJORD_FLEET_DIRECT_BLOCK: '1' } });
  assert.equal(r.block, false);
  assert.equal(r.reason, 'paid-bypass-not-fleet-scope');
});

test('shouldBlock: env on + suppressed override = NOT block', () => {
  const r = shouldBlock({ detection: { detected: true, suppressed: true }, env: { MEGINGJORD_FLEET_DIRECT_BLOCK: '1' } });
  assert.equal(r.block, false);
  assert.equal(r.reason, 'override-marker-suppresses');
});

test('shouldBlock: env on + no detection = NOT block', () => {
  const r = shouldBlock({ detection: { detected: false }, env: { MEGINGJORD_FLEET_DIRECT_BLOCK: '1' } });
  assert.equal(r.block, false);
});

test('blockMessage: includes detected provider names', () => {
  const msg = blockMessage({ providers: [{ name: 'ollama-fleet' }, { name: 'ollama-local' }] });
  assert.match(msg, /ollama-fleet, ollama-local/);
});

test('ENV_FLAG constant is MEGINGJORD_FLEET_DIRECT_BLOCK', () => {
  assert.equal(ENV_FLAG, 'MEGINGJORD_FLEET_DIRECT_BLOCK');
});

test('REDIRECT_MSG cites dispatchRedTeam path', () => {
  assert.match(REDIRECT_MSG, /fleet-red-team-dispatch/);
});
