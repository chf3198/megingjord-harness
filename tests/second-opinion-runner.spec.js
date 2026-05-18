'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { runSecondOpinion, parseScoreLines, buildPrompt, RATER_TEAM_MODEL } =
  require('../scripts/global/second-opinion-runner.js');

test('parseScoreLines: extracts G1..G9 integer scores', () => {
  const out = parseScoreLines('G1=8\nG2=9\nG3:7\nG10=10');
  assert.deepEqual(out, { G1: 8, G2: 9, G3: 7 });
});

test('parseScoreLines: handles decimals + first-wins', () => {
  const out = parseScoreLines('G1=8.5\nG1=2\nG2=7');
  assert.equal(out.G1, 8.5);
  assert.equal(out.G2, 7);
});

test('parseScoreLines: empty input', () => {
  assert.deepEqual(parseScoreLines(''), {});
  assert.deepEqual(parseScoreLines(null), {});
});

test('buildPrompt: substitutes both placeholders', () => {
  const p = buildPrompt('CLOSEOUT_TEXT', 'DIFF_TEXT');
  assert.match(p, /CLOSEOUT_TEXT/);
  assert.match(p, /DIFF_TEXT/);
});

test('buildPrompt: caps long inputs', () => {
  const longCloseout = 'Z'.repeat(5000);
  const longDiff = 'X'.repeat(3000);
  const p = buildPrompt(longCloseout, longDiff);
  const zCount = (p.match(/Z/g) || []).length;
  const xCount = (p.match(/X/g) || []).length;
  assert.ok(zCount <= 4001 && zCount >= 3999);
  assert.ok(xCount <= 2001 && xCount >= 1999);
});

test('runSecondOpinion: dry-run skips fleet call', async () => {
  const r = await runSecondOpinion({
    closeoutBody: 'G1=8\nG2=7\nG3=9',
    diffSummary: '',
    dryRun: true,
  });
  assert.equal(r.dry_run, true);
  assert.deepEqual(r.first_scores, { G1: 8, G2: 7, G3: 9 });
  assert.equal(r.rater_team_model, RATER_TEAM_MODEL);
});

test('RATER_TEAM_MODEL is cross-family from any provider team', () => {
  assert.match(RATER_TEAM_MODEL, /^fleet:/);
  assert.match(RATER_TEAM_MODEL, /qwen/);
});
