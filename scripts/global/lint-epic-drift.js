'use strict';
const cp = require('child_process');

const QUERY = `query($owner:String!,$repo:String!){
  repository(owner:$owner,name:$repo){
    issues(labels:["type:epic"],states:OPEN,first:100){
      nodes{
        number title labels(first:10){nodes{name}}
        subIssues(first:100){nodes{number state body}}
        comments(first:100){nodes{body}}
      }
    }
  }
}`;

function gh(args) {
  return cp.execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }).trim();
}

function childProgressComplete(child, comments) {  // EPIC_CLOSEOUT-aware
  const ref = `#${child.number}`;
  return comments.some(c =>
    (c.includes('## Epic Progress Update') && c.includes(ref)) ||
    (c.includes('## CONSULTANT_CLOSEOUT') && c.includes(ref)) ||
    (c.includes('## CONSULTANT_EPIC_CLOSEOUT') && c.includes(ref)));
}

function lintEpicDrift(owner, repo) {
  const payload = JSON.parse(gh(['api', 'graphql', '-f', `query=${QUERY}`, '-F', `owner=${owner}`, '-F', `repo=${repo}`]));
  const epics = payload?.data?.repository?.issues?.nodes || [];
  const findings = [];

  for (const epic of epics) {
    const labels = epic.labels.nodes.map(l => l.name);
    const status = labels.find(l => l.startsWith('status:'))?.slice(7) || 'backlog';
    const children = epic.subIssues.nodes;
    const comments = epic.comments.nodes.map(c => c.body || '');

    if (!children.length) continue;

    const allClosed = children.every(c => c.state === 'CLOSED');
    if (allClosed && status !== 'review' && status !== 'done') {
      findings.push({
        epic: epic.number,
        class: 'A',
        message: `Epic #${epic.number} is status:${status} but all children are CLOSED (requires review/done).`
      });
    }

    for (const child of children) {
      if (child.state === 'CLOSED') {
        if (!childProgressComplete(child, comments)) {
          findings.push({
            epic: epic.number,
            class: 'C',
            child: child.number,
            message: `Epic #${epic.number} comments missing progress update for closed child #${child.number}.`
          });
        }
      }
    }
  }

  const openIssues = JSON.parse(gh(['issue', 'list', '--state', 'open', '--limit', '200', '--json', 'number,body']));
  for (const issue of openIssues) {
    const parentMatch = String(issue.body || '').match(/Parent Epic:\s*#(\d+)/i) || String(issue.body || '').match(/Parent:\s*#(\d+)/i);
    if (parentMatch) {
      const parentNum = parseInt(parentMatch[1], 10);
      const parentEpic = epics.find(e => e.number === parentNum);
      if (parentEpic) {
        const linked = parentEpic.subIssues.nodes.some(c => c.number === issue.number);
        if (!linked) {
          findings.push({
            child: issue.number,
            class: 'B',
            parent: parentNum,
            message: `Child #${issue.number} references Parent Epic #${parentNum} in body but is not natively linked via GraphQL Sub-issues.`
          });
        }
      }
    }
  }

  return findings;
}

if (require.main === module) {
  try {
    const raw = gh(['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner']);
    const [owner, repo] = raw.split('/');
    const findings = lintEpicDrift(owner, repo);
    if (findings.length) { console.error('❌ Ticket Governance Drift Detected:'); findings.forEach(f => console.error(`- [Class ${f.class}] ${f.message}`)); process.exit(1); }
    console.log('✅ Ticket Governance Drift: PASS');
  } catch (err) { console.error('Error:', err.message); process.exit(1); }
}

module.exports = { lintEpicDrift, QUERY, childProgressComplete };
