'use strict';

function issueRefs(text) {
  const nums = []; const r = /#(\d+)\b/g;
  for (let m = r.exec(text || ''); m; m = r.exec(text || '')) nums.push(Number(m[1]));
  return nums;
}

async function listOpenIssues(github, owner, repo) {
  let after = null; let parentSupported = true; const nodes = [];
  const vars = () => ({ owner, repo, after });
  const q = withParent => `query($owner:String!,$repo:String!,$after:String){repository(owner:$owner,name:$repo){issues(first:100,states:OPEN,after:$after){nodes{number title body labels(first:20){nodes{name}}${withParent ? ' parentIssue{number}' : ''}} pageInfo{hasNextPage endCursor}}}}`;
  while (true) {
    let data;
    try { data = await github.graphql(q(parentSupported), vars()); }
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

function directMatch(issue, epicNum, owner, repo) {
  const txt = `${issue.title || ''}\n${issue.body || ''}`;
  const rgx = [
    new RegExp(`[Cc]loses\\s+#${epicNum}\\b`),
    new RegExp(`[Rr]efs\\s+#${epicNum}\\b`),
    new RegExp(`[Pp]arent:\\s*#${epicNum}\\b`),
    new RegExp(`[Pp]arent:\\s*https://github.com/${owner}/${repo}/issues/${epicNum}\\b`),
    new RegExp(`[Ee]pic\\s+#${epicNum}\\b`),
  ];
  const byText = rgx.some(r => r.test(txt));
  const byLabel = (issue.labels?.nodes || []).some(l => l.name.toLowerCase() === `epic-${epicNum}`);
  const byParent = issue.parentIssue?.number === epicNum;
  return { byText, byLabel, byParent, matched: byText || byLabel || byParent };
}

async function run({ github, context, core }) {
  const epicNum = context.issue.number; const { owner, repo } = context.repo;
  try {
    const { nodes, parentSupported } = await listOpenIssues(github, owner, repo);
    const issues = nodes.filter(i => i.number !== epicNum);
    const reasons = new Map(); const direct = new Set();
    for (const i of issues) {
      const hit = directMatch(i, epicNum, owner, repo); if (!hit.matched) continue;
      const why = [];
      if (hit.byText) why.push('text');
      if (hit.byLabel) why.push('label');
      if (hit.byParent && parentSupported) why.push('parentIssue');
      reasons.set(i.number, why.join('+')); direct.add(i.number);
    }
    for (const i of issues) {
      if (direct.has(i.number)) continue;
      const ref = issueRefs(`${i.title || ''}\n${i.body || ''}`).find(n => direct.has(n));
      if (!ref) continue;
      direct.add(i.number); reasons.set(i.number, `indirect-via-#${ref}`);
    }
    const openChildren = issues.filter(i => direct.has(i.number));
    if (!openChildren.length) return;
    const lines = openChildren.map(i => `- #${i.number}: ${i.title} _(match: ${reasons.get(i.number)})_`).join('\n');
    const body = `## Epic Close-Readiness Violation\n\nOpen child issues detected for epic #${epicNum}:\n\n${lines}\n\nParent field support: ${parentSupported ? 'enabled' : 'not available in this API context'}\n\n_Auto-reopened by Epic Close-Readiness Gate._`;
    await github.rest.issues.createComment({ owner, repo, issue_number: epicNum, body });
    await github.rest.issues.update({ owner, repo, issue_number: epicNum, state: 'open' });
    core.setFailed(`Epic #${epicNum} re-opened: ${openChildren.length} open child(ren).`);
  } catch (error) {
    const msg = String(error.message || error).slice(0, 1500);
    await github.rest.issues.createComment({
      owner, repo, issue_number: epicNum,
      body: `## Epic Close-Readiness Diagnostic Failure\n\nValidation failed due to API/runtime error:\n\n\`${msg}\`\n\nPlease re-run workflow after resolving token/permission/rate-limit issues.`
    }).catch(() => {});
    core.setFailed(`Close-readiness diagnostic failed: ${msg}`);
  }
}

module.exports = { run };
