// Tests for scripts/global/phase0-closure-guard.js (Epic #2678 AC3, AC5, AC6).
const { test, expect } = require('@playwright/test');
const os = require('os');
const fs = require('fs');
const path = require('path');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'phase0-guard-'));
process.env.HOME = TMP_HOME;
const guard = require('../scripts/global/phase0-closure-guard');
const { makeGithub, makeCore, validPlanRating } = require('./phase0-github-mock');
const closeProt = require('../scripts/global/label-lint-close-protection');
const INCIDENTS = path.join(TMP_HOME, '.megingjord', 'incidents.jsonl');

test('AC3: label-lint decide() blocks close when phase0MissingPhase1 is set', () => {
  const r = closeProt.decide({
    state: 'closed', labels: ['type:epic', 'status:review', 'role:consultant'],
    comments: [{ body: '## CONSULTANT_CLOSEOUT rubric 9/10' }], phase0MissingPhase1: true,
  });
  expect(r.action).toBe('block-close');
  expect(r.reopen).toBe(true);
});

test('AC3: label-lint decide() default-off preserves auto-transition (no regression)', () => {
  const r = closeProt.decide({
    state: 'closed', labels: ['type:task', 'status:review', 'role:consultant'],
    comments: [{ body: '## CONSULTANT_CLOSEOUT rubric 9/10' }],
  });
  expect(r.action).toBe('auto-transition');
});

const ctx = (n) => ({ repo: { owner: 'o', repo: 'r' }, payload: { issue: { number: n } } });

test('AC3: evaluateClosure blocks only on applicable+complete+missing', () => {
  expect(guard.evaluateClosure({ applicable: true, complete: true, missingPhase1Children: true }).block).toBe(true);
  expect(guard.evaluateClosure({ applicable: true, complete: true, missingPhase1Children: false }).block).toBe(false);
  expect(guard.evaluateClosure({ applicable: false }).block).toBe(false);
});

test('AC3: buildBlockerNote carries the required BLOCKER_NOTE fields', () => {
  const note = guard.buildBlockerNote(500, { details: 'Phase-0 green; Phase-1 children ABSENT', pattern_id: 'phase0-complete-no-phase1' });
  expect(note).toContain('EPIC_PHASE_GATE_PAUSE');
  expect(note).toContain('BLOCKER_NOTE');
  expect(note).toContain('owner:');
  expect(note).toContain('unblock_condition:');
  expect(note).toContain('eta_or_review_time:');
});

// AC6: the #2661 scenario — research-first Epic, green Phase-0, ZERO Phase-1 children.
// #3826: carry a VALID plan-rating so this fixture blocks via the missing-phase-1 path
// (its intent) rather than being masked by the new unrated-plan block.
const PR2661 = validPlanRating(2661);
function regressionFixture(failGetFor) {
  const g = makeGithub({
    issues: {
      2661: { state: 'closed', labels: ['type:epic', 'phase-gate:research-first'], body: 'Phase-0 child #2662' },
      2662: { state: 'closed', labels: ['phase-gate:research-first'], body: 'Parent: #2661' },
    },
    commentsByIssue: { 2661: [{ body: '## EPIC_RESCOPE' }, PR2661.comment], 2662: [{ body: '## CONSULTANT_CLOSEOUT rubric 8/10' }] },
    failGetFor,
  });
  return { ...g, ledger: PR2661.ledger };
}

test('AC3+AC6: closing the #2661-shaped Epic is blocked, reopened, and fails the run', async () => {
  const { github, postedComments, updates } = regressionFixture();
  const { core, calls } = makeCore();
  delete process.env.PHASE0_GATE_BYPASS;
  const r = await guard.run({ github, context: ctx(2661), core, ledger: PR2661.ledger });
  expect(r.blocked).toBe(true);
  expect(calls.setFailed.length).toBe(1);
  expect(updates.some((u) => u.issue_number === 2661 && u.state === 'open')).toBe(true);
  expect(postedComments.some((c) => /EPIC_PHASE_GATE_PAUSE/.test(c.body))).toBe(true);
});

test('AC5: a blocked close emits a phase0-complete-no-phase1 incident', async () => {
  const { github } = regressionFixture();
  const { core } = makeCore();
  delete process.env.PHASE0_GATE_BYPASS;
  await guard.run({ github, context: ctx(2661), core, ledger: PR2661.ledger });
  expect(fs.readFileSync(INCIDENTS, 'utf8')).toContain('phase0-complete-no-phase1');
});

test('AC3: PHASE0_GATE_BYPASS=1 downgrades to advisory (no setFailed) with audit warning', async () => {
  const { github } = regressionFixture();
  const { core, calls } = makeCore();
  process.env.PHASE0_GATE_BYPASS = '1';
  const r = await guard.run({ github, context: ctx(2661), core, ledger: PR2661.ledger });
  delete process.env.PHASE0_GATE_BYPASS;
  expect(r.bypass).toBe(true);
  expect(calls.setFailed.length).toBe(0);
  expect(calls.warning.some((w) => /BYPASS/.test(w))).toBe(true);
});

test('AC3: a compliant Epic (Phase-1 present + rated plan) is not blocked', async () => {
  const pr = validPlanRating(500); // #3826: compliant now also carries a verified plan-rating
  const { github } = makeGithub({
    issues: {
      500: { state: 'closed', labels: ['type:epic', 'phase-gate:research-first'], body: 'child #501 #502' },
      501: { state: 'closed', labels: ['phase-gate:research-first'], body: 'Parent: #500' },
      502: { state: 'open', labels: ['phase-gate:phase-1'], body: 'Parent: #500' },
    },
    commentsByIssue: { 500: [{ body: 'EPIC_RESCOPE' }, pr.comment], 501: [{ body: 'CONSULTANT_CLOSEOUT 9/10' }] },
  });
  const { core, calls } = makeCore();
  const r = await guard.run({ github, context: ctx(500), core, ledger: pr.ledger });
  expect(r.blocked).toBe(false);
  expect(calls.setFailed.length).toBe(0);
});
