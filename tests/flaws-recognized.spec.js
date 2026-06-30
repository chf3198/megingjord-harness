'use strict';
// Tests for #3428 (Epic #3425 P1-a): the per-review-point flaws_recognized contract.
// Strategy: tdd-pyramid per test-methodology-matrix (scripts/global/megalint validator
// + baton-artifact-schema field). node:test + node:assert — no playwright, no mocks.

const test = require('node:test');
const assert = require('node:assert');

const fr = require('../scripts/global/megalint/flaws-recognized.js');
const { ARTIFACT_SPECS } = require('../scripts/global/baton-artifact-schema.js');
const { buildArtifact } = require('../scripts/global/baton-artifact-builder.js');
const { FLAW_DECISIONS } = require('../scripts/global/judgment-gate.js');

const TM = 'claude-code:opus@local';
const comment = (body) => ({ body });

function manager(flawsBlock) {
  return comment(`## MANAGER_HANDOFF\n\nscope: x\nlane: lane:code-change\n${flawsBlock}\n\nSigned-by: Orla Mason\nTeam&Model: ${TM}\nRole: manager`);
}

// ---- schema: field present on all four artifact specs, block, not required ----
test('flaws_recognized is on all four artifact specs as a block, non-required field', () => {
  for (const name of ['MANAGER_HANDOFF', 'COLLABORATOR_HANDOFF', 'ADMIN_HANDOFF', 'CONSULTANT_CLOSEOUT']) {
    const field = ARTIFACT_SPECS[name].fields.find((f) => f.k === 'flaws_recognized');
    assert.ok(field, `${name} should carry flaws_recognized`);
    assert.equal(field.block, true, `${name} flaws_recognized must be a block field`);
    assert.equal(field.req, false, `${name} flaws_recognized must NOT be required (corpus back-compat)`);
  }
});

test('builder back-compat: artifacts still build WITHOUT flaws_recognized (historical corpus)', () => {
  const out = buildArtifact({ artifact: 'ADMIN_HANDOFF', role: 'admin', teamModel: TM, ticket: 1,
    fields: { branch: 'feat/1-x', commit: 'abc1234', 'signer-independence-check': 'PASS', 'deploy-runtime-impact': 'none' } });
  assert.match(out, /## ADMIN_HANDOFF/);
  assert.ok(!/flaws_recognized/.test(out), 'omitted field must not appear');
});

test('builder can emit flaws_recognized when supplied', () => {
  const out = buildArtifact({ artifact: 'ADMIN_HANDOFF', role: 'admin', teamModel: TM, ticket: 1,
    fields: { branch: 'feat/1-x', commit: 'abc1234', 'signer-independence-check': 'PASS', 'deploy-runtime-impact': 'none', flaws_recognized: 'none' } });
  assert.match(out, /flaws_recognized:\n.*none/s);
});

// ---- validator: grammar + decision enum + artifact shape ----
test("bare 'none' is a valid disposition", () => {
  const r = fr.validate({ comments: [manager('flaws_recognized: none')] });
  assert.equal(r.violations.length, 0);
  assert.equal(r.ok, true);
});

test('missing flaws_recognized block surfaces an advisory (not blocking)', () => {
  const r = fr.validate({ comments: [manager('gates: lint')] });
  assert.equal(r.violations.length, 1);
  assert.equal(r.violations[0].rule, 'flaws-recognized-missing');
  assert.equal(r.violations[0].severity, 'advisory');
  assert.equal(r.ok, true, 'advisory ship: never blocks');
});

test('empty value surfaces an advisory', () => {
  const r = fr.validate({ comments: [manager('flaws_recognized:\ngates: lint')] });
  assert.ok(r.violations.some((v) => v.rule === 'flaws-recognized-empty'));
});

test('valid multi-entry block with each decision type passes shape checks', () => {
  const block = [
    'flaws_recognized:',
    '  - flaw: gate flaked once',
    '    detected_by: F3',
    '    decision: file-ticket',
    '    artifact: #4242',
    '  - flaw: one-off retry',
    '    detected_by: F2',
    '    decision: log-incident-only',
    '    artifact: incidents.jsonl:retry-loop-pattern',
    '  - flaw: judgment note',
    '    detected_by: manual',
    '    decision: memory-note-only',
    '    artifact: memory/feedback_x.md',
    '  - flaw: benign',
    '    detected_by: F1',
    '    decision: no-action-justified',
    '    artifact: read-only probe path is clean, no action needed',
  ].join('\n');
  const r = fr.validate({ comments: [manager(block)] });
  assert.deepEqual(r.violations, [], JSON.stringify(r.violations));
});

test('decision outside the FLAW_DECISIONS enum is flagged (advisory)', () => {
  const block = 'flaws_recognized:\n  - flaw: x\n    decision: ignore-it\n    artifact: #1';
  const r = fr.validate({ comments: [manager(block)] });
  assert.ok(r.violations.some((v) => v.rule === 'flaws-recognized-bad-decision'));
  // sanity: the enum is the judgment-gate source of truth, not a fork
  assert.ok(!FLAW_DECISIONS.includes('ignore-it'));
});

test('file-ticket without a #N artifact is flagged', () => {
  const block = 'flaws_recognized:\n  - flaw: x\n    decision: file-ticket\n    artifact: will do later';
  const r = fr.validate({ comments: [manager(block)] });
  assert.ok(r.violations.some((v) => v.rule === 'flaws-recognized-artifact-shape'));
});

test('no-action-justified needs a non-trivial rationale', () => {
  const block = 'flaws_recognized:\n  - flaw: x\n    decision: no-action-justified\n    artifact: ok';
  const r = fr.validate({ comments: [manager(block)] });
  assert.ok(r.violations.some((v) => v.rule === 'flaws-recognized-artifact-shape'));
});

test('only artifacts present on the issue are checked (no false positives on absent roles)', () => {
  const r = fr.validate({ comments: [manager('flaws_recognized: none')] });
  // ADMIN/COLLABORATOR/CONSULTANT absent → no findings for them
  assert.equal(r.violations.length, 0);
});

test('checkArtifact + artifactShapeOk are exported pure helpers', () => {
  assert.equal(fr.artifactShapeOk('file-ticket', '#12'), true);
  assert.equal(fr.artifactShapeOk('file-ticket', 'nope'), false);
  assert.equal(fr.artifactShapeOk('memory-note-only', 'memory/x.md'), true);
});
