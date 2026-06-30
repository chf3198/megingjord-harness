'use strict';
// epic-ac-disposition-check — advisory: flags an Epic that closes with an
// enforcement-worded acceptance-criterion ticked while the shipped artifact is
// advisory-only (non-blocking). Ticket #1617 (Tier-2 anneal). Complements
// body-ac-truthfulness (checkbox state) and epic-ac-traceability (child refs):
// this is the wording-vs-shipped-disposition axis, not covered by either.
//
// Path D (advisory-first -> soak -> replay-eval promotion) is a valid rollout.
// The trap is the closure LANGUAGE: an `enforce X` AC ticked as shipped when
// only the advisory phase landed. Either ship required-mode before close, or
// rescope the AC text to `ship advisory; promotion deferred` before ticking.

// AC lines whose wording promises enforcement / blocking behavior.
const ENFORCE_VOCAB = /\b(enforce(?:s|d|ment|ments)?|enforcing|required-blocking|block(s|ed|ing)?|fail[\s-]the[\s-]gate|fails?[\s-]the[\s-](?:consultant[\s-])?gate|must[\s-](?:block|fail)|hard[\s-]gate|blocking[\s-]gate)\b/i;

// An AC line that already discloses its advisory disposition is honest — exclude it.
const RESCOPE_DISCLOSURE = /\b(advisory(?:[\s-]only|[\s-]first)?|promotion[\s-]deferred|ship[\s-]advisory|non[\s-]blocking|soak[\s-]then[\s-]promote)\b/i;

// Disposition evidence drawn from closeout / comment narrative.
const ADVISORY_SIGNAL = /\b(advisory[\s-]only|advisory[\s-]first|ship(?:s|ped|ping)?[\s-]advisory|promotion[\s-]deferred|does[\s-]not[\s-]block|non[\s-]blocking|-advisory\.yml|core\.warning)\b/i;
const REQUIRED_SIGNAL = /\b(required[\s-]blocking|now[\s-]blocks?|core\.setFailed|promoted[\s-]to[\s-](?:required|blocking)|promotion[\s-](?:complete|landed|shipped)|enforced[\s-]blocking|hard[\s-]gate[\s-]live)\b/i;

function isEpic(labels) {
  return (labels || []).includes('type:epic');
}

function isTerminal(labels, state) {
  return state === 'closed'
    || (labels || []).includes('status:done')
    || (labels || []).includes('status:cancelled');
}

// Ticked enforce-worded AC lines that do NOT already disclose advisory disposition.
function findEnforceAcs(body) {
  const lines = (body || '').split('\n');
  const hits = [];
  for (const line of lines) {
    if (!/^[\s-]*\[x\]\s*\*?\*?\s*AC[\d:\s-]/i.test(line)) continue;
    if (RESCOPE_DISCLOSURE.test(line)) continue;
    if (ENFORCE_VOCAB.test(line)) hits.push(line.trim());
  }
  return hits;
}

function dispositionText(input) {
  const comments = (input.comments || []).map(c => (c && c.body) || (typeof c === 'string' ? c : '')).join('\n');
  return `${comments}\n${input.dispositionText || ''}`;
}

// Scope guard: act only on terminal, non-cancelled Epics (advisory elsewhere).
function inScope(labels, state) {
  if (!isEpic(labels) || !isTerminal(labels, state)) return false;
  if ((labels || []).includes('status:cancelled')) return false; // goal invalidated
  return true;
}

function buildViolation(enforceAcs) {
  return {
    rule: 'enforce-ac-shipped-advisory',
    severity: 'advisory',
    detail: `${enforceAcs.length} enforce-worded AC(s) ticked on a closed Epic whose closeout evidence reads advisory-only `
      + '(no required-blocking / promotion signal). Ship required-mode before close, OR rescope the AC text to '
      + '`ship advisory; promotion deferred`. Offending AC(s): '
      + enforceAcs.map(ac => ac.slice(0, 80)).join(' | '),
    enforce_ac_count: enforceAcs.length,
  };
}

function validate(input) {
  input = input || {};
  const labels = input.labels || [];
  const violations = [];
  if (!inScope(labels, input.state)) return { ok: true, violations, skipped: true };

  const enforceAcs = findEnforceAcs(input.body || '');
  if (enforceAcs.length === 0) return { ok: true, violations };

  const disposition = dispositionText(input);
  // Trigger only when evidence shows advisory-only shipped (no required/promotion signal).
  if (ADVISORY_SIGNAL.test(disposition) && !REQUIRED_SIGNAL.test(disposition)) {
    violations.push(buildViolation(enforceAcs));
  }
  return { ok: violations.length === 0, violations };
}

module.exports = {
  validate, findEnforceAcs, dispositionText, inScope, isEpic, isTerminal, buildViolation,
  ENFORCE_VOCAB, RESCOPE_DISCLOSURE, ADVISORY_SIGNAL, REQUIRED_SIGNAL,
};

if (require.main === module) {
  const fs = require('fs');
  const file = process.argv[2];
  if (!file) {
    console.error('usage: epic-ac-disposition-check.js <issue.json>  (json: {body,labels,state,comments})');
    process.exit(2);
  }
  const input = JSON.parse(fs.readFileSync(file, 'utf8'));
  const result = validate(input);
  if (!result.ok) {
    result.violations.forEach(v => console.error(`epic-ac-disposition-check: ${v.rule} - ${v.detail}`));
    process.exit(process.env.EPIC_AC_DISPOSITION_STRICT === '1' ? 1 : 0); // advisory by default
  }
  console.log('epic-ac-disposition-check: OK - no enforce-AC vs advisory-artifact mismatch');
}
