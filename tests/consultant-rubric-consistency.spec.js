'use strict';
const { test, expect } = require('@playwright/test');
// #3814 (Epic #3807 C6): rubric-consistency logic consolidated into its only consumer,
// consultant-closeout.js; the standalone validator file was retired. Property unchanged.
const { checkRubricVerdictConsistency, parseGScores, FLOOR } =
  require('../scripts/global/megalint/consultant-closeout.js');

const HIGH = 'G1: 8 G2: 8 G3: 8 G4: 8 G5: 8 G6: 8 G7: 8 G8: 8 G9: 8';
const LOW = 'G1: 2 G2: 8 G3: 8 G4: 8 G5: 8 G6: 8 G7: 8 G8: 8 G9: 8';

test.describe('consultant rubric consistency (#2908)', () => {
  test('parseGScores reads G1–G9', () => {
    expect(parseGScores(HIGH)).toHaveLength(9);
    expect(parseGScores('G1: 8')).toBeNull();
  });

  test('blocks approve when min < floor', () => {
    const v = checkRubricVerdictConsistency(`verdict: approve_for_merge\n${LOW}`);
    expect(v.some(x => x.rule === 'rubric-floor-violation')).toBe(true);
  });

  test('allows approve when min >= floor', () => {
    expect(checkRubricVerdictConsistency(`verdict: approve_for_merge\n${HIGH}`)).toHaveLength(0);
  });

  test('blocks reject when min >= floor', () => {
    const v = checkRubricVerdictConsistency(`verdict: reject\n${HIGH}`);
    expect(v.some(x => x.rule === 'rubric-verdict-contradiction')).toBe(true);
  });

  test('FLOOR is 7', () => {
    expect(FLOOR).toBe(7);
  });
});
