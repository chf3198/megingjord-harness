'use strict';
// changelog-fragment-presence — pre-merge validator
// Fails any PR carrying lane:code-change unless a .changes/unreleased/<N>.md
// fragment exists OR the PR description carries [skip-changelog].
// Refs #2157.

const { resolveLinkedTicket } = require('../linkage-resolver');

const SKIP_MARKER = '[skip-changelog]';
const FRAGMENT_RE = /^\.changes\/unreleased\/(\d+)\.md$/;

// Deterministic linkage (Refs #1614 AC1): prefer the auto-close / deferred-final
// target, then the first line-anchored `Refs #N`; `Refs Epic #N` is excluded.
// Replaces a first-match `Refs` scan that picked the wrong issue when a non-ticket
// reference led the PR body.
function extractRefsTicket(prBody) {
  return resolveLinkedTicket(prBody).ticket;
}

function findFragment(prFiles, ticket) {
  if (!ticket || !Array.isArray(prFiles)) return null;
  for (const file of prFiles) {
    const path = typeof file === 'string' ? file : file.path || file.filename;
    if (!path) continue;
    const match = FRAGMENT_RE.exec(path);
    if (match && Number(match[1]) === ticket) return path;
  }
  return null;
}

function isCodeChangeLane(labels) {
  return (labels || []).some(label => {
    const name = typeof label === 'string' ? label : label.name;
    return name === 'lane:code-change';
  });
}

function hasSkipMarker(prBody) {
  return typeof prBody === 'string' && prBody.includes(SKIP_MARKER);
}

function validate(input) {
  if (!isCodeChangeLane(input.labels)) {
    return { ok: true, reason: 'not-lane-code-change' };
  }
  if (hasSkipMarker(input.prBody)) {
    return { ok: true, reason: 'skip-marker-present' };
  }
  const ticket = extractRefsTicket(input.prBody);
  if (!ticket) {
    return { ok: false, reason: 'no-refs-ticket-in-pr-body' };
  }
  const fragment = findFragment(input.prFiles, ticket);
  if (!fragment) {
    return {
      ok: false,
      reason: `missing-fragment: lane:code-change PR for #${ticket} requires .changes/unreleased/${ticket}.md or ${SKIP_MARKER}`,
    };
  }
  return { ok: true, reason: `fragment-present: ${fragment}` };
}

module.exports = { validate, extractRefsTicket, findFragment, isCodeChangeLane, hasSkipMarker, SKIP_MARKER };
