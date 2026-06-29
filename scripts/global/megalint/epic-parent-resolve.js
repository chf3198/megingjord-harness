'use strict';

// Resolve which Epic an epic-traceability re-validation should target when an
// issue event fires. The native GitHub Sub-issue parent is the canonical
// linkage; the prose forms `Refs Epic #N` | `Epic: #N` | `Parent: #N` are the
// deprecated-but-supported fallback. Pure module (no IO) so the workflow that
// consumes it stays the only place that touches the GitHub API.
//
// Refs #1432 (follow-on to closed Epic #1407). The original AC named only the
// prose `Epic:`/`Parent:` forms; this resolver adds native-parent precedence
// and the repo's actual `Refs Epic #N` convention (drift remediation 2026-06-28).

const PROSE_PARENT_PATTERNS = [
  /Refs\s+Epic\s+#(\d+)/i,
  /Epic:\s*#(\d+)/i,
  /Parent:\s*#(\d+)/i,
];

/** First parent issue number named in the body prose, or null. */
function parseParentFromProse(body) {
  const text = String(body || '');
  for (const pattern of PROSE_PARENT_PATTERNS) {
    const match = pattern.exec(text);
    if (match) return Number(match[1]);
  }
  return null;
}

/** Resolve a child's parent Epic number: native Sub-issue parent first, prose
 *  fallback second. Returns null when neither resolves. */
function resolveParentNumber({ nativeParent = null, body = '' } = {}) {
  if (Number.isInteger(nativeParent) && nativeParent >= 1) return nativeParent;
  return parseParentFromProse(body);
}

/** Decide which issue a close/edit event should run epic-traceability on:
 *   - the issue is itself an Epic   -> { target: issueNumber, kind: 'self' }
 *   - a non-Epic with a parent Epic -> { target: parentNumber, kind: 'parent' }
 *   - neither                        -> { target: null,        kind: 'none' }
 *  `nativeParent` is the value the caller fetched from the Sub-issues API. */
function resolveTraceabilityTarget({
  issueNumber = null, labels = [], nativeParent = null, body = '',
} = {}) {
  if ((labels || []).includes('type:epic')) {
    return { target: issueNumber, kind: 'self' };
  }
  const parent = resolveParentNumber({ nativeParent, body });
  return parent ? { target: parent, kind: 'parent' } : { target: null, kind: 'none' };
}

module.exports = {
  PROSE_PARENT_PATTERNS,
  parseParentFromProse,
  resolveParentNumber,
  resolveTraceabilityTarget,
};
