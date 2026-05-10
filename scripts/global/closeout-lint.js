'use strict';
// Refs #1287 — EPIC_RESCOPE artifact validation on Epic close.
// Refs #1288 — Consultant-only Epic close authority + cross-team signer rule.

const { parseRescopeBlocks, parseEpicAcs } = require('./closeout-rescope-parser');
const { validateConsultantClose } = require('./closeout-consultant-rule');

async function run({ github, context, core }) {
  const body = context.payload.pull_request?.body || '';
  const refsMatch = body.match(/Refs\s+#(\d+)/i);
  if (!refsMatch) return;
  const linkedIssue = parseInt(refsMatch[1], 10);

  const { owner, repo } = context.repo;
  const issueResp = await github.rest.issues.get({ owner, repo, issue_number: linkedIssue });
  const issue = issueResp.data;
  const isEpic = (issue.labels || []).some(l => (l.name || l) === 'type:epic');

  const { data: comments } = await github.rest.issues.listComments({
    owner, repo, issue_number: linkedIssue, per_page: 100,
  });
  const closeout = comments.find(c => /CONSULTANT_(EPIC_)?CLOSEOUT/.test(c.body));
  if (!closeout) return;

  const violations = [];

  if (!closeout.body.includes('Signed-by:')) violations.push('Missing Signed-by field');
  if (!closeout.body.includes('Team&Model:')) violations.push('Missing Team&Model field');
  if (!closeout.body.includes('Role: consultant')) violations.push('Missing Role: consultant');

  const collab = comments.find(c => c.body.includes('COLLABORATOR_HANDOFF'));
  if (collab) {
    const collabTeam = (collab.body.match(/Team&Model:\s*(\S+)/) || [])[1];
    const closeoutTeam = (closeout.body.match(/Team&Model:\s*(\S+)/) || [])[1];
    if (collabTeam && closeoutTeam && collabTeam === closeoutTeam) {
      violations.push(`CONSULTANT_CLOSEOUT Team&Model (${closeoutTeam}) matches COLLABORATOR_HANDOFF — independent review requires a different team`);
    }
  }

  if (isEpic) {
    const consultantViolations = validateConsultantClose({ closeout, comments });
    violations.push(...consultantViolations);

    const acs = parseEpicAcs(issue.body || '');
    const rescopes = parseRescopeBlocks(comments.map(c => c.body).join('\n\n'));
    const deferred = new Set(rescopes.flatMap(r => r.deferred_acs));
    const unmet = acs.filter(a => !a.checked && !deferred.has(a.id));
    if (unmet.length) {
      violations.push(`Epic close blocked: ${unmet.length} unmet AC(s) without EPIC_RESCOPE: ${unmet.map(a => a.id).join(', ')}`);
    }
    for (const r of rescopes) {
      if (r.errors && r.errors.length) {
        violations.push(`EPIC_RESCOPE schema errors: ${r.errors.join('; ')}`);
      }
    }
  }

  if (violations.length) {
    const msg = `CONSULTANT_CLOSEOUT schema issues on issue #${linkedIssue}:\n` +
      violations.map(v => `  - ${v}`).join('\n');
    if (isEpic) {
      core.setFailed(msg);
    } else {
      core.warning(msg);
    }
  }
}

module.exports = { run };
