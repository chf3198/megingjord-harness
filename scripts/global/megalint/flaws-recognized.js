'use strict';
// flaws-recognized — the per-review-point flaw-capture validator.
// (Ticket #3428, Epic #3425 P1-a.) Generalizes the Consultant-only `mid_flight_flaws`
// check to ALL FOUR baton artifacts: every MANAGER/COLLABORATOR/ADMIN/CONSULTANT artifact
// present on an issue MUST carry a `flaws_recognized:` block — either bare `none` or one
// entry per disposed candidate with a `decision:` in the FLAW_DECISIONS enum and a
// decision-typed `artifact:`. SHIPS ADVISORY (every finding severity 'advisory') until the
// Epic replay-eval promotion gate flips it to blocking.
//
// Reuse-first (no new enum, no new parser): FLAW_DECISIONS comes from judgment-gate.js and
// the line-anchored field reader is consultant-closeout.js#flawFieldState.
// The none-vs-candidate rule (a bare `none` contradicted by surfaced candidates) is the
// separate reconciler child P1-f, not this foundation validator.

const path = require('path');
const { FLAW_DECISIONS } = require(path.join(__dirname, '..', 'judgment-gate.js'));
const { flawFieldState } = require('./consultant-closeout.js');

const ADVISORY = 'advisory'; // whole system ships advisory until the promotion gate (P1-g)

// The four review-point artifacts this contract covers, newest-comment-wins.
const ARTIFACTS = [
  { name: 'MANAGER_HANDOFF', re: /(^|\n)\s*(?:\*\*|##\s+)?MANAGER_HANDOFF\b/ },
  { name: 'COLLABORATOR_HANDOFF', re: /(^|\n)\s*(?:\*\*|##\s+)?COLLABORATOR_HANDOFF\b/ },
  { name: 'ADMIN_HANDOFF', re: /(^|\n)\s*(?:\*\*|##\s+)?ADMIN_HANDOFF\b/ },
  { name: 'CONSULTANT_CLOSEOUT', re: /(^|\n)\s*(?:\*\*|##\s+)?CONSULTANT_CLOSEOUT(?:_EPIC_CLOSEOUT)?\b/ },
];

function findArtifact(comments, artifactRe) {
  return [...(comments || [])].reverse().find((comment) => artifactRe.test(comment.body || ''));
}

// Extract the multi-line `flaws_recognized:` block: from its header line up to the next
// top-level `Key:` line, a `Signed-by:` line, or end-of-body.
function extractBlock(body) {
  const lines = String(body || '').split('\n');
  const start = lines.findIndex((lineText) => /^\s*flaws_recognized\s*:/i.test(lineText));
  if (start === -1) return null;
  const collected = [lines[start]];
  for (let cursor = start + 1; cursor < lines.length; cursor++) {
    const lineText = lines[cursor];
    if (/^\s*Signed-by\s*:/i.test(lineText)) break;
    // a new top-level field (non-indented `Key:`) ends the block; indented list entries continue it.
    if (/^[A-Za-z][\w&-]*\s*:/.test(lineText) && !/^\s/.test(lineText)) break;
    collected.push(lineText);
  }
  return collected.join('\n');
}

// True when the flaw's decision-typed `artifact:` value has the shape its decision requires.
function artifactShapeOk(decision, value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return false;
  if (decision === 'file-ticket') return /#\d{1,9}\b/.test(trimmed);
  if (decision === 'log-incident-only') return /incidents\.jsonl|pattern_id|[a-z0-9]+(?:-[a-z0-9]+){2,}/i.test(trimmed);
  if (decision === 'memory-note-only') return /memory\/|\.md\b|[\w-]+\/[\w./-]+/.test(trimmed);
  if (decision === 'no-action-justified') return trimmed.length >= 10; // non-empty rationale (anti-empty-justification)
  return false;
}

// Validate the per-candidate entries of a non-`none` block: decision-in-enum + artifact shape.
function checkEntries(name, block) {
  const findings = [];
  const decisions = [...block.matchAll(/^\s*decision\s*:\s*([\w-]+)/gim)].map((entry) => entry[1]);
  const artifacts = [...block.matchAll(/^\s*artifact\s*:\s*(.+)$/gim)].map((entry) => entry[1]);
  if (decisions.length === 0) {
    findings.push({ rule: 'flaws-recognized-no-entries',
      detail: `${name} flaws_recognized is non-empty and not 'none' but lists no decision: entries.` });
  }
  decisions.forEach((decision, index) => {
    if (!FLAW_DECISIONS.includes(decision)) {
      findings.push({ rule: 'flaws-recognized-bad-decision',
        detail: `${name} flaws_recognized decision '${decision}' not in enum: ${FLAW_DECISIONS.join(', ')}.` });
    } else if (!artifactShapeOk(decision, artifacts[index])) {
      findings.push({ rule: 'flaws-recognized-artifact-shape',
        detail: `${name} flaws_recognized decision '${decision}' needs a matching artifact: (#N | pattern_id | memory-path | rationale).` });
    }
  });
  return findings;
}

// Validate one artifact's flaws_recognized block. Returns raw findings (severity set by caller).
// candidates (optional): the checkpoint-surfaced feed for this artifact's review-point, enabling the
// P1-f none-vs-candidate reconciler. opts.incidentsPath feeds the recurrence-escalation read.
function checkArtifact(name, body, candidates, opts = {}) {
  const state = flawFieldState(body, 'flaws_recognized');
  if (state === 'missing') {
    return [{ rule: 'flaws-recognized-missing',
      detail: `${name} has no flaws_recognized: block (declare 'none' or one entry per disposed candidate).` }];
  }
  if (state === 'empty') {
    return [{ rule: 'flaws-recognized-empty', detail: `${name} flaws_recognized: has no value.` }];
  }
  const block = extractBlock(body) || '';
  // A bare `none` is a valid disposition by itself; the none-vs-candidate rule (P1-f #3433) checks it
  // against the surfaced candidate feed when one is supplied (candidates), else stays lenient (back-compat).
  if (/flaws_recognized\s*:\s*none\b/i.test(block)) {
    if (Array.isArray(candidates) && candidates.length) {
      const { validateArtifact } = require('../none-vs-candidate-reconciler');
      return validateArtifact(name, body, candidates, opts);
    }
    return [];
  }
  return checkEntries(name, block);
}

// Map an artifact name to the review-point surface its candidate feed is keyed under.
const SURFACE_FOR = {
  MANAGER_HANDOFF: 'review-point:manager', COLLABORATOR_HANDOFF: 'review-point:collaborator',
  ADMIN_HANDOFF: 'review-point:admin', CONSULTANT_CLOSEOUT: 'review-point:consultant',
};

function validate(input) {
  const comments = (input && input.comments) || [];
  const bySurface = (input && input.candidatesBySurface) || {};
  const violations = [];
  for (const spec of ARTIFACTS) {
    const found = findArtifact(comments, spec.re);
    if (!found) continue; // only check artifacts actually present on the issue
    const candidates = bySurface[SURFACE_FOR[spec.name]] || null;
    for (const finding of checkArtifact(spec.name, found.body || '', candidates,
      { incidentsPath: input && input.incidentsPath })) {
      violations.push({ ...finding, severity: ADVISORY });
    }
  }
  // ok ignores advisory findings, so this validator never blocks in its advisory ship.
  return { ok: violations.filter((finding) => finding.severity !== ADVISORY).length === 0, violations };
}

module.exports = { validate, checkArtifact, checkEntries, extractBlock, artifactShapeOk, ARTIFACTS };
