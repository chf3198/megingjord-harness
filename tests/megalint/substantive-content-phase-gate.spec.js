// Substantive-content + Phase Gate enforcement tests (#1453, #1454).
const { test, expect } = require('@playwright/test');
const path = require('path');
const Cons = require(path.resolve(__dirname, '..', '..', 'scripts', 'global', 'megalint', 'consultant-closeout.js'));
const Trace = require(path.resolve(__dirname, '..', '..', 'scripts', 'global', 'megalint', 'epic-ac-traceability.js'));

const phantomCloseout = `**CONSULTANT_CLOSEOUT — Orla Vale**
Rubric: G1=9, G2=9, G3=10, G4=10, G5=10, G6=9, G7=8, G8=8, G9=9. Mean 9.0.
verdict: approve
verification timestamp: 2026-05-12T20:00Z
Signed-by: Orla Vale · Team&Model: claude-code:opus-4-7@anthropic · Role: consultant`;

const substantiveCloseout = phantomCloseout
  + '\n\nChildren: #1446 closed, #1447 closed, #1449 closed. PR #1456 merged. See research/epic-1436-decision.md.';

test('#1453: phantom closeout on Epic fails substantive-content gate', () => {
  const r = Cons.validate({ comments: [{ body: phantomCloseout }], isEpic: true });
  expect(r.ok).toBe(false);
  expect(r.violations.some(v => v.rule === 'epic-closeout-no-substantive-evidence')).toBe(true);
});

test('#1453: closeout with child #N ref passes substantive-content gate', () => {
  const r = Cons.validate({ comments: [{ body: substantiveCloseout }], isEpic: true });
  expect(r.violations.filter(v => v.rule === 'epic-closeout-no-substantive-evidence').length).toBe(0);
});

test('#1453: closeout on non-Epic skips substantive-content (no violation)', () => {
  const r = Cons.validate({ comments: [{ body: phantomCloseout }], isEpic: false });
  expect(r.violations.filter(v => v.rule === 'epic-closeout-no-substantive-evidence').length).toBe(0);
});

test('#1453: PR-only reference satisfies substantive-content', () => {
  const body = phantomCloseout + '\n\nShipped via PR #1234 (merged).';
  const r = Cons.validate({ comments: [{ body }], isEpic: true });
  expect(r.violations.filter(v => v.rule === 'epic-closeout-no-substantive-evidence').length).toBe(0);
});

test('#1453: research/*.md reference satisfies substantive-content', () => {
  const body = phantomCloseout + '\n\nDeliverable: research/epic-foo-decision-2026-05-12.md.';
  const r = Cons.validate({ comments: [{ body }], isEpic: true });
  expect(r.violations.filter(v => v.rule === 'epic-closeout-no-substantive-evidence').length).toBe(0);
});

test('#1454: countAcRs counts AC-R markers correctly', () => {
  expect(Trace.countAcRs('- [ ] AC-R1: foo\n- [ ] AC-R2: bar\n- [x] AC-R3: baz')).toBe(3);
  expect(Trace.countAcRs('- [ ] AC1: regular AC')).toBe(0);
});

test('#1454: isResearchFirstEpic detects AC-R markers', () => {
  expect(Trace.isResearchFirstEpic('- [ ] AC-R1: research thing')).toBe(true);
});

test('#1454: isResearchFirstEpic detects "Phase Gate" language', () => {
  expect(Trace.isResearchFirstEpic('Per #1397 Phase Gate Rule, no implementation until R-children close.')).toBe(true);
});

test('#1454: isResearchFirstEpic returns false for plain Epic', () => {
  expect(Trace.isResearchFirstEpic('- [ ] AC1: regular implementation work')).toBe(false);
});

test('#1454: Phase Gate compliance — research Epic with 0 children at close-time fails', () => {
  const body = '## ACs\n- [ ] AC-R1: research\n- [ ] AC-R2: synthesis';
  const r = Trace.validate({
    body, labels: ['type:epic'], issueNumber: 9999,
    linkedChildren: [], isClosingAttempt: true,
  });
  expect(r.ok).toBe(false);
  expect(r.violations.some(v => v.rule === 'phase-gate-children-incomplete')).toBe(true);
});

test('#1454: Phase Gate compliance — research Epic with children passes', () => {
  const body = '## ACs\n- [ ] AC-R1: research\n- [ ] AC-R2: synthesis\nChildren: #100, #101';
  const r = Trace.validate({
    body, labels: ['type:epic'], issueNumber: 9999,
    linkedChildren: [100, 101], isClosingAttempt: true,
  });
  expect(r.violations.filter(v => v.rule === 'phase-gate-children-incomplete').length).toBe(0);
});

test('#1454: Phase Gate skipped when not closing attempt (open Epic)', () => {
  const body = '- [ ] AC-R1: research';
  const r = Trace.validate({
    body, labels: ['type:epic'], issueNumber: 1, linkedChildren: [],
    isClosingAttempt: false,
  });
  expect(r.violations.filter(v => v.rule === 'phase-gate-children-incomplete').length).toBe(0);
});

test('#1454: Phase Gate skipped on non-research-first Epic', () => {
  const body = '- [ ] AC1: regular AC\n- [ ] AC2: another\n- [ ] AC3: third';
  const r = Trace.validate({
    body, labels: ['type:epic'], issueNumber: 1, linkedChildren: [],
    isClosingAttempt: true,
  });
  expect(r.violations.filter(v => v.rule === 'phase-gate-children-incomplete').length).toBe(0);
});

test('#1454: checkPhaseGateCompliance direct call — declares research-first but no AC-R → no violation', () => {
  // Edge: body says "Phase Gate" but no AC-R markers → can't enforce
  const v = Trace.checkPhaseGateCompliance(
    'Per Phase Gate Rule (no R-ACs declared)', [], true,
  );
  expect(v).toEqual([]);
});
