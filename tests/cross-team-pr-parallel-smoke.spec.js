const assert = require('assert');
const { verifySmokeResult } = require('../scripts/global/cross-team-pr-parallel-smoke');

(function run() {
  const pass = verifySmokeResult({
    comments: ['<!-- cross-team-pr-parallel-check -->\n| #1488 | #777 | claude-code:opus-4-7@anthropic |'],
    labels: ['coordinator:cross-team-needs-hand-off'],
    expectedParallelPr: '777',
  });
  assert.strictEqual(pass.ok, true);

  const noComment = verifySmokeResult({
    comments: ['other comment'],
    labels: ['coordinator:cross-team-needs-hand-off'],
    expectedParallelPr: '777',
  });
  assert.strictEqual(noComment.ok, false);

  const noLabel = verifySmokeResult({
    comments: ['<!-- cross-team-pr-parallel-check -->'],
    labels: [],
    expectedParallelPr: '777',
  });
  assert.strictEqual(noLabel.ok, false);

  const rowOptional = verifySmokeResult({
    comments: ['<!-- cross-team-pr-parallel-check -->'],
    labels: ['coordinator:cross-team-needs-hand-off'],
  });
  assert.strictEqual(rowOptional.ok, true);

  console.log('cross-team-pr-parallel-smoke tests: PASS');
})();
