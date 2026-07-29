'use strict';
// Epic #3576 W-B (#3583) — lane-selection guidance + batch generator + E4 anchor-drift golden.
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const fs = require('node:fs');
const sel = require(path.resolve(__dirname, '../scripts/global/lane-selector'));
const batch = require(path.resolve(__dirname, '../scripts/global/batch-block-generator'));

test('recommendLane: trivial docs -> lane:trivial', () => {
  expect(sel.recommendLane({ diffLines: 5, touchedPaths: ['README.md', 'docs/x.md'] })).toBe('lane:trivial');
});
test('recommendLane: small config -> lane:config-only', () => {
  expect(sel.recommendLane({ diffLines: 3, touchedPaths: ['config/x.json'] })).toBe('lane:config-only');
});
test('recommendLane: risk label -> lane:code-change', () => {
  expect(sel.recommendLane({ diffLines: 2, touchedPaths: ['config/x.json'], riskLabels: ['area:hooks'] })).toBe('lane:code-change');
});
test('recommendLane: large/multi-file -> lane:code-change', () => {
  expect(sel.recommendLane({ diffLines: 500, touchedPaths: ['a.js'] })).toBe('lane:code-change');
  expect(sel.recommendLane({ diffLines: 5, touchedPaths: ['a', 'b', 'c', 'd'] })).toBe('lane:code-change');
});
test('recommendLane: unknown (no paths) -> lane:code-change (conservative)', () => {
  expect(sel.recommendLane({ diffLines: 1, touchedPaths: [] })).toBe('lane:code-change');
});

test('leadCloseBlock: emits Closes for lead + siblings', () => {
  expect(batch.leadCloseBlock(10, [11, 12])).toBe('Closes #10\nCloses #11\nCloses #12');
});
test('siblingBriefEvidence: carries the #1714 batch marker phrase', () => {
  const b = batch.siblingBriefEvidence({ sibling: 11, lead: 10, teamModel: 'claude-code:claude-opus-4-8@local' });
  expect(b).toContain('resolved as part of batch with #10');
  expect(b).toContain('## CONSULTANT_CLOSEOUT');
});
test('buildBatchBlocks: one block per sibling', () => {
  const r = batch.buildBatchBlocks({ lead: 10, siblings: [11, 12], teamModel: 'claude-code:claude-opus-4-8@local' });
  expect(r.siblingBlocks.length).toBe(2);
});

test('E4 anchor-drift golden: both anchor files reference #1714, none flatly forbids bundling', () => {
  const files = ['hooks/scripts/precompact_anchor.py', 'hooks/scripts/session_context.py']
    .map((f) => fs.readFileSync(path.resolve(__dirname, '..', f), 'utf8'));
  for (const body of files) {
    const line = body.split('\n').find((l) => l.includes('One branch = one ticket'));
    expect(line).toBeTruthy();
    expect(line).toContain('#1714');
    expect(line).not.toContain('No bundling');
  }
});
