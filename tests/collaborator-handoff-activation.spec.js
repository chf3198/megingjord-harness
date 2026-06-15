'use strict';

// @megalint:test-discoverability:opt-out — node:test runner spec (run via `node --test`).
// #3016 — regression coverage for ACTIVATING the doc-coverage + cross-family
// collaborator gate that was dead code (gated on input.lane, which the CI caller
// never passes — it passes `labels`).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const ch = require('../scripts/global/megalint/collaborator-handoff.js');
const dc = require('../scripts/global/megalint/doc-coverage.js');

// A signer-complete, cross-family-complete handoff. doc-coverage conformance
// depends on the labels' required surfaces.
const HANDOFF = {
  user: { login: 'tester' },
  body: [
    '## COLLABORATOR_HANDOFF',
    'doc_coverage: UPDATED: .changes/unreleased/x.md',
    'cross_family_reviewer: gemini-2.5-flash@google',
    'cross_family_rating: 9/10',
    'cross_family_findings: none',
    'cross_family_receipt: 0123456789abcdef',
    'Signed-by: Orla Harper',
    'Team&Model: claude-code:claude-opus-4-8@anthropic',
    'Role: collaborator',
  ].join('\n'),
};

test('laneOf prefers the scalar, falls back to the lane:* label, else null', () => {
  assert.equal(ch.laneOf({ lane: 'lane:code-change', labels: ['lane:docs-research'] }), 'lane:code-change');
  assert.equal(ch.laneOf({ labels: ['area:governance', 'lane:code-change'] }), 'lane:code-change');
  assert.equal(ch.laneOf({ labels: ['area:governance'] }), null);
});

test('DEAD-GATE REGRESSION: labels-only call (no lane scalar) now ENFORCES doc-coverage', () => {
  // This is the exact CI signature from baton-gates.yml: { comments, labels }.
  const result = ch.validate({ comments: [HANDOFF], labels: ['lane:code-change', 'area:governance'] });
  assert.equal(result.ok, false, 'gate must block a non-conforming area:governance handoff');
  assert.ok(result.violations.some((v) => /doc-coverage/.test(v.rule)), 'doc-coverage violations must surface');
});

test('back-compat: explicit input.lane scalar still enforces', () => {
  const result = ch.validate({ comments: [HANDOFF], lane: 'lane:code-change', labels: ['area:governance'] });
  assert.equal(result.ok, false);
});

test('lightweight lane detected via label is skipped', () => {
  const result = ch.validate({ comments: [HANDOFF], labels: ['lane:docs-research'] });
  assert.equal(result.ok, true);
  assert.equal(result.reason, 'lightweight-lane-skip');
});

test('underscore doc_coverage key is parsed (no spurious missing-block error)', () => {
  // labels with no area:* -> no required surfaces -> a present block must not error.
  const result = ch.validate({ comments: [HANDOFF], labels: ['lane:code-change'] });
  assert.ok(!result.violations.some((v) => v.rule === 'doc-coverage-missing' && /missing doc-coverage block/.test(v.detail)));
});

test('fail-CLOSED: a matrix load failure blocks instead of silently skipping', () => {
  const original = dc.loadMatrix;
  dc.loadMatrix = () => { throw new Error('boom'); };
  try {
    const result = ch.validate({ comments: [HANDOFF], labels: ['lane:code-change', 'area:governance'] });
    assert.equal(result.ok, false);
    assert.ok(result.violations.some((v) => v.rule === 'doc-coverage-matrix-load-failed'), 'must emit a blocking load-failed violation');
  } finally {
    dc.loadMatrix = original;
  }
});

test('fail-CLOSED: a null/empty matrix returned WITHOUT throwing still blocks (#3016 review)', () => {
  const original = dc.loadMatrix;
  for (const bad of [null, undefined, {}]) {
    dc.loadMatrix = () => bad;
    try {
      const result = ch.validate({ comments: [HANDOFF], labels: ['lane:code-change', 'area:governance'] });
      assert.equal(result.ok, false, `matrix=${JSON.stringify(bad)} must fail closed`);
      assert.ok(result.violations.some((v) => v.rule === 'doc-coverage-matrix-load-failed'));
    } finally {
      dc.loadMatrix = original;
    }
  }
});

test('BLOCKER_NOTE substring inside a word does NOT activate LEGACY_DOC_SKIP (#3016 review)', () => {
  const prev = process.env.LEGACY_DOC_SKIP;
  process.env.LEGACY_DOC_SKIP = '1';
  try {
    const decoy = ch.validate({ comments: [HANDOFF, { body: 'see MY_BLOCKER_NOTEBOOK for notes' }], labels: ['lane:code-change', 'area:governance'] });
    assert.ok(decoy.violations.some((v) => /doc-coverage/.test(v.rule)), 'substring must not trigger the skip');
  } finally {
    if (prev === undefined) delete process.env.LEGACY_DOC_SKIP; else process.env.LEGACY_DOC_SKIP = prev;
  }
});

test('LEGACY_DOC_SKIP bypasses doc-coverage ONLY with a BLOCKER_NOTE present', () => {
  const prev = process.env.LEGACY_DOC_SKIP;
  process.env.LEGACY_DOC_SKIP = '1';
  try {
    const withNote = ch.validate({ comments: [HANDOFF, { body: 'BLOCKER_NOTE: legacy PR' }], labels: ['lane:code-change', 'area:governance'] });
    assert.ok(!withNote.violations.some((v) => v.rule === 'doc-coverage-missing'), 'doc-coverage bypassed when BLOCKER_NOTE present');
    const noNote = ch.validate({ comments: [HANDOFF], labels: ['lane:code-change', 'area:governance'] });
    assert.ok(noNote.violations.some((v) => /doc-coverage/.test(v.rule)), 'no bypass without a BLOCKER_NOTE');
  } finally {
    if (prev === undefined) delete process.env.LEGACY_DOC_SKIP; else process.env.LEGACY_DOC_SKIP = prev;
  }
});
