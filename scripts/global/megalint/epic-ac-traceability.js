'use strict';
// epic-ac-traceability — verifies Epic body contains child-ticket references.
// Epic #1407 AC6.

const MIN_ACS_FOR_REFS = 3;

function countAcs(body) {
  return ((body || '').match(/^[\s-]*\[[\sx]\]\s+AC[\d:\s-]/gim) || []).length;
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
  ];
  return { ok: violations.length === 0, violations, ac_count: acCount, refs };
}

module.exports = { validate, countAcs, findChildRefs };
