// tests/github-telemetry-read.spec.js — unit tests for telemetry reader. Refs #2753.
'use strict';
const assert = require('node:assert/strict');
const { describe, it, before } = require('node:test');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');

let readTelemetry, readSubstrateHealth;

before(() => {
  const Module = require('node:module');
  const origLoad = Module._load;
  Module._load = function(req, parent, isMain) {
    if (req === 'node:child_process') {
      return {
        execSync(cmd) {
          if (cmd.includes('run list')) return JSON.stringify([{ databaseId: 42 }]);
          if (cmd.includes('run download')) {
            const dir = cmd.match(/--dir "([^"]+)"/)?.[1] || os.tmpdir();
            const name = cmd.match(/--name "([^"]+)"/)?.[1] || 'telemetry.json';
            fs.writeFileSync(path.join(dir, name), JSON.stringify({ mock: true }));
            return '';
          }
          return '';
        },
      };
    }
    return origLoad.apply(this, arguments);
  };
  const modulePath = path.resolve(__dirname, '../scripts/global/github-telemetry-read');
  delete require.cache[require.resolve(modulePath)];
  ({ readTelemetry, readSubstrateHealth } = require(modulePath));
});

describe('readTelemetry', () => {
  it('returns parsed JSON from artifact', async () => {
    const result = await readTelemetry('owner/repo');
    assert.deepEqual(result, { mock: true });
  });

  it('returns null when run list fails', async () => {
    const Module = require('node:module');
    const origLoad = Module._load;
    Module._load = function(req, parent, isMain) {
      if (req === 'node:child_process') return { execSync() { throw new Error('no runs'); } };
      return origLoad.apply(this, arguments);
    };
    const modulePath = path.resolve(__dirname, '../scripts/global/github-telemetry-read');
    delete require.cache[require.resolve(modulePath)];
    const { readTelemetry: rt } = require(modulePath);
    const result = await rt('owner/repo');
    assert.equal(result, null);
    Module._load = origLoad; // restore
  });
});

describe('readSubstrateHealth', () => {
  it('returns health data from artifact', async () => {
    const result = await readSubstrateHealth('owner/repo');
    assert.ok(result !== undefined);
  });
});
