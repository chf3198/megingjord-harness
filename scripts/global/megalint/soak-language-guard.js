'use strict';
// soak-language-guard (#1809) — detects calendar-bound "soak" phrasing in
// governed artifacts and redirects to Epic #1771 replay-based eval gates.

const fs = require('node:fs');
const path = require('node:path');

const SOAK_PATTERNS = [
  /\b\d+\s*-?\s*day\s+soak\b/i,
  /\bmulti-?day\s+soak\b/i,
  /\bcalendar\s+soak\b/i,
  /\b\d+\s*-?\s*day\s+window\b/i,
  /\bmulti-?day\s+window\b/i,
  /\b\d+\s+days?\s+to\s+(validate|measure|promote|sample|observe|soak)\b/i,
  /\bsoak\s+(period|phase|window)\b/i,
];
const OVERRIDE_RE = /<!--\s*soak-language-override:\s*[^>]+-->/i;
const OVERRIDE_LABEL = 'soak-language-override:approved';
const TRANSLATION_REF = 'docs/howto/soak-to-replay-translation.md';

function shouldSkip(labels) {
  if ((labels || []).includes(OVERRIDE_LABEL)) return 'override-approved';
  return null;
}

function detectMentions(text) {
  const lines = String(text || '').split('\n');
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    if (OVERRIDE_RE.test(lines[i])) continue;
    for (const re of SOAK_PATTERNS) {
      const m = lines[i].match(re);
      if (m) { hits.push({ line: i + 1, text: lines[i].trim(), match: m[0] }); break; }
    }
  }
  return hits;
}

function findArtifacts(comments) {
  const tags = /(MANAGER_HANDOFF|COLLABORATOR_HANDOFF|ADMIN_HANDOFF|CONSULTANT_CLOSEOUT|EPIC_CLOSEOUT)/;
  return (comments || []).map(c => c.body || '').filter(b => tags.test(b));
}

function validate(input) {
  const skipReason = shouldSkip(input.labels || []);
  if (skipReason) return { ok: true, violations: [], skipped: skipReason };
  const violations = [];
  for (const body of findArtifacts(input.comments || [])) {
    for (const hit of detectMentions(body)) {
      violations.push({
        rule: 'soak-language-detected',
        detail: `Soak phrasing "${hit.match}" near line ${hit.line}. Use replay-based eval per #1771 (${TRANSLATION_REF}). Override with HTML comment <!-- soak-language-override: <rationale> --> on the same line.`,
      });
    }
  }
  if (input.prBody) {
    for (const hit of detectMentions(input.prBody)) {
      violations.push({ rule: 'soak-language-in-pr-body', detail: `Soak phrasing "${hit.match}" in PR body line ${hit.line}.` });
    }
  }
  return { ok: violations.length === 0, violations };
}

function scanFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  return detectMentions(text).map(h => ({ ...h, file: filePath }));
}

function scanPaths(paths) {
  const all = [];
  for (const p of paths) {
    try {
      if (!fs.existsSync(p)) continue;
      const stat = fs.statSync(p);
      if (stat.isFile()) all.push(...scanFile(p));
    } catch { /* ignore */ }
  }
  return all;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const annotate = args.includes('--annotate');
  const json = args.includes('--json');
  const files = args.filter(a => !a.startsWith('--'));
  const hits = scanPaths(files);
  if (json) { process.stdout.write(JSON.stringify({ ok: hits.length === 0, hits }, null, 2) + '\n'); }
  else if (!hits.length) { process.stdout.write('✓ no soak-language hits\n'); }
  else {
    for (const h of hits) process.stderr.write(`${annotate ? '⚠' : '✗'} ${h.file}:${h.line} "${h.match}" — translate per ${TRANSLATION_REF}\n`);
  }
  process.exit(hits.length === 0 || annotate ? 0 : 1);
}

module.exports = { validate, detectMentions, scanFile, scanPaths, SOAK_PATTERNS, OVERRIDE_RE, OVERRIDE_LABEL, TRANSLATION_REF };
