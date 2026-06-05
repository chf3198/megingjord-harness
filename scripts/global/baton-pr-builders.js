'use strict';
// Programmatic builders for the 3 NON-comment baton artifacts (Epic #2037 P1.2,
// Refs #2672): PR body, CHANGELOG fragment, commit trailers. Pure + deterministic
// (byte-identical for identical input). Reuses deriveSigner from #2671's
// baton-artifact-builder — no parallel signer logic. Encodes the recurring
// Refs-ordering / title-length / signer-invention / fragment-naming defects as
// data rather than prose the operator must remember.
const { deriveSigner } = require('./baton-artifact-builder');

const MAX_SUBJECT = 60; // pr-title.yml subjectPattern ^.{1,60}$ (subject after CC prefix)
const CC_PREFIX = /^[a-z]+(?:\([^)]+\))?!?:\s+/; // conventional-commit type(scope):
const CHANGELOG_SECTIONS = ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security'];
// Back-compat auto-close form (global-standards merge-evidence contract): Closes/Fixes/Resolves #N.
const CLOSE_FORM = /^(?:Closes|Fixes|Resolves) #\d+$/;

function ticketNum(ticket) {
  const n = String(ticket === null || ticket === undefined ? '' : ticket).replace(/^#/, '');
  if (!/^\d+$/.test(n)) throw new Error(`invalid ticket: ${JSON.stringify(ticket)}`);
  return n;
}

// Validate a PR title against pr-title.yml: CC prefix required, subject 1-60 chars.
function validatePrTitle(title) {
  const t = String(title || '').trim();
  if (!CC_PREFIX.test(t)) throw new Error(`PR title needs a Conventional-Commit prefix: "${t}"`);
  const subject = t.replace(CC_PREFIX, '');
  if (subject.length < 1 || subject.length > MAX_SUBJECT) {
    throw new Error(`PR title subject must be 1-${MAX_SUBJECT} chars (got ${subject.length}): "${subject}"`);
  }
  return t;
}

function buildCommitTrailers({ teamModel, role, ticket }) {
  const n = ticketNum(ticket);
  const signer = deriveSigner(teamModel, role); // derived — rejects hand-typed alias
  return [`Refs #${n}`, '', `AI-Signature: ${signer}`, `AI-Team-Model: ${teamModel}`, `AI-Role: ${role}`].join('\n');
}

function buildChangelogFragment({ ticket, section, entry }) {
  const n = ticketNum(ticket); // fragment is named per the ticket — .changes/unreleased/<N>.md
  if (!CHANGELOG_SECTIONS.includes(section)) {
    throw new Error(`section must be one of ${CHANGELOG_SECTIONS.join('/')}: got ${section}`);
  }
  const entries = (Array.isArray(entry) ? entry : [entry]).filter((e) => String(e || '').trim());
  if (!entries.length) throw new Error('changelog fragment needs at least one entry');
  const body = entries.map((e) => `- ${String(e).trim()}`).join('\n');
  return { path: `.changes/unreleased/${n}.md`, content: `### ${section}\n${body}\n` };
}

// Assemble a PR body: Refs-first (validator regex /Refs\s+#(\d+)/ must match first),
// merge-evidence line, then the 3 baton-artifact strings (baton-gates CI requires them).
function buildPrBody({
  ticket, title, lane, testStrategy, summary,
  artifacts = {}, siblings = [], mergeEvidence = 'deferred-final',
}) {
  const n = ticketNum(ticket);
  validatePrTitle(title);
  const lines = [`Refs #${n}`];
  if (mergeEvidence === 'deferred-final') lines.push(`merge-evidence-deferred-final: #${n}`);
  else if (mergeEvidence) { // back-compat auto-close form — reject anything that isn't a known gate form
    if (!CLOSE_FORM.test(mergeEvidence)) {
      throw new Error(`mergeEvidence must be 'deferred-final' or a Closes/Fixes/Resolves #N line: "${mergeEvidence}"`);
    }
    lines.push(mergeEvidence);
  }
  lines.push('', '## Summary', String(summary || '').trim(), '', `lane: ${lane}`, `test_strategy: ${testStrategy}`);
  if (siblings.length) lines.push(`siblings: ${siblings.map((s) => `#${ticketNum(s)}`).join(', ')}`);
  lines.push('');
  for (const key of ['collaborator', 'admin', 'consultant']) {
    if (artifacts[key]) lines.push(String(artifacts[key]).trim(), '');
  }
  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

module.exports = {
  buildPrBody, buildChangelogFragment, buildCommitTrailers, validatePrTitle,
  CHANGELOG_SECTIONS, MAX_SUBJECT,
};
