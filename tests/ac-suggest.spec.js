'use strict';
// Refs #3329 / Epic #1299 — tdd-pyramid coverage for the AI AC-suggestion tool + reconciler
// backstop + the closeout-rescope-parser plain-AC parse fix.

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const G = path.join(__dirname, '..', 'scripts', 'global');
const core = require(path.join(G, 'ac-suggest'));
const cli = require(path.join(G, 'ac-suggest-cli'));
const replay = require(path.join(G, 'ac-suggest-replay-eval'));
const { parseEpicAcs } = require(path.join(G, 'closeout-rescope-parser'));

// --- AC3: parser plain-AC fix (regression) ----------------------------------------------------
test('parser parses PLAIN ACs (the #3329 bug fix)', () => {
  const acs = parseEpicAcs('- [ ] AC1: Phase-0 gate complete\n- [x] AC2: ships scripts/x.js');
  assert.equal(acs.length, 2);
  assert.equal(acs[0].id, 'AC1');
  assert.equal(acs[0].checked, false);
  assert.equal(acs[1].checked, true);
  assert.match(acs[0].text, /Phase-0/);
});
test('parser still parses BOLD ACs (back-compat)', () => {
  const acs = parseEpicAcs('- [ ] **AC1**: x');
  assert.equal(acs.length, 1);
  assert.equal(acs[0].id, 'AC1');
});

// --- AC3: measurability classifier ------------------------------------------------------------
test('classifier accepts file / #child / numeric-metric / github-state anchors', () => {
  assert.equal(core.classifyMeasurability('ships scripts/global/ac-suggest.js').evidence_source, 'file_existence');
  assert.equal(core.classifyMeasurability('child #1302 closed').evidence_source, 'closed_child');
  assert.equal(core.classifyMeasurability('p99 latency <200ms').evidence_source, 'sensor_output');
  assert.equal(core.classifyMeasurability('PR merged with CI green').evidence_source, 'native_github_api');
});
test('classifier REJECTS aspirational phrasing (incl. metric-word without a number)', () => {
  assert.equal(core.classifyMeasurability('improve code quality').measurable, false);
  assert.equal(core.classifyMeasurability('improve latency').measurable, false); // no number → aspirational
  assert.equal(core.classifyMeasurability('make it more robust').measurable, false);
  assert.equal(core.classifyMeasurability('double-check the logic').measurable, false); // not github "check"
});

// --- AC3: reconciler backstop wiring ----------------------------------------------------------
test('backstop accepts measurable, rejects unmeasurable via the real reconciler', () => {
  const { accepted, rejected } = core.validateSuggestions([
    { id: 'AC1', text: 'ships scripts/global/ac-suggest.js' },          // file_existence (high conf)
    { id: 'AC2', text: 'reduce p99 latency to <200ms' },                // sensor_output (low conf)
    { id: 'AC3', text: 'improve overall quality' },                     // aspirational
  ]);
  assert.equal(accepted.length, 2, 'both measurable ACs accepted (incl. low-confidence sensor)');
  assert.equal(rejected.length, 1);
  assert.deepEqual(accepted.map((a) => a.ac_id).sort(), ['AC1', 'AC2']);
  assert.equal(rejected[0].ac_id, 'AC3');
  assert.equal(rejected[0].consensus, 'unknown'); // no recognized evidence source
});

// --- AC2: suggestACs with injected dispatch + offline fallback ---------------------------------
test('suggestACs parses injected LLM JSON (G3 lane)', async () => {
  const dispatch = async () => ({ ok: true, provider: 'fleet-stub',
    content: 'noise [{"id":"AC1","text":"ships docs/howto/x.md","evidence_source":"file_existence"}] tail' });
  const r = await core.suggestACs('add a how-to doc', { dispatch });
  assert.equal(r.source, 'fleet-stub');
  assert.equal(r.suggestions.length, 1);
  assert.match(r.suggestions[0].text, /docs\/howto/);
});
test('suggestACs falls back deterministically when no LLM lane answers (G6)', async () => {
  const dispatch = async () => ({ ok: false });
  const r = await core.suggestACs('Add scripts/global/foo.js with tests. Reduce p99 to <100ms.', { dispatch });
  assert.equal(r.source, 'offline-fallback');
  assert.ok(r.suggestions.length >= 1);
});
test('suggestACs handles empty problem statement', async () => {
  const r = await core.suggestACs('   ');
  assert.equal(r.suggestions.length, 0);
});

// --- AC4: CLI arg parsing ---------------------------------------------------------------------
test('CLI parseArgs handles --json and --problem', () => {
  const o = cli.parseArgs(['--json', '--problem', 'hello world']);
  assert.equal(o.json, true);
  assert.equal(o.problem, 'hello world');
});
test('CLI renders accepted block as epic-body AC lines', () => {
  const block = cli.renderAcceptedBlock([{ text: 'ships a.js' }, { text: 'child #5 closed' }]);
  assert.match(block, /- \[ \] \*\*AC1\*\*: ships a\.js/);
  assert.match(block, /\*\*AC2\*\*: child #5 closed/);
});

// --- AC5: replay-eval meets the <5% FP-rate bar -----------------------------------------------
test('replay-eval over the corpus meets the <5% FP-rate bar (AC5)', () => {
  const r = replay.run();
  assert.ok(r.total >= 20, 'corpus should be non-trivial');
  assert.ok(r.meetsBar, `FP-rate ${r.fpRate} must be < ${r.fpRateBar}`);
  assert.ok(r.precision >= 0.95, `precision ${r.precision} should be high`);
  assert.ok(r.recall >= 0.85, `recall ${r.recall} should be reasonable`);
});
