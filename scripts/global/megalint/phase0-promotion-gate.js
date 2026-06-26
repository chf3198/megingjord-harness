'use strict';
// phase0-promotion-gate — pure decision logic for the Phase-0 -> Phase-1
// promotion gate on research-first Epics (Epic #2678 / AC1, AC5).
//
// Decides whether a research-first Epic's Phase-0 is "green complete" and
// whether the Epic is therefore missing the Phase-1 children a green Phase-0
// mandates. No GitHub calls — the resolver/workflow layer supplies data, so
// this stays unit-testable (mirrors research-first-phase-gate.js).
//
// Green-complete predicate (per design #2679 Component A): the Epic carries
// type:epic + phase-gate:research-first AND every Phase-0 child is closed AND
// at least one Phase-0 child carries a CONSULTANT_CLOSEOUT AND the Epic has an
// EPIC_RESCOPE comment. "missingPhase1Children" is the blockable defect: green
// Phase-0 with zero phase-gate:phase-1 children (the #2661 silent-close gap).

const RESCOPE_RE = /(^|\n)\s*(?:\*\*|##\s+)?EPIC_RESCOPE\b/i;
const CLOSEOUT_RE = /(^|\n)\s*(?:\*\*|##\s+)?CONSULTANT_CLOSEOUT(?:_EPIC_CLOSEOUT)?\b/i;
const PATTERN_ID = 'phase0-complete-no-phase1';

function hasRescope(comments) {
  return (comments || []).some((c) => RESCOPE_RE.test((c && c.body) || ''));
}

function childHasCloseout(child) {
  return ((child && child.comments) || []).some((c) => CLOSEOUT_RE.test((c && c.body) || ''));
}

function isClosed(child) {
  const labels = (child && child.labels) || [];
  if ((String(child && child.state).toLowerCase()) === 'closed') return true;
  return labels.includes('status:done') || labels.includes('status:cancelled');
}

function classifyChildren(children) {
  const phase0 = [];
  const phase1 = [];
  for (const c of children || []) {
    const labels = (c && c.labels) || [];
    if (labels.includes('phase-gate:phase-1')) phase1.push(c);
    else if (labels.includes('phase-gate:research-first')) phase0.push(c);
    // children carrying neither phase-gate label are outside this taxonomy.
  }
  return { phase0, phase1 };
}

/**
 * @param {{labels?: string[], comments?: Array<{body?: string}>,
 *          children?: Array<{number, state, labels, comments}>}} input
 * @returns {{applicable: boolean, complete: boolean, missingPhase1Children: boolean,
 *            details: string, pattern_id: string, phase0Count: number, phase1Count: number}}
 */
function phase0GreenComplete(input) {
  const labels = (input && input.labels) || [];
  const applicable = labels.includes('type:epic') && labels.includes('phase-gate:research-first');
  if (!applicable) {
    return {
      applicable: false, complete: false, missingPhase1Children: false,
      details: 'not a research-first Epic', pattern_id: PATTERN_ID, phase0Count: 0, phase1Count: 0,
    };
  }
  const { phase0, phase1 } = classifyChildren(input.children);
  const allPhase0Closed = phase0.length > 0 && phase0.every(isClosed);
  const anyCloseout = phase0.some(childHasCloseout);
  const rescope = hasRescope(input.comments);
  const complete = allPhase0Closed && anyCloseout && rescope;
  const missingPhase1Children = complete && phase1.length === 0;
  const reasons = [];
  if (phase0.length === 0) reasons.push('no Phase-0 children found');
  if (phase0.length > 0 && !allPhase0Closed) reasons.push('not all Phase-0 children closed');
  if (!anyCloseout) reasons.push('no Phase-0 child carries CONSULTANT_CLOSEOUT');
  if (!rescope) reasons.push('Epic missing EPIC_RESCOPE comment');
  const details = complete
    ? (missingPhase1Children ? 'Phase-0 green; Phase-1 children ABSENT' : 'Phase-0 green; Phase-1 children present')
    : `Phase-0 not green: ${reasons.join('; ')}`;
  return {
    applicable: true, complete, missingPhase1Children, details,
    pattern_id: PATTERN_ID, phase0Count: phase0.length, phase1Count: phase1.length,
  };
}

/**
 * Build a v3-compatible incidents.jsonl record for the gap (AC5). Carries both
 * `ts` (v3) and `timestamp` (incidents-store loadIndex dedup key).
 */
function buildIncident(epicNumber, detail, triggerRole, nowIso) {
  const ts = nowIso || new Date().toISOString();
  return {
    version: 3, ts, timestamp: ts, service: 'phase0-promotion-gate', env: 'ci',
    event: 'phase0-complete-no-phase1', tier: 2, trigger_role: triggerRole || 'system',
    trigger_type: 'gate-detect', pattern_id: PATTERN_ID, severity: 'medium',
    epic_ref: epicNumber, evidence: detail || '',
    _summary: `Epic #${epicNumber}: Phase-0 green but no Phase-1 children`,
  };
}

module.exports = {
  phase0GreenComplete, classifyChildren, hasRescope, childHasCloseout,
  isClosed, buildIncident, PATTERN_ID,
};
