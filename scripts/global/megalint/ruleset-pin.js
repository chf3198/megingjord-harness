'use strict';
// ruleset-pin (Epic #3576 W-G, #3581) — ADVISORY. Flags a lane:code-change MANAGER_HANDOFF
// that does not pin ruleset_version (profile-freeze adoption). Never blocks (promotion-gated).
const ADVISORY = 'advisory';
function findArtifact(comments, re) {
  return [...(comments || [])].reverse().find((c) => re.test((c && c.body) || ''));
}
function validate(input = {}) {
  const labels = input.labels || [];
  const comments = input.comments || [];
  const violations = [];
  if (!labels.includes('lane:code-change')) return { ok: true, violations };
  const mgr = findArtifact(comments, /##\s*MANAGER_HANDOFF/i);
  if (mgr && !/ruleset_version\s*:/i.test(mgr.body || '')) {
    violations.push({ rule: 'ruleset-version-unpinned', severity: ADVISORY,
      detail: 'MANAGER_HANDOFF does not pin ruleset_version (Epic #3576 W-G profile freeze) — advisory' });
  }
  return { ok: violations.length === 0, violations };
}
module.exports = { validate, check: validate };
