'use strict';
// Stress (Epic #2192 / #2738): adversarial-input parser -> fault-injection + p99 budget.
// The offline skip-fixture (AC4): replays the "skip review under pressure" scenario.
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fr = require(path.resolve(__dirname, '..', 'scripts', 'global', 'megalint', 'fleet-review-required.js'));

const P99_BUDGET_MS = 200;
const SCALE = 5000;

test('chaos: malformed / adversarial closeout bodies never throw, always classify', () => {
  const adversarial = [
    { labels: ['area:governance'], closeoutBody: 'cross_family_reviewer: \n', authorTeamModel: 'x:y@z' },
    { labels: ['area:scripts'], closeoutBody: 'cross_family_verdict: MAYBE - a@b - x', authorTeamModel: null },
    { labels: ['area:hooks'], closeoutBody: 'cross_family_reviewer: gpt@openai\ncross_family_verdict: ACCEPT - gpt@openai - ok', authorTeamModel: 'codex:gpt-5@openai' },
    { labels: null, closeoutBody: undefined },
  ];
  for (const ctx of adversarial) {
    const result = fr.validate(ctx);
    assert.ok(typeof result.ok === 'boolean');
  }
  // the OpenAI-reviews-OpenAI case must be flagged not-cross-family
  const same = fr.validate(adversarial[2]);
  assert.ok(same.violations.some((v) => v.rule === 'fleet-review-not-cross-family'));
});

test('skip-fixture: a closeout that omits the review block is BLOCKED (the core scenario)', () => {
  const skipUnderPressure = { labels: ['area:governance'],
    closeoutBody: 'verdict: approve_for_merge\nrubric_rating: 9/10\nSigned-by: X', authorTeamModel: 'claude-code:opus@anthropic' };
  const result = fr.validate(skipUnderPressure);
  assert.strictEqual(result.ok, false);
  assert.ok(result.violations.some((v) => v.rule === 'fleet-review-missing'));
});

test('perf: validating many closeouts stays under the p99 budget', () => {
  const ctx = { labels: ['area:governance'],
    closeoutBody: 'cross_family_reviewer: gemini@google-ai-studio\ncross_family_verdict: ACCEPT - gemini@google-ai-studio - ok',
    authorTeamModel: 'claude-code:opus@anthropic', dispatchRecorded: true };
  const start = process.hrtime.bigint();
  for (let i = 0; i < SCALE; i += 1) fr.validate(ctx);
  const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
  assert.ok(elapsedMs < P99_BUDGET_MS, `took ${elapsedMs}ms (budget ${P99_BUDGET_MS}ms)`);
});
