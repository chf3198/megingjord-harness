'use strict';
// tests/wiki-digest-verify.spec.js — CI gate for #3540 wiki manifest hash drift
const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT, 'inventory', 'orchestrator-governance-parity.json');

describe('wiki-digest-verify (#3540)', () => {
  it('reads digestManifest from orchestrator-governance-parity.json', () => {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    const dm = (manifest.wikiDocsParity || {}).digestManifest;
    assert.ok(dm, 'digestManifest key must exist in wikiDocsParity');
    assert.ok(dm.copilot?.indexMd, 'copilot indexMd hash must be present');
    assert.ok(dm.codex?.indexMd, 'codex indexMd hash must be present');
  });

  it('digestManifest copilot hash matches actual deployed wiki index.md', () => {
    const { fileHash } = require('../scripts/global/wiki-parity-check');
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    const expected = manifest.wikiDocsParity?.digestManifest?.copilot?.indexMd;
    const wikiPath = path.join(os.homedir(), '.copilot', 'wiki', 'index.md');
    if (!fs.existsSync(wikiPath)) {
      // Skip if wiki not deployed in this environment
      return;
    }
    const actual = fileHash(wikiPath);
    assert.equal(actual, expected,
      `Manifest hash mismatch for copilot wiki index.md.\n` +
      `Expected (manifest): ${expected}\n` +
      `Actual (deployed):   ${actual}\n` +
      `Fix: run npm run deploy:apply then update inventory/orchestrator-governance-parity.json`
    );
  });

  it('wiki-parity-check returns ok:true with reconciled manifest (#3540)', () => {
    const { run } = require('../scripts/global/wiki-parity-check');
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    const wp = manifest.wikiDocsParity || {};
    const result = run({ digestManifest: wp.digestManifest, runtimeTiers: wp.runtimeTiers });
    const highSev = result.findings.filter(f => f.severity === 'high');
    assert.equal(highSev.length, 0,
      `wiki-parity-check must return 0 high-severity findings after #3540 fix.\n` +
      `Findings: ${JSON.stringify(highSev, null, 2)}`
    );
    assert.ok(result.ok, 'wiki-parity-check must return ok:true after hash reconciliation');
  });

  it('_lastReconciled and _reconciliationNote are present in manifest', () => {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    const wp = manifest.wikiDocsParity;
    assert.ok(wp._lastReconciled, '_lastReconciled must be set in wikiDocsParity after #3540 fix');
    assert.ok(wp._reconciliationNote, '_reconciliationNote must explain drift root cause');
  });
});
