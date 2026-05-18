'use strict';
// Stress tests for Epic #1827 rebase discipline — fuzz, perf, chaos, monotonicity.
// Goal alignment: G2 quality, G6 resilience, G7 throughput.

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { classifyTier, evaluate, exitCodeFor }
  = require('../scripts/global/git-freshness-check.js');
const { evaluate: predict, overlap }
  = require('../scripts/global/git-conflict-predict.js');
const { validate, advisoryComment, parse }
  = require('../scripts/global/collab-handoff-rebase-freshness.js');

test('FUZZ AC8: 1000 random tier classifications — exit codes consistent', () => {
  for (let i = 0; i < 1000; i++) {
    const behind = Math.floor(Math.random() * 200);
    const drift = Math.random() * 30;
    const ratio = Math.random() * 30;
    const tier = classifyTier(behind, drift, ratio);
    const exitCode = exitCodeFor(tier);
    assert.ok(['ok', 'advisory', 'pre-handoff-block', 're-scope'].includes(tier),
      `unexpected tier "${tier}" at i=${i}`);
    assert.ok([0, 1, 2].includes(exitCode));
  }
});

test('MONOTONICITY: higher behind never relaxes tier (holding drift+ratio constant)', () => {
  for (let drift = 0; drift <= 10; drift += 2) {
    for (let ratio = 0; ratio <= 10; ratio += 2) {
      const tiers = [];
      for (let behind = 0; behind <= 50; behind += 5) {
        tiers.push(classifyTier(behind, drift, ratio));
      }
      const tierRanks = { ok: 0, advisory: 1, 'pre-handoff-block': 2, 're-scope': 3 };
      for (let i = 1; i < tiers.length; i++) {
        assert.ok(tierRanks[tiers[i]] >= tierRanks[tiers[i - 1]],
          `non-monotonic at drift=${drift} ratio=${ratio}: ${tiers[i - 1]} → ${tiers[i]} as behind grew`);
      }
    }
  }
});

test('PERF AC5: evaluate latency p99 < 10ms (without git IO)', () => {
  const samples = [];
  for (let i = 0; i < 500; i++) {
    const start = process.hrtime.bigint();
    evaluate({ branch: 'feat/test', behind: 5, branchCommits: 10, velocity: 3 });
    samples.push(Number(process.hrtime.bigint() - start) / 1_000_000);
  }
  samples.sort((a, b) => a - b);
  const p99 = samples[Math.floor(samples.length * 0.99)];
  assert.ok(p99 < 10, `evaluate p99 ${p99.toFixed(2)}ms exceeds 10ms budget`);
});

test('PERF AC6: conflict-predict with 100 mocked PRs < 100ms (in-process)', () => {
  const mockPRs = Array.from({ length: 100 }, (_, i) => ({
    number: i, headRefName: `feat/${i}`,
    files: Array.from({ length: 10 }, (_, j) => ({ path: `src/file-${i}-${j}.js` })),
  }));
  const myFiles = Array.from({ length: 10 }, (_, i) => `src/file-50-${i}.js`);
  const start = process.hrtime.bigint();
  const r = predict({ branch: 'feat/me', myFiles, mockPRs });
  const elapsed = Number(process.hrtime.bigint() - start) / 1_000_000;
  assert.ok(elapsed < 100, `predict 100 PRs ${elapsed.toFixed(2)}ms exceeds 100ms budget`);
  assert.equal(r.overlap_count, 1);
});

test('OVERLAP perf: union of 1000 paths in < 5ms', () => {
  const a = Array.from({ length: 1000 }, (_, i) => `src/x-${i}.js`);
  const b = Array.from({ length: 1000 }, (_, i) => `src/y-${i}.js`);
  const start = process.hrtime.bigint();
  overlap(a, b);
  const elapsed = Number(process.hrtime.bigint() - start) / 1_000_000;
  assert.ok(elapsed < 5, `overlap p99 ${elapsed.toFixed(2)}ms exceeds 5ms budget`);
});

test('FUZZ: collab-handoff validator — 200 random body shapes never throws', () => {
  const fragments = ['behind_at_handoff: 5', 'rebase_freshness: 2026-05-18T00:00:00Z',
    'invalid', '## COLLABORATOR_HANDOFF', 'Signed-by: Orla Harper',
    'behind_at_handoff=200', 'rebase_freshness=garbage'];
  for (let i = 0; i < 200; i++) {
    const body = Array.from({ length: 1 + Math.floor(Math.random() * 5) },
      () => fragments[Math.floor(Math.random() * fragments.length)]).join('\n');
    assert.doesNotThrow(() => validate(body), `validate threw on body: ${body}`);
  }
});

test('CHAOS: collab-handoff parse — malformed timestamp falls back to missing', () => {
  // FRESHNESS_FIELD_RE requires ISO-compatible chars; "not-a-date" fails to match,
  // so the field is treated as missing rather than unparseable. Either path is
  // resilient (no crash) and surfaces an advisory.
  const r = validate('behind_at_handoff: 5\nrebase_freshness: not-a-date');
  assert.ok(r.advisories.includes('missing-rebase-freshness'));
});

test('CHAOS: collab-handoff parse — ISO-shape garbage triggers unparseable', () => {
  const r = validate('behind_at_handoff: 5\nrebase_freshness: 2026-99-99T99:99:99Z');
  assert.ok(r.advisories.includes('rebase-freshness-unparseable'));
});

test('CHAOS: zero-input collab-handoff returns bridge-mode advisory not crash', () => {
  const r = validate('');
  const c = advisoryComment(r);
  assert.ok(typeof c === 'string');
  assert.match(c, /Epic #1827/);
});

test('PARSE robustness: parse with whitespace + case variations', () => {
  for (const fmt of ['behind_at_handoff: 7', 'Behind_At_Handoff = 7',
    'behind_at_handoff:7', 'BEHIND_AT_HANDOFF: 7']) {
    const p = parse(fmt);
    assert.equal(p.behind_at_handoff, 7, `failed on: ${fmt}`);
  }
});

test('FUZZ predict: 50 PR-count permutations — never throws', () => {
  for (let i = 0; i < 50; i++) {
    const prCount = Math.floor(Math.random() * 200);
    const mockPRs = Array.from({ length: prCount }, (_, j) => ({
      number: j, headRefName: `feat/${j}`,
      files: [{ path: `src/x${j % 5}.js` }],
    }));
    assert.doesNotThrow(() =>
      predict({ branch: 'feat/me', myFiles: ['src/x0.js'], mockPRs }));
  }
});
