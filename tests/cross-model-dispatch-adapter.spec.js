'use strict';
// Tests for the post-merge-audit Layer-B operationalization (Epic #3251 #3258 D6):
// the dispatch adapter mapping + a golden-file assertion that the workflow now
// calls the real adapter (not the retired inert placeholder).
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { makeCrossModelDispatch, mapToAudit } =
  require('../scripts/global/baton-postmerge-audit/cross-model-dispatch-adapter.js');

test('mapToAudit: blocking findings -> REJECT with reviewer family', () => {
  const out = mapToAudit({ review_coverage: 'cross-family-free', reviewer: { family: 'google' },
    route: { markers: [{ remediator: 'collaborator', impact: 'baton-back', finding_ref: 'F1' }] } });
  assert.equal(out.verdict, 'REJECT');
  assert.equal(out.reviewer_model_family, 'google');
  assert.equal(out.findings[0], 'collaborator:baton-back F1');
  assert.equal(out.score, 4);
});

test('mapToAudit: no findings -> ACCEPT/8; programmatic-only -> score 5', () => {
  const clean = mapToAudit({ review_coverage: 'cross-family-free', reviewer: { family: 'mistral' }, route: { markers: [] } });
  assert.equal(clean.verdict, 'ACCEPT');
  assert.equal(clean.score, 8);
  const prog = mapToAudit({ review_coverage: 'programmatic-only', findings: [] });
  assert.equal(prog.reviewer_model_family, 'programmatic-only');
  assert.equal(prog.score, 5);
});

test('makeCrossModelDispatch calls dispatchReview and maps output', async () => {
  const dispatch = makeCrossModelDispatch({ dispatchReview: async () => ({
    review_coverage: 'cross-family-free', reviewer: { family: 'google' }, route: { markers: [] } }) });
  const res = await dispatch('review this', { authorTeam: 'claude-code' });
  assert.equal(res.verdict, 'ACCEPT');
  assert.equal(res.reviewer_model_family, 'google');
});

test('makeCrossModelDispatch degrades to advisory programmatic-only on throw (G6)', async () => {
  const dispatch = makeCrossModelDispatch({ dispatchReview: async () => { throw new Error('all down'); } });
  const res = await dispatch('x', { authorTeam: 'claude-code' });
  assert.equal(res.verdict, 'ACCEPT');
  assert.equal(res.reviewer_model_family, 'programmatic-only');
  assert.match(res.degraded_reason, /all down/);
});

test('golden: workflow calls the real adapter, keeps advisory posture, drops placeholder', () => {
  const wf = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'post-merge-consultant-audit.yml'), 'utf8');
  assert.match(wf, /cross-model-dispatch-adapter/);
  assert.match(wf, /makeCrossModelDispatch\(\)/);
  assert.match(wf, /continue-on-error:\s*true/);
  assert.match(wf, /contents:\s*read/);
  assert.match(wf, /issues:\s*write/);
  assert.equal(/reviewer_model_family:\s*'qwen'/.test(wf), false); // inert placeholder removed
});
