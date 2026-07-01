'use strict';
// AC4 rule-coverage gate: every rule in the YAML table MUST be exercised by an F0..F4 fixture
// and emit its declared severity; the generated rule doc MUST be in sync with the source.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const engine = require('../scripts/global/fleet-advisor-lint.js');
const ruleDoc = require('../scripts/global/fleet-advisor-rules-doc.js');

const FIX_DIR = path.join(__dirname, 'fixtures', 'fleet-advisor');

function allFiredFindings() {
  const fired = new Map();
  for (const name of fs.readdirSync(FIX_DIR)) {
    const fx = JSON.parse(fs.readFileSync(path.join(FIX_DIR, name), 'utf8'));
    const lastEmit = fx.probe.telemetry && fx.probe.telemetry.lastEmitMs;
    const now = lastEmit ? lastEmit + 1000 : 8 * 24 * 60 * 60 * 1000;
    for (const f of engine.runLint(fx.probe, { now }).findings) fired.set(f.id, f);
  }
  return fired;
}

test('AC4 — EVERY rule is exercised across F0..F4 fixtures', () => {
  const fired = allFiredFindings();
  const { rules } = engine.loadRules();
  const missing = rules.filter((r) => !fired.has(r.id)).map((r) => r.id);
  assert.deepEqual(missing, [], `uncovered rules: ${missing.join(', ')}`);
});

test('AC4 — each fired rule emits its declared severity', () => {
  const fired = allFiredFindings();
  const { rules } = engine.loadRules();
  for (const r of rules) {
    const f = fired.get(r.id);
    if (f) assert.equal(f.severity, r.severity, `severity mismatch ${r.id}`);
  }
});

test('AC4 — generated rule doc is in sync with the YAML source', () => {
  const current = fs.existsSync(ruleDoc.DOC_PATH) ? fs.readFileSync(ruleDoc.DOC_PATH, 'utf8') : '';
  assert.equal(current, ruleDoc.generate(), 'run: npm run fleet-advisor:rules-doc');
});

test('fixtures declare the findings the engine actually emits (fixture integrity)', () => {
  for (const name of fs.readdirSync(FIX_DIR)) {
    const fx = JSON.parse(fs.readFileSync(path.join(FIX_DIR, name), 'utf8'));
    const lastEmit = fx.probe.telemetry && fx.probe.telemetry.lastEmitMs;
    const now = lastEmit ? lastEmit + 1000 : 8 * 24 * 60 * 60 * 1000;
    const got = engine.runLint(fx.probe, { now }).findings.map((f) => f.id).sort();
    assert.deepEqual(got, (fx.expectFindings || []).slice().sort(), `${name} findings`);
  }
});
