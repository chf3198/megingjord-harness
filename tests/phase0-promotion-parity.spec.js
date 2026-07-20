// Cross-runtime parity for the Phase-0->Phase-1 promotion gate (Epic #2678 AC4).
// The gate is enforced by a single scripts/global module set wired into shared
// GitHub Actions + label-lint surfaces — there is no per-runtime code path, so
// Copilot / Codex / Claude Code / Antigravity all trigger identical enforcement.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const gate = require('../scripts/global/megalint/phase0-promotion-gate');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const RUNTIMES = ['copilot', 'codex', 'claude-code', 'antigravity'];

test('AC4: predicate is runtime-agnostic — identical verdict for every runtime', () => {
  const base = {
    labels: ['type:epic', 'phase-gate:research-first'],
    comments: [{ body: 'EPIC_RESCOPE' }],
    children: [{ number: 2, state: 'closed', labels: ['phase-gate:research-first'], comments: [{ body: 'CONSULTANT_CLOSEOUT' }] }],
    planRating: { ok: true }, // #3826: green now requires a verified plan-rating (runtime-agnostic conjunct)
  };
  const verdicts = RUNTIMES.map((runtime) => gate.phase0GreenComplete({ ...base, runtime }));
  for (const v of verdicts) {
    expect(v.complete).toBe(true);
    expect(v.missingPhase1Children).toBe(true);
    expect(v.pattern_id).toBe(verdicts[0].pattern_id);
  }
});

test('AC4: the workflow routes every runtime through the same shared modules', () => {
  const wf = read('.github/workflows/phase0-promotion-gate.yml');
  expect(wf).toContain('scripts/global/phase0-closure-guard.js');
  expect(wf).toContain('scripts/global/phase1-auto-materialize.js');
  // Trigger is the GitHub issue (the shared baton), not a runtime-specific event.
  expect(wf).toContain('issues:');
});

test('AC4: closure protection is wired into the shared label-lint surface', () => {
  const lib = read('scripts/global/label-lint-close-protection.js');
  expect(lib).toContain('phase0MissingPhase1');
  expect(lib).toContain('block-close');
});

test('AC4: no runtime-name branching exists in the enforcement core (single path)', () => {
  const core = read('scripts/global/megalint/phase0-promotion-gate.js');
  for (const rt of RUNTIMES) {
    expect(core.toLowerCase().includes(`'${rt}'`)).toBe(false);
  }
});
