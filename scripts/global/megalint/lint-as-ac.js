'use strict';
// lint-as-ac — Epic #1510 Phase-1a. Flags Acceptance Criteria that
// restate already-enforced lint rules (e.g. "AC: all files ≤ 100 lines").
// Linting is automatic; restating it as an AC adds noise, lets authors
// tick via reading rather than running, and doesn't generalize.
//
// IMPORTANT: distinguishes ADDING a lint rule (legitimate scope) from
// RESTATING an enforced one (anti-pattern). The heuristic in §3c of the
// Phase-0 design: ACs starting with "New rule"/"Add lint"/"Megalint
// validator" describe the work; ACs starting with "All files ≤"/"npm run
// lint passes" restate enforcement.

const ANTI_PATTERNS = [
  // File-size restate
  /\b(all\s+|every\s+|each\s+)?(new\s+)?files?\s+(must\s+be\s+|are\s+|is\s+)?(≤|<=|under|below|within)\s+\d+\s*line/i,
  // Named-tool restate (the bare tool name with no add-rule context)
  /\b(prettier|markdownlint|ruff|shellcheck|eslint)\b\s+(clean|green|pass(es|ed)?)\b/i,
  // Generic lint-clean restate
  /\blint\s+(clean|green|pass(es|ed)?)\b/i,
  // npm-script restate
  /\b(npm\s+run\s+)?format:check\s+(green|pass(es|ed)?)\b/i,
  // Readability/whitespace restate
  /\b(readability|whitespace|trailing\s+whitespace)\s+(check|pass(es|ed)?)\b/i,
];

const ADDITIVE_HINTS = /\b(new\s+(rule|validator|lint|check)|add\s+(a\s+)?lint|megalint\s+validator|rule\s+(catches|detects|flags))/i;

function isAcLine(line) {
  return /^\s*-\s*\[[ x]\]\s*AC[\d:\s-]/i.test(line);
}

function extractACs(body) {
  const lines = (body || '').split('\n');
  let inAcSection = false;
  const out = [];
  for (const line of lines) {
    if (/^#{1,4}\s*Acceptance\s+Criteria/i.test(line)) { inAcSection = true; continue; }
    if (inAcSection && /^#{1,4}\s+/.test(line)) inAcSection = false;
    if (inAcSection && isAcLine(line)) out.push(line);
  }
  return out;
}

function isAntiPattern(acLine) {
  if (ADDITIVE_HINTS.test(acLine)) return false;
  return ANTI_PATTERNS.some((re) => re.test(acLine));
}

function validate(input) {
  const acs = extractACs(input.body || '');
  const violations = [];
  for (const ac of acs) {
    if (isAntiPattern(ac)) {
      violations.push({
        rule: 'lint-as-ac',
        detail: `AC restates an already-enforced lint rule (anti-pattern). Remove or rephrase: ${ac.trim().slice(0, 100)}`,
        ac: ac.trim(),
      });
    }
  }
  return { ok: violations.length === 0, violations };
}

module.exports = { validate, extractACs, isAntiPattern, ANTI_PATTERNS, ADDITIVE_HINTS };
