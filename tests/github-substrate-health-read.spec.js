// tests/github-substrate-health-read.spec.js — unit tests. Refs #2754.
'use strict';
const assert = require('node:assert/strict');
const { describe, it, before } = require('node:test');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');

let readSubstrateHealth;

before(() => {
  const Module = require('node:module');
  const origLoad = Module._load;
  Module._load = function(req, parent, isMain) {
    if (req === 'node:child_process') {
      return {
        execSync(cmd) {
          if (cmd.includes('run list')) return JSON.stringify([{ databaseId: 7 }]);
          if (cmd.includes('run download')) {
            const dir = cmd.match(/--dir "([^"]+)"/)?.[1] || os.tmpdir();
            fs.writeFileSync(path.join(dir, 'health.json'), JSON.stringify({ status: 'healthy', ts: '2026-06-08T00:00:00Z' }));
            return '';
          }
          return '';
        },
      };
    }
    return origLoad.apply(this, arguments);
  };
  const modulePath = path.resolve(__dirname, '../scripts/global/github-substrate-health-read');
  delete require.cache[require.resolve(modulePath)];
  ({ readSubstrateHealth } = require(modulePath));
});

describe('readSubstrateHealth', () => {
  it('returns health data', async () => {
    const result = readSubstrateHealth('owner/repo');
    assert.equal(result.status, 'healthy');
  });

  it('returns null when no run exists', () => {
    const Module = require('node:module');
    const orig = Module._load;
    Module._load = function(req) {
      if (req === 'node:child_process') return { execSync() { return '[]'; } };
      return orig.apply(this, arguments);
    };
    const modulePath = path.resolve(__dirname, '../scripts/global/github-substrate-health-read');
    delete require.cache[require.resolve(modulePath)];
    const { readSubstrateHealth: r } = require(modulePath);
    assert.equal(r('owner/repo'), null);
    Module._load = orig;
  });
});
