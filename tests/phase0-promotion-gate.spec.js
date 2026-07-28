// Tests for scripts/global/megalint/phase0-promotion-gate.js (Epic #2678 AC1, AC5).
// Pure predicate: when is a research-first Epic's Phase-0 green-complete, and
// when is it missing the Phase-1 children a green Phase-0 mandates (#2661 gap).
const { test, expect } = require('@playwright/test');
const gate = require('../scripts/global/megalint/phase0-promotion-gate');

const RESCOPE = { body: '## EPIC_RESCOPE\nPhase-0 complete.' };
const closedP0 = (n, withCloseout = true) => ({
  number: n, state: 'closed', labels: ['type:research', 'phase-gate:research-first'],
  comments: withCloseout ? [{ body: '## CONSULTANT_CLOSEOUT\nrubric_rating: 8/10' }] : [],
});
const phase1Child = (n) => ({ number: n, state: 'open', labels: ['type:task', 'phase-gate:phase-1'], comments: [] });
const epicLabels = ['type:epic', 'phase-gate:research-first'];
// #3826: the plan-rating conjunct is now required for green — supply a verified fact
// for tests exercising the OTHER dimensions (children/closeout/rescope). The receipt
// verification itself is covered by phase0-plan-rating-gate-3826.spec.js.
const RATED = { ok: true, reason: 'plan-rating-verified' };

test('AC1: non-epic / non-research-first is not applicable', () => {
  expect(gate.phase0GreenComplete({ labels: ['type:task'] }).applicable).toBe(false);
  expect(gate.phase0GreenComplete({ labels: ['type:epic'] }).applicable).toBe(false);
});

test('AC1: Phase-0 not all closed is not complete', () => {
  const r = gate.phase0GreenComplete({
    labels: epicLabels, comments: [RESCOPE],
    children: [closedP0(2), { number: 3, state: 'open', labels: ['phase-gate:research-first'], comments: [] }],
  });
  expect(r.complete).toBe(false);
  expect(r.details).toContain('not all Phase-0 children closed');
});

test('AC1: closed Phase-0 without any CONSULTANT_CLOSEOUT is not complete', () => {
  const r = gate.phase0GreenComplete({ labels: epicLabels, comments: [RESCOPE], children: [closedP0(2, false)] });
  expect(r.complete).toBe(false);
  expect(r.details).toContain('CONSULTANT_CLOSEOUT');
});

test('AC1: green Phase-0 without EPIC_RESCOPE is not complete', () => {
  const r = gate.phase0GreenComplete({ labels: epicLabels, comments: [], children: [closedP0(2)] });
  expect(r.complete).toBe(false);
  expect(r.details).toContain('EPIC_RESCOPE');
});

test('AC1: green Phase-0 WITH Phase-1 children is complete and not missing', () => {
  const r = gate.phase0GreenComplete({ labels: epicLabels, comments: [RESCOPE], children: [closedP0(2), phase1Child(3)], planRating: RATED });
  expect(r.complete).toBe(true);
  expect(r.missingPhase1Children).toBe(false);
  expect(r.phase1Count).toBe(1);
});

test('AC1: green Phase-0 with ZERO Phase-1 children is the blockable defect (#2661)', () => {
  const r = gate.phase0GreenComplete({ labels: epicLabels, comments: [RESCOPE], children: [closedP0(2)], planRating: RATED });
  expect(r.complete).toBe(true);
  expect(r.missingPhase1Children).toBe(true);
  expect(r.details).toContain('ABSENT');
});

test('AC1: classifyChildren splits by label and ignores untagged children', () => {
  const { phase0, phase1 } = gate.classifyChildren([
    { labels: ['phase-gate:research-first'] }, { labels: ['phase-gate:phase-1'] }, { labels: ['type:task'] },
  ]);
  expect(phase0.length).toBe(1);
  expect(phase1.length).toBe(1);
});

test('AC1: status:done label counts as closed even if state field missing', () => {
  const child = { number: 2, labels: ['phase-gate:research-first', 'status:done'], comments: [{ body: 'CONSULTANT_CLOSEOUT' }] };
  const r = gate.phase0GreenComplete({ labels: epicLabels, comments: [RESCOPE], children: [child], planRating: RATED });
  expect(r.complete).toBe(true);
});

test('AC5: buildIncident carries pattern_id, dual ts/timestamp, and severity', () => {
  const inc = gate.buildIncident(2678, 'Phase-0 green; Phase-1 children ABSENT', 'consultant', '2026-06-26T00:00:00Z');
  expect(inc.pattern_id).toBe('phase0-complete-no-phase1');
  expect(inc.ts).toBe('2026-06-26T00:00:00Z');
  expect(inc.timestamp).toBe(inc.ts);
  expect(inc.version).toBe(3);
  expect(inc.severity).toBe('medium');
  expect(inc.epic_ref).toBe(2678);
  expect(inc.trigger_role).toBe('consultant');
});
