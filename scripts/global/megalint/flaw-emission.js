'use strict';
// flaw-emission — detects mid-flight flaw mentions lacking anneal artifact citations.

const MARKERS = [/\bI had to\b/i, /\bworked around\b/i, /\bside-?effect\b/i, /\bflaw\b/i, /\bbug\b/i, /\bfailure\b/i, /\bincident\b/i];
const CITE = /#\d+|incidents\.jsonl|pattern_id\s*:|anneal_tickets_filed\s*:|memory\//i;

function findArtifacts(comments) {
  const out = [];
  for (const c of comments || []) {
    const body = c.body || '';
    if (/(COLLABORATOR_HANDOFF|CONSULTANT_CLOSEOUT|ADMIN_HANDOFF)/.test(body)) out.push(body);
  }
  return out;
}

function detectMentions(text) {
  const lines = String(text || '').split('\n');
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    if (MARKERS.some(r => r.test(lines[i]))) hits.push({ line: i, text: lines[i].trim() });
  }
  return { lines, hits };
}

function citedNear(lines, line) {
  const start = Math.max(0, line - 2);
  const end = Math.min(lines.length - 1, line + 2);
  for (let i = start; i <= end; i++) if (CITE.test(lines[i])) return true;
  return false;
}

function validate(input) {
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

module.exports = { validate, detectMentions, citedNear, findArtifacts };
