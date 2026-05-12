'use strict';
// epic-ac-traceability — verifies Epic body contains child-ticket references.
// Epic #1407 AC6; Phase Gate enforcement added in #1454.

const MIN_ACS_FOR_REFS = 3;
const RUBRIC_THRESHOLD = 7;

function countAcs(body) {
  return ((body || '').match(/^[\s-]*\[[\sx]\]\s+AC[\d:\s-]/gim) || []).length;
}

function countAcRs(body) {
  // AC-R<n> = research-AC marker for research-first Epics (per #1397 Phase Gate Rule).
  return ((body || '').match(/^[\s-]*\[[\sx]\]\s*\*?\*?\s*AC-R\d/gim) || []).length;
}

function isResearchFirstEpic(body) {
  if (!body) return false;
  if (/^[\s-]*\[[\sx]\]\s*\*?\*?\s*AC-R\d/im.test(body)) return true;
  return /research-first\s+Epic|Phase\s*0\b|Phase\s+Gate\s+Rule/i.test(body);
}

function findChildRefs(body) {
  const matches = (body || '').match(/#(\d+)/g) || [];
  return [...new Set(matches.map(m => parseInt(m.slice(1), 10)))];
}

function checkRefPresence(acCount, refs) {
  if (acCount >= MIN_ACS_FOR_REFS && refs.length === 0) {
    return [{
      rule: 'epic-body-missing-child-refs',
      detail: `Epic with ${acCount} ACs has zero child-ticket #N references in body. `
        + 'Add a "Child tickets" section listing #N references per AC, or document explicit deferral.',
      ac_count: acCount,
    }];
  }
  return [];
}

function checkKnownChildren(refs, linkedChildren) {
  if (linkedChildren.length === 0) return [];
  const mentioned = linkedChildren.filter(n => refs.includes(n));
  if (mentioned.length === 0) {
    return [{
      rule: 'epic-body-missing-known-children',
      detail: `Epic has ${linkedChildren.length} child(ren) [${linkedChildren.join(', ')}] but body references none`,
    }];
  }
  return [];
}

function checkPhaseGateCompliance(body, linkedChildren, isClosingAttempt) {
  // #1454: research-first Epics must satisfy Phase Gate at close-time.
  // Detection: AC-R<n> markers in body OR explicit Phase-Gate language.
  if (!isResearchFirstEpic(body)) return [];
  if (!isClosingAttempt) return [];
  const acR = countAcRs(body);
  if (acR === 0) return []; // declares research-first but no R-ACs to enforce
  const list = linkedChildren || [];
  if (list.length === 0) {
    return [{
      rule: 'phase-gate-children-incomplete',
      detail: `Research-first Epic declares ${acR} AC-R marker(s) but has zero linked children. `
        + `Per #1397 Phase Gate Rule, AC-R1..R${acR} must close with Consultant rubric ≥${RUBRIC_THRESHOLD} `
        + 'before this Epic can close.',
      ac_r_count: acR,
    }];
  }
  return [];
}

function validate(input) {
  const isEpic = (input.labels || []).includes('type:epic');
  if (!isEpic) return { ok: true, violations: [], reason: 'not-an-epic' };

  const body = input.body || '';
  const issueNumber = input.issueNumber || null;
  const acCount = countAcs(body);
  const refs = findChildRefs(body).filter(n => n !== issueNumber);
  const violations = [
    ...checkRefPresence(acCount, refs),
    ...checkKnownChildren(refs, input.linkedChildren || []),
    ...checkPhaseGateCompliance(body, input.linkedChildren || [], input.isClosingAttempt === true),
  ];
  return { ok: violations.length === 0, violations, ac_count: acCount, refs };
}

module.exports = { validate, countAcs, countAcRs, isResearchFirstEpic, findChildRefs, checkPhaseGateCompliance };
