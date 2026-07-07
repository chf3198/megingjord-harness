const { test, expect } = require('@playwright/test');
const rule = require('../scripts/global/megalint/flaw-emission');

// Epic #2070 / #3649 — soften flaw-emission for legitimate marker-word prose.
// AC4 positive corpus (>=15): feature-descriptive prose that previously false-failed the
// blocking closeout-lint gate. Each MUST NOT be counted as a flaw line.
const POSITIVE_PROSE = [
  'baton-stall failure mode observed under load',
  'single-cycle bug-fix landed cleanly',
  'the LLM-failure patterns are catalogued',
  'persistent-failure threshold exceeded once',
  'Flaw=ticket-scope-creep',
  'flaw: scope-creep',
  'see incidents.jsonl for the trace',
  'failure modes enumerated in the G8 rationale',
  'the bug tracker link is stale',
  'error path failure handling was added',
  'incident report filed automatically',
  'bug detection improved this quarter',
  'failure rate dropped to zero',
  'the flaw-emission validator was softened',
  'reduced false-positive bug reports',
  'failure path coverage is complete',
  'the incident queue is empty',
  'flaws_recognized: none',
];

// AC5 negative corpus (>=10): genuine first-person/uncited flaw confessions. Each MUST be
// counted as a flaw line (and, when uncited, produce a violation).
const NEGATIVE_CONFESSIONS = [
  'I had to work around the sibling-worktree data loss',
  'worked around a broken merge gate by editing state',
  'Flaw observed: admin-merge bypass under failing CI',
  'there was a bug in the workflow we never filed',
  'hit a side-effect while patching the hook',
  'the incident went unlogged',
  'I had to manually reset the label state',
  'a genuine flaw in the signer logic slipped through',
  'worked around the canonical-main guard',
  'observed a failure to emit the artifact',
  'I had to bypass the push gate',
  'there is a bug here that needs a ticket',
];

test('AC4: positive prose corpus (>=15) is NOT flagged as flaw lines', () => {
  expect(POSITIVE_PROSE.length).toBeGreaterThanOrEqual(15);
  for (const line of POSITIVE_PROSE) {
    expect(rule.isFlawLine(line), `false-positive on: "${line}"`).toBe(false);
  }
});

test('AC5: negative confession corpus (>=10) IS flagged as flaw lines', () => {
  expect(NEGATIVE_CONFESSIONS.length).toBeGreaterThanOrEqual(10);
  for (const line of NEGATIVE_CONFESSIONS) {
    expect(rule.isFlawLine(line), `missed true flaw: "${line}"`).toBe(true);
  }
});

test('AC2: strong first-person markers unchanged (still fire without a nearby citation)', () => {
  const body = '## COLLABORATOR_HANDOFF\nI had to work around a broken gate\nmore prose here';
  const result = rule.validate({ comments: [{ body }] });
  expect(result.ok).toBe(false);
  expect(result.violations[0].rule).toBe('flaw-mention-missing-anneal-artifact');
});

test('AC3: structured-block citation forms (decision:/artifact:/flaws_recognized:) satisfy CITE', () => {
  const body = '## CONSULTANT_CLOSEOUT\nmid_flight_flaws: [<flaw>, decision=file-ticket, artifact=#42]';
  const result = rule.validate({ comments: [{ body }] });
  expect(result.ok).toBe(true); // self-citing structured block passes
});

test('AC3: a flaws_recognized block entry passes via nearby artifact citation', () => {
  const body = [
    '## COLLABORATOR_HANDOFF',
    'flaws_recognized:',
    '  - flaw: scope crept mid-flight',
    '    decision: file-ticket',
    '    artifact: #123',
  ].join('\n');
  const result = rule.validate({ comments: [{ body }] });
  expect(result.ok).toBe(true);
});

// AC7 replay-eval: measure precision improvement vs the PRE-softening broad regex, with
// recall preserved. Old behavior = any of the original 7 markers matches the raw line.
const OLD_MARKERS = [/\bI had to\b/i, /\bworked around\b/i, /\bside-?effect\b/i,
  /\bflaw\b/i, /\bbug\b/i, /\bfailure\b/i, /\bincident\b/i];
const oldIsHit = (line) => OLD_MARKERS.some((marker) => marker.test(line));

function scoreCorpus(hitFn) {
  let truePos = 0; let falsePos = 0; let falseNeg = 0;
  for (const line of NEGATIVE_CONFESSIONS) (hitFn(line) ? truePos++ : falseNeg++);
  for (const line of POSITIVE_PROSE) if (hitFn(line)) falsePos++;
  const precision = truePos / (truePos + falsePos);
  const recall = truePos / (truePos + falseNeg);
  return { truePos, falsePos, falseNeg, precision, recall };
}

test('AC7: precision improves >=20% over the old regex with recall preserved', () => {
  const before = scoreCorpus(oldIsHit);
  const after = scoreCorpus((line) => rule.isFlawLine(line));
  // recall preserved: every genuine confession still caught by the softened validator.
  expect(after.recall).toBeGreaterThanOrEqual(before.recall);
  expect(after.recall).toBe(1);
  // precision materially improves: the old regex false-fires on the benign prose.
  expect(before.falsePos).toBeGreaterThan(0);
  expect(after.falsePos).toBe(0);
  expect(after.precision - before.precision).toBeGreaterThanOrEqual(0.20);
});
