'use strict';
// Epic #3391 B4 (#3408) — drift test: EVERY enumerated goal-list consumer must carry the
// operator-autonomy dimension (Option B: cross-cutting always-on principle, not a ranked goal),
// and the byte-identity trap must stay defused (canonical == hook, anchored through G10).
// This is the zero-drift guarantee the atomic propagation (B2/B3) has to keep true.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// Each enumerated consumer -> a marker proving it carries the autonomy dimension.
const CONSUMERS = {
  'instructions/harness-goals.instructions.md': /Operator Autonomy \(cross-cutting principle/i,
  'instructions/global-standards.instructions.md': /operator autonomy/i,
  'instructions/owasp-agentic-mapping.instructions.md': /operator autonomy/i,
  'instructions/test-methodology-matrix.instructions.md': /operator autonomy/i,
  'hooks/scripts/goal_lens.py': /Operator autonomy \(always-on principle\)/i,
  'scripts/global/governance-context.js': /AUTONOMY_PRINCIPLE/,
  'scripts/global/second-opinion-runner.js': /GA=N|Operator-Autonomy/,
  'scripts/global/governance-bundle-fields.js': /autonomy_score/,
  'scripts/global/governance-bundle.js': /autonomy_score/,
  'scripts/global/fleet-decision-oracle.js': /autonomy/i,
  'scripts/global/adjudication-guardrail.js': /Operator-Autonomy/i,
};

test('every enumerated goal-list consumer carries the autonomy dimension (zero drift)', () => {
  for (const [rel, marker] of Object.entries(CONSUMERS)) {
    assert.match(read(rel), marker, `${rel} is missing the operator-autonomy dimension`);
  }
});

test('harness-goals Constitution carries the 4 carve-outs + C-G1/C-G4 + G8 logging + versioning', () => {
  const md = read('instructions/harness-goals.instructions.md');
  for (const needle of ['design direction', 'UAT', 'irreversible', 'security', 'C-G1', 'C-G4',
    'reversible-fast-path', 'retained-human-touchpoints.json', 'client-prompt-rate']) {
    assert.ok(md.includes(needle), `Constitution missing: ${needle}`);
  }
  assert.match(md, /Autonomy check \(always first/i, 'Decision-Lens autonomy entry missing');
});

test('byte-identity trap defused: canonical == hook, extraction anchors THROUGH G10', () => {
  const { extractCanonical } = require('../scripts/global/lint-goal-canonical-identity.js');
  const canonical = extractCanonical(read('instructions/harness-goals.instructions.md'));
  const hook = extractCanonical(read('hooks/scripts/goal_lens.py'));
  assert.ok(canonical, 'canonical sentence not extracted');
  assert.strictEqual(hook, canonical, 'goal_lens.py drifts from canonical priority sentence');
  // Regex must reach G10 Maintainability, not silently truncate at G9 Interoperability.
  assert.match(canonical, /Maintainability$/, 'extraction truncated before G10 (regex not extended)');
  const lintSrc = read('scripts/global/lint-goal-canonical-identity.js');
  assert.match(lintSrc, /G1 Governance\[\^"\]\*\?Maintainability/,
    'extraction regex still anchored on Interoperability — G10/future dimensions truncated');
});

test('rater parses a GA (autonomy) score line', () => {
  const { parseScoreLines } = require('../scripts/global/second-opinion-runner.js');
  const scores = parseScoreLines('G1=8\nG2=9\nG9=7\nGA=6\n');
  assert.strictEqual(scores.GA, 6, 'GA autonomy score not parsed');
  assert.strictEqual(scores.G1, 8);
});

test('governance-bundle allow-list + fields include autonomy_score', () => {
  const { FIELD_KEYS } = require('../scripts/global/governance-bundle.js');
  const { ROLE_FIELD_KEYS } = require('../scripts/global/governance-bundle-fields.js');
  assert.ok(FIELD_KEYS.includes('autonomy_score'), 'FIELD_KEYS missing autonomy_score');
  assert.ok(ROLE_FIELD_KEYS.consultant.includes('autonomy_score'), 'consultant fields missing autonomy_score');
});

test('governance-context prefix injects the autonomy principle', () => {
  const gc = require('../scripts/global/governance-context.js');
  assert.ok(gc.AUTONOMY_PRINCIPLE && /operator autonomy/i.test(gc.AUTONOMY_PRINCIPLE));
  assert.match(gc.buildPrefix(), /operator autonomy/i);
  // count-normalization: the canonical priority sentence is the full G1..G10 ranked set.
  assert.match(gc.PRIORITY_SENTENCE, /G10 Maintainability/);
  assert.match(gc.PRIORITY_SENTENCE, /G4 Privacy & Security/);
});

test('G-count normalization: goal_lens docstring reflects G1-G10 (not stale G1-G9)', () => {
  const py = read('hooks/scripts/goal_lens.py');
  assert.match(py, /inject G1-G10 decision lens/, 'goal_lens docstring still says G1-G9');
});
