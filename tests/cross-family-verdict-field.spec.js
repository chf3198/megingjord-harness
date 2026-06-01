// cross-family-verdict-field — tests for #2537 (Epic #2511 C2)
// Validates checkCrossFamilyVerdict() in scripts/global/megalint/consultant-closeout.js
const { test, expect } = require('@playwright/test');
const path = require('path');
const { validate } = require(path.resolve(__dirname, '..', 'scripts', 'global', 'megalint', 'consultant-closeout.js'));

function makeInput(closeoutBody, extras = {}) {
  return {
    comments: [{
      body: `## CONSULTANT_CLOSEOUT\nrubric: G1=9, G2=8\nverification-timestamp: 2026-05-31T00:00:00Z\nverdict: approved\nSigned-by: Soren Vale\nTeam&Model: copilot:claude-sonnet-4-6@github\nRole: consultant\n${closeoutBody}`,
    }],
    lane: 'lane:code-change', labels: [], state: 'open', body: '', prBody: '',
    ...extras,
  };
}

test('#2537 C2: missing cross_family_verdict emits advisory, ok stays true', () => {
  const r = validate(makeInput(''));
  expect(r.found).toBe(true);
  expect(r.ok).toBe(true);
  const advisory = r.violations.find(v => v.rule === 'cross-family-verdict-missing');
  expect(advisory).toBeDefined();
  expect(advisory.severity).toBe('advisory');
});

test('#2537 C2: malformed cross_family_verdict emits hard error, ok is false', () => {
  const r = validate(makeInput('cross_family_verdict: ACCEPT missing-fields'));
  expect(r.found).toBe(true);
  expect(r.ok).toBe(false);
  const err = r.violations.find(v => v.rule === 'cross-family-verdict-malformed');
  expect(err).toBeDefined();
  expect(err.severity).toBeUndefined();
});

test('#2537 C2: valid ACCEPT verdict — no cross-family violations', () => {
  const r = validate(makeInput('cross_family_verdict: ACCEPT — qwen2.5-coder:7b@100.91.113.16 — No structural issues found'));
  expect(r.found).toBe(true);
  expect(r.ok).toBe(true);
  const cfViolations = r.violations.filter(v => v.rule.startsWith('cross-family-verdict'));
  expect(cfViolations).toHaveLength(0);
});

test('#2537 C2: valid PARTIAL verdict — no cross-family violations', () => {
  const r = validate(makeInput('cross_family_verdict: PARTIAL — qwen2.5-coder:7b@100.91.113.16 — Advisory gaps in G5'));
  expect(r.found).toBe(true);
  expect(r.ok).toBe(true);
  const cfViolations = r.violations.filter(v => v.rule.startsWith('cross-family-verdict'));
  expect(cfViolations).toHaveLength(0);
});

test('#2537 C2: valid REJECT verdict — no cross-family violations', () => {
  const r = validate(makeInput('cross_family_verdict: REJECT — qwen2.5-coder:7b@100.91.113.16 — Critical G1 violation'));
  const cfViolations = r.violations.filter(v => v.rule.startsWith('cross-family-verdict'));
  expect(cfViolations).toHaveLength(0);
});

test('#2537 C2: em-dash and en-dash separators both accepted', () => {
  const r1 = validate(makeInput('cross_family_verdict: ACCEPT — qwen2.5-coder:7b@host — rationale'));
  expect(r1.violations.filter(v => v.rule.startsWith('cross-family-verdict'))).toHaveLength(0);
  const r2 = validate(makeInput('cross_family_verdict: PARTIAL – qwen2.5-coder:7b@host – rationale'));
  expect(r2.violations.filter(v => v.rule.startsWith('cross-family-verdict'))).toHaveLength(0);
});
