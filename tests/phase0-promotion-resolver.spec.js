// Tests for scripts/global/phase0-promotion-resolver.js (Epic #2678 AC1 integration).
// Validates child-linkage resolution incl the back-reference filter that stops
// unrelated #N mentions (e.g. "Refs #3256" in an analysis comment) from being
// mis-counted as Phase-0/Phase-1 children.
const { test, expect } = require('@playwright/test');
const resolver = require('../scripts/global/phase0-promotion-resolver');
const { makeGithub, validPlanRating } = require('./phase0-github-mock');

test('parseRefs dedupes and parses #N', () => {
  expect(resolver.parseRefs('see #2680 and #2680 plus #2681')).toEqual([2680, 2681]);
  expect(resolver.parseRefs(null)).toEqual([]);
});

test('collectCandidateRefs unions body+comments, excludes the Epic itself', () => {
  const refs = resolver.collectCandidateRefs({ body: 'children #11 #12' }, [{ body: 'also #13 and self #99' }], 99);
  expect(refs.sort()).toEqual([11, 12, 13]);
});

test('childBackrefsEpic matches #N ref and Parent: form', () => {
  expect(resolver.childBackrefsEpic('Refs #500 here', 500)).toBe(true);
  expect(resolver.childBackrefsEpic('Parent: #500', 500)).toBe(true);
  expect(resolver.childBackrefsEpic('unrelated #777', 500)).toBe(false);
});

test('resolve classifies only true children and ignores polluting refs', async () => {
  const pr = validPlanRating(500); // #3826: green now needs a verified plan-rating
  const { github } = makeGithub({
    issues: {
      500: { state: 'open', labels: ['type:epic', 'phase-gate:research-first'], body: 'kids #501 #502; see also #3256' },
      501: { state: 'closed', labels: ['phase-gate:research-first'], body: 'Parent: #500' },
      502: { state: 'open', labels: ['phase-gate:phase-1'], body: 'Refs #500' },
      // #3256 carries a phase-gate label but back-refs a DIFFERENT epic — must be ignored.
      3256: { state: 'open', labels: ['phase-gate:research-first'], body: 'Parent: #3251' },
    },
    commentsByIssue: {
      500: [{ body: '## EPIC_RESCOPE done' }, pr.comment],
      501: [{ body: '## CONSULTANT_CLOSEOUT rubric 8/10' }],
    },
  });
  const r = await resolver.resolve({ github, owner: 'o', repo: 'r', epicNumber: 500, ledger: pr.ledger });
  expect(r.phase0Count).toBe(1);   // only #501, not the polluting #3256
  expect(r.phase1Count).toBe(1);   // #502
  expect(r.complete).toBe(true);
  expect(r.planRating.ok).toBe(true);
  expect(r.missingPhase1Children).toBe(false);
});
