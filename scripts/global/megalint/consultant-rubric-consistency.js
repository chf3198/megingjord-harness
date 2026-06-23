'use strict';
// #2908 — G1–G9 rubric vs verdict internal consistency (Gap G-04).

const APPROVE_RE = /\bverdict:\s*approve_for_merge\b/i;
const REJECT_RE = /\bverdict:\s*reject(?:_for_\w+)?\b/i;
const FLOOR = 7;

function parseGScores(body) {
  const text = String(body || '');
  const scores = [];
  for (let i = 1; i <= 9; i++) {
    const m = text.match(new RegExp(`\\bG${i}\\s*[=:]\\s*([0-9]+(?:\\.[0-9]+)?)`, 'i'));
    if (!m) return null;
    scores.push(Number(m[1]));
  }
  return scores;
}

function checkRubricVerdictConsistency(body) {
  const scores = parseGScores(body);
  if (!scores) return [];
  const min = Math.min(...scores);
  const violations = [];
  if (APPROVE_RE.test(body) && min < FLOOR) {
    violations.push({ rule: 'rubric-floor-violation',
      detail: `min(G1..G9)=${min} < ${FLOOR} but verdict is approve_for_merge` });
  }
  if (REJECT_RE.test(body) && min >= FLOOR) {
    violations.push({ rule: 'rubric-verdict-contradiction',
      detail: `min(G1..G9)=${min} >= ${FLOOR} but verdict is reject` });
  }
  return violations;
}

module.exports = { checkRubricVerdictConsistency, parseGScores, FLOOR };
