'use strict';
// sub-issue-preference (#1658) — closeout-schema helper preferring Sub-issue
// link evidence over prose `Refs #N` scanning. Pure function; no network.

const SUB_ISSUE_MARKER_RE = /<!--\s*sub-issue-linked:\s*parent=(\d+)\s*-->/i;
const PROSE_REFS_RE = /\bRefs(?:\s+Epic)?\s+#(\d+)\b/i;

function detectParentByMarker(body) {
  const match = (body || '').match(SUB_ISSUE_MARKER_RE);
  return match ? parseInt(match[1], 10) : null;
}

function detectParentByProse(body) {
  const match = (body || '').match(PROSE_REFS_RE);
  return match ? parseInt(match[1], 10) : null;
}

function detectParent(body) {
  const markerParent = detectParentByMarker(body);
  if (markerParent !== null) return { parent: markerParent, source: 'sub-issue-marker' };
  const proseParent = detectParentByProse(body);
  if (proseParent !== null) return { parent: proseParent, source: 'prose-refs' };
  return { parent: null, source: 'none' };
}

module.exports = { detectParent, detectParentByMarker, detectParentByProse, SUB_ISSUE_MARKER_RE };
