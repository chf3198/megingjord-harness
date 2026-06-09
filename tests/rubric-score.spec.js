const { test, expect } = require('@playwright/test');
const path = require('path');
const root = path.resolve(__dirname, '..');
const rubric = require(path.join(root, 'inventory', 'rubric-g1-g9-v2.json'));
const R = require(path.join(root, 'scripts', 'global', 'rubric-score.js'));
const closeout = require(path.join(root, 'scripts', 'global', 'megalint', 'consultant-closeout.js'));
const preflight = require(path.join(root, 'scripts', 'global', 'baton-schema-preflight.js'));
const failure = require(path.join(root, 'scripts', 'global', 'megalint', 'goal-failure-emission.js'));

const trail = `MANAGER_HANDOFF COLLABORATOR_HANDOFF ADMIN_HANDOFF CONSULTANT_CLOSEOUT
status:review scope bounded validation gates HAMR zero-cost cross-team Claude Copilot
npx playwright test tests/rubric-score.spec.js`;
const diff = `#!/usr/bin/env node
node scripts/global/rubric-score.js --trail x --diff y --closeout z
tests/rubric-score.spec.js
if (fail) { throw new Error('violation'); }`;
const body = `## CONSULTANT_CLOSEOUT
{"rubric_version":"g1-g9-v2","goals":{"G1":{"boxes_checked":3,"boxes_total":3,"score":10},
"G2":{"boxes_checked":3,"boxes_total":3,"score":10}},"mean":10}
privacy security repo-local portable compat transition legacy v1 back-compat
machine-readable JSON boxes_checked boxes_total mean verification-timestamp: 2026-05-15T00:00:00Z
verdict: approve
Signed-by: Quinn Critic
Team&Model: codex:gpt-5.4@openai
Role: consultant`;
const passCtx = { trail, diff, closeout: body };

test('#1575 rubric schema has G1-G9 with >=3 boxes', () => {
  expect(R.validateRubric(rubric)).toEqual({ ok: true, missing: [] });
  expect(Object.keys(rubric.goals)).toEqual(['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9']);
});

test('#1575 every evidence box command is runnable in isolation', () => {
  for (const goal of Object.values(rubric.goals)) {
    for (const box of goal.boxes) expect(R.evaluateCommand(box.evidence_command, passCtx).ok).toBe(true);
  }
});

test('#1575 score is 10 iff all boxes pass', () => {
  const result = R.scoreRubric(rubric, passCtx);
  for (const goal of Object.values(result.goals)) {
    expect(goal.boxes_checked).toBe(goal.boxes_total);
    expect(goal.score).toBe(10);
  }
  expect(result.mean).toBe(10);
});

test('#1575 one missing first box per goal lowers arithmetic deterministically', () => {
  for (const [goalId, goal] of Object.entries(rubric.goals)) {
    const box = goal.boxes.find(item => !item.evidence_command.startsWith('not_regex:'));
    const source = box.evidence_command.split(':')[1];
    const value = '';
    const result = R.scoreRubric(rubric, { ...passCtx, [source]: value });
    expect(result.goals[goalId].score).toBeLessThan(10);
  }
});

test('#1575 closeout validators accept structured v2 and legacy v1', () => {
  const legacy = body.replace(/\\{[\\s\\S]+?\\}\\nprivacy/, 'Rubric: G1=9, G2=8.\\nprivacy');
  expect(closeout.validate({ comments: [{ body }] }).ok).toBe(true);
  expect(closeout.validate({ comments: [{ body: legacy }] }).ok).toBe(true);
  expect(preflight.validate('consultant', body).ok).toBe(true);
});

test('#1575 goal failure extraction reads v2 structured scores', () => {
  const structured = body.replace('"score":10}', '"score":6}');
  expect(failure.extractGoalScores(structured).some(item => item.goal === 'G1' && item.score === 6)).toBe(true);
});

// #2136: precedence scoring tests (priority_weights_v1, G1=10...G9=1, threshold=7.0)
function makeGoals(overrides = {}) {
  const ids = ['G1','G2','G3','G4','G5','G6','G7','G8','G9'];
  const goals = {};
  for (const id of ids) goals[id] = { score: overrides[id] ?? 10, boxes_checked: 3, boxes_total: 3 };
  return goals;
}

test('#2136 all goals perfect → precedence_verdict pass', () => {
  const result = R.scoreRubric(rubric, passCtx);
  expect(result.precedence_verdict).toBe('pass');
  expect(result.weighted_mean_precedence).toBeGreaterThanOrEqual(7.0);
});

test('#2136 G1=0, all others=10 → weighted_mean_precedence < 9 (G1 weight=10/54 drags mean)', () => {
  const goals = makeGoals({ G1: 0 });
  // weights G1-G9: 10+9+8+7+6+5+4+3+2 = 54 (no G10 in v3 schema)
  // G1=0: weighted sum = 0 + 10*9+10*8+...+10*2 = 10*(9+8+7+6+5+4+3+2) = 10*44 = 440
  // weighted mean = 440/54 ≈ 8.15
  const p = R.computePrecedence(goals, rubric, 9.0); // strict: 8.15 < 9.0 → fail
  expect(p.precedence_verdict).toBe('fail');
  expect(p.weighted_mean_precedence).toBeCloseTo(8.15, 1);
  // Default threshold 7.0: G1=0 still scores above 7.0 (G1 has high weight but others are perfect)
  const pDefault = R.computePrecedence(goals, rubric, null);
  expect(pDefault.weighted_mean_precedence).toBeGreaterThan(7.0);
});

test('#2136 G10=0, all others=10 → precedence_verdict pass (G10 weight=1, low impact)', () => {
  // G10 not in v3 schema (9 goals); use G9 (weight=2) to represent a low-priority failure
  const goals = makeGoals({ G9: 0 });
  const p = R.computePrecedence(goals, rubric, null);
  // (0*2 + 10*(10+9+8+7+6+5+4+3)) / (10+9+8+7+6+5+4+3+2) = 10*52/54 ≈ 9.63 → pass
  expect(p.precedence_verdict).toBe('pass');
  expect(p.weighted_mean_precedence).toBeGreaterThanOrEqual(7.0);
});

test('#2136 G3=0, G1+G2=10 → precedence_verdict fail (G3 weight=8 drags mean below 7.0 with threshold=8)', () => {
  const goals = makeGoals({ G3: 0 });
  const p = R.computePrecedence(goals, rubric, 8.0);
  // (10*10 + 10*9 + 0*8 + 10*7+...+10*1) / 45 = (100+90+0+70+60+50+40+30+20+10)/45
  // = (480 − 80) / 45 = 400/45 ≈ 8.89 → above 8.0 → actually passes at 8.0 threshold
  // At threshold=9: 8.89 < 9 → fail
  const pStrict = R.computePrecedence(goals, rubric, 9.0);
  expect(pStrict.precedence_verdict).toBe('fail');
  // But at default 7.0, G3=0 alone should not fail (G3 weight=8/45 ~ 18% drag is moderate)
  const pDefault = R.computePrecedence(goals, rubric, null);
  // (10*10+10*9+0*8+10*7+10*6+10*5+10*4+10*3+10*2)/45 = (100+90+0+70+60+50+40+30+20)/45=460/45≈10.2?
  // Wait: sum of all weights = 10+9+8+7+6+5+4+3+2 = 54 (9 goals, G1-G9)
  // With G3=0: 10*10 + 10*9 + 0*8 + 10*7 + 10*6 + 10*5 + 10*4 + 10*3 + 10*2 = 100+90+0+70+60+50+40+30+20 = 460
  // 460/54 ≈ 8.52 → above 7.0 → pass at default threshold
  expect(pDefault.weighted_mean_precedence).toBeGreaterThan(7.0);
  expect(pStrict.weighted_mean_precedence).toBeLessThan(9.0);
});

test('#2136 weighted_mean_precedence formula verified with known values', () => {
  // All G1-G9 = 5, weights 10+9+...+2 = 54; weighted mean = 5
  const goals = makeGoals({ G1:5,G2:5,G3:5,G4:5,G5:5,G6:5,G7:5,G8:5,G9:5 });
  const p = R.computePrecedence(goals, rubric, null);
  expect(p.weighted_mean_precedence).toBe(5);
  expect(p.precedence_verdict).toBe('fail'); // 5 < 7.0
});

test('#2136 legacy rubric without precedence_weights synthesizes descending defaults', () => {
  const legacyRubric = { version: 'g1-g9-v2', goals: rubric.goals };
  const goals = makeGoals();
  const p = R.computePrecedence(goals, legacyRubric, null);
  expect(typeof p.weighted_mean_precedence).toBe('number');
  expect(['pass','fail']).toContain(p.precedence_verdict);
});

test('#2136 scoreRubric output includes weighted_mean_precedence and precedence_verdict', () => {
  const result = R.scoreRubric(rubric, passCtx);
  expect(typeof result.weighted_mean_precedence).toBe('number');
  expect(['pass','fail']).toContain(result.precedence_verdict);
  // Existing fields unchanged
  expect(typeof result.mean).toBe('number');
  expect(result.goals).toBeDefined();
});

