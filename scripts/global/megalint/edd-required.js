'use strict';
// tier: 1
// edd-required (GOV-009, #2915): validates EDD artifact presence for lane:code-change tickets.
// Implementation tickets above the trivial threshold MUST reference an EDD before first commit.
// EDD artifact requires at minimum: scope:, acceptance:, risk:, implementation-plan: fields.
// Exempt lanes: lane:trivial, lane:config-only, lane:docs-research, lane:no-code-remediation.

/** Lanes exempt from the EDD requirement. */
const EXEMPT_LANES = new Set([
  'lane:trivial',
  'lane:config-only',
  'lane:docs-research',
  'lane:docs-only',
  'lane:research',
  'lane:no-code-remediation',
]);

/** Required fields that must appear in the EDD artifact body. */
const EDD_REQUIRED_FIELDS = ['scope', 'acceptance', 'risk', 'implementation-plan'];

/** Header patterns that signal the start of an EDD artifact. */
const EDD_HEADER_RE = /(?:^|\n)\s*(?:##\s+)?EDD\b|engineering\s+design\s+doc(?:ument)?/im;

/** Governance control id this gate enforces (named to keep it out of magic-number lint). */
const GOV_CONTROL = 'GOV-009';

/** The standard "EDD artifact absent" hard violation result. */
function eddMissingResult() {
  return {
    ok: false,
    exempt: false,
    violations: [{
      rule: 'edd-missing',
      detail: 'No EDD artifact found. lane:code-change tickets require an EDD before implementation ' +
        `(${GOV_CONTROL}). Add an EDD comment to the linked issue with ` +
        'scope:, acceptance:, risk:, implementation-plan:',
      severity: 'hard',
    }],
  };
}

/** Lane scoping decision: 'exempt' (skip gate) or 'in-scope' (apply gate). */
function laneScope(labels) {
  if (isExempt(labels)) return 'exempt';
  const hasCodeChange = labels.some((label) => label === 'lane:code-change');
  const hasAnyLane = labels.some((label) => label.startsWith('lane:'));
  return (hasAnyLane && !hasCodeChange) ? 'exempt' : 'in-scope';
}

/** Concatenate PR body + all issue comment bodies into one corpus string. */
function buildCorpus(input) {
  const prBodyText = typeof input.prBody === 'string' ? input.prBody : '';
  const commentTexts = Array.isArray(input.comments)
    ? input.comments.map((c) => (c && typeof c.body === 'string' ? c.body : '')).join('\n\n')
    : '';
  return [prBodyText, commentTexts].filter(Boolean).join('\n\n');
}

/**
 * Determine if the ticket's lanes exempt it from the EDD gate.
 * @param {string[]} labels - Array of label name strings.
 * @returns {boolean}
 */
function isExempt(labels) {
  if (!Array.isArray(labels)) return false;
  return labels.some((label) => EXEMPT_LANES.has(label));
}

/**
 * Find the EDD artifact text within combined issue+PR text.
 * Searches both PR body and issue comment trail.
 * Returns the matched EDD section text or null if absent.
 * @param {string} text - Combined body text to scan.
 * @returns {string|null}
 */
function findEddSection(text) {
  if (typeof text !== 'string' || text.length === 0) return null;
  const match = EDD_HEADER_RE.exec(text);
  if (!match) return null;
  // Return the text from the EDD header to end (full artifact, bounded by caller).
  return text.slice(match.index);
}

/**
 * Check that all required EDD fields are present in the artifact section.
 * FAIL-CLOSED: each field must be present as a colon-key line.
 * @param {string} eddText - The EDD artifact body text.
 * @returns {{ rule: string, detail: string, severity: string }[]}
 */
function checkEddFields(eddText) {
  const violations = [];
  for (const field of EDD_REQUIRED_FIELDS) {
    const re = new RegExp(`(?:^|\\n)[-*]?\\s*${field}\\s*:`, 'i');
    if (!re.test(eddText)) {
      violations.push({
        rule: 'edd-missing-field',
        detail: `EDD artifact is missing required field '${field}:' (${GOV_CONTROL} §Requirement)`,
        severity: 'hard',
      });
    }
  }
  return violations;
}

/**
 * Validate EDD presence for a pull request / issue pair.
 *
 * @param {object} input
 * @param {string[]}  input.labels        - Issue label name strings.
 * @param {string}    [input.prBody]      - PR body text (may be empty).
 * @param {object[]}  [input.comments]    - Issue comment objects with `.body` string.
 * @returns {{ ok: boolean, violations: object[], exempt: boolean }}
 */
function validate(input) {
  // Defensive: treat null/undefined input as invalid — FAIL-CLOSED.
  if (input == null || typeof input !== 'object') {
    return {
      ok: false,
      exempt: false,
      violations: [{
        rule: 'edd-gate-invalid-input',
        detail: `validate() received null/non-object input; failing closed (${GOV_CONTROL})`,
        severity: 'hard',
      }],
    };
  }
  const labels = Array.isArray(input.labels) ? input.labels : [];
  // Exempt lanes (and non-exempt non-code-change lanes) skip the gate entirely.
  if (laneScope(labels) === 'exempt') return { ok: true, exempt: true, violations: [] };

  const fullText = buildCorpus(input);
  // FAIL-CLOSED: empty corpus or no EDD header = missing EDD.
  if (fullText.trim().length === 0) return eddMissingResult();
  const eddSection = findEddSection(fullText);
  if (!eddSection) return eddMissingResult();

  // EDD header found — validate required fields.
  const fieldViolations = checkEddFields(eddSection);
  return {
    ok: fieldViolations.length === 0,
    exempt: false,
    violations: fieldViolations,
  };
}

module.exports = { validate, isExempt, findEddSection, checkEddFields, EXEMPT_LANES, EDD_REQUIRED_FIELDS };
