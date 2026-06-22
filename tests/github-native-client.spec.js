// tests/github-native-client.spec.js — unit tests for Layer-2 client wrapper. Refs #2756.
'use strict';
const assert = require('node:assert/strict');
const { describe, it, before, after } = require('node:test');
const path = require('node:path');

let client;
const SCRIPTS_DIR = path.resolve(__dirname, '..', 'scripts', 'global');

function resolveScript(name) {
  return path.resolve(SCRIPTS_DIR, name);
}

before(() => {
  const Module = require('node:module');
  const origLoad = Module._load;
  Module._load = function(req, parent, isMain) {
    if (req === './github-mailbox' || req === resolveScript('github-mailbox')) {
      return { writeMessage: async () => {}, readMessages: async () => [{ id: 1, body: 'msg' }] };
    }
    if (req === './github-bundle-client' || req === resolveScript('github-bundle-client')) {
      return { publishBundle: async () => ({ name: 'b' }), fetchBundle: async () => '{}' };
    }
    if (req === './github-mcp-dispatch' || req === resolveScript('github-mcp-dispatch')) {
      return { dispatch: async () => ({ dispatched: true, event_type: 'test' }) };
    }
    if (req === './github-telemetry-read' || req === resolveScript('github-telemetry-read')) {
      return { readTelemetry: async () => ({ mock: true }) };
    }
    if (req === './github-substrate-health-read' || req === resolveScript('github-substrate-health-read')) {
      return { readSubstrateHealth: () => ({ status: 'healthy' }) };
    }
    if (req === './hamr-provider-wrapper' || req === resolveScript('hamr-provider-wrapper')) {
      return {
        fetchBundle: async () => 'hamr-data',
        readTelemetry: async () => ({ hamr: true }),
        readSubstrateHealth: async () => ({ hamr: true }),
        readMailbox: async () => [{ id: 2 }],
        writeMailbox: async () => {},
        publishBundle: async () => ({ hamr: true }),
      };
    }
    return origLoad.apply(this, arguments);
  };

  const modulePath = resolveScript('github-native-client');
  delete require.cache[modulePath];
  client = require(modulePath);
});

after(() => { delete process.env.MEGINGJORD_HAMR_ENABLED; });

describe('GitHub-native mode (default)', () => {
  before(() => { delete process.env.MEGINGJORD_HAMR_ENABLED; });

  it('readMailbox returns github-native messages', async () => {
    delete process.env.MEGINGJORD_HAMR_ENABLED;
    const msgs = await client.readMailbox('o', 'r', 0);
    assert.ok(Array.isArray(msgs));
  });

  it('dispatchMcp always uses GitHub-native dispatch', async () => {
    const result = await client.dispatchMcp('o', 'r', 'test-event');
    assert.equal(result.dispatched, true);
  });

  it('readTelemetry returns github data', async () => {
    const result = await client.readTelemetry('o/r');
    assert.deepEqual(result, { mock: true });
  });
});

describe('HAMR mode (MEGINGJORD_HAMR_ENABLED=1)', () => {
  before(() => { process.env.MEGINGJORD_HAMR_ENABLED = '1'; });
  after(() => { delete process.env.MEGINGJORD_HAMR_ENABLED; });

  it('fetchBundle routes to HAMR', async () => {
    const result = await client.fetchBundle('o', 'r', 'test.json');
    assert.equal(result, 'hamr-data');
  });

  it('readTelemetry routes to HAMR', async () => {
    const result = await client.readTelemetry('o/r');
    assert.deepEqual(result, { hamr: true });
  });
});
