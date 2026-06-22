'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { buildPrompt, loadRubric, rubricToBoxes, PERSONAS, FRAMINGS, PROMPT_HINT_MAX }
  = require('../scripts/global/multi-judge-prompts.js');

test('PERSONAS has approving/adversarial/balanced', () => {
  assert.deepEqual(PERSONAS, ['approving', 'adversarial', 'balanced']);
});

test('FRAMINGS are distinct per persona', () => {
  assert.notEqual(FRAMINGS.approving, FRAMINGS.adversarial);
  assert.notEqual(FRAMINGS.adversarial, FRAMINGS.balanced);
  assert.match(FRAMINGS.adversarial, /red-team|adversarial|FAIL/);
});

test('loadRubric returns g1-g9-v3 with all 9 goals', () => {
  const r = loadRubric();
  assert.equal(r.version, 'g1-g9-v3');
  for (let i = 1; i <= 9; i++) assert.ok(r.goals[`G${i}`]);
});

test('rubricToBoxes flattens goals into box list', () => {
  const r = loadRubric();
  const boxes = rubricToBoxes(r);
  assert.ok(boxes.length >= 18);
  const g1 = boxes.filter(b => b.goal === 'G1');
  assert.ok(g1.length >= 2);
  assert.ok(g1[0].id.startsWith('g1-'));
});

test('buildPrompt includes persona framing + rubric boxes + artifact', () => {
  const p = buildPrompt('adversarial', 'sample artifact text');
  assert.match(p, /adversarial|red-team/);
  assert.match(p, /G1\.g1-/);
  assert.match(p, /G9\./);
  assert.match(p, /sample artifact text/);
  assert.match(p, /Respond ONLY with JSON/);
});

test('buildPrompt rejects unknown persona', () => {
  assert.throws(() => buildPrompt('unknown', 'x'), /unknown persona/);
});

test('buildPrompt truncates oversize artifact', () => {
  const huge = 'x'.repeat(PROMPT_HINT_MAX * 2);
  const p = buildPrompt('balanced', huge);
  const lines = p.split('\n');
  const artifactLine = lines.find(l => l.startsWith('x'));
  assert.ok(artifactLine.length <= PROMPT_HINT_MAX);
});

test('buildPrompt accepts injected rubric (no IO)', () => {
  const fakeRubric = { goals: { G1: { title: 'Custom', boxes: [{ id: 'g1-x', check: 'Custom check' }] } } };
  const p = buildPrompt('approving', 'a', fakeRubric);
  assert.match(p, /Custom check/);
  assert.doesNotMatch(p, /g2-/);
});
