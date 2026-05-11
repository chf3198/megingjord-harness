'use strict';
// Epic Close-Readiness Gate logic (#452 / #750 / #1306).
const ERROR_MSG_MAX = 1500;
// Matcher uses task-list edges + explicit Parent: refs + GitHub native parentIssue.
// Replaces #1306-flagged prose/`Refs`/`Epic #N` matching that produced false positives.

function parseTaskListChildren(epicBody) {
  const refs = new Set();
  const lines = (epicBody || '').split('\n');
  for (const line of lines) {
    const m = line.match(/^\s*-\s*\[[ xX]\]\s+.*?#(\d+)\b/);
    if (m) refs.add(Number(m[1]));
  }
  return refs;
}

function parseParentRef(issue, epicNum, owner, repo) {
  const txt = `${issue.title || ''}\n${issue.body || ''}`;
  if (new RegExp(`\\bParent:\\s*#${epicNum}\\b`).test(txt)) return 'parent-text';
  const urlRe = new RegExp(`\\bParent:\\s*https://github\\.com/${owner}/${repo}/issues/${epicNum}\\b`);
  if (urlRe.test(txt)) return 'parent-url';
  return null;
}

async function listOpenIssues(github, owner, repo) {
  let after = null; let parentSupported = true; const nodes = [];
  const query = (wp) => `query($owner:String!,$repo:String!,$after:String){repository(owner:$owner,name:$repo){issues(first:100,states:OPEN,after:$after){nodes{number title body labels(first:20){nodes{name}}${wp ? ' parentIssue{number}' : ''}} pageInfo{hasNextPage endCursor}}}}`;
  for (;;) {
    let data;
    try { data = await github.graphql(query(parentSupported), { owner, repo, after }); }
    catch (e) {
      if (parentSupported && /parentIssue/i.test(String(e.message))) { parentSupported = false; continue; }
      throw e;
    }
    const block = data.repository.issues;
    nodes.push(...block.nodes);
    if (!block.pageInfo.hasNextPage) return { nodes, parentSupported };
    after = block.pageInfo.endCursor;
  }
}

async function restoreEpicLabels(github, owner, repo, epicNum, epic) {
  const labels = epic.labels.map(label => label.name);
  const toRemove = [];
  if (labels.includes('status:done')) toRemove.push('status:done');
  for (const resolutionLabel of ['resolution:released', 'resolution:completed']) {
    if (labels.includes(resolutionLabel)) toRemove.push(resolutionLabel);
  }
  for (const labelToRemove of toRemove) {
    await github.rest.issues.removeLabel({ owner, repo, issue_number: epicNum, name: labelToRemove }).catch(() => {});
  }
  if (labels.includes('status:done')) {
    await github.rest.issues.addLabels({ owner, repo, issue_number: epicNum, labels: ['status:review'] }).catch(() => {});
  }
}

async function run({ github, context, core }) {
  const dryRun = process.env.DRY_RUN === 'true';
  const epicNum = (dryRun && context.payload.inputs?.epic_number)
    ? Number(context.payload.inputs.epic_number)
    : context.issue?.number;
  if (!epicNum) { core.setFailed('No epic number provided.'); return; }
  const { owner, repo } = context.repo;
  try {
    const { data: epic } = await github.rest.issues.get({ owner, repo, issue_number: epicNum });
    const taskList = parseTaskListChildren(epic.body);
    const { nodes, parentSupported } = await listOpenIssues(github, owner, repo);
    const open = [];
    for (const i of nodes) {
      if (i.number === epicNum) continue;
      const inTL = taskList.has(i.number);
      const isParent = parentSupported && i.parentIssue?.number === epicNum;
      const pText = parseParentRef(i, epicNum, owner, repo);
      if (inTL || isParent || pText) {
        open.push({ number: i.number, title: i.title, why: inTL ? 'task-list' : (isParent ? 'parentIssue' : pText) });
      }
    }
    if (!open.length) {
      if (dryRun) console.log(`Epic #${epicNum}: zero open children. Close is valid.`);
      return;
    }
    const lines = open.map(c => `- #${c.number}: ${c.title} _(match: ${c.why})_`).join('\n');
    const body = `## Epic Close-Readiness Violation\n\nOpen child issues detected for epic #${epicNum}:\n\n${lines}\n\nParent field support: ${parentSupported ? 'enabled' : 'not available in this API context'}\n\n_Auto-reopened by Epic Close-Readiness Gate (task-list-only matcher, ${open.length} child${open.length === 1 ? '' : 'ren'})._\n\n**Status restoration**: \`status:done\` and \`resolution:*\` labels removed; \`status:review\` re-applied.`;
    if (dryRun) {
      console.log(`DRY RUN — would reopen #${epicNum} with ${open.length} children:\n${body}`);
      return;
    }
    await github.rest.issues.createComment({ owner, repo, issue_number: epicNum, body });
    await github.rest.issues.update({ owner, repo, issue_number: epicNum, state: 'open' });
    await restoreEpicLabels(github, owner, repo, epicNum, epic);
    core.setFailed(`Epic #${epicNum} re-opened: ${open.length} open child(ren).`);
  } catch (error) {
    const msg = String(error.message || error).slice(0, ERROR_MSG_MAX);
    await github.rest.issues.createComment({
      owner, repo, issue_number: epicNum,
      body: `## Epic Close-Readiness Diagnostic Failure\n\nValidation failed: \`${msg}\``
    }).catch(() => {});
    core.setFailed(`Close-readiness diagnostic failed: ${msg}`);
  }
}

module.exports = { run, parseTaskListChildren, parseParentRef, restoreEpicLabels };
