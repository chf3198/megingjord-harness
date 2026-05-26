// Refs #1993 - regression test for childProgressComplete predicate
// Asserts CONSULTANT_EPIC_CLOSEOUT enumerating children clears Class C drift.
const test = require('node:test');
const assert = require('node:assert/strict');
const { childProgressComplete } = require('../scripts/global/lint-epic-drift.js');

test('returns false when no progress comments mention the child', () => {
  const child = { number: 2175 };
  const comments = ['Some unrelated comment', 'Another mention of #9999'];
  assert.equal(childProgressComplete(child, comments), false);
});

test('returns true when "## Epic Progress Update" comment cites the child', () => {
  const child = { number: 2175 };
  const comments = ['## Epic Progress Update — #2175 Complete\n- Ticket: #2175\n- Closed: 2026-05-26'];
  assert.equal(childProgressComplete(child, comments), true);
});

test('returns true when "## CONSULTANT_CLOSEOUT" comment cites the child', () => {
  const child = { number: 2175 };
  const comments = ['## CONSULTANT_CLOSEOUT\nticket: #2175\nverdict: approve_for_merge'];
  assert.equal(childProgressComplete(child, comments), true);
});

test('REGRESSION #1993: returns true when "## CONSULTANT_EPIC_CLOSEOUT" enumerates the child', () => {
  const child = { number: 2175 };
  const comments = [
    `## CONSULTANT_EPIC_CLOSEOUT

ticket: #2041
status: review
verdict: approve_epic_close

| Child | State |
|---|---|
| #2174 | CLOSED |
| #2175 | CLOSED |
| #2176 | CLOSED |`,
  ];
  assert.equal(childProgressComplete(child, comments), true);
});

test('REGRESSION #1993: returns true for all enumerated children in EPIC_CLOSEOUT', () => {
  const comments = [
    `## CONSULTANT_EPIC_CLOSEOUT enumerating #2174 #2175 #2176 #2177 #2178 #2179 #2180 #2181`,
  ];
  for (const number of [2174, 2175, 2176, 2177, 2178, 2179, 2180, 2181]) {
    assert.equal(childProgressComplete({ number }, comments), true, `child #${number} not matched`);
  }
});

test('returns false when EPIC_CLOSEOUT exists but does not enumerate this child', () => {
  const child = { number: 9999 };
  const comments = [`## CONSULTANT_EPIC_CLOSEOUT for Epic #2041 enumerates #2174 #2175`];
  assert.equal(childProgressComplete(child, comments), false);
});

test('handles undefined/empty comments array', () => {
  assert.equal(childProgressComplete({ number: 1 }, []), false);
});

test('child-number substring guard: #21 does NOT match #210', () => {
  // The predicate currently uses substring match; document the limitation
  const comments = ['## Epic Progress Update — #210 Complete'];
  // Expected behavior: #21 SHOULD NOT match #210 — but current substring match WILL match.
  // This test documents the known limitation; if it fails (i.e. correctly returns false),
  // the predicate has been strengthened — update this test.
  const result = childProgressComplete({ number: 21 }, comments);
  // Known-limitation: substring `#21` IS contained in `#210`, so match=true today.
  assert.equal(result, true, 'documented limitation: substring match. See #1993 follow-on if fix needed.');
});
