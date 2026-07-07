'use strict';
// flaw-emission — detects mid-flight flaw mentions lacking anneal artifact citations.
//
// Softened per Epic #2070 / #3649. Two changes preserve true-positive recall while
// removing the false positives on ordinary engineering prose:
//   (a) WEAK noun markers (flaw|bug|failure|incident) are skipped when they form a benign
//       engineering compound ("failure mode", "bug-fix", "failure patterns"), a structured
//       field key ("flaw=", "flaw:"), or the "incidents.jsonl" citation token. STRONG
//       first-person confession markers ("I had to", "worked around", "side-effect") are
//       always counted — they are the high-precision signal the gate exists to catch.
//   (b) CITE recognizes the Epic #3425 structured-block forms (decision:/artifact:/
//       flaws_recognized:) so self-citing flaws_recognized:/mid_flight_flaws: blocks pass.

// STRONG markers — first-person flaw confession; high precision; always counted.
const STRONG_MARKERS = [/\bI had to\b/i, /\bworked around\b/i, /\bside-?effect\b/i];

// WEAK markers — common in feature-descriptive prose; counted only when NOT a benign idiom.
const WEAK_MARKERS = [/\bflaw\b/i, /\bbug\b/i, /\bfailure\b/i, /\bincident\b/i];

// A WEAK marker forming ordinary engineering vocabulary (not a flaw confession). If, after
// removing every benign-idiom occurrence from a line, no WEAK marker remains, the line is
// feature-descriptive prose and is not flagged.
const BENIGN_IDIOM = new RegExp(
  '\\b(?:flaws?|bugs?|failures?|incidents?)' +
  '(?:' +
    '[-\\s](?:mode|modes|fix|fixes|path|paths|pattern|patterns|class|classes|report|reports|' +
      'threshold|thresholds|budget|rate|count|handling|detection|detector|tracker|marker|markers|' +
      'word|words|emission|queue|free)\\b' +   // marker followed by a benign engineering noun
    '|\\s*[:=]' +                              // structured field key: flaw= / flaw:
    '|s?\\.jsonl\\b' +                         // incidents.jsonl citation token
  ')',
  'ig',
);

const CITE = /#\d+|incidents?\.jsonl|pattern_id\s*[:=]|anneal_tickets_filed\s*:|memory\/|decision\s*[:=]|artifact\s*[:=]|flaws_recognized\s*:/i;
const OVERRIDE_LABEL = 'flaw-emission-override:approved';

function findArtifacts(comments) {
  const out = [];
  for (const comment of comments || []) {
    const body = comment.body || '';
    if (/(COLLABORATOR_HANDOFF|CONSULTANT_CLOSEOUT|ADMIN_HANDOFF)/.test(body)) out.push(body);
  }
  return out;
}

// A WEAK marker survives only if it still matches after benign idioms are stripped.
function hasWeakMarker(line) {
  const residual = String(line).replace(BENIGN_IDIOM, ' ');
  return WEAK_MARKERS.some((marker) => marker.test(residual));
}

function isFlawLine(line) {
  if (STRONG_MARKERS.some((marker) => marker.test(line))) return true;
  return hasWeakMarker(line);
}

function detectMentions(text) {
  const lines = String(text || '').split('\n');
  const hits = [];
  for (let index = 0; index < lines.length; index++) {
    if (isFlawLine(lines[index])) hits.push({ line: index, text: lines[index].trim() });
  }
  return { lines, hits };
}

function citedNear(lines, line) {
  const start = Math.max(0, line - 2);
  const end = Math.min(lines.length - 1, line + 2);
  for (let index = start; index <= end; index++) if (CITE.test(lines[index])) return true;
  return false;
}

function shouldSkip(labels) {
  if ((labels || []).includes(OVERRIDE_LABEL)) return 'override-approved';
  return null;
}

function validate(input) {
  const skipReason = shouldSkip(input.labels || []);
  if (skipReason) return { ok: true, violations: [], mentions: 0, skipped: skipReason };
  const artifacts = findArtifacts(input.comments || []);
  const violations = [];
  let mentions = 0;
  for (const body of artifacts) {
    const { lines, hits } = detectMentions(body);
    mentions += hits.length;
    for (const hit of hits) {
      if (!citedNear(lines, hit.line)) {
        violations.push({
          rule: 'flaw-mention-missing-anneal-artifact',
          detail: `Flaw mention lacks ticket/incident/memory citation near: "${hit.text}"`,
        });
      }
    }
  }
  return { ok: violations.length === 0, violations, mentions, skipped: mentions === 0 ? 'no-flaw-mentions' : undefined };
}

module.exports = {
  validate, detectMentions, citedNear, findArtifacts, shouldSkip, isFlawLine, hasWeakMarker,
  OVERRIDE_LABEL, STRONG_MARKERS, WEAK_MARKERS, BENIGN_IDIOM, CITE,
};
