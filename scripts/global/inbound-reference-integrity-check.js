'use strict';
// inbound-reference-integrity-check (#3419, Epic #3398 C1) — issues.closed Action.
// Sibling to epic-close-readiness-check.js (outbound); scans INBOUND refs to the
// closing ticket in other live OPEN issues and routes dangling pointers into the
// baton: a Manager-triage correction task + a BLOCKER_NOTE + an incidents.jsonl
// event (pattern_id: inbound-reference-orphan). Deterministic $0; no model calls.
const lib = require('./inbound-reference-integrity');
const store = require('./incidents-store');

const MARKER = '<!-- inbound-reference-integrity -->';

async function listOpenIssues(github, owner, repo) {
  const q = 'query($owner:String!,$repo:String!,$after:String){repository(owner:$owner,name:$repo)'
    + '{issues(first:100,states:OPEN,after:$after){nodes{number title body} pageInfo{hasNextPage endCursor}}}}';
  let after = null; const nodes = [];
  for (;;) {
    const d = await github.graphql(q, { owner, repo, after });
    const b = d.repository.issues; nodes.push(...b.nodes);
    if (!b.pageInfo.hasNextPage) return nodes;
    after = b.pageInfo.endCursor;
  }
}

async function alreadyFiled(github, owner, repo, closing) {
  const q = `Re-home orphaned reference to #${closing} in:title repo:${owner}/${repo}`;
  const r = await github.rest.search.issuesAndPullRequests({ q }).catch(() => ({ data: { total_count: 0 } }));
  return (r.data.total_count || 0) > 0;
}

function orphanLines(orphans) {
  return orphans.map((o) => `- #${o.from} (${o.form}/${o.cls}): \`${o.line}\``).join('\n');
}

async function run({ github, context, core }, opts = {}) {
  const { owner, repo } = context.repo;
  const closing = (context.issue && context.issue.number) || context.payload.issue.number;
  const nowIso = opts.now || new Date().toISOString();
  const info = (m) => core && core.info && core.info(m);
  const items = (await listOpenIssues(github, owner, repo))
    .map((n) => ({ number: n.number, text: `${n.title || ''}\n${n.body || ''}` }));
  const orphans = lib.scanInbound(closing, items);
  if (!orphans.length) { info(`inbound-reference-integrity: #${closing} clean`); return { orphans: [] }; }
  if (await alreadyFiled(github, owner, repo, closing)) { info('correction task already filed'); return { orphans, filed: false }; }
  const task = lib.buildCorrectionTask(closing, orphans);
  const created = await github.rest.issues.create({ owner, repo, title: task.title, body: task.body, labels: task.labels });
  const note = `${MARKER}\n## BLOCKER_NOTE — inbound-reference-orphan\n#${closing} closed with dangling inbound pointer(s); `
    + `filed correction #${created.data.number}:\n${orphanLines(orphans)}`;
  await github.rest.issues.createComment({ owner, repo, issue_number: closing, body: note });
  (opts.appendIncident || store.append)(lib.buildIncident(closing, orphans, nowIso, opts.env || 'ci'));
  core && core.warning && core.warning(`inbound-reference-integrity: ${orphans.length} orphan(s), correction #${created.data.number}`);
  return { orphans, filed: true, correction: created.data.number };
}

module.exports = { run, listOpenIssues, alreadyFiled, orphanLines, MARKER };
