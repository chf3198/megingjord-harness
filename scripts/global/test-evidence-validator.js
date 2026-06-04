#!/usr/bin/env node
'use strict';
// tier: 2
// test-evidence-validator (#1214) — pure function consumed by .github/workflows/test-evidence.yml.
// Per instructions/test-methodology-matrix.instructions.md.
// Enum constants sourced from test-strategy-enum.js (#1236).

const { ALLOWED_STRATEGIES, NONE_PERMITTED_LANES, PEER_REVIEW_RUBRIC_THRESHOLD } = require('./test-strategy-enum');

function fail(rule, detail) { return { ok: false, reason: rule, violations: [{ rule, detail }] }; }
function ok(reason = 'evidence-present') { return { ok: true, reason, violations: [] }; }

function trail(comments) { return (comments || []).map(c => c.body || '').join('\n'); }
function anyFile(prFiles, patterns) {
  return (prFiles || []).some(f => patterns.some(p => p.test(f)));
}

const CHECKERS = {
  'tdd-pyramid': (ctx) => anyFile(ctx.pr_files, [/^tests\/.+\.(spec|test)\.(js|ts)$/])
    ? ok() : fail('missing-spec-file', 'TDD strategy requires tests/**/*.spec.{js,ts}'),
  'tdd-trophy': (ctx) => CHECKERS['tdd-pyramid'](ctx),
  'contract-test': (ctx) => anyFile(ctx.pr_files,
    [/^cloudflare\/.*(test|spec)\.(ts|js)$/, /^tests\/.*contract.*\.(spec|test)\.(js|ts)$/])
    ? ok() : fail('missing-contract-test', 'contract-test requires cloudflare/**/test.ts or tests/**contract*.spec.*'),
  'golden-file': (ctx) => anyFile(ctx.pr_files, [/^tests\/fixtures\//])
    ? ok() : fail('missing-fixture', 'golden-file requires tests/fixtures/** artifact'),
  'eval-harness': (ctx) => anyFile(ctx.pr_files, [/^tests\/eval\//])
    ? ok() : fail('missing-eval-fixture', 'eval-harness requires tests/eval/** fixture'),
  'visual-regression': (ctx) => /VISUAL_QA_EVIDENCE/.test(trail(ctx.comments))
    ? ok() : fail('missing-visual-qa', 'visual-regression requires VISUAL_QA_EVIDENCE block in trail'),
  'drift-lint': (ctx) => /docs-drift-maintenance/.test(trail(ctx.comments))
    ? ok() : fail('missing-drift-lint', 'drift-lint requires docs-drift-maintenance citation in trail'),
  'peer-review': (ctx) => {
    const trailText = trail(ctx.comments);
    if (!/CONSULTANT_CLOSEOUT/.test(trailText)) return fail('missing-closeout', 'peer-review requires CONSULTANT_CLOSEOUT');
    const match = trailText.match(/rubric_rating:\s*(\d+)\s*\/\s*10/);
    const rating = match ? parseInt(match[1], 10) : 0;
    return rating >= PEER_REVIEW_RUBRIC_THRESHOLD
      ? ok() : fail('rubric-below-threshold', `peer-review rating ${rating} < ${PEER_REVIEW_RUBRIC_THRESHOLD}`);
  },
  'manual-verify': (ctx) => /before(\s*\/\s*|\s*and\s*)?after|before:.+after:/i.test(trail(ctx.comments))
    ? ok() : fail('missing-manual-verify', 'manual-verify requires before/after value citation'),
  'none': (ctx) => NONE_PERMITTED_LANES.includes(ctx.lane)
    ? ok('none-permitted-lane')
    : fail('none-disallowed', `test_strategy=none disallowed for ${ctx.lane}; declare a strategy from matrix`),
};

function validate(ctx = {}) {
  const strategy = ctx.test_strategy || 'none';
  if (!ALLOWED_STRATEGIES.includes(strategy)) {
    return fail('unknown-strategy', `'${strategy}' not in matrix enum; see instructions/test-methodology-matrix.instructions.md`);
  }
  return CHECKERS[strategy](ctx);
}

if (require.main === module) {
  const fs = require('node:fs');
  const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : null; };
  const ctx = {
    test_strategy: arg('strategy') || 'none',
    lane: arg('lane') || 'lane:code-change',
    comments: arg('comments') ? JSON.parse(fs.readFileSync(arg('comments'), 'utf8')) : [],
    pr_files: arg('pr-files') ? JSON.parse(fs.readFileSync(arg('pr-files'), 'utf8')) : [],
  };
  const result = validate(ctx);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

module.exports = { validate, ALLOWED_STRATEGIES, NONE_PERMITTED_LANES };
