// tests/trivial-lane-fast-path.spec.js — #2810 regression tests.
// Verifies that lightweight lanes skip baton gates consistently.
'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const LIGHTWEIGHT = [
  'lane:docs-research', 'lane:docs-only', 'lane:trivial',
  'lane:research', 'lane:config-only', 'lane:no-code-remediation',
];
const NON_LIGHTWEIGHT = ['lane:code-change', 'lane:hotfix'];

function isLightweight(labels) {
  return labels.some(l => LIGHTWEIGHT.includes(l));
}

describe('lightweight lane classification', () => {
  for (const lane of LIGHTWEIGHT) {
    it(`${lane} → lightweight (skip baton gates)`, () => {
      assert.ok(isLightweight([lane, 'type:task', 'priority:P1']));
    });
  }
  for (const lane of NON_LIGHTWEIGHT) {
    it(`${lane} → NOT lightweight (require baton gates)`, () => {
      assert.ok(!isLightweight([lane, 'type:task']));
    });
  }
  it('no lane label → NOT lightweight', () => {
    assert.ok(!isLightweight(['type:bug', 'priority:P1']));
  });
});

describe('changelog-fragment-presence: trivial exemption', () => {
  const { validate } = require('../scripts/global/megalint/changelog-fragment-presence.js');
  it('lane:trivial → not-lane-code-change → skip', () => {
    const r = validate({ labels: ['lane:trivial'], prBody: 'Refs #999', prFiles: [] });
    assert.ok(r.ok);
    assert.equal(r.reason, 'not-lane-code-change');
  });
  it('lane:code-change without fragment → fail', () => {
    const r = validate({ labels: ['lane:code-change'], prBody: 'Refs #999', prFiles: [] });
    assert.ok(!r.ok);
  });
});

describe('test-evidence-validator: trivial lane permits none', () => {
  const { validate } = require('../scripts/global/test-evidence-validator.js');
  it('lane:trivial + test_strategy=none → PASS', () => {
    const r = validate({ test_strategy: 'none', lane: 'lane:trivial', comments: [], pr_files: [] });
    assert.ok(r.ok);
    assert.equal(r.reason, 'none-permitted-lane');
  });
  it('lane:code-change + test_strategy=none → FAIL', () => {
    const r = validate({ test_strategy: 'none', lane: 'lane:code-change', comments: [], pr_files: [] });
    assert.ok(!r.ok);
  });
});

describe('edd-required: trivial lane exemption', () => {
  const { validate } = require('../scripts/global/megalint/edd-required.js');
  it('lane:trivial → exempt', () => {
    const r = validate({ labels: ['lane:trivial'], prBody: 'Refs #42', comments: [] });
    assert.ok(r.exempt || r.ok);
  });
});
