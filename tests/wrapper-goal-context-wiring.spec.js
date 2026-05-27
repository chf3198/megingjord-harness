// Refs #2234 — wiring tests for injectGoalContext into wrapProviderCall
const test = require('node:test');
const assert = require('node:assert/strict');
const { wrapProviderCall } = require('../scripts/global/hamr-provider-wrapper.js');

test('governed call: bodyExtras contains systemPrefix with G1-G10', async () => {
  let captured = null;
  await wrapProviderCall('ollama', async (hints) => {
    captured = hints;
    return { response: 'ok' };
  }, { tier: 'fleet-local' });
  assert.ok(captured.bodyExtras, 'bodyExtras missing');
  assert.ok(captured.bodyExtras.systemPrefix, 'systemPrefix missing');
  assert.match(captured.bodyExtras.systemPrefix, /G1.*G10/);
});

test('diagnostic tier: NO systemPrefix injected', async () => {
  let captured = null;
  await wrapProviderCall('ollama', async (hints) => {
    captured = hints;
    return { response: 'ok' };
  }, { tier: 'diagnostic' });
  assert.equal(captured.bodyExtras && captured.bodyExtras.systemPrefix, undefined);
});

test('test tier: NO systemPrefix injected', async () => {
  let captured = null;
  await wrapProviderCall('ollama', async (hints) => {
    captured = hints;
    return { response: 'ok' };
  }, { tier: 'test' });
  assert.equal(captured.bodyExtras && captured.bodyExtras.systemPrefix, undefined);
});

test('explicit opt-out (inject_goal_context: false): NO systemPrefix', async () => {
  let captured = null;
  await wrapProviderCall('anthropic', async (hints) => {
    captured = hints;
    return { response: 'ok' };
  }, { tier: 'haiku', inject_goal_context: false });
  assert.equal(captured.bodyExtras && captured.bodyExtras.systemPrefix, undefined);
});

test('hamr-disabled: NO systemPrefix (short-circuits)', async () => {
  process.env.MEGINGJORD_HAMR_DISABLED = '1';
  try {
    let captured = null;
    await wrapProviderCall('ollama', async (hints) => {
      captured = hints;
      return { response: 'ok' };
    }, { tier: 'fleet-local' });
    assert.equal(captured.bodyExtras && captured.bodyExtras.systemPrefix, undefined);
  } finally {
    delete process.env.MEGINGJORD_HAMR_DISABLED;
  }
});

test('headers preserved alongside systemPrefix (additive)', async () => {
  let captured = null;
  await wrapProviderCall('anthropic', async (hints) => {
    captured = hints;
    return { response: 'ok' };
  }, { tier: 'haiku' });
  assert.ok(captured.headers !== undefined, 'cache headers must still be threaded');
});

test('caller-supplied bodyExtras preserved (not overwritten)', async () => {
  let captured = null;
  await wrapProviderCall('ollama', async (hints) => {
    captured = hints;
    // Caller may extend bodyExtras themselves; our injection should not blow that away
    return { response: 'ok' };
  }, { tier: 'fleet-local' });
  // We provide bodyExtras with systemPrefix; verify it's there
  assert.ok(captured.bodyExtras.systemPrefix);
});

test('REGRESSION #1962: priority sentence forces harness G1-G10 (not NIST/OECD)', async () => {
  let captured = null;
  await wrapProviderCall('ollama', async (hints) => {
    captured = hints;
    return { response: 'ok' };
  }, { tier: 'fleet-local' });
  assert.equal(captured.bodyExtras.systemPrefix.includes('NIST'), false);
  assert.equal(captured.bodyExtras.systemPrefix.includes('OECD'), false);
  assert.match(captured.bodyExtras.systemPrefix, /G3 Zero Cost/);
});
